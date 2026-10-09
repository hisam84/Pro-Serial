/**
 * Development utility: creates a session for a user and prints a Cookie
 * header value for curl-based smoke testing.
 *
 *   npx tsx scripts/make-session.ts <username>
 *
 * Never use with production data.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDb, resolveDb } from "../src/db/index";
import { sessions, users } from "../src/db/schema";
import { SESSION_COOKIE } from "../src/lib/auth";

async function main() {
  const username = (process.argv[2] ?? "").trim().toLowerCase();
  if (!username) {
    console.error("Usage: npx tsx scripts/make-session.ts <username>");
    process.exit(1);
  }

  const { db } = await resolveDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 3600_000),
  });

  console.log(`${SESSION_COOKIE}=${token}`);
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
