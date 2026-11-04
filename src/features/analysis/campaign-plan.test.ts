import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Local Node verification helper has no declaration file.
import * as campaign from "../../../scripts/lib/t9-campaign-plan.mjs";
const { campaignPlan, inspectJournal, sha256 } = campaign;
const corpus = JSON.parse(readFileSync("evals/t9/corpus.json", "utf8"));
const audio = JSON.parse(readFileSync("evals/t9/audio/manifest.json", "utf8"));
function journal(amount = 768000) {
  const header = JSON.stringify({ version: 1, limit_microusd: 1000000 });
  const payload = {
    key: "existing",
    amount_microusd: amount,
    previous: sha256(header),
  };
  return (
    header +
    "\n" +
    JSON.stringify({ ...payload, sha256: sha256(JSON.stringify(payload)) }) +
    "\n"
  );
}
describe("live campaign preparation", () => {
  it("prepares exactly three uniquely identified repeats without scores or enabled calls", () => {
    const p = campaignPlan(corpus, audio);
    expect(p.slots).toHaveLength(90);
    expect(new Set(p.slots.map((s: { key: string }) => s.key)).size).toBe(90);
    expect(
      p.slots.every(
        (s: { status: string; semantic_review: null; workflow_review: null }) =>
          s.status === "not_run" &&
          s.semantic_review === null &&
          s.workflow_review === null,
      ),
    ).toBe(true);
    expect(p.live_calls_enabled).toBe(false);
    expect(p.maximum_reservation_microusd).toBe(13266000);
  });
  it("keeps oracle facts and faults out of transport slots", () => {
    const p = campaignPlan(corpus, audio);
    expect(JSON.stringify(p.slots)).not.toContain("expected");
    expect(JSON.stringify(p.slots)).not.toContain("fault_injections");
  });
  it("rejects missing or duplicated case identities", () => {
    expect(() =>
      campaignPlan({ ...corpus, cases: corpus.cases.slice(1) }, audio),
    ).toThrow();
    expect(() =>
      campaignPlan(
        {
          ...corpus,
          cases: corpus.cases.map((c: { case_id: string }, i: number) =>
            i === 1 ? corpus.cases[0] : c,
          ),
        },
        audio,
      ),
    ).toThrow();
  });
  it("rejects changed input bytes when the pinned input hash is unchanged", () => {
    const changed = structuredClone(corpus);
    changed.cases[0].input.confirmed_text = "Different synthetic request";
    expect(() => campaignPlan(changed, audio)).toThrow("Input drift: E01");
  });
  it("retains existing charges and computes the unspent allowance", () => {
    expect(inspectJournal(journal())).toEqual({
      limit_microusd: 1000000,
      reserved_microusd: 768000,
      remaining_microusd: 232000,
    });
  });
  it("rejects changed allowance, truncation, tampering and overspend", () => {
    expect(() => inspectJournal(journal().slice(0, -1))).toThrow();
    expect(() =>
      inspectJournal(journal().replace("1000000", "2000000")),
    ).toThrow();
    expect(() =>
      inspectJournal(journal().replace("768000", "760000")),
    ).toThrow();
    expect(() => inspectJournal(journal(1000001))).toThrow();
  });
});
