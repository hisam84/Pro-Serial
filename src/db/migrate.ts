/**
 * Minimal SQL migration runner.
 *
 * - Applies *.sql files from the migrations directory in lexical order.
 * - Each file may contain several statements separated by a line that is
 *   exactly (after trimming): --> statement-breakpoint
 * - Applied file names are recorded in `_schema_migrations`; files already
 *   applied are skipped. Each new file runs inside a single transaction.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "./index";

export function splitStatements(content: string): string[] {
  return content
    .split(/^\s*--> statement-breakpoint\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isOnlyComments(s));
}

function isOnlyComments(stmt: string): boolean {
  return stmt
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("--"));
}

/** Normalizes raw results across drivers (postgres.js row list vs { rows }). */
export function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = res as { rows?: unknown } | null;
  if (r && Array.isArray(r.rows)) return r.rows as T[];
  return [];
}

export async function applyMigrations(
  db: Db,
  migrationsDir: string,
): Promise<string[]> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `));

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRows = rowsOf<{ name: string }>(
    await db.execute(sql`SELECT name FROM _schema_migrations`),
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(migrationsDir, file), "utf8");
    const statements = splitStatements(content);
    await db.transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.execute(sql.raw(stmt));
      }
      await tx.execute(
        sql`INSERT INTO _schema_migrations (name) VALUES (${file})`,
      );
    });
    ran.push(file);
  }
  return ran;
}
