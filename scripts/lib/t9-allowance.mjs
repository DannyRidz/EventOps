// Private, conservative campaign reservations. No credentials or provider access.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readFile, rmdir, lstat } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

const digest = (s) => createHash("sha256").update(s).digest("hex");
const integer = (n) => Number.isSafeInteger(n) && n > 0 && n <= 50_000_000;
async function syncDirectory(path) {
  const fd = await open(path, "r");
  try {
    await fd.sync();
  } finally {
    await fd.close();
  }
}
export async function reserveCampaign({
  path,
  limitMicrousd,
  amountMicrousd,
  key,
}) {
  assert.ok(
    isAbsolute(path) && integer(limitMicrousd) && integer(amountMicrousd),
  );
  assert.match(key, /^[A-Za-z0-9_-]{1,100}$/);
  const parent = await lstat(dirname(path));
  assert.ok(
    parent.isDirectory() &&
      !parent.isSymbolicLink() &&
      (parent.mode & 0o077) === 0,
    "Private ledger directory required",
  );
  const lock = path + ".lock";
  let acquired = false;
  for (let i = 0; i < 100; i++) {
    try {
      await mkdir(lock, { mode: 0o700 });
      acquired = true;
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  assert.ok(
    acquired,
    "CAMPAIGN_LOCKED, inspect an interrupted owner; never automatically clear a stale lock",
  );
  try {
    let fd;
    try {
      fd = await open(
        path,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      await fd.writeFile(
        JSON.stringify({ version: 1, limit_microusd: limitMicrousd }) + "\n",
      );
      await fd.sync();
      await syncDirectory(dirname(path));
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    } finally {
      if (fd) await fd.close();
    }
    const info = await lstat(path);
    assert.ok(
      info.isFile() &&
        !info.isSymbolicLink() &&
        (info.mode & 0o077) === 0 &&
        info.size <= 1_048_576,
      "Invalid private ledger",
    );
    const raw = await readFile(path, "utf8");
    assert.ok(raw.endsWith("\n"), "Incomplete journal, fail closed");
    const [head, ...lines] = raw.trimEnd().split("\n");
    const header = JSON.parse(head);
    assert.deepEqual(
      header,
      { version: 1, limit_microusd: limitMicrousd },
      "Allowance cannot change on restart",
    );
    let total = 0,
      prior = digest(head);
    const seen = new Map();
    for (const line of lines) {
      const row = JSON.parse(line);
      assert.match(row.key, /^[A-Za-z0-9_-]{1,100}$/);
      assert.ok(integer(row.amount_microusd) && !seen.has(row.key));
      assert.equal(row.previous, prior);
      const { sha256, ...payload } = row;
      assert.equal(sha256, digest(JSON.stringify(payload)));
      total += row.amount_microusd;
      seen.set(row.key, row.amount_microusd);
      prior = sha256;
    }
    assert.ok(total <= limitMicrousd, "Corrupt overdrawn journal");
    if (seen.has(key)) {
      assert.equal(
        seen.get(key),
        amountMicrousd,
        "Reservation key reused with different amount",
      );
      return { alreadyReserved: true, reservedMicrousd: total };
    }
    assert.ok(
      total + amountMicrousd <= limitMicrousd,
      "CAMPAIGN_ALLOWANCE_EXHAUSTED",
    );
    const payload = { key, amount_microusd: amountMicrousd, previous: prior };
    const row = { ...payload, sha256: digest(JSON.stringify(payload)) };
    const append = await open(
      path,
      constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
    );
    try {
      await append.writeFile(JSON.stringify(row) + "\n");
      await append.sync();
    } finally {
      await append.close();
    }
    return { alreadyReserved: false, reservedMicrousd: total + amountMicrousd };
  } finally {
    await rmdir(lock);
  }
}

export function campaignCall(reservation, call) {
  return async (...args) => {
    const receipt = await reserveCampaign(reservation);
    assert.equal(
      receipt.alreadyReserved,
      false,
      "This attempt was already reserved; never repeat its provider call after uncertain completion",
    );
    return call(...args);
  };
}
