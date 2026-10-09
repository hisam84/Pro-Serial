/**
 * Sequential test runner: executes each test file in its own Vitest process.
 *
 * Each PGlite (WASM Postgres) instance uses significant memory, so files run
 * one at a time and never in parallel workers. Exit code is non-zero if any
 * file fails — safe for CI.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const testsDir = path.resolve("tests");
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

let failed = 0;

for (const file of files) {
  console.log(`\n━━━ ${file} ━━━`);
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", path.join("tests", file)],
    { stdio: "inherit", shell: false },
  );
  if (result.status !== 0) {
    failed += 1;
    console.error(`✗ ${file} failed`);
  }
}

console.log(
  `\n${failed === 0 ? "✓ All test files passed" : `✗ ${failed} file(s) failed`}`,
);
process.exit(failed === 0 ? 0 : 1);
