import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export function inspectJournal(raw) {
  assert.ok(raw.endsWith("\n"), "Incomplete journal");
  const [first, ...lines] = raw.trimEnd().split("\n");
  const header = JSON.parse(first);
  assert.equal(header.version, 1);
  assert.equal(
    header.limit_microusd,
    1000000,
    "Existing USD 1 allowance required",
  );
  let prior = sha256(first),
    total = 0;
  const seen = new Set();
  for (const line of lines) {
    const row = JSON.parse(line),
      { sha256: hash, ...payload } = row;
    assert.match(row.key, /^[A-Za-z0-9_-]{1,100}$/);
    assert.ok(!seen.has(row.key));
    seen.add(row.key);
    assert.ok(
      Number.isSafeInteger(row.amount_microusd) && row.amount_microusd > 0,
    );
    assert.equal(row.previous, prior);
    assert.equal(hash, sha256(JSON.stringify(payload)));
    prior = hash;
    total += row.amount_microusd;
  }
  assert.ok(total <= header.limit_microusd);
  return {
    limit_microusd: header.limit_microusd,
    reserved_microusd: total,
    remaining_microusd: header.limit_microusd - total,
  };
}
export function campaignPlan(corpus, audio) {
  assert.equal(corpus.cases.length, 30);
  for (const c of corpus.cases)
    assert.equal(
      c.input_sha256,
      sha256(JSON.stringify(c.input)),
      `Input drift: ${c.case_id}`,
    );
  assert.deepEqual(
    corpus.cases.map((c) => c.case_id),
    Array.from({ length: 30 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`),
  );
  const slots = corpus.cases.flatMap((c) =>
    [1, 2, 3].map((repeat) => ({
      case_id: c.case_id,
      repeat,
      key: `t9-${c.case_id}-${repeat}`,
      driver: c.case_id === "E28" ? "voice_worker" : "analysis_worker",
      maximum_provider_calls: c.case_id === "E28" ? audio.files.length : 3,
      maximum_reservation_microusd:
        c.case_id === "E28" ? audio.files.length * 18000 : 150000,
      status: "not_run",
      semantic_review: null,
      workflow_review: null,
    })),
  );
  return {
    schema_version: 1,
    live_calls_enabled: false,
    corpus_sha256: sha256(JSON.stringify(corpus)),
    source_sha256: corpus.source_sha256,
    slots,
    maximum_reservation_microusd: slots.reduce(
      (n, s) => n + s.maximum_reservation_microusd,
      0,
    ),
    acceptance: "not_evaluated",
    note: "Collection is not a pass. Independent semantic scoring and all case-specific workflow/fault observations are required.",
  };
}
