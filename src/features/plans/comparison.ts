import { collections, type Plan } from "./schema";
export type Change = {
  record_id: string;
  field: string;
  before: unknown;
  after: unknown;
  sources: string[];
};
export function comparePlans(base: Plan, candidate: Plan): Change[] {
  const result: Change[] = [];
  function compare(
    id: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    for (const key of [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].sort()) {
      if (
        key === "id" ||
        JSON.stringify(before[key]) === JSON.stringify(after[key])
      )
        continue;
      result.push({
        record_id: id,
        field: key,
        before: before[key] ?? null,
        after: after[key] ?? null,
        sources:
          candidate.provenance.find(
            (p) => p.record_id === id && p.field_path === key,
          )?.source_record_ids ?? [],
      });
    }
  }
  compare("event", base.event, candidate.event);
  for (const c of collections) {
    const b = new Map(base[c].map((r) => [r.id, r])),
      a = new Map(candidate[c].map((r) => [r.id, r]));
    for (const id of new Set([...b.keys(), ...a.keys()])) {
      if (b.has(id) && !a.has(id))
        result.push({
          record_id: id,
          field: "$record",
          before: b.get(id),
          after: null,
          sources:
            candidate.provenance.find(
              (p) => p.record_id === id && p.field_path === "$record",
            )?.source_record_ids ?? [],
        });
      else compare(id, b.get(id) ?? {}, a.get(id) ?? {});
    }
  }
  return result;
}
export function displayValue(value: unknown): string {
  return value === null
    ? "Not recorded"
    : Array.isArray(value)
      ? value.map(displayValue).join(", ") || "None"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
}

export function recordName(plan: Plan, id: string): string | null {
  if (id === "event") return "Event details";
  for (const c of collections) {
    const row = plan[c].find((r) => r.id === id);
    if (row)
      return `${"title" in row ? row.title : "display_name" in row ? row.display_name : "name" in row ? row.name : c} (${row.external_id})`;
  }
  return null;
}
