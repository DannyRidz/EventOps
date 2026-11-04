import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function launch(
  overrides: Record<string, string>,
  args: string[] = [],
  expectDatabaseTrap = false,
) {
  const root = mkdtempSync(join(tmpdir(), "eventops-campaign-gate-"));
  dirs.push(root);
  for (const folder of ["src", "scripts", "evals", "docs"])
    symlinkSync(resolve(folder), join(root, folder), "dir");
  const output = join(root, "output", "live-analysis-private");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const header = JSON.stringify({ version: 1, limit_microusd: 1000000 });
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const row = {
    key: "existing",
    amount_microusd: 768000,
    previous: hash(header),
  };
  writeFileSync(
    join(output, "usd1-reservations.jsonl"),
    header +
      "\n" +
      JSON.stringify({ ...row, sha256: hash(JSON.stringify(row)) }) +
      "\n",
    { mode: 0o600 },
  );
  const marker = join(root, "unexpected-io");
  const guard = join(root, "guard.mjs");
  writeFileSync(
    guard,
    `import fs from 'node:fs';import fsp from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';import pg from ${JSON.stringify(pathToFileURL(resolve("node_modules/pg/lib/index.js")).href)};const originalRead=fsp.readFile;fsp.readFile=async(path,...args)=>path==='/private/tmp/eventops-local-status.json'?JSON.stringify({env:{DB_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'}}):originalRead(path,...args);syncBuiltinESMExports();const fail=()=>{fs.writeFileSync(${JSON.stringify(marker)},'unexpected IO');throw new Error('TEST_BLOCKED_IO');};pg.Client.prototype.connect=fail;globalThis.fetch=fail;`,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      guard,
      resolve("scripts/run-t9-live-evaluation.mjs"),
      "--execute",
      ...args,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        NODE_OPTIONS: "",
        EVENTOPS_T9_LIVE_APPROVED: "1",
        EVENTOPS_MODEL_ENABLED: "1",
        EVENTOPS_VOICE_ENABLED: "1",
        EVENTOPS_META_ACCESS_VERIFIED: "1",
        EVENTOPS_META_BILLING_BOUND_VERIFIED: "1",
        MODEL_API_KEY: "synthetic-test-key",
        ...overrides,
      },
    },
  );
  expect(result.error).toBeUndefined();
  expect(existsSync(marker)).toBe(expectDatabaseTrap);
  expect(readdirSync(output).sort()).toEqual(
    expectDatabaseTrap
      ? ["corpus-E02-1-receipt.json", "usd1-reservations.jsonl"]
      : ["usd1-reservations.jsonl"],
  );
  return result;
}
describe("live collector entry gates", () => {
  it("rejects missing approval before database or provider access", () => {
    const r = launch({ EVENTOPS_T9_LIVE_APPROVED: "" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "Live execution is not authorized by preparation",
    );
  });
  it("rejects missing verified flags before database or provider access", () => {
    const r = launch({ EVENTOPS_META_ACCESS_VERIFIED: "0" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "Private key and explicit verified flags required",
    );
  });
  it("rejects missing voice verification before database or provider access", () => {
    const r = launch({ EVENTOPS_VOICE_ENABLED: "0" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Explicit verified voice flags required");
  });
  it("allows an eligible single slot to reach only the controlled database trap", () => {
    const r = launch({}, ["--case=E02", "--repeat=1"], true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('"state":"blocked_or_failed"');
    expect(r.stdout).toContain('"live_provider_calls":0');
  });
  it("rejects the full campaign under the remaining allowance before any IO", () => {
    const r = launch({});
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("INSUFFICIENT_EXISTING_ALLOWANCE");
  });
});
