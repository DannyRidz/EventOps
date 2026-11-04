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
export function parseCampaignLedger(raw) {
  assert.ok(raw.endsWith("\n"), "Incomplete journal, fail closed");
  const [head, ...lines] = raw.trimEnd().split("\n");
  const header = JSON.parse(head);
  assert.ok(integer(header.limit_microusd));
  assert.deepEqual(header, {
    version: 1,
    limit_microusd: header.limit_microusd,
  });
  let limitMicrousd = header.limit_microusd,
    total = 0,
    prior = digest(head);
  const seen = new Map(),
    amendments = [];
  for (const line of lines) {
    const row = JSON.parse(line),
      { sha256, ...payload } = row;
    assert.match(row.key, /^[A-Za-z0-9_-]{1,100}$/);
    assert.ok(!seen.has(row.key), "Duplicate journal key");
    assert.equal(row.previous, prior);
    assert.equal(sha256, digest(JSON.stringify(payload)));
    if (row.kind === "allowance_amendment") {
      assert.deepEqual(
        Object.keys(payload).sort(),
        [
          "approval",
          "key",
          "kind",
          "new_limit_microusd",
          "previous",
          "previous_limit_microusd",
          "recorded_at",
        ].sort(),
      );
      assert.equal(row.previous_limit_microusd, limitMicrousd);
      assert.ok(
        integer(row.new_limit_microusd) &&
          row.new_limit_microusd > limitMicrousd,
      );
      assert.ok(
        typeof row.approval === "string" &&
          row.approval.length > 0 &&
          row.approval.length <= 2000,
      );
      assert.ok(
        typeof row.recorded_at === "string" &&
          Number.isFinite(Date.parse(row.recorded_at)),
      );
      limitMicrousd = row.new_limit_microusd;
      amendments.push(row);
      seen.set(row.key, null);
    } else {
      assert.deepEqual(
        Object.keys(payload).sort(),
        ["key", "amount_microusd", "previous"].sort(),
      );
      assert.ok(integer(row.amount_microusd));
      total += row.amount_microusd;
      seen.set(row.key, row.amount_microusd);
    }
    assert.ok(total <= limitMicrousd, "Corrupt overdrawn journal");
    prior = sha256;
  }
  return { header, limitMicrousd, total, prior, seen, amendments };
}
export async function amendCampaignAllowance({
  path,
  previousLimitMicrousd,
  newLimitMicrousd,
  key,
  approval,
}) {
  assert.ok(
    isAbsolute(path) &&
      integer(previousLimitMicrousd) &&
      integer(newLimitMicrousd) &&
      newLimitMicrousd > previousLimitMicrousd,
  );
  assert.match(key, /^[A-Za-z0-9_-]{1,100}$/);
  assert.ok(
    typeof approval === "string" &&
      approval.length > 0 &&
      approval.length <= 2000,
  );
  const parent = await lstat(dirname(path));
  assert.ok(
    parent.isDirectory() &&
      !parent.isSymbolicLink() &&
      (parent.mode & 0o077) === 0,
  );
  const lock = path + ".lock";
  await mkdir(lock, { mode: 0o700 });
  try {
    const info = await lstat(path);
    assert.ok(
      info.isFile() &&
        !info.isSymbolicLink() &&
        (info.mode & 0o077) === 0 &&
        info.size <= 1048576,
    );
    const parsed = parseCampaignLedger(await readFile(path, "utf8"));
    if (parsed.seen.has(key)) {
      const prior = parsed.amendments.find((a) => a.key === key);
      assert.ok(
        prior &&
          prior.previous_limit_microusd === previousLimitMicrousd &&
          prior.new_limit_microusd === newLimitMicrousd &&
          prior.approval === approval,
      );
      return {
        alreadyRecorded: true,
        limitMicrousd: parsed.limitMicrousd,
        reservedMicrousd: parsed.total,
      };
    }
    assert.equal(parsed.limitMicrousd, previousLimitMicrousd);
    const payload = {
      kind: "allowance_amendment",
      key,
      previous_limit_microusd: previousLimitMicrousd,
      new_limit_microusd: newLimitMicrousd,
      approval,
      recorded_at: new Date().toISOString(),
      previous: parsed.prior,
    };
    const row = { ...payload, sha256: digest(JSON.stringify(payload)) };
    const fd = await open(
      path,
      constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
    );
    try {
      await fd.writeFile(JSON.stringify(row) + "\n");
      await fd.sync();
    } finally {
      await fd.close();
    }
    return {
      alreadyRecorded: false,
      limitMicrousd: newLimitMicrousd,
      reservedMicrousd: parsed.total,
    };
  } finally {
    await rmdir(lock);
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
    const parsed = parseCampaignLedger(raw);
    assert.equal(
      parsed.limitMicrousd,
      limitMicrousd,
      "Allowance cannot change without an authorized journal amendment",
    );
    const { total, prior, seen } = parsed;
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
