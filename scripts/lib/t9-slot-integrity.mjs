import assert from "node:assert/strict";
export function reconcileSlot(key, slot, journalKeys, jobCompleted = false) {
  const keys = journalKeys.filter((k) => k.startsWith(key + "-call-")).sort();
  if (!slot) {
    assert.equal(
      keys.length,
      0,
      "Prior reservations without retained SQL state",
    );
    return;
  }
  const requests = slot.result?.requests ?? [];
  if (keys.length) {
    assert.equal(
      requests.length,
      keys.length,
      "Journal and retained request evidence disagree",
    );
    assert.deepEqual(
      keys,
      requests.map((r) => `${key}-call-${r.index}`).sort(),
      "Journal request identities disagree",
    );
    if (slot.phase === "prepared")
      assert.equal(
        jobCompleted,
        true,
        "Prior reservation before non-completed SQL job requires inspection",
      );
  }
}
