/**
 * Role-based access control helpers.
 * These express the permission matrix; DB-backed checks (clinic scoping,
 * doctor assignment) live in services and always run on the server.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { doctorAttendants, doctors } from "@/db/schema";
import type { UserRole } from "@/db/schema";

/** Anything that carries identity + role + tenant (SessionUser or AuditActor). */
export interface ActorLike {
  id: string;
  role: UserRole;
  clinicId: string | null;
  name?: string;
}

type SessionUser = ActorLike;

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "super_admin";
}

export function isClinicAdmin(user: SessionUser): boolean {
  return user.role === "clinic_admin";
}

export function isAttendant(user: SessionUser): boolean {
  return user.role === "attendant";
}

export function canManageClinics(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canManageDoctors(user: SessionUser): boolean {
  return isClinicAdmin(user);
}

export function canManageStaff(user: SessionUser): boolean {
  return isClinicAdmin(user);
}

export function canManageClinicSettings(user: SessionUser): boolean {
  return isClinicAdmin(user);
}

export function canManageSmsTemplates(user: SessionUser): boolean {
  return isClinicAdmin(user);
}

/** Who may work with serials at all. */
export function canUseSerials(user: SessionUser): boolean {
  return isClinicAdmin(user) || isAttendant(user);
}

/** Who may view patient reports (super admin is intentionally excluded). */
export function canViewReports(user: SessionUser): boolean {
  return isClinicAdmin(user) || isAttendant(user) || user.role === "doctor";
}

/**
 * Doctor IDs the user may manage serials for.
 * - Clinic admin: all doctors of their clinic.
 * - Attendant: only explicitly assigned doctors.
 */
export async function accessibleDoctorIds(
  db: Db,
  user: ActorLike,
): Promise<string[]> {
  if (!user.clinicId) return [];
  if (isClinicAdmin(user)) {
    const rows = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.clinicId, user.clinicId));
    return rows.map((r) => r.id);
  }
  if (isAttendant(user)) {
    const rows = await db
      .select({ doctorId: doctorAttendants.doctorId })
      .from(doctorAttendants)
      .where(eq(doctorAttendants.userId, user.id));
    return rows.map((r) => r.doctorId);
  }
  return [];
}

/** True when `doctorId` is inside the user's permitted doctor set. */
export async function canAccessDoctor(
  db: Db,
  user: ActorLike,
  doctorId: string,
): Promise<boolean> {
  if (!user.clinicId) return false;
  if (isClinicAdmin(user)) {
    const rows = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(and(eq(doctors.id, doctorId), eq(doctors.clinicId, user.clinicId)))
      .limit(1);
    return rows[0]?.id === doctorId;
  }
  if (isAttendant(user)) {
    const rows = await db
      .select({ doctorId: doctorAttendants.doctorId })
      .from(doctorAttendants)
      .where(eq(doctorAttendants.userId, user.id));
    return rows.some((r) => r.doctorId === doctorId);
  }
  return false;
}

/** Filters a doctor list down to the user's permitted set. */
export async function filterAccessibleDoctors<T extends { id: string }>(
  db: Db,
  user: ActorLike,
  doctorRows: T[],
): Promise<T[]> {
  const allowed = new Set(await accessibleDoctorIds(db, user));
  return doctorRows.filter((d) => allowed.has(d.id));
}

export { inArray };
