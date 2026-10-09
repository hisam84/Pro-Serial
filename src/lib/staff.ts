/**
 * Staff (attendant) management + own-account services.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { doctorAttendants, doctors, users, type User } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import type { ServiceResult } from "@/lib/serials";

function fail<T>(error: string, fieldErrors?: Record<string, string>): ServiceResult<T> {
  return { ok: false, error, fieldErrors };
}
function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export interface AttendantListItem {
  id: string;
  name: string;
  username: string;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  doctorIds: string[];
  doctorNames: string[];
  createdAt: Date;
}

export async function listAttendants(
  db: Db,
  clinicId: string,
): Promise<AttendantListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.clinicId, clinicId), eq(users.role, "attendant")))
    .orderBy(asc(users.name));

  const assignments = await db
    .select({
      userId: doctorAttendants.userId,
      doctorId: doctorAttendants.doctorId,
      doctorName: doctors.name,
    })
    .from(doctorAttendants)
    .innerJoin(doctors, eq(doctorAttendants.doctorId, doctors.id))
    .where(eq(doctorAttendants.clinicId, clinicId));

  return rows.map((u) => {
    const mine = assignments.filter((a) => a.userId === u.id);
    return {
      ...u,
      doctorIds: mine.map((a) => a.doctorId),
      doctorNames: mine.map((a) => a.doctorName),
    };
  });
}

export async function createAttendant(
  db: Db,
  actor: SessionUser,
  input: {
    name: string;
    username: string;
    password: string;
    doctorIds: string[];
  },
): Promise<ServiceResult<{ userId: string; username: string }>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  const username = input.username.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing.length > 0) {
    return fail("This username is already taken.", {
      username: "This username is already taken.",
    });
  }

  const doctorIds = await filterClinicDoctors(db, actor.clinicId, input.doctorIds);
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          clinicId: actor.clinicId,
          name: input.name.trim(),
          username,
          passwordHash,
          role: "attendant",
          status: "active",
          mustChangePassword: false,
        })
        .returning();

      if (doctorIds.length > 0) {
        await tx.insert(doctorAttendants).values(
          doctorIds.map((doctorId) => ({
            clinicId: actor.clinicId as string,
            doctorId,
            userId: user.id,
          })),
        );
      }

      await writeAudit(tx, {
        actor,
        entityType: "user",
        entityId: user.id,
        action: "create_attendant",
        after: { name: user.name, username: user.username, doctorIds },
      });

      return { userId: user.id, username: user.username };
    });
    return ok(result);
  } catch (e) {
    console.error("createAttendant failed:", e);
    return fail("Could not create the attendant.");
  }
}

export async function updateAttendant(
  db: Db,
  actor: SessionUser,
  input: {
    userId: string;
    name: string;
    status: "active" | "disabled";
    doctorIds: string[];
  },
): Promise<ServiceResult<{ userId: string }>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  const existing = await getAttendant(db, actor.clinicId, input.userId);
  if (!existing) return fail("User not found.");

  const doctorIds = await filterClinicDoctors(db, actor.clinicId, input.doctorIds);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          name: input.name.trim(),
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      await tx
        .delete(doctorAttendants)
        .where(eq(doctorAttendants.userId, input.userId));
      if (doctorIds.length > 0) {
        await tx.insert(doctorAttendants).values(
          doctorIds.map((doctorId) => ({
            clinicId: actor.clinicId as string,
            doctorId,
            userId: input.userId,
          })),
        );
      }

      await writeAudit(tx, {
        actor,
        entityType: "user",
        entityId: input.userId,
        action: "update_attendant",
        before: { name: existing.name, status: existing.status },
        after: { name: input.name, status: input.status, doctorIds },
      });
    });
    return ok({ userId: input.userId });
  } catch (e) {
    console.error("updateAttendant failed:", e);
    return fail("Could not update the user.");
  }
}

export async function getAttendant(
  db: Db,
  clinicId: string,
  userId: string,
): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.clinicId, clinicId),
        eq(users.role, "attendant"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Admin-initiated reset: temporary password shown once + forced change. */
export async function resetAttendantPassword(
  db: Db,
  actor: SessionUser,
  userId: string,
): Promise<ServiceResult<{ username: string; tempPassword: string }>> {
  if (actor.role !== "clinic_admin" || !actor.clinicId) {
    return fail("You do not have permission.");
  }
  const user = await getAttendant(db, actor.clinicId, userId);
  if (!user) return fail("User not found.");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await writeAudit(db, {
    actor,
    entityType: "user",
    entityId: user.id,
    action: "reset_password",
    after: { username: user.username },
  });

  return ok({ username: user.username, tempPassword });
}

/** Self-service password change (any role). */
export async function changeOwnPassword(
  db: Db,
  actor: SessionUser,
  input: { currentPassword: string; newPassword: string },
): Promise<ServiceResult<{ done: true }>> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    return fail("Current password is incorrect.", {
      currentPassword: "Current password is incorrect.",
    });
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await writeAudit(db, {
    actor,
    entityType: "user",
    entityId: user.id,
    action: "change_own_password",
    after: { username: user.username },
  });

  return ok({ done: true });
}

/** Keeps doctor assignments inside the actor's clinic (tenant isolation). */
async function filterClinicDoctors(
  db: Db,
  clinicId: string,
  doctorIds: string[],
): Promise<string[]> {
  if (doctorIds.length === 0) return [];
  const rows = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinicId), inArray(doctors.id, doctorIds)));
  return rows.map((r) => r.id);
}
