import { collections, type Plan } from "./schema";
export type Collection = (typeof collections)[number];
export type Row = Record<string, string | number | boolean | null | string[]>;
export type Records = Record<Collection, Row[]>;
export type Field = {
  key: string;
  label: string;
  type?: "number" | "tags" | "boolean" | "time";
  nullable?: boolean;
  reference?: Collection;
  options?: string[];
  default?: string | number | boolean | null | string[];
};
const time: Field[] = [
  { key: "start", label: "Start", type: "time" },
  { key: "end", label: "End", type: "time" },
  {
    key: "start_offset",
    label: "Start UTC offset (only required for a repeated time)",
  },
  {
    key: "end_offset",
    label: "End UTC offset (only required for a repeated time)",
  },
];
export const recordFields: Record<Collection, Field[]> = {
  rooms: [
    { key: "name", label: "Room name" },
    { key: "location", label: "Location" },
    { key: "capacity", label: "Capacity", type: "number", nullable: true },
    { key: "feature_tags", label: "Features", type: "tags" },
  ],
  sessions: [
    { key: "title", label: "Session title" },
    ...time,
    { key: "room_id", label: "Room", reference: "rooms" },
    {
      key: "required_volunteers",
      label: "Required volunteers",
      type: "number",
    },
    {
      key: "expected_attendance",
      label: "Expected attendance",
      type: "number",
      nullable: true,
    },
    { key: "required_role_tag", label: "Required role", nullable: true },
    { key: "required_feature_tags", label: "Required features", type: "tags" },
    {
      key: "setup_minutes",
      label: "Setup minutes",
      type: "number",
      default: 0,
    },
    {
      key: "teardown_minutes",
      label: "Teardown minutes",
      type: "number",
      default: 0,
    },
  ],
  volunteers: [
    { key: "display_name", label: "Volunteer name" },
    { key: "role_tags", label: "Roles", type: "tags" },
    { key: "active", label: "Active", type: "boolean", default: true },
  ],
  availability: [
    { key: "volunteer_id", label: "Volunteer", reference: "volunteers" },
    ...time,
    { key: "status", label: "Status", options: ["available", "unavailable"] },
  ],
  assignments: [
    { key: "volunteer_id", label: "Volunteer", reference: "volunteers" },
    { key: "session_id", label: "Session", reference: "sessions" },
    { key: "role_tag", label: "Assignment role" },
    ...time,
  ],
  dependencies: [
    {
      key: "predecessor_session_id",
      label: "Predecessor session",
      reference: "sessions",
    },
    {
      key: "successor_session_id",
      label: "Successor session",
      reference: "sessions",
    },
    {
      key: "minimum_gap_minutes",
      label: "Minimum gap minutes",
      type: "number",
      default: 0,
    },
  ],
};
export function emptyRecords(): Records {
  return Object.fromEntries(
    collections.map((c) => [c, [] as Row[]]),
  ) as Records;
}
export function editableRecords(plan?: Plan | null): Records {
  const result = emptyRecords();
  if (plan)
    for (const c of collections)
      result[c] = plan[c].map(
        (row) =>
          Object.fromEntries(
            ["id", "external_id", ...recordFields[c].map((f) => f.key)]
              .filter((k) => k in row)
              .map((k) => [k, row[k as keyof typeof row]]),
          ) as Row,
      );
  return result;
}
export function newRow(c: Collection): Row {
  return Object.fromEntries([
    ["external_id", ""],
    ...recordFields[c].map((f) => [
      f.key,
      f.default ?? (f.type === "tags" ? [] : f.nullable ? null : ""),
    ]),
  ]);
}
export function recordLabel(row: Row) {
  return String(row.name || row.title || row.display_name || row.external_id);
}
export function fieldValue(field: Field, value: string): Row[string] {
  if (field.type === "tags")
    return value
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  if (field.nullable && !value) return null;
  if (field.type === "number") return value === "" ? "" : Number(value);
  return value;
}
export function planInput(records: Records) {
  return Object.fromEntries(
    collections.map((c) => [
      c,
      records[c].map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key, value]) =>
              !(["start_offset", "end_offset"].includes(key) && value === ""),
          ),
        ),
      ),
    ]),
  );
}
export function manualPatch(base: Plan, records: Records) {
  const current = editableRecords(base);
  const values = planInput(records);
  return collections
    .filter((c) => JSON.stringify(current[c]) !== JSON.stringify(records[c]))
    .map((c) => ({ op: "replace" as const, path: `/${c}`, value: values[c] }));
}
