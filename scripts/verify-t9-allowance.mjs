import assert from "node:assert/strict";
import { fork } from "node:child_process";
import {
  mkdtemp,
  readFile,
  writeFile,
  appendFile,
  mkdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { campaignCall, reserveCampaign } from "./lib/t9-allowance.mjs";

if (process.argv[2] === "--child") {
  try {
    const receipt = await reserveCampaign({
      path: process.argv[3],
      limitMicrousd: 300000,
      amountMicrousd: 150000,
      key: process.argv[4],
    });
    process.send?.({ ok: true, receipt });
  } catch {
    process.send?.({ ok: false });
  }
} else {
  const temp = await mkdtemp(join(tmpdir(), "eventops-t9-allowance-"));
  try {
    const path = join(temp, "reservations.jsonl");
    const child = (key) =>
      new Promise((resolve, reject) => {
        const p = fork(fileURLToPath(import.meta.url), ["--child", path, key], {
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        });
        let result;
        p.on("message", (m) => {
          result = m;
        });
        p.on("error", reject);
        p.on("exit", (code) =>
          code === 0 && result
            ? resolve(result)
            : reject(new Error("Child failed")),
        );
      });
    const results = await Promise.all([
      child("attempt-a"),
      child("attempt-b"),
      child("attempt-c"),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 2);
    const successful = ["attempt-a", "attempt-b", "attempt-c"].find(
      (_, i) => results[i].ok,
    );
    const config = {
      path,
      limitMicrousd: 300000,
      amountMicrousd: 150000,
      key: successful,
    };
    assert.equal((await reserveCampaign(config)).alreadyReserved, true);
    let calls = 0;
    await assert.rejects(() => campaignCall(config, async () => calls++)());
    assert.equal(calls, 0);
    await assert.rejects(() =>
      reserveCampaign({ ...config, amountMicrousd: 1 }),
    );
    await assert.rejects(() =>
      reserveCampaign({ ...config, limitMicrousd: 450000 }),
    );
    assert.equal((await child("restart-attempt")).ok, false);
    const before = await readFile(path, "utf8");
    await mkdir(path + ".lock");
    await assert.rejects(() => reserveCampaign(config), /CAMPAIGN_LOCKED/);
    await rm(path + ".lock", { recursive: true });
    assert.equal(await readFile(path, "utf8"), before);
    await appendFile(path, "truncated");
    await assert.rejects(() => reserveCampaign(config), /Incomplete journal/);
    // A failed/uncertain call retains its hold through a fresh process/restart.
    const uncertain = {
      path: join(temp, "uncertain.jsonl"),
      limitMicrousd: 150000,
      amountMicrousd: 150000,
      key: "uncertain-attempt",
    };
    await assert.rejects(() =>
      campaignCall(uncertain, async () => {
        throw new Error("lost response");
      })(),
    );
    await assert.rejects(() => campaignCall(uncertain, async () => calls++)());
    await assert.rejects(() =>
      reserveCampaign({ ...uncertain, key: "retry-attempt" }),
    );
    assert.equal(calls, 0);
    const corrupt = (await readFile(uncertain.path, "utf8")).split("\n");
    const altered = JSON.parse(corrupt[1]);
    altered.amount_microusd = 1;
    corrupt[1] = JSON.stringify(altered);
    await writeFile(uncertain.path, corrupt.join("\n"));
    await assert.rejects(() => reserveCampaign(uncertain));
    console.log(
      "PASS allowance concurrency, idempotency, payload mismatch, restart, uncertain completion, stale lock, truncated journal and tampered hash chain; no provider calls",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
