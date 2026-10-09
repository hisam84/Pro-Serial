/**
 * Authentication: bcrypt password hashing + database-backed sessions.
 *
 * - Passwords are hashed with bcrypt (cost 10). Plaintext is never stored.
 * - Session tokens are 32-byte random values; only their SHA-256 hash is
 *   stored. Cookies are httpOnly, SameSite=Lax, Secure in production.
 * - Every protected page/action calls requireUser()/requireRole() server-side.
 */
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Db } from "@/db";
import { sessions, users, type User, type UserRole } from "@/db/schema";

export const SESSION_COOKIE = "sp_session";
const DEFAULT_TTL_HOURS = 168; // 7 days

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  clinicId: string | null;
  status: "active" | "disabled";
  mustChangePassword: boolean;
}

/* ── Passwords ─────────────────────────────────────────────────────── */

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/* ── Sessions ──────────────────────────────────────────────────────── */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function ttlHours(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_HOURS;
}

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export async function createSession(db: Db, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours() * 3600_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await import("@/db").then((m) => m.getDb());
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Reads and validates the current session. Returns null when signed out. */
export async function getSessionUser(db: Db): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const user = row.user;
  if (user.status !== "active") return null;

  // Sliding activity stamp (best effort, not a security control).
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.tokenHash, hashToken(token)));

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    clinicId: user.clinicId,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

/* ── Guards (server-side authorization) ────────────────────────────── */

export async function requireUser(db: Db): Promise<SessionUser> {
  const user = await getSessionUser(db);
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  db: Db,
  roles: UserRole[],
): Promise<SessionUser> {
  const user = await requireUser(db);
  if (!roles.includes(user.role)) redirect("/unauthorized");
  return user;
}

/** Super admin only. */
export async function requireSuperAdmin(db: Db): Promise<SessionUser> {
  return requireRole(db, ["super_admin"]);
}

/** Clinic-scoped staff (admin, attendant, doctor). */
export async function requireClinicUser(db: Db): Promise<SessionUser> {
  const user = await requireRole(db, ["clinic_admin", "attendant", "doctor"]);
  if (!user.clinicId) redirect("/unauthorized");
  return user;
}

/** Converts a session user into the AuditActor shape. */
export function toActor(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
  };
}

/** Random temporary password for admin-issued resets (shown exactly once). */
export function generateTempPassword(): string {
  // 4 groups of 4 chars from an unambiguous alphabet.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < 15) out += "-";
  }
  return out;
}

export type { User };
