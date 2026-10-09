import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db";
import { clinics } from "@/db/schema";

describe("PGlite database initialization", () => {
  beforeAll(() => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PG_LITE_DIR", ":memory:");
  });

  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });

  it("runs migrations once when initialized concurrently", async () => {
    const databases = await Promise.all(
      Array.from({ length: 10 }, () => getDb()),
    );

    const results = await Promise.all(
      databases.map((db) => db.select().from(clinics).limit(1)),
    );

    expect(results).toHaveLength(10);
    expect(results.every((rows) => rows.length === 0)).toBe(true);
  });
});
