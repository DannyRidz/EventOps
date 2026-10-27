import { describe, expect, it } from "vitest";
import { validatePlan } from "./validate";
import { fixturePlan, parityCases } from "./fixtures";
import type { Rule } from "./schema";
describe("whole plan constraints, AC-04/07/11/12/13", () => {
  it("allows adjacent half open room and volunteer intervals", () => {
    expect(validatePlan(fixturePlan())).toEqual([]);
  });
  const expected: Record<string, Rule> = {
    "capacity unknown": "CAPACITY",
    "features missing": "FEATURES",
    "buffer overlap": "ROOM_OVERLAP",
    "volunteer overlap": "VOLUNTEER_OVERLAP",
    "inactive volunteer": "ROLE",
    "wrong role": "ROLE",
    "unknown availability": "AVAILABILITY",
    "unavailable overrides available": "AVAILABILITY",
    "coverage incomplete": "COVERAGE",
    "missing reference": "REFERENCES",
    "duplicate identifier": "REFERENCES",
    "dependency gap": "DEPENDENCY",
    "dependency cycle": "DEPENDENCY",
    "outside event": "TIME",
    "time mismatch": "TIME",
    "unknown fields": "SHAPE",
    "null field": "SHAPE",
    "record limit": "LIMITS",
    "duplicate locations": "TIME",
    "duplicate assignment reversed ids": "REFERENCES",
    "untrimmed tag": "SHAPE",
  };
  for (const test of parityCases().slice(1))
    it(`blocks ${test.name}`, () => {
      expect(validatePlan(test.plan).map((i) => i.rule)).toContain(
        expected[test.name],
      );
    });
  it("includes exact buffered conflict interval and both affected ids", () => {
    const p = fixturePlan();
    p.sessions[0]!.teardown_minutes = 10;
    const collision = validatePlan(p).find((i) => i.rule === "ROOM_OVERLAP");
    expect(collision?.record_ids).toEqual([
      p.sessions[0]!.id,
      p.sessions[1]!.id,
    ]);
    expect(collision?.interval).toEqual({
      start: "2026-11-02T03:00:00.000Z",
      end: "2026-11-02T03:10:00.000Z",
    });
  });
  it("keeps independently generated fixtures isolated", () => {
    const first = fixturePlan();
    first.event.locations.push("Another hall");
    expect(fixturePlan().event.locations).toEqual(["Main hall", "Side hall"]);
  });
  it("does not mutate input or its record order", () => {
    const p = fixturePlan(),
      before = structuredClone(p);
    validatePlan(p);
    expect(p).toEqual(before);
  });
});
