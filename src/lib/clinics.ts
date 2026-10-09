/**
 * Clinic administration services (Super Admin + clinic profile).
 */
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  appointments,
  clinics,
  doctors,
  users,
  type Clinic,
  type ClinicStatus,
} from "@/db/schema";
import { writeAudit, type AuditActor } from "@/lib/audit";
import {
  generateTempPassword,
  hashPassword,
  type SessionUser,
} from "@/lib/auth";
import type { ClinicInput } from "@/lib/validation";
import type { ServiceResult } from "@/lib/serials";

function fail<T>(error: string): ServiceResult<T> {
  return { ok: false, error };
}
function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export interface ClinicListItem extends Clinic {
  adminName: string | null;
  adminUsername: string | null;
  doctorCount: number;
  attendantCount: number;
}

export async function listClinics(
  db: Db,
  filters: { search?: string; status?: ClinicStatus | "" } = {},
): Promise<ClinicListItem[]> {
  const conditions = [];
  if (filters.status) conditions.push(eq(clinics.status, filters.status));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(clinics.name, q), ilike(clinics.phone, q)));
  }

  const rows = await db
    .select({
      clinic: clinics,
      adminName: users.name,
      adminUsername: users.username,
      doctorCount: sql<number>`(
        SELECT count(*) FROM doctors d WHERE d.clinic_id = ${clinics.id}
      )`,
      attendantCount: sql<number>`(
        SELECT count(*) FROM users u
        WHERE u.clinic_id = ${clinics.id} AND u.role = 'attendant'
      )`,
    })
    .from(clinics)
    .leftJoin(
      users,
      and(eq(users.clinicId, clinics.id), eq(users.role, "clinic_admin")),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(clinics.createdAt));

  return rows.map((r) => ({
    ...r.clinic,
    adminName: r.adminName ?? null,
    adminUsername: r.adminUsername ?? null,
    doctorCount: Number(r.doctorCount ?? 0),
    attendantCount: Number(r.attendantCount ?? 0),
  }));
}

export async function getClinicById(db: Db, clinicId: string): Promise<Clinic | null> {
  const rows = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  return rows[0] ?? null;
}

export async function getClinicAdmin(
  db: Db,
  clinicId: string,
): Promise<{ id: string; name: string; username: string } | null> {
  const rows = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.clinicId, clinicId), eq(users.role, "clinic_admin")))
    .limit(1);
  return rows[0] ?? null;
}

export async function createClinic(
  db: Db,
  actor: SessionUser,
  input: ClinicInput & {
    adminName: string;
    adminUsername: string;
    adminPassword: string;
  },
): Promise<ServiceResult<{ clinicId: string; adminUsername: string }>> {
  if (actor.role !== "super_admin") {
    return fail("Only a super admin can create clinics.");
  }

  const username = input.adminUsername.trim().toLowerCase();
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingUser.length > 0) {
    return fail("This username is already taken.");
  }

  try {
    const passwordHash = await hashPassword(input.adminPassword);
    const result = await db.transaction(async (tx) => {
      const [clinic] = await tx
        .insert(clinics)
        .values({
          name: input.name.trim(),
          address: input.address.trim(),
          phone: input.phone.trim(),
          timezone: input.timezone.trim() || "Asia/Dhaka",
          requireAddress: input.requireAddress,
          status: "active",
        })
        .returning();

      const [admin] = await tx
        .insert(users)
        .values({
          clinicId: clinic.id,
          name: input.adminName.trim(),
          username,
          passwordHash,
          role: "clinic_admin",
          status: "active",
          mustChangePassword: true,
        })
        .returning();

      await writeAudit(tx, {
        actor,
        entityType: "clinic",
        entityId: clinic.id,
        action: "create_clinic",
        after: { name: clinic.name, admin_username: admin.username },
      });

      return { clinicId: clinic.id, adminUsername: admin.username };
    });
    return ok(result);
  } catch (e) {
    console.error("createClinic failed:", e);
    return fail("Could not create the clinic.");
  }
}

export async function updateClinic(
  db: Db,
  actor: SessionUser,
  clinicId: string,
  input: ClinicInput,
): Promise<ServiceResult<Clinic>> {
  const allowed =
    actor.role === "super_admin" ||
    (actor.role === "clinic_admin" && actor.clinicId === clinicId);
  if (!allowed) return fail("You do not have permission.");

  const existing = await getClinicById(db, clinicId);
  if (!existing) return fail("Clinic not found.");

  try {
    const [updated] = await db
      .update(clinics)
      .set({
        name: input.name.trim(),
        address: input.address.trim(),
        phone: input.phone.trim(),
        timezone: input.timezone.trim() || "Asia/Dhaka",
        requireAddress: input.requireAddress,
        updatedAt: new Date(),
      })
      .where(eq(clinics.id, clinicId))
      .returning();

    await writeAudit(db, {
      actor,
      entityType: "clinic",
      entityId: clinicId,
      action: "update_clinic",
      before: { name: existing.name, phone: existing.phone },
      after: { name: updated.name, phone: updated.phone },
    });
    return ok(updated);
  } catch (e) {
    console.error("updateClinic failed:", e);
    return fail("Could not update the clinic.");
  }
}

export async function setClinicStatus(
  db: Db,
  actor: SessionUser,
  clinicId: string,
  status: ClinicStatus,
): Promise<ServiceResult<Clinic>> {
  if (actor.role !== "super_admin") {
    return fail("Only a super admin can change clinic status.");
  }
  const existing = await getClinicById(db, clinicId);
  if (!existing) return fail("Clinic not found.");

  const [updated] = await db
    .update(clinics)
    .set({ status, updatedAt: new Date() })
    .where(eq(clinics.id, clinicId))
    .returning();

  await writeAudit(db, {
    actor,
    entityType: "clinic",
    entityId: clinicId,
    action: "set_clinic_status",
    before: { status: existing.status },
    after: { status },
  });
  return ok(updated);
}

/**
 * Admin-initiated password reset for a clinic admin: generates a temporary
 * password shown exactly once and forces a change at next login.
 */
export async function resetClinicAdminPassword(
  db: Db,
  actor: SessionUser,
  clinicId: string,
): Promise<ServiceResult<{ username: string; tempPassword: string }>> {
  if (actor.role !== "super_admin") {
    return fail("You do not have permission.");
  }
  const admin = await getClinicAdmin(db, clinicId);
  if (!admin) return fail("This clinic's admin was not found.");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, admin.id));

  await writeAudit(db, {
    actor,
    entityType: "user",
    entityId: admin.id,
    action: "reset_password",
    after: { username: admin.username },
  });

  return ok({ username: admin.username, tempPassword });
}

/** Operational counters only — no patient information. */
export interface ClinicStats {
  doctorCount: number;
  activeDoctorCount: number;
  attendantCount: number;
  activeSerialsToday: number;
  totalAppointments: number;
}

export async function clinicOperationalStats(
  db: Db,
  clinicId: string,
  todayIso: string,
): Promise<ClinicStats> {
  const [doctorAgg] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) FILTER (WHERE ${doctors.status} = 'active')`,
    })
    .from(doctors)
    .where(eq(doctors.clinicId, clinicId));

  const [attendantAgg] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.clinicId, clinicId), eq(users.role, "attendant")));

  const [serialAgg] = await db
    .select({
      today: sql<number>`count(*) FILTER (WHERE ${appointments.appointmentDate} = ${todayIso} AND ${appointments.status} = 'active')`,
      total: sql<number>`count(*)`,
    })
    .from(appointments)
    .where(eq(appointments.clinicId, clinicId));

  return {
    doctorCount: Number(doctorAgg?.total ?? 0),
    activeDoctorCount: Number(doctorAgg?.active ?? 0),
    attendantCount: Number(attendantAgg?.total ?? 0),
    activeSerialsToday: Number(serialAgg?.today ?? 0),
    totalAppointments: Number(serialAgg?.total ?? 0),
  };
}
