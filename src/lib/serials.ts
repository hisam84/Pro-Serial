/**
 * Serial / appointment domain services.
 *
 * Business rules enforced here (and mirrored in tests):
 * - Serial numbers are allocated per clinic + doctor + date + patient type.
 * - New and old patients have fully separate sequences.
 * - Reference entries never consume a serial number.
 * - Allocation is transaction-safe (atomic counter upsert) — concurrent
 *   creates can never receive the same number.
 * - Cancelled serials keep their number forever (never reused).
 * - Editing patient details never changes the serial number unless an
 *   authorized user explicitly requests a change.
 * - All reads/writes are scoped to the actor's clinic and (for attendants)
 *   assigned doctors — IDOR-safe.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  appointments,
  doctors,
  patients,
  users,
  serialCounters,
  type Appointment,
  type Patient,
  type PatientType,
} from "@/db/schema";
import { writeAudit, type AuditActor } from "@/lib/audit";
import { accessibleDoctorIds, canAccessDoctor, isClinicAdmin } from "@/lib/rbac";
import { normalizeMobile } from "@/lib/mobile";
import { rowsOf } from "@/db/migrate";

export interface ServiceResult<T> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

function fail<T>(error: string, fieldErrors?: Record<string, string>): ServiceResult<T> {
  return { ok: false, error, fieldErrors };
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export interface SerialScope {
  clinicId: string;
  doctorId: string;
  appointmentDate: string;
  patientType: PatientType;
}

/* ── Serial allocation ─────────────────────────────────────────────── */

/**
 * Atomically allocates the next serial number for a scope.
 * A single INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement —
 * concurrent callers are serialized by the row lock and always get
 * distinct numbers.
 */
export async function allocateSerialNumber(
  db: Db,
  scope: SerialScope,
  tx: Db = db,
): Promise<number> {
  const rows = rowsOf<{ last_number: number }>(
    await tx.execute(sql`
      INSERT INTO serial_counters (clinic_id, doctor_id, appointment_date, patient_type, last_number)
      VALUES (${scope.clinicId}, ${scope.doctorId}, ${scope.appointmentDate}, ${scope.patientType}, 1)
      ON CONFLICT (clinic_id, doctor_id, appointment_date, patient_type)
      DO UPDATE SET last_number = serial_counters.last_number + 1, updated_at = now()
      RETURNING last_number
    `),
  );
  const number = rows[0]?.last_number;
  if (typeof number !== "number") {
    throw new Error("serial allocation failed");
  }
  return number;
}

/** Current allocated high-water mark for a scope (0 when never used). */
export async function currentCounter(
  db: Db,
  scope: SerialScope,
  tx: Db = db,
): Promise<number> {
  const rows = rowsOf<{ last_number: number }>(
    await tx.execute(sql`
      SELECT last_number FROM serial_counters
      WHERE clinic_id = ${scope.clinicId}
        AND doctor_id = ${scope.doctorId}
        AND appointment_date = ${scope.appointmentDate}
        AND patient_type = ${scope.patientType}
    `),
  );
  return rows[0]?.last_number ?? 0;
}

/* ── Patient identity ──────────────────────────────────────────────── */

/**
 * Finds a clinic patient by normalized mobile for the "existing patient
 * found" suggestion. Read-only — never auto-fills or overwrites data.
 */
export async function findPatientsByMobile(
  db: Db,
  clinicId: string,
  rawMobile: string,
): Promise<Patient[]> {
  const { normalized } = normalizeMobile(rawMobile);
  if (!normalized) return [];
  return db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        eq(patients.mobileNormalized, normalized),
      ),
    )
    .limit(5);
}

/**
 * Reuses an existing identity only when mobile AND name match exactly;
 * otherwise a new patient record is created. Never overwrites existing data.
 */
async function findOrCreatePatient(
  db: Db,
  params: {
    clinicId: string;
    name: string;
    address: string;
    mobile: string;
  },
): Promise<Patient> {
  const mobile = normalizeMobile(params.mobile);
  if (!mobile.ok) {
    throw new Error(mobile.error ?? "invalid mobile");
  }
  const nameKey = params.name.trim().toLowerCase();
  const existing = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, params.clinicId),
        eq(patients.mobileNormalized, mobile.normalized),
      ),
    )
    .limit(10);

  const match = existing.find(
    (p) => p.name.trim().toLowerCase() === nameKey,
  );
  if (match) return match;

  const [created] = await db
    .insert(patients)
    .values({
      clinicId: params.clinicId,
      name: params.name.trim(),
      address: params.address.trim(),
      mobileNormalized: mobile.normalized,
      mobileDisplay: mobile.display,
    })
    .returning();
  return created;
}

/* ── Doctor / clinic authorization ─────────────────────────────────── */

async function assertDoctorAccess(
  db: Db,
  actor: AuditActor,
  doctorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor.clinicId) return { ok: false, error: "You do not have permission." };
  const allowed = await canAccessDoctor(db, actor, doctorId);
  if (!allowed) {
    return {
      ok: false,
      error: "You cannot manage serials for this doctor.",
    };
  }
  return { ok: true };
}

/* ── Create ────────────────────────────────────────────────────────── */

export interface CreateSerialParams {
  actor: AuditActor;
  doctorId: string;
  appointmentDate: string;
  patientType: PatientType;
  patientName: string;
  patientMobile: string;
  patientAddress: string;
  isReference: boolean;
  referenceDetails: string;
  notes: string;
  /** Clinic setting — when true, the address is required. */
  requireAddress: boolean;
}

export interface CreatedSerial {
  appointment: Appointment;
  patient: Patient;
  serialNumber: number | null;
}

export async function createSerialEntry(
  db: Db,
  params: CreateSerialParams,
): Promise<ServiceResult<CreatedSerial>> {
  const access = await assertDoctorAccess(db, params.actor, params.doctorId);
  if (!access.ok) return fail(access.error);

  const mobile = normalizeMobile(params.patientMobile);
  if (!mobile.ok) return fail(mobile.error ?? "Mobile number is invalid.", {
    patientMobile: mobile.error ?? "Mobile number is invalid.",
  });

  if (params.requireAddress && !params.isReference && !params.patientAddress.trim()) {
    return fail("Address is required.", { patientAddress: "Address is required." });
  }

  if (params.isReference && !params.referenceDetails.trim()) {
    return fail("Reference details are required.", {
      referenceDetails: "Reference details are required.",
    });
  }

  const scope: SerialScope = {
    clinicId: params.actor.clinicId!,
    doctorId: params.doctorId,
    appointmentDate: params.appointmentDate,
    patientType: params.patientType,
  };

  const MAX_ATTEMPTS = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await db.transaction(async (tx) => {
        const patient = await findOrCreatePatient(tx, {
          clinicId: scope.clinicId,
          name: params.patientName,
          address: params.patientAddress,
          mobile: params.patientMobile,
        });

        // References never consume a serial number.
        let serialNumber: number | null = null;
        if (!params.isReference) {
          serialNumber = await allocateSerialNumber(tx, scope);
        }

        const [appointment] = await tx
          .insert(appointments)
          .values({
            clinicId: scope.clinicId,
            doctorId: scope.doctorId,
            patientId: patient.id,
            appointmentDate: scope.appointmentDate,
            patientType: scope.patientType,
            serialNumber,
            isReference: params.isReference,
            referenceDetails: params.isReference
              ? params.referenceDetails.trim()
              : null,
            status: "active",
            notes: params.notes.trim(),
            createdBy: params.actor.id,
            updatedBy: params.actor.id,
          })
          .returning();

        await writeAudit(tx, {
          actor: params.actor,
          entityType: "appointment",
          entityId: appointment.id,
          action: params.isReference ? "create_reference" : "create_serial",
          after: {
            serial_number: serialNumber,
            patient_type: params.patientType,
            appointment_date: params.appointmentDate,
            doctor_id: params.doctorId,
            patient_name: patient.name,
          },
        });

        return { appointment, patient, serialNumber };
      });
      return ok(result);
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      // Unique violation on the serial index → counter drifted; retry.
      if (!/23505|duplicate key|unique/i.test(message)) break;
    }
  }

  console.error("createSerialEntry failed:", lastError);
  return fail("Could not save the serial. Please try again.");
}

/* ── Read (scoped) ─────────────────────────────────────────────────── */

export interface SerialListFilters {
  date?: string;
  from?: string;
  to?: string;
  doctorId?: string;
  patientType?: PatientType | "";
  status?: "active" | "cancelled" | "";
  includeReferences?: boolean;
}

export interface SerialRow {
  id: string;
  appointmentDate: string;
  patientType: PatientType;
  serialNumber: number | null;
  isReference: boolean;
  referenceDetails: string | null;
  status: "active" | "cancelled";
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  patientId: string;
  patientName: string;
  patientMobile: string;
  patientMobileDisplay: string;
  patientAddress: string;
  doctorId: string;
  doctorName: string;
  cancelledByName: string | null;
}

const serialSelect = {
  id: appointments.id,
  appointmentDate: appointments.appointmentDate,
  patientType: appointments.patientType,
  serialNumber: appointments.serialNumber,
  isReference: appointments.isReference,
  referenceDetails: appointments.referenceDetails,
  status: appointments.status,
  notes: appointments.notes,
  createdAt: appointments.createdAt,
  updatedAt: appointments.updatedAt,
  cancelledAt: appointments.cancelledAt,
  cancelReason: appointments.cancelReason,
  patientId: patients.id,
  patientName: patients.name,
  patientMobile: patients.mobileNormalized,
  patientMobileDisplay: patients.mobileDisplay,
  patientAddress: patients.address,
  doctorId: doctors.id,
  doctorName: doctors.name,
  cancelledByName: sql<string | null>`COALESCE(${users.name}, '')`,
};

/**
 * Lists serials visible to `actor`, ordered: references first, then regular
 * serials by serial number.
 */
export async function listSerials(
  db: Db,
  actor: AuditActor,
  filters: SerialListFilters = {},
): Promise<SerialRow[]> {
  if (!actor.clinicId) return [];

  const allowedIds = await accessibleDoctorIds(db, actor);
  if (allowedIds.length === 0) return [];

  const conditions = [
    eq(appointments.clinicId, actor.clinicId),
    inArray(appointments.doctorId, allowedIds),
  ];
  if (filters.date) conditions.push(eq(appointments.appointmentDate, filters.date));
  if (filters.from) conditions.push(sql`${appointments.appointmentDate} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${appointments.appointmentDate} <= ${filters.to}`);
  if (filters.doctorId) conditions.push(eq(appointments.doctorId, filters.doctorId));
  if (filters.patientType) conditions.push(eq(appointments.patientType, filters.patientType));
  if (filters.status) conditions.push(eq(appointments.status, filters.status));
  if (filters.includeReferences === false) {
    conditions.push(eq(appointments.isReference, false));
  }

  const rows = await db
    .select(serialSelect)
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(users, eq(appointments.cancelledBy, users.id))
    .where(and(...conditions))
    .orderBy(
      desc(appointments.isReference),
      asc(appointments.serialNumber),
      asc(appointments.createdAt),
    );

  return rows.map((r) => ({
    ...r,
    cancelledByName: r.cancelledByName || null,
  }));
}

/** Single appointment, scoped to the actor (IDOR-safe). */
export async function getSerialForActor(
  db: Db,
  actor: AuditActor,
  appointmentId: string,
): Promise<SerialRow | null> {
  const rows = await listSerialsByIds(db, actor, [appointmentId]);
  return rows[0] ?? null;
}

export async function listSerialsByIds(
  db: Db,
  actor: AuditActor,
  ids: string[],
): Promise<SerialRow[]> {
  if (!actor.clinicId || ids.length === 0) return [];
  const allowedIds = await accessibleDoctorIds(db, actor);

  const rows = await db
    .select(serialSelect)
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(users, eq(appointments.cancelledBy, users.id))
    .where(
      and(
        eq(appointments.clinicId, actor.clinicId),
        inArray(appointments.id, ids),
        inArray(appointments.doctorId, allowedIds),
      ),
    );

  return rows.map((r) => ({ ...r, cancelledByName: r.cancelledByName || null }));
}

/* ── Update ────────────────────────────────────────────────────────── */

export interface UpdateSerialParams {
  actor: AuditActor;
  appointmentId: string;
  patientName: string;
  patientMobile: string;
  patientAddress: string;
  referenceDetails: string;
  notes: string;
}

/**
 * Updates patient/entry details. The serial number is NEVER touched here —
 * use changeSerialNumber for that.
 */
export async function updateSerialEntry(
  db: Db,
  params: UpdateSerialParams,
): Promise<ServiceResult<SerialRow>> {
  const existing = await getSerialForActor(db, params.actor, params.appointmentId);
  if (!existing) return fail("Serial not found or you do not have permission.");

  const mobile = normalizeMobile(params.patientMobile);
  if (!mobile.ok) {
    return fail(mobile.error ?? "Mobile number is invalid.", {
      patientMobile: mobile.error ?? "Mobile number is invalid.",
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(patients)
        .set({
          name: params.patientName.trim(),
          address: params.patientAddress.trim(),
          mobileNormalized: mobile.normalized,
          mobileDisplay: mobile.display,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, existing.patientId));

      await tx
        .update(appointments)
        .set({
          notes: params.notes.trim(),
          referenceDetails: existing.isReference
            ? params.referenceDetails.trim()
            : null,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, params.appointmentId));

      await writeAudit(tx, {
        actor: params.actor,
        entityType: "appointment",
        entityId: params.appointmentId,
        action: "update_serial",
        before: {
          patient_name: existing.patientName,
          patient_mobile: existing.patientMobileDisplay,
          notes: existing.notes,
        },
        after: {
          patient_name: params.patientName,
          patient_mobile: mobile.display,
          notes: params.notes,
        },
      });
    });
  } catch (e) {
    console.error("updateSerialEntry failed:", e);
    return fail("Could not update the serial.");
  }

  const updated = await getSerialForActor(db, params.actor, params.appointmentId);
  return updated ? ok(updated) : fail("Could not update the serial.");
}

/* ── Cancel ────────────────────────────────────────────────────────── */

export async function cancelSerialEntry(
  db: Db,
  params: {
    actor: AuditActor;
    appointmentId: string;
    reason: string;
  },
): Promise<ServiceResult<SerialRow>> {
  const existing = await getSerialForActor(db, params.actor, params.appointmentId);
  if (!existing) return fail("Serial not found or you do not have permission.");
  if (existing.status === "cancelled") return fail("This serial is already cancelled.");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledBy: params.actor.id,
          cancelledAt: new Date(),
          cancelReason: params.reason.trim() || null,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, params.appointmentId));

      await writeAudit(tx, {
        actor: params.actor,
        entityType: "appointment",
        entityId: params.appointmentId,
        action: "cancel_serial",
        before: { status: "active", serial_number: existing.serialNumber },
        after: { status: "cancelled", reason: params.reason.trim() },
      });
    });
  } catch (e) {
    console.error("cancelSerialEntry failed:", e);
    return fail("Could not cancel the serial.");
  }

  const updated = await getSerialForActor(db, params.actor, params.appointmentId);
  return updated ? ok(updated) : fail("Could not cancel the serial.");
}

/* ── Manual serial number change ───────────────────────────────────── */

export async function changeSerialNumber(
  db: Db,
  params: {
    actor: AuditActor;
    appointmentId: string;
    serialNumber: number;
  },
): Promise<ServiceResult<SerialRow>> {
  const existing = await getSerialForActor(db, params.actor, params.appointmentId);
  if (!existing) return fail("Serial not found or you do not have permission.");
  if (existing.isReference) {
    return fail("Reference entries have no serial number.");
  }
  if (existing.status === "cancelled") {
    return fail("A cancelled serial number cannot be changed.");
  }
  if (existing.serialNumber === params.serialNumber) {
    return fail("The new serial number is the same as the current one.");
  }
  if (params.actor.role !== "clinic_admin") {
    // Attendants cannot reorder serials — only clinic admins.
    return fail("Only clinic admins can change serial numbers.");
  }

  const scope: SerialScope = {
    clinicId: params.actor.clinicId as string,
    doctorId: existing.doctorId,
    appointmentDate: existing.appointmentDate,
    patientType: existing.patientType,
  };

  try {
    await db.transaction(async (tx) => {
      // Lock/refresh the counter so future allocations never collide.
      await tx.execute(sql`
        INSERT INTO serial_counters (clinic_id, doctor_id, appointment_date, patient_type, last_number)
        VALUES (${scope.clinicId}, ${scope.doctorId}, ${scope.appointmentDate}, ${scope.patientType}, ${params.serialNumber})
        ON CONFLICT (clinic_id, doctor_id, appointment_date, patient_type)
        DO UPDATE SET last_number = GREATEST(serial_counters.last_number, ${params.serialNumber}), updated_at = now()
      `);

      // Conflict check against ALL non-reference serials (including
      // cancelled ones — numbers are never reused).
      const conflicts = rowsOf<{ id: string }>(
        await tx.execute(sql`
          SELECT id FROM appointments
          WHERE clinic_id = ${scope.clinicId}
            AND doctor_id = ${scope.doctorId}
            AND appointment_date = ${scope.appointmentDate}
            AND patient_type = ${scope.patientType}
            AND is_reference = false
            AND serial_number = ${params.serialNumber}
            AND id <> ${params.appointmentId}
        `),
      );
      if (conflicts.length > 0) {
        throw new DuplicateSerialError();
      }

      await tx
        .update(appointments)
        .set({
          serialNumber: params.serialNumber,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, params.appointmentId));

      await writeAudit(tx, {
        actor: params.actor,
        entityType: "appointment",
        entityId: params.appointmentId,
        action: "change_serial_number",
        before: { serial_number: existing.serialNumber },
        after: { serial_number: params.serialNumber },
      });
    });
  } catch (e) {
    if (e instanceof DuplicateSerialError) {
      return fail(
        `Number ${params.serialNumber} is already in use — choose another.`,
        { serialNumber: "This number is already in use." },
      );
    }
    console.error("changeSerialNumber failed:", e);
    return fail("Could not change the serial number.");
  }

  const updated = await getSerialForActor(db, params.actor, params.appointmentId);
  return updated ? ok(updated) : fail("Could not change the serial number.");
}

/** Moves a serial one active position within its doctor/date/patient queue. */
export async function moveSerialNumber(
  db: Db,
  params: {
    actor: AuditActor;
    appointmentId: string;
    direction: "up" | "down";
  },
): Promise<ServiceResult<SerialRow>> {
  if (!isClinicAdmin(params.actor)) {
    return fail("Only clinic admins can change serial order.");
  }
  const existing = await getSerialForActor(db, params.actor, params.appointmentId);
  if (!existing) return fail("Serial not found or you do not have permission.");
  if (existing.isReference || existing.serialNumber == null) {
    return fail("Reference entries have no serial number.");
  }
  if (existing.status === "cancelled") {
    return fail("A cancelled serial number cannot be moved.");
  }

  const scope: SerialScope = {
    clinicId: params.actor.clinicId as string,
    doctorId: existing.doctorId,
    appointmentDate: existing.appointmentDate,
    patientType: existing.patientType,
  };

  try {
    await db.transaction(async (tx) => {
      const counterRows = rowsOf<{ last_number: number }>(await tx.execute(sql`
        INSERT INTO serial_counters (clinic_id, doctor_id, appointment_date, patient_type, last_number)
        VALUES (${scope.clinicId}, ${scope.doctorId}, ${scope.appointmentDate}, ${scope.patientType}, ${existing.serialNumber})
        ON CONFLICT (clinic_id, doctor_id, appointment_date, patient_type)
        DO UPDATE SET last_number = GREATEST(serial_counters.last_number, ${existing.serialNumber}), updated_at = now()
        RETURNING last_number
      `));

      const lockedRows = rowsOf<{
        id: string;
        serial_number: number;
        status: string;
      }>(
        await tx.execute(sql`
          SELECT id, serial_number, status
          FROM appointments
          WHERE clinic_id = ${scope.clinicId}
            AND doctor_id = ${scope.doctorId}
            AND appointment_date = ${scope.appointmentDate}
            AND patient_type = ${scope.patientType}
            AND is_reference = false
            AND serial_number IS NOT NULL
          ORDER BY serial_number ASC
          FOR UPDATE
        `),
      );
      const activeRows = lockedRows.filter((row) => row.status === "active");
      const currentIndex = activeRows.findIndex(
        (row) => row.id === params.appointmentId,
      );
      const neighborIndex =
        params.direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const neighbor = activeRows[neighborIndex];
      if (currentIndex < 0) {
        throw new Error("The serial is no longer active.");
      }
      if (!neighbor) {
        throw new SerialMoveBoundaryError();
      }

      const current = activeRows[currentIndex];
      const maximumNumber = lockedRows.reduce(
        (max, row) => Math.max(max, row.serial_number),
        counterRows[0]?.last_number ?? 0,
      );
      if (maximumNumber >= 2147483647) {
        throw new Error("Could not find a temporary serial number.");
      }
      const temporaryNumber = maximumNumber + 1;

      await tx
        .update(appointments)
        .set({
          serialNumber: temporaryNumber,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, current.id));
      await tx
        .update(appointments)
        .set({
          serialNumber: current.serial_number,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, neighbor.id));
      await tx
        .update(appointments)
        .set({
          serialNumber: neighbor.serial_number,
          updatedBy: params.actor.id,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, current.id));

      await writeAudit(tx, {
        actor: params.actor,
        entityType: "appointment",
        entityId: current.id,
        action: "reorder_serial",
        before: { serial_number: current.serial_number },
        after: { serial_number: neighbor.serial_number },
      });
      await writeAudit(tx, {
        actor: params.actor,
        entityType: "appointment",
        entityId: neighbor.id,
        action: "reorder_serial",
        before: { serial_number: neighbor.serial_number },
        after: { serial_number: current.serial_number },
      });
    });
  } catch (e) {
    if (e instanceof SerialMoveBoundaryError) {
      return fail(
        params.direction === "up"
          ? "This serial is already first in the queue."
          : "This serial is already last in the queue.",
      );
    }
    console.error("moveSerialNumber failed:", e);
    return fail("Could not change the serial order.");
  }

  const updated = await getSerialForActor(db, params.actor, params.appointmentId);
  return updated ? ok(updated) : fail("Could not change the serial order.");
}

class SerialMoveBoundaryError extends Error {
  constructor() {
    super("serial is already at the queue boundary");
    this.name = "SerialMoveBoundaryError";
  }
}

class DuplicateSerialError extends Error {
  constructor() {
    super("duplicate serial");
    this.name = "DuplicateSerialError";
  }
}

/* ── Counts (for the serial screen chips) ──────────────────────────── */

export interface SerialCounts {
  activeNew: number;
  activeOld: number;
  activeReference: number;
  cancelled: number;
  activeTotal: number;
}

export function summarizeCounts(rows: SerialRow[]): SerialCounts {
  const counts: SerialCounts = {
    activeNew: 0,
    activeOld: 0,
    activeReference: 0,
    cancelled: 0,
    activeTotal: 0,
  };
  for (const r of rows) {
    if (r.status === "cancelled") {
      counts.cancelled += 1;
      continue;
    }
    if (r.isReference) counts.activeReference += 1;
    else if (r.patientType === "new") counts.activeNew += 1;
    else counts.activeOld += 1;
    counts.activeTotal += 1;
  }
  return counts;
}

/* ── Doctor list for selectors (role-aware) ────────────────────────── */

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
  status: string;
}

export async function listDoctorsForActor(
  db: Db,
  actor: AuditActor,
): Promise<DoctorOption[]> {
  if (!actor.clinicId) return [];
  const allowedIds = await accessibleDoctorIds(db, actor);
  if (allowedIds.length === 0) return [];
  const rows = await db
    .select({
      id: doctors.id,
      name: doctors.name,
      specialty: doctors.specialty,
      status: doctors.status,
    })
    .from(doctors)
    .where(and(eq(doctors.clinicId, actor.clinicId), inArray(doctors.id, allowedIds)))
    .orderBy(asc(doctors.name));
  return rows;
}
