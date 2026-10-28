import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { collections, type Plan } from "@/features/plans/schema";
import {
  emptyRecords,
  recordFields,
  type Collection,
  type Records,
} from "@/features/plans/editor-model";
import { validatePlan } from "@/features/plans/validate";
export const templates = {
  rooms: {
    filename: "rooms.csv",
    required: ["room_id", "name", "location"],
    optional: ["capacity", "feature_tags"],
    limit: 20,
  },
  sessions: {
    filename: "schedule.csv",
    required: [
      "session_id",
      "title",
      "start",
      "end",
      "room_id",
      "required_volunteers",
    ],
    optional: [
      "expected_attendance",
      "required_role_tag",
      "required_feature_tags",
      "setup_minutes",
      "teardown_minutes",
    ],
    limit: 100,
  },
  volunteers: {
    filename: "volunteers.csv",
    required: ["volunteer_id", "name"],
    optional: ["role_tags", "active"],
    limit: 100,
  },
  availability: {
    filename: "availability.csv",
    required: ["volunteer_id", "start", "end", "status"],
    optional: [],
    limit: 1000,
  },
  assignments: {
    filename: "assignments.csv",
    required: ["session_id", "volunteer_id", "role_tag"],
    optional: ["start", "end"],
    limit: 500,
  },
  dependencies: {
    filename: "dependencies.csv",
    required: [
      "predecessor_session_id",
      "successor_session_id",
      "minimum_gap_minutes",
    ],
    optional: [],
    limit: 100,
  },
} as const;
const collection = z.enum(collections);
export const tableSchema = z.strictObject({
  collection,
  filename: z.string().min(1).max(240),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  headers: z.array(z.string().min(1).max(4096)).min(1).max(32),
  rows: z.array(z.array(z.string().max(4096)).max(32)).max(2001),
  lines: z.array(z.number().int().positive()).max(2001),
  mapping: z.record(z.string(), z.string()),
  excluded: z.array(z.number().int().min(0).max(2000)).max(2001),
  keep_one: z.array(z.string().max(4096)).max(2001),
  offsets: z.record(
    z.string(),
    z.strictObject({ start: z.string().max(9), end: z.string().max(9) }),
  ),
});
export const tablesSchema = z
  .array(tableSchema)
  .min(1)
  .max(6)
  .superRefine((tables, ctx) => {
    if (new Set(tables.map((t) => t.collection)).size !== tables.length)
      ctx.addIssue({ code: "custom", message: "Use one file per template." });
    for (const t of tables) {
      const keys: readonly string[] = [
        ...templates[t.collection].required,
        ...templates[t.collection].optional,
      ];
      if (
        t.lines.length !== t.rows.length ||
        t.rows.some((r) => r.length !== t.headers.length) ||
        new Set(t.headers).size !== t.headers.length ||
        Object.entries(t.mapping).some(
          ([k, v]) => !keys.includes(k) || !t.headers.includes(v),
        ) ||
        new Set(Object.values(t.mapping)).size !==
          Object.values(t.mapping).length ||
        t.excluded.some((i) => i >= t.rows.length)
      )
        ctx.addIssue({ code: "custom", message: "Invalid table or mapping." });
    }
  });
export type ImportTable = z.infer<typeof tableSchema>;
export type ImportIssue = {
  severity: "error" | "warning";
  file: string;
  row: number;
  column: string;
  value: string;
  message: string;
  action: string;
};
export function initialMapping(c: Collection, headers: string[]) {
  return Object.fromEntries(
    [...templates[c].required, ...templates[c].optional]
      .filter((h) => headers.includes(h))
      .map((h) => [h, h]),
  );
}
export function templateCsv(c: Collection) {
  return (
    [...templates[c].required, ...templates[c].optional].join(",") + "\r\n"
  );
}
export type Setup = Pick<
  Plan["event"],
  "name" | "date" | "timezone" | "start" | "end" | "locations"
> &
  Partial<Pick<Plan["event"], "start_offset" | "end_offset">>;
export function reviewImport(tables: ImportTable[], setup: Setup) {
  const records = emptyRecords(),
    issues: ImportIssue[] = [];
  const origins = new Map<string, { table: ImportTable; index: number }>();
  function issue(
    t: ImportTable,
    i: number,
    column: string,
    value: string,
    message: string,
    action: string,
    severity: "error" | "warning" = "error",
  ) {
    issues.push({
      severity,
      file: t.filename,
      row: i < 0 ? 1 : t.lines[i]!,
      column,
      value,
      message,
      action,
    });
  }
  for (const t of tables) {
    const spec = templates[t.collection];
    for (const h of spec.required)
      if (!t.mapping[h])
        issue(
          t,
          -1,
          h,
          "",
          "Required column is not mapped.",
          "Choose its source column.",
        );
    const seen = new Map<string, { value: string; row: number }>();
    const names = new Map<string, string>();
    t.rows.forEach((cells, i) => {
      if (t.excluded.includes(i)) return;
      const values = Object.fromEntries(
        Object.entries(t.mapping).map(([field, header]) => [
          field,
          cells[t.headers.indexOf(header)] ?? "",
        ]),
      );
      const get = (k: string) => values[k] ?? "";
      const idKey =
        t.collection === "rooms"
          ? "room_id"
          : t.collection === "sessions"
            ? "session_id"
            : t.collection === "volunteers"
              ? "volunteer_id"
              : "";
      const id = idKey ? get(idKey) : `csv-${i + 1}`;
      const duplicateKey = idKey ? id : JSON.stringify(values);
      const exact = JSON.stringify(values),
        prior = seen.get(duplicateKey);
      if (prior) {
        if (prior.value !== exact)
          issue(
            t,
            i,
            idKey,
            id,
            `Conflicting duplicate ID, first seen at row ${t.lines[prior.row]}.`,
            "Correct the ID or explicitly exclude a row.",
          );
        else if (
          !t.keep_one.includes(idKey ? duplicateKey : `row:${prior.row + 1}`)
        )
          issue(
            t,
            i,
            idKey || "row",
            idKey ? duplicateKey : `row:${prior.row + 1}`,
            "Identical duplicate records need a decision.",
            "Choose Keep one or correct/exclude the row.",
          );
        if (prior.value === exact) return;
      } else seen.set(duplicateKey, { value: exact, row: i });
      if (idKey && !/^[\x21-\x7e]{1,64}$/.test(id))
        issue(
          t,
          i,
          idKey,
          id,
          "Use a case sensitive ID of 1 to 64 safe printable characters, without spaces.",
          "Correct this identifier.",
        );
      const row: Records[Collection][number] = { external_id: id };
      for (const f of recordFields[t.collection].filter(
        (f) => !f.key.endsWith("_offset"),
      )) {
        const key = f.key === "display_name" ? "name" : f.key;
        const raw = get(key),
          value = raw.trim();
        if (f.type === "number") {
          if (!value && f.nullable) row[f.key] = null;
          else if (!value && f.default !== undefined) row[f.key] = f.default;
          else if (
            !/^\d+$/.test(value) ||
            !Number.isSafeInteger(Number(value)) ||
            Number(value) >
              (key.includes("minutes")
                ? 1440
                : key === "required_volunteers"
                  ? 100
                  : 1000000) ||
            (key === "capacity" && Number(value) === 0)
          )
            issue(
              t,
              i,
              key,
              raw,
              "A valid nonnegative integer is required (capacity must be positive).",
              "Enter a whole number within the field limit.",
            );
          else row[f.key] = Number(value);
        } else if (f.type === "tags") {
          const tags = value
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean);
          row[f.key] = tags;
          if (tags.length > 20 || tags.some((s) => s.length > 64))
            issue(
              t,
              i,
              key,
              raw,
              "Use at most 20 tags of at most 64 characters.",
              "Shorten the semicolon separated tags.",
            );
        } else if (f.type === "boolean") {
          if (!["", "true", "false"].includes(value))
            issue(
              t,
              i,
              key,
              raw,
              "Active must be true or false.",
              "Enter true or false, or leave blank for true.",
            );
          row[f.key] = value !== "false";
        } else {
          row[f.key] = !value && f.nullable ? null : f.reference ? raw : value;
          const optionalTime =
            t.collection === "assignments" && f.type === "time" && !value;
          if (!value && !f.nullable && !optionalTime)
            issue(t, i, key, raw, "A value is required.", "Enter this field.");
          if (f.options && !f.options.includes(value))
            issue(
              t,
              i,
              key,
              raw,
              "Value is not one of the supported options.",
              `Use ${f.options.join(" or ")}.`,
            );
          const max =
            key === "location"
              ? 240
              : f.reference
                ? 64
                : key.includes("role")
                  ? 64
                  : 160;
          if (value.length > max)
            issue(
              t,
              i,
              key,
              raw,
              `Maximum length is ${max} characters.`,
              "Shorten this field.",
            );
        }
      }
      const offsets = t.offsets[String(i)];
      if (offsets?.start) row.start_offset = offsets.start;
      if (offsets?.end) row.end_offset = offsets.end;
      const name = String(row.name ?? row.title ?? row.display_name ?? "")
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");
      if (name && names.has(name) && names.get(name) !== id)
        issue(
          t,
          i,
          "name",
          name,
          "Similar names have distinct IDs. They remain separate records.",
          "Review the identifiers; do not merge by name.",
          "warning",
        );
      names.set(name, id);
      records[t.collection].push(row);
      origins.set(`${t.collection}:${id}`, { table: t, index: i });
    });
    if (records[t.collection].length > spec.limit)
      issue(
        t,
        -1,
        "rows",
        String(records[t.collection].length),
        `This template permits ${spec.limit} records.`,
        "Explicitly exclude or remove excess records.",
      );
  }
  for (const c of collections)
    for (const row of records[c]) {
      const origin = origins.get(`${c}:${row.external_id}`)!;
      if (c === "assignments") {
        const session = records.sessions.find(
          (s) => s.external_id === row.session_id,
        );
        for (const edge of ["start", "end"])
          if (!row[edge]) row[edge] = session?.[edge] ?? "";
      }
      for (const f of recordFields[c])
        if (
          f.reference &&
          !records[f.reference].some((r) => r.external_id === row[f.key])
        )
          issue(
            origin.table,
            origin.index,
            f.key,
            String(row[f.key]),
            "Referenced ID was not found in this batch.",
            "Import that record or correct the exact case sensitive ID.",
          );
      if ("start" in row) {
        for (const edge of ["start", "end"] as const) {
          try {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(row[edge])))
              throw new Error();
            Temporal.ZonedDateTime.from(
              `${setup.date}T${row[edge]}${row[`${edge}_offset`] ?? ""}[${setup.timezone}]`,
              { disambiguation: "reject", offset: "reject" },
            );
          } catch {
            issue(
              origin.table,
              origin.index,
              edge,
              String(row[edge]),
              "Invalid or repeated local time on the event date.",
              "Use HH:mm; for a repeated time select its explicit UTC offset below.",
            );
          }
        }
        if (
          String(row.start) >= String(row.end) &&
          !row.start_offset &&
          !row.end_offset
        )
          issue(
            origin.table,
            origin.index,
            "end",
            String(row.end),
            "End must follow start on the event date.",
            "Correct the interval.",
          );
      }
    }
  return { records, issues };
}
// Full preview uses the same validator as manual plans; SQL repeats all checks at commit.
export function constraintPreview(records: Records, setup: Setup) {
  const ids = new Map<string, string>();
  for (const c of collections)
    for (const r of records[c])
      ids.set(`${c}:${r.external_id}`, crypto.randomUUID());
  function interval(r: Record<string, unknown>) {
    const start = Temporal.ZonedDateTime.from(
      `${setup.date}T${r.start}${r.start_offset ?? ""}[${setup.timezone}]`,
      { disambiguation: "reject", offset: "reject" },
    );
    const end = Temporal.ZonedDateTime.from(
      `${setup.date}T${r.end}${r.end_offset ?? ""}[${setup.timezone}]`,
      { disambiguation: "reject", offset: "reject" },
    );
    return {
      start: r.start,
      end: r.end,
      start_offset: start.offset,
      end_offset: end.offset,
      starts_at: start.toInstant().toString(),
      ends_at: end.toInstant().toString(),
    };
  }
  const candidate: Record<string, unknown> = {
    schema_version: 1,
    event: { ...setup, ...interval(setup) },
    provenance: [],
  };
  for (const c of collections)
    candidate[c] = records[c].map((r) => {
      const row: Record<string, unknown> = {
        ...r,
        id: ids.get(`${c}:${r.external_id}`),
      };
      for (const f of recordFields[c])
        if (f.reference)
          row[f.key] = ids.get(`${f.reference}:${r[f.key]}`) ?? "";
      return "start" in row ? { ...row, ...interval(row) } : row;
    });
  return validatePlan(candidate).map((i) => ({
    ...i,
    record_ids: i.record_ids.map(
      (id) => [...ids].find(([, v]) => v === id)?.[0] ?? id,
    ),
  }));
}

export function constraintDiagnostics(
  tables: ImportTable[],
  records: Records,
  setup: Setup,
) {
  return constraintPreview(records, setup).flatMap((issue) => {
    const targets = issue.record_ids.length ? issue.record_ids : ["sessions:"];
    return targets.map((target) => {
      const split = target.indexOf(":"),
        c = target.slice(0, split) as Collection,
        id = target.slice(split + 1),
        table = tables.find((t) => t.collection === c);
      const idColumn =
        c === "rooms"
          ? "room_id"
          : c === "sessions"
            ? "session_id"
            : c === "volunteers"
              ? "volunteer_id"
              : "";
      const index =
        table?.rows.findIndex((r, i) =>
          idColumn
            ? r[table.headers.indexOf(table.mapping[idColumn] ?? "")] === id
            : `csv-${i + 1}` === id,
        ) ?? -1;
      const column = (
        {
          COVERAGE: "required_volunteers",
          CAPACITY: c === "rooms" ? "capacity" : "expected_attendance",
          FEATURES: c === "rooms" ? "feature_tags" : "required_feature_tags",
          ROLE: c === "volunteers" ? "role_tags" : "role_tag",
          AVAILABILITY: "start",
          DEPENDENCY: "minimum_gap_minutes",
          TIME: "start",
          ROOM_OVERLAP: "start",
          VOLUNTEER_OVERLAP: "start",
          REFERENCES: idColumn || "row",
          SHAPE: "row",
          LIMITS: "rows",
        } as const
      )[issue.rule];
      const value =
        table && index >= 0
          ? (table.rows[index]?.[
              table.headers.indexOf(table.mapping[column] ?? "")
            ] ?? id)
          : id;
      return {
        severity: "error" as const,
        file: table?.filename ?? "Whole plan",
        row: index >= 0 ? table!.lines[index]! : 1,
        column,
        value,
        message: issue.message,
        action: `Correct ${column} or the related records in this batch or the manual editor, then check the entire plan again.`,
      };
    });
  });
}
