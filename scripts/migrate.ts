/**
 * Applies SQL migrations to the configured database.
 *
 *   npm run db:migrate
 *
 * - With DATABASE_URL set (Neon/PostgreSQL): applies pending migrations there.
 * - Without DATABASE_URL: applies to the built-in PGlite dev database.
 */
import path from "node:path";
import { applyMigrations } from "../src/db/migrate";
import { closeDb, resolveDb } from "../src/db/index";

async function main() {
  const { db, driver } = await resolveDb();
  const migrationsDir = path.resolve("src/db/migrations");
  console.log(`→ Database driver: ${driver}`);
  const ran = await applyMigrations(db, migrationsDir);
  if (ran.length === 0) {
    console.log("✓ Database up to date — no new migrations.");
  } else {
    console.log(`✓ Applied migrations: ${ran.join(", ")}`);
  }
  await closeDb();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
