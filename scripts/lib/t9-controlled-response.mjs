import assert from "node:assert/strict";
import { fixtureId as id } from "../../src/features/plans/fixtures.ts";
export function controlledCall(
  c,
  s,
  intents,
  questions = [],
  unsupported = [],
  badSelection = false,
) {
  let count = 0;
  return {
    get count() {
      return count;
    },
    call: async (name, _schema, policy, input) => {
      count++;
      assert.ok(policy.length > 0);
      assert.ok(!JSON.stringify(input).includes('"constraint_probes"'));
      if (name === "EventOpsIntent") {
        assert.ok(!JSON.stringify(input).includes("Synthetic Alex"));
        return {
          schema_version: 1,
          base_revision_id: s.baseId,
          intents: intents.map((r) => ({
            ...r,
            span: {
              start: 0,
              end: input.confirmed_text.length,
              quote: input.confirmed_text,
            },
          })),
          questions,
          unsupported_requests: unsupported,
        };
      }
      assert.equal(name, "EventOpsSelection");
      return {
        base_revision_id: s.baseId,
        selected_option_id: badSelection ? "not-supplied" : input.options[0].id,
        dispositions: input.options[0].requests.map((r) => ({
          intent_id: r.intent_id,
          status: "satisfied",
          evidence_refs: [badSelection ? id(999) : s.source],
        })),
      };
    },
  };
}
