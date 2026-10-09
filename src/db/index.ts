/**
 * Database access layer.
 *
 * - Production: PostgreSQL (Neon) through DATABASE_URL using postgres.js
 *   (use Neon's POOLED connection string; prepare is disabled so it works
 *   with transaction poolers).
 * - Development / demo: built-in PGlite (in-process WASM Postgres) persisted
 *   under PG_LITE_DIR (default .pglite-data). Zero external setup.
 * - Tests: PGlite in-memory via createTestDb() (see tests/helpers.ts).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

/** A schema-typed database handle usable with either driver. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema, any>;

export type DbDriver = "postgres" | "pglite";

export interface ResolvedDb {
  db: Db;
  driver: DbDriver;
}

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

/* ── Connection singletons (survive Next.js dev HMR) ───────────────── */

interface DbGlobal {
  __serialProPglite?: PGlite;
  __serialProPgClient?: ReturnType<typeof postgres>;
  __serialProMigrationPromises?: WeakMap<PGlite, Promise<void>>;
}

const g = globalThis as DbGlobal;

function getPgLiteClient(dir: string): PGlite {
  if (!g.__serialProPglite) {
    // ":memory:" / empty → ephemeral in-memory database.
    g.__serialProPglite =
      dir && dir !== ":memory:" ? new PGlite(dir) : new PGlite();
  }
  return g.__serialProPglite;
}

function getPostgresClient(url: string): ReturnType<typeof postgres> {
  if (!g.__serialProPgClient) {
    g.__serialProPgClient = postgres(url, {
      max: 5,
      // Required for transaction poolers (e.g. the Neon pooler).
      prepare: false,
    });
  }
  return g.__serialProPgClient;
}

/* ── Public API ────────────────────────────────────────────────────── */

export function isPgLiteMode(): boolean {
  return !process.env.DATABASE_URL?.trim();
}

/**
 * Returns the shared application database handle.
 * In PGlite mode, migrations run once automatically (dev/demo convenience).
 * With DATABASE_URL set, run `npm run db:migrate` explicitly — migrations
 * never run per-request in production.
 */
export async function getDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return drizzlePg(getPostgresClient(url), { schema }) as unknown as Db;
  }
  const dir = process.env.PG_LITE_DIR ?? ".pglite-data";
  const client = getPgLiteClient(dir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  if (!g.__serialProMigrationPromises) {
    g.__serialProMigrationPromises = new WeakMap();
  }
  let migrationPromise = g.__serialProMigrationPromises.get(client);
  if (!migrationPromise) {
    migrationPromise = applyMigrations(db, MIGRATIONS_DIR)
      .then(() => undefined)
      .catch((error: unknown) => {
        g.__serialProMigrationPromises?.delete(client);
        throw error;
      });
    g.__serialProMigrationPromises.set(client, migrationPromise);
  }
  await migrationPromise;
  return db;
}

/**
 * Creates a fresh, isolated in-memory database with migrations applied.
 * Used by tests; not used by the application at runtime.
 */
export async function createTestDb(): Promise<ResolvedDb> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  await applyMigrations(db, MIGRATIONS_DIR);
  return { db, driver: "pglite" };
}

/** For scripts (migrate/seed) that need a handle + driver name. */
export async function resolveDb(): Promise<ResolvedDb> {
  const driver: DbDriver = isPgLiteMode() ? "pglite" : "postgres";
  return { db: await getDb(), driver };
}

/** Closes open connections (scripts only). */
export async function closeDb(): Promise<void> {
  if (g.__serialProPgClient) {
    await g.__serialProPgClient.end();
    g.__serialProPgClient = undefined;
  }
  if (g.__serialProPglite) {
    await g.__serialProPglite.close();
    g.__serialProPglite = undefined;
  }
}

export { schema };
