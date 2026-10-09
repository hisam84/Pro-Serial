import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { auditLogs, type UserRole } from "@/db/schema";

export interface AuditActor {
  id: string;
  name: string;
  role: UserRole;
  clinicId: string | null;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "token",
  "tokenhash",
  "token_hash",
]);

/** Strips secrets and keeps audit payloads small. */
export function sanitizeAuditData(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export async function writeAudit(
  db: Db,
  params: {
    actor: AuditActor;
    entityType: string;
    entityId: string;
    action: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    clinicId: params.actor.clinicId,
    actorUserId: params.actor.id,
    actorName: params.actor.name,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    beforeData: sanitizeAuditData(params.before),
    afterData: sanitizeAuditData(params.after),
  });
}

export async function listAuditForEntity(
  db: Db,
  entityType: string,
  entityId: string,
) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, entityId))
    .orderBy(auditLogs.createdAt);
}
