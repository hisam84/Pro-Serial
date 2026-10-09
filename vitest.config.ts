import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite (WASM Postgres) boots inside tests; allow a warm-up window.
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
});
