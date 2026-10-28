import { describe, it, expect } from "vitest";
import { fixturePlan } from "./fixtures";
import {
  editableRecords,
  manualPatch,
  fieldValue,
  planInput,
} from "./editor-model";
import { comparePlans } from "./comparison";
describe("manual plan edits", () => {
  it("keeps stable identity but omits derived instants and provenance", () => {
    const plan = fixturePlan();
    const records = editableRecords(plan);
    expect(records.sessions[0]?.id).toBe(plan.sessions[0]?.id);
    expect(records.sessions[0]).not.toHaveProperty("starts_at");
    expect(planInput(records)).not.toHaveProperty("provenance");
    expect(manualPatch(plan, records)).toEqual([]);
  });
  it("only patches explicitly edited collections", () => {
    const base = fixturePlan();
    const rows = editableRecords(base);
    rows.sessions[0] = { ...rows.sessions[0], title: "Changed" };
    expect(manualPatch(base, rows).map((p) => p.path)).toEqual(["/sessions"]);
    expect(base.sessions[0]?.title).toBe("Opening");
  });
  it("does not turn unknown attendance into zero", () => {
    expect(
      fieldValue({ key: "x", label: "x", type: "number", nullable: true }, ""),
    ).toBeNull();
    expect(fieldValue({ key: "x", label: "x", type: "number" }, "")).toBe("");
    expect(
      fieldValue({ key: "x", label: "x", type: "number", nullable: true }, "0"),
    ).toBe(0);
  });
  it("removes empty fold offsets while retaining a deliberate fold choice", () => {
    const rows = editableRecords(fixturePlan());
    rows.sessions[0] = {
      ...rows.sessions[0],
      start_offset: "",
      end_offset: "-05:00",
    };
    const session = (planInput(rows).sessions as Record<string, unknown>[])[0];
    expect(session).not.toHaveProperty("start_offset");
    expect(session?.end_offset).toBe("-05:00");
  });
  it("comparison uses immutable values and actual field evidence", () => {
    const before = fixturePlan(),
      after = fixturePlan();
    after.sessions[0]!.title = "Revision title";
    after.provenance = [
      {
        record_id: after.sessions[0]!.id,
        field_path: "title",
        source_record_ids: ["frozen-source"],
        derivation_kind: "manual",
      },
    ];
    expect(comparePlans(before, after)).toEqual([
      {
        record_id: after.sessions[0]!.id,
        field: "title",
        before: "Opening",
        after: "Revision title",
        sources: ["frozen-source"],
      },
    ]);
  });
});
it("removed records keep their frozen removal evidence in the comparison", () => {
  const base = fixturePlan(),
    candidate = fixturePlan();
  const removed = candidate.rooms.pop()!;
  candidate.provenance = [
    {
      record_id: removed.id,
      field_path: "$record",
      source_record_ids: ["removal-source"],
      derivation_kind: "manual",
    },
  ];
  expect(comparePlans(base, candidate)).toEqual([
    {
      record_id: removed.id,
      field: "$record",
      before: removed,
      after: null,
      sources: ["removal-source"],
    },
  ]);
});
