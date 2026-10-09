/**
 * Doctor profile + SMS template services (clinic-scoped).
 */
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { doctorAttendants, doctors, type Doctor } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { DEFAULT_SMS_TEMPLATE } from "@/lib/sms";
import type { DoctorInput } from "@/lib/validation";
import type { ServiceResult } from "@/lib/serials";

function fail<T>(error: string): ServiceResult<T> {
  return { ok: false, error };
}
function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export interface DoctorWithAssignments extends Doctor {
  attendantNames: string[];
}

export async function listDoctors(
  db: Db,
  clinicId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<DoctorWithAssignments[]> {
  const rows = await db
    .select()
    .from(doctors)
    .where(
      opts.includeInactive
        ? eq(doctors.clinicId, clinicId)
        : and(eq(doctors.clinicId, clinicId), eq(doctors.status, "active")),
    )
    .orderBy(asc(doctors.name));

  const { users } = await import("@/db/schema");
  const attendants = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.clinicId, clinicId));
  const nameById = new Map(attendants.map((u) => [u.id, u.name]));

  const assignRows = await db
    .select({
      doctorId: doctorAttendants.doctorId,
      userId: doctorAttendants.userId,
    })
    .from(doctorAttendants)
    .where(eq(doctorAttendants.clinicId, clinicId));

  const namesByDoctor = new Map<string, string[]>();
  for (const a of assignRows) {
    const list = namesByDoctor.get(a.doctorId) ?? [];
    const name = nameById.get(a.userId);
    if (name) list.push(name);
    namesByDoctor.set(a.doctorId, list);
  }

  return rows.map((d) => ({
    ...d,
    attendantNames: namesByDoctor.get(d.id) ?? [],
  }));
}

export async function getDoctor(
  db: Db,
  clinicId: string,
  doctorId: string,
): Promise<Doctor | null> {
  const rows = await db
    .select()
    .from(doctors)
    .where(and(eq(doctors.id, doctorId), eq(doctors.clinicId, clinicId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createDoctor(
  db: Db,
  actor: SessionUser,
  input: DoctorInput,
): Promise<ServiceResult<Doctor>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  try {
    const [doctor] = await db
      .insert(doctors)
      .values({
        clinicId: actor.clinicId,
        name: input.name.trim(),
        specialty: input.specialty.trim(),
        phone: input.phone.trim(),
        instructions: input.instructions.trim(),
        smsTemplate: input.smsTemplate?.trim() || null,
        status: input.status,
      })
      .returning();

    await writeAudit(db, {
      actor,
      entityType: "doctor",
      entityId: doctor.id,
      action: "create_doctor",
      after: { name: doctor.name, status: doctor.status },
    });
    return ok(doctor);
  } catch (e) {
    console.error("createDoctor failed:", e);
    return fail("Could not create the doctor.");
  }
}

export async function updateDoctor(
  db: Db,
  actor: SessionUser,
  doctorId: string,
  input: DoctorInput,
): Promise<ServiceResult<Doctor>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  const existing = await getDoctor(db, actor.clinicId, doctorId);
  if (!existing) return fail("Doctor not found.");

  try {
    const [updated] = await db
      .update(doctors)
      .set({
        name: input.name.trim(),
        specialty: input.specialty.trim(),
        phone: input.phone.trim(),
        instructions: input.instructions.trim(),
        smsTemplate: input.smsTemplate?.trim() || null,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, doctorId))
      .returning();

    await writeAudit(db, {
      actor,
      entityType: "doctor",
      entityId: doctorId,
      action: "update_doctor",
      before: { name: existing.name, status: existing.status },
      after: { name: updated.name, status: updated.status },
    });
    return ok(updated);
  } catch (e) {
    console.error("updateDoctor failed:", e);
    return fail("Could not update the doctor.");
  }
}

/** Effective SMS template for a doctor (custom or built-in default). */
export function effectiveSmsTemplate(doctor: {
  smsTemplate: string | null;
}): string {
  return doctor.smsTemplate?.trim() || DEFAULT_SMS_TEMPLATE;
}

export async function saveSmsTemplate(
  db: Db,
  actor: SessionUser,
  doctorId: string,
  template: string,
): Promise<ServiceResult<Doctor>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  const existing = await getDoctor(db, actor.clinicId, doctorId);
  if (!existing) return fail("Doctor not found.");

  const value = template.trim() || null;
  const [updated] = await db
    .update(doctors)
    .set({ smsTemplate: value, updatedAt: new Date() })
    .where(eq(doctors.id, doctorId))
    .returning();

  await writeAudit(db, {
    actor,
    entityType: "doctor",
    entityId: doctorId,
    action: "save_sms_template",
    before: { sms_template: existing.smsTemplate },
    after: { sms_template: value },
  });
  return ok(updated);
}
