/**
 * Secure one-time Super Admin creation.
 *
 *   npm run superadmin
 *
 * Reads SUPER_ADMIN_NAME / SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD from
 * the environment, or prompts interactively (password input is hidden when
 * possible). Never ships a default password.
 */
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { closeDb, resolveDb } from "../src/db/index";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateUsername(u: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) {
    return "Username must be 3–32 characters (lowercase letters, numbers, . _ -).";
  }
  return null;
}

function validatePassword(p: string): string | null {
  if (p.length < 8) return "Password must be at least 8 characters.";
  return null;
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SUPERADMIN_SETUP) {
    console.error(
      "For safety, run with ALLOW_SUPERADMIN_SETUP=1 set in the production environment.",
    );
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let name = process.env.SUPER_ADMIN_NAME ?? "";
  let username = normalizeUsername(process.env.SUPER_ADMIN_USERNAME ?? "");
  let password = process.env.SUPER_ADMIN_PASSWORD ?? "";

  try {
    if (!name) name = (await rl.question("Super admin name: ")).trim();
    while (!name) {
      name = (await rl.question("Name cannot be empty. Name: ")).trim();
    }

    if (!username) {
      username = normalizeUsername(await rl.question("Username: "));
    }
    let err = validateUsername(username);
    while (err) {
      console.error(err);
      username = normalizeUsername(await rl.question("Username: "));
      err = validateUsername(username);
    }

    if (!password) {
      password = await rl.question("Password (at least 8 characters): ");
    }
    err = validatePassword(password);
    while (err) {
      console.error(err);
      password = await rl.question("Password: ");
      err = validatePassword(password);
    }
  } finally {
    rl.close();
  }

  const { db } = await resolveDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing.length > 0) {
    console.error(`Username “${username}” is already taken.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      clinicId: null,
      name: name.trim(),
      username,
      passwordHash,
      role: "super_admin",
      status: "active",
      mustChangePassword: false,
    })
    .returning();

  console.log(`✓ Super admin created: ${user.name} (${user.username})`);
  await closeDb();
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
