"use client";
import { useEffect, useState } from "react";
import { operationKey } from "./request-key";
import { useRouter } from "next/navigation";
import { collections, type Plan, type Issue } from "./schema";
import {
  editableRecords,
  newRow,
  recordFields,
  recordLabel,
  fieldValue,
  planInput,
  manualPatch,
  type Collection,
  type Records,
} from "./editor-model";
import { PlanEvidence } from "./plan-evidence";
import { PlanRecords, ValidationReport } from "./plan-records";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
export async function planRequest(
  path: string,
  body: unknown,
  method = "POST",
) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message ||
        "Could not save. Your edits remain here. Retry or reload saved data.",
    );
  return data;
}
export function PlanEditor({
  eventId,
  initial,
  generation,
  base,
  digest,
  report,
  editing,
  patchBase,
}: {
  eventId: string;
  initial: Plan | null;
  generation: number;
  base?: { id: string; number: number };
  digest?: string | null;
  report?: Issue[];
  patchBase?: Plan;
  editing?: {
    id: string;
    generation: number;
    interpreted: boolean;
    restores: boolean;
    contextDigest?: string;
  };
}) {
  const router = useRouter();
  const [records, setRecords] = useState(() => editableRecords(initial));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState<{
    snapshot: Plan;
    generation: number;
    candidate_digest: string;
    validation_report: Issue[];
  } | null>(
    initial && digest && !base
      ? {
          snapshot: initial,
          generation,
          candidate_digest: digest,
          validation_report: report ?? [],
        }
      : null,
  );
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(
    c: Collection,
    i: number,
    k: string,
    v: Records[Collection][number][string],
  ) {
    setRecords((prev) => ({
      ...prev,
      [c]: prev[c].map((r, index) => (index === i ? { ...r, [k]: v } : r)),
    }));
    setDirty(true);
    setConfirmed(false);
    setKey(crypto.randomUUID());
  }
  async function save() {
    setPending(true);
    setError("");
    try {
      if (base && initial) {
        const p = await planRequest(
          editing
            ? `/api/events/${eventId}/proposals/${editing.id}`
            : `/api/events/${eventId}/proposals`,
          {
            ...(editing
              ? {
                  generation: editing.generation,
                  withdraw_interpreted_requests: withdraw,
                  ...(editing.contextDigest
                    ? { context_digest: editing.contextDigest }
                    : {}),
                }
              : { mode: "manual", expected_head: base.id }),
            patch: manualPatch(patchBase ?? initial, records),
            confirmed: true,
            reason,
            idempotency_key: key,
          },
          editing ? "PUT" : "POST",
        );
        setDirty(false);
        router.push(`/events/${eventId}/proposals/${p.id}`);
      } else {
        const result = await planRequest(
          `/api/events/${eventId}/draft`,
          {
            plan: planInput(records),
            expected_generation: saved?.generation ?? generation,
            confirmed: true,
          },
          "PUT",
        );
        setSaved(result);
        setRecords(editableRecords(result.snapshot));
        setDirty(false);
        setConfirmed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }
  async function approve() {
    if (!saved) return;
    setPending(true);
    setError("");
    try {
      await planRequest(`/api/events/${eventId}/confirm-plan`, {
        expected_generation: saved.generation,
        candidate_digest: saved.candidate_digest,
        idempotency_key: operationKey(
          `confirm:${eventId}:${saved.generation}:${saved.candidate_digest}`,
        ),
      });
      router.push(`/events/${eventId}/briefing`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack">
      <p>
        {base
          ? `Manual proposal against approved revision ${base.number}. Confirm the exact field changes below. A reason is context, not an interpreted request.`
          : "Enter all records, save them for checks, then review the entire starting plan. Confirmation creates revision 1."}
      </p>
      <p>
        Tags use semicolons. Blank capacity, attendance and role mean unknown or
        unspecified. Setup and teardown default to zero, active volunteers
        default to yes. Enter assignment times explicitly. UTC offsets are
        needed when a local time repeats.
      </p>
      {editing && (
        <p>
          Saving creates generation {editing.generation + 1} and preserves this
          candidate as an earlier rejected generation.
        </p>
      )}
      {editing?.restores && (
        <p role="status">
          This candidate restores a historical revision. Confirming exact
          changes also reconfirms its historical availability, activity and
          reinstated sessions after reviewing current updates.
        </p>
      )}
      {editing?.interpreted && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={withdraw}
            onChange={(e) => setWithdraw(e.target.checked)}
          />
          I explicitly withdraw every interpreted request in the original
          proposal and replace them with the exact manual changes entered here.
        </label>
      )}
      <fieldset disabled={pending} className="stack">
        <legend>Plan records</legend>
        {collections.map((c) => (
          <section key={c} className="stack">
            <h2>{c[0]!.toUpperCase() + c.slice(1)}</h2>
            {records[c].map((row, i) => (
              <fieldset className="record-editor stack" key={`${c}-${i}`}>
                <legend>
                  {c} record {i + 1}
                </legend>
                <TextField
                  label="Record identifier"
                  required
                  value={String(row.external_id)}
                  onChange={(e) => change(c, i, "external_id", e.target.value)}
                  maxLength={64}
                />
                <div className="form-columns">
                  {recordFields[c].map((f) => {
                    const id = `${c}-${i}-${f.key}`;
                    return f.reference || f.options || f.type === "boolean" ? (
                      <div className="field" key={f.key}>
                        <label htmlFor={id}>{f.label}</label>
                        <select
                          id={id}
                          value={String(row[f.key] ?? "")}
                          onChange={(e) =>
                            change(
                              c,
                              i,
                              f.key,
                              f.type === "boolean"
                                ? e.target.value === "true"
                                : e.target.value,
                            )
                          }
                        >
                          <option value="">Choose</option>
                          {f.reference
                            ? records[f.reference].map((r, n) => (
                                <option
                                  key={n}
                                  value={String(r.id ?? r.external_id)}
                                >
                                  {recordLabel(r)}
                                </option>
                              ))
                            : (f.options ?? ["true", "false"]).map((o) => (
                                <option key={o} value={o}>
                                  {o === "true"
                                    ? "Yes"
                                    : o === "false"
                                      ? "No"
                                      : o}
                                </option>
                              ))}
                        </select>
                      </div>
                    ) : (
                      <TextField
                        key={f.key}
                        id={id}
                        label={f.label}
                        type={
                          f.type === "number"
                            ? "number"
                            : f.type === "time"
                              ? "time"
                              : "text"
                        }
                        min={f.type === "number" ? 0 : undefined}
                        value={
                          Array.isArray(row[f.key])
                            ? (row[f.key] as string[]).join("; ")
                            : String(row[f.key] ?? "")
                        }
                        onChange={(e) =>
                          change(c, i, f.key, fieldValue(f, e.target.value))
                        }
                      />
                    );
                  })}
                </div>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setRecords((p) => ({
                      ...p,
                      [c]: p[c].filter((_, n) => n !== i),
                    }));
                    setDirty(true);
                    setConfirmed(false);
                    setKey(crypto.randomUUID());
                  }}
                >
                  Remove record {i + 1}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRecords((p) => ({ ...p, [c]: [...p[c], newRow(c)] }));
                setDirty(true);
                setConfirmed(false);
                setKey(crypto.randomUUID());
              }}
            >
              Add{" "}
              {c === "availability"
                ? "availability interval"
                : c === "dependencies"
                  ? "dependency"
                  : c.slice(0, -1)}
            </Button>
          </section>
        ))}
      </fieldset>
      {base && (
        <div className="field">
          <label htmlFor="reason">Reason for these exact manual changes</label>
          <textarea
            id="reason"
            value={reason}
            maxLength={2000}
            onChange={(e) => {
              setReason(e.target.value);
              setKey(crypto.randomUUID());
            }}
          />
        </div>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm these manually entered facts and exact changes.
      </label>
      <Button
        disabled={
          pending ||
          (editing?.interpreted && !withdraw) ||
          !confirmed ||
          (!!base && !reason.trim())
        }
        onClick={save}
      >
        {pending
          ? "Saving…"
          : base
            ? "Check and review proposal"
            : "Save records and check plan"}
      </Button>
      <p role="status">
        {dirty
          ? "Edits have not been saved."
          : saved
            ? `Saved draft version ${saved.generation}. Not approved.`
            : ""}
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error} <a href={`/events/${eventId}/plan`}>Reload saved plan</a>
        </p>
      )}
      {saved && !dirty && !base && (
        <section className="stack">
          <h2>Review starting plan</h2>
          <ValidationReport issues={saved.validation_report} />
          <PlanRecords plan={saved.snapshot} />
          <PlanEvidence plan={saved.snapshot} eventId={eventId} />
          <p>
            Save this exact starting plan as revision 1. This creates your event
            plan and briefing. No messages will be sent.
          </p>
          <Button
            disabled={pending || saved.validation_report.length > 0}
            onClick={approve}
          >
            Confirm starting plan as revision 1
          </Button>
        </section>
      )}
    </div>
  );
}
