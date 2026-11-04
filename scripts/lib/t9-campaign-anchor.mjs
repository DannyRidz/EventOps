// A retained campaign may never silently acquire a replacement SQL ledger.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { open, lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function campaignAnchor(folder, identity, mustExist = false) {
  assert.match(identity, /^[a-f0-9]{64}$/);
  const path = resolve(folder, "campaign-state-anchor.json");
  let created = false;
  if (mustExist) await lstat(path);
  try {
    const fd = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await fd.writeFile(
        JSON.stringify({
          version: 1,
          database: "eventops_t9_campaign_v1",
          identity,
        }) + "\n",
      );
      await fd.sync();
      created = true;
    } finally {
      await fd.close();
    }
    const dir = await open(folder, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  const info = await lstat(path);
  assert.ok(
    info.isFile() &&
      !info.isSymbolicLink() &&
      (info.mode & 0o077) === 0 &&
      info.size <= 4096,
  );
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
    version: 1,
    database: "eventops_t9_campaign_v1",
    identity,
  });
  return { requireExistingCampaign: !created };
}
