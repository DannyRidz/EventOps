"use client";
import Link from "next/link";
import { useState } from "react";
import { collections, type Plan } from "./schema";
export function PlanEvidence({
  plan,
  eventId,
}: {
  plan: Plan;
  eventId: string;
}) {
  const [record, setRecord] = useState("event");
  const [field, setField] = useState("");
  const entries = plan.provenance.filter((p) => p.record_id === record);
  const selected = entries.find((p) => p.field_path === field) ?? entries[0];
  return (
    <details>
      <summary>Inspect frozen field sources</summary>
      <div className="stack">
        <div className="field">
          <label htmlFor="source-record">Record</label>
          <select
            id="source-record"
            value={record}
            onChange={(e) => {
              setRecord(e.target.value);
              setField("");
            }}
          >
            <option value="event">Event details</option>
            {collections.flatMap((c) =>
              plan[c].map((r) => (
                <option key={r.id} value={r.id}>
                  {c}:{" "}
                  {"name" in r
                    ? r.name
                    : "title" in r
                      ? r.title
                      : "display_name" in r
                        ? r.display_name
                        : r.external_id}{" "}
                  ({r.external_id})
                </option>
              )),
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="source-field">Field</label>
          <select
            id="source-field"
            value={selected?.field_path ?? ""}
            onChange={(e) => setField(e.target.value)}
          >
            {entries.map((p) => (
              <option key={p.field_path} value={p.field_path}>
                {p.field_path}
              </option>
            ))}
          </select>
        </div>
        {selected ? (
          <ul>
            {selected.source_record_ids.map((source) => (
              <li key={source}>
                <Link href={`/events/${eventId}/evidence/${source}`}>
                  Open frozen {selected.field_path} value
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No source recorded for this selection.</p>
        )}
      </div>
    </details>
  );
}
