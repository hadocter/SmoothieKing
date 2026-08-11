import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL("../../", import.meta.url));

test("production refuses to load auth without a JWT secret", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["--input-type=module", "--eval", 'import "./src/lib/auth.ts"'], {
      cwd: packageDir,
      env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "" },
    }),
    (error: { stderr?: string }) => {
      assert.match(error.stderr ?? "", /JWT_SECRET must be set/);
      return true;
    },
  );
});

test("production accepts an explicitly configured JWT secret", async () => {
  await execFileAsync(process.execPath, ["--input-type=module", "--eval", 'import "./src/lib/auth.ts"'], {
    cwd: packageDir,
    env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "test-only-secret" },
  });
});
