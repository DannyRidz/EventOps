import { collections, planSchema, type Plan } from "./schema";
import { comparePlans, displayValue, recordName } from "./comparison";
import { validatePlan } from "./validate";
export type BriefingRevision = {
  id: string;
  revision_number: number;
  approved_at: string;
  snapshot: Plan;
};
export function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const safe =
    /^[\s]*[=+\-@\t\r]/u.test(text) || /^[\t\r]/u.test(text)
      ? "'" + text
      : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function briefingCsv(
  revision: BriefingRevision,
  collection: (typeof collections)[number],
): string {
  const plan = revision.snapshot;
  const fields = Object.keys(planSchema.shape[collection].element.shape);
  const header = [
    "event_name",
    "event_date",
    "event_timezone",
    "approved_revision",
    "revision_id",
    ...fields,
  ];
  const rows = plan[collection].map((row) => [
    plan.event.name,
    plan.event.date,
    plan.event.timezone,
    revision.revision_number,
    revision.id,
    ...fields.map((field) => (row as Record<string, unknown>)[field]),
  ]);
  return (
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
export function briefingText(
  revision: BriefingRevision,
  parent?: Plan,
): string {
  const p = revision.snapshot;
  const lines = [
    p.event.name,
    `Approved revision ${revision.revision_number} (${revision.id})`,
    `Event date: ${p.event.date}`,
    `Timezone: ${p.event.timezone}`,
    `Approved at: ${revision.approved_at}`,
    `Operating hours: ${p.event.start} (${p.event.start_offset}) to ${p.event.end} (${p.event.end_offset})`,
    "Only this approved revision is included. Pending updates are excluded.",
    "",
  ];
  lines.push("CHANGES SINCE PREVIOUS REVISION");
  if (parent) {
    const changes = comparePlans(parent, p);
    lines.push(
      ...changes.map(
        (c) =>
          `${recordName(p, c.record_id) ?? recordName(parent, c.record_id) ?? c.record_id} / ${c.field}: ${displayValue(c.before)} -> ${displayValue(c.after)}`,
      ),
    );
    if (!changes.length) lines.push("No field changes.");
  } else lines.push("Initial approved plan.");
  for (const c of collections) {
    lines.push("", c.toUpperCase());
    if (!p[c].length) lines.push("None recorded.");
    for (const row of p[c]) {
      lines.push(
        ...Object.entries(row).map(([k, v]) => `${k}: ${displayValue(v)}`),
        "",
      );
    }
  }
  const issues = validatePlan(p);
  lines.push(
    "RECORDED CONSTRAINT CHECKS",
    ...(issues.length
      ? issues.map((i) => `${i.rule}: ${i.message}`)
      : [
          "No blocking conflicts against recorded constraints. Unknown facts remain unknown.",
        ]),
  );
  return lines.join("\n") + "\n";
}
