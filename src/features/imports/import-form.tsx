"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { collections } from "@/features/plans/schema";
import { planRequest } from "@/features/plans/editor";
import {
  templates,
  reviewImport,
  constraintDiagnostics,
  type ImportTable,
  type Setup,
} from "./model";
import { FILE_BYTES, BATCH_BYTES } from "./csv";
export function ImportUpload({
  eventId,
  generation,
}: {
  eventId: string;
  generation: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setError("");
        let total = 0;
        for (const [k, v] of [...form])
          if (v instanceof File) {
            if (!v.size) {
              form.delete(k);
              continue;
            }
            total += v.size;
            if (v.size > FILE_BYTES || total > BATCH_BYTES) {
              setError("Choose files of at most 2 MiB each and 10 MiB total.");
              return;
            }
          }
        setPending(true);
        try {
          const response = await fetch(`/api/events/${eventId}/imports`, {
            method: "POST",
            body: form,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          router.push(
            `/events/${eventId}/imports/${data.id}${data.repeated_file ? "?repeated=1" : ""}`,
          );
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Upload failed. Your files remain selected. Retry the upload.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="expected_generation" value={generation} />
      <fieldset disabled={pending} className="stack">
        <legend>Starting plan files</legend>
        {collections.map((c) => (
          <div className="field" key={c}>
            <label htmlFor={`file-${c}`}>{templates[c].filename}</label>
            <p id={`help-${c}`}>
              {templates[c].required.join(", ")} ·{" "}
              <a
                href={`/api/events/${eventId}/imports/templates/${templates[c].filename}`}
              >
                Download template
              </a>
            </p>
            <input
              id={`file-${c}`}
              aria-describedby={`help-${c}`}
              name={c}
              type="file"
              accept=".csv,text/csv"
            />
          </div>
        ))}
      </fieldset>
      <p>
        UTF 8 CSV, comma separated, up to 2 MiB per file and 10 MiB per batch.
        Rooms and schedule are needed for confirmation. Roster, availability and
        assignments are needed when sessions require volunteers. Optional
        dependencies remain explicit.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload for private review"}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function ImportCorrection({
  eventId,
  batchId,
  generation,
  draftGeneration,
  initial,
  originals,
  setup,
  locked,
}: {
  eventId: string;
  batchId: string;
  generation: number;
  draftGeneration: number;
  initial: ImportTable[];
  originals: { artifact_id: string; original_table: ImportTable }[];
  setup: Setup;
  locked: boolean;
}) {
  const router = useRouter();
  const [tables, setTables] = useState(initial),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [pages, setPages] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const review = reviewImport(tables, setup);
  let constraints: ReturnType<typeof constraintDiagnostics> = [];
  if (!review.issues.some((i) => i.severity === "error")) {
    try {
      constraints = constraintDiagnostics(tables, review.records, setup);
    } catch {
      /* Field diagnostics describe invalid times before full validation. */
    }
  }
  function change(index: number, patch: Partial<ImportTable>) {
    setTables((p) => p.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    setDirty(true);
    setConfirmed(false);
  }
  async function save(stage = false) {
    setPending(true);
    setError("");
    try {
      await planRequest(
        `/api/events/${eventId}/imports/${batchId}`,
        {
          generation,
          tables,
          stage,
          ...(stage ? { expected_draft: draftGeneration, confirmed } : {}),
        },
        "PUT",
      );
      if (stage) router.push(`/events/${eventId}/records`);
      else router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your corrections remain here.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack">
      <div className="state-panel">
        <h2>Review the complete batch</h2>
        <p>
          {setup.date} · {setup.timezone} · {setup.start} to {setup.end}
        </p>
        <p>
          Original files remain unchanged. Save corrections to resume later.
          Excluded rows and Keep one decisions are explicit. Active defaults to
          true, buffers to zero, and blank assignment times to the session
          interval. Blank capacity and attendance remain unknown.
        </p>
      </div>
      {locked && (
        <p role="status">
          This import is read only. These records are retained for reference.{" "}
          <Link href={`/events/${eventId}/records`}>Propose a correction</Link>.
        </p>
      )}
      <fieldset className="stack" disabled={pending || locked}>
        <legend>Mappings and corrections</legend>
        {tables.map((t, ti) => {
          const spec = templates[t.collection],
            page = pages[t.collection] ?? 0;
          const original = originals.find(
            (o) => o.original_table.sha256 === t.sha256,
          );
          return (
            <section className="stack import-table" key={t.sha256}>
              <h2>{t.filename}</h2>
              <p>
                {t.rows.length} rows · {t.excluded.length} explicitly excluded ·{" "}
                {t.collection}
              </p>
              <details>
                <summary>Map columns ({spec.required.length} required)</summary>
                <div className="form-columns">
                  {[...spec.required, ...spec.optional].map((h) => (
                    <div className="field" key={h}>
                      <label htmlFor={`${ti}-${h}`}>
                        {h}
                        {(spec.required as readonly string[]).includes(h)
                          ? " (required)"
                          : " (optional)"}
                      </label>
                      <select
                        id={`${ti}-${h}`}
                        value={t.mapping[h] ?? ""}
                        onChange={(e) => {
                          const mapping = { ...t.mapping };
                          if (e.target.value) mapping[h] = e.target.value;
                          else delete mapping[h];
                          change(ti, { mapping });
                        }}
                      >
                        <option value="">Not mapped</option>
                        {t.headers.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p>
                  Unmapped columns:{" "}
                  {t.headers
                    .filter((h) => !Object.values(t.mapping).includes(h))
                    .join(", ") || "None"}
                  . Their original values remain in the file; they do not become
                  plan fields.
                </p>
              </details>
              {original && (
                <p>
                  <Link
                    href={`/api/events/${eventId}/imports/${batchId}/files/${t.sha256}`}
                  >
                    Download unchanged original
                  </Link>
                </p>
              )}
              <p>
                {t.rows.length
                  ? `Rows ${page * 20 + 1} to ${Math.min(t.rows.length, (page + 1) * 20)} of ${t.rows.length}. Line numbers refer to the original file.`
                  : "No data rows. This template contributes no records."}
              </p>
              {t.rows.slice(page * 20, (page + 1) * 20).map((cells, n) => {
                const i = page * 20 + n;
                return (
                  <details key={i} className="record-editor">
                    <summary>
                      Row {t.lines[i]}
                      {t.excluded.includes(i) ? " · Excluded" : ""}
                      {original &&
                      JSON.stringify(cells) !==
                        JSON.stringify(original.original_table.rows[i])
                        ? " · Corrected"
                        : ""}
                    </summary>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={t.excluded.includes(i)}
                        onChange={(e) =>
                          change(ti, {
                            excluded: e.target.checked
                              ? [...t.excluded, i]
                              : t.excluded.filter((k) => k !== i),
                          })
                        }
                      />
                      Exclude this row from the candidate
                    </label>
                    <div className="form-columns">
                      {t.headers.map((h, j) => (
                        <div className="field" key={h}>
                          <label htmlFor={`cell-${ti}-${i}-${j}`}>{h}</label>
                          <input
                            id={`cell-${ti}-${i}-${j}`}
                            value={cells[j]}
                            maxLength={4096}
                            onChange={(e) =>
                              change(ti, {
                                rows: t.rows.map((r, k) =>
                                  k === i
                                    ? r.map((v, col) =>
                                        col === j ? e.target.value : v,
                                      )
                                    : r,
                                ),
                              })
                            }
                          />
                          {original &&
                            original.original_table.rows[i]?.[j] !==
                              cells[j] && (
                              <p>
                                Original:{" "}
                                {original.original_table.rows[i]?.[j] ||
                                  "(blank)"}
                              </p>
                            )}
                        </div>
                      ))}
                    </div>
                    {["sessions", "availability", "assignments"].includes(
                      t.collection,
                    ) && (
                      <div className="form-columns">
                        {["start", "end"].map((edge) => (
                          <div className="field" key={edge}>
                            <label htmlFor={`offset-${ti}-${i}-${edge}`}>
                              {edge} UTC offset for a repeated time
                            </label>
                            <input
                              id={`offset-${ti}-${i}-${edge}`}
                              placeholder="+01:00"
                              value={
                                t.offsets[String(i)]?.[
                                  edge as "start" | "end"
                                ] ?? ""
                              }
                              onChange={(e) =>
                                change(ti, {
                                  offsets: {
                                    ...t.offsets,
                                    [i]: {
                                      start: t.offsets[String(i)]?.start ?? "",
                                      end: t.offsets[String(i)]?.end ?? "",
                                      [edge]: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                );
              })}
              <div className="actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page === 0}
                  onClick={() =>
                    setPages((p) => ({ ...p, [t.collection]: page - 1 }))
                  }
                >
                  Previous rows
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={(page + 1) * 20 >= t.rows.length}
                  onClick={() =>
                    setPages((p) => ({ ...p, [t.collection]: page + 1 }))
                  }
                >
                  Next rows
                </Button>
              </div>
            </section>
          );
        })}
        {review.issues.length > 0 && (
          <section className="stack">
            <h2>Field checks</h2>
            <ul className="stack">
              {review.issues.map((issue, i) => (
                <li key={i}>
                  <strong>
                    {issue.severity === "error" ? "Needs correction" : "Review"}
                    : {issue.file}, row {issue.row}, {issue.column}
                  </strong>
                  <p>
                    Value: {issue.value || "(blank)"}. {issue.message}{" "}
                    {issue.action}
                  </p>
                  {issue.message.startsWith("Identical duplicate") && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const ti = tables.findIndex(
                          (t) => t.filename === issue.file,
                        );
                        change(ti, {
                          keep_one: [...tables[ti]!.keep_one, issue.value],
                        });
                      }}
                    >
                      Keep one ({issue.file}, row {issue.row})
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button type="button" disabled={!dirty} onClick={() => save()}>
          {pending ? "Saving…" : "Save corrections"}
        </Button>
      </fieldset>
      <p role="status">
        {dirty
          ? "Corrections have not been saved."
          : `Saved import version ${generation}. No official plan changes.`}
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}{" "}
          <a href={`/events/${eventId}/imports/${batchId}`}>
            Reload saved import
          </a>
        </p>
      )}
      {constraints.length > 0 && (
        <section className="stack">
          <h2>Whole plan checks</h2>
          <ul>
            {constraints.map((i, n) => (
              <li key={n}>
                {i.file}, row {i.row}, column {i.column}: {i.message} Value:{" "}
                {i.value || "(blank)"}. {i.action}
              </li>
            ))}
          </ul>
          <p>
            You can review these records in the manual editor to fill
            assignments or resolve remaining constraints before confirmation.
          </p>
        </section>
      )}
      {!locked && (
        <section className="stack">
          <h2>Continue to starting plan review</h2>
          <p>
            This replaces the saved starting draft (version {draftGeneration})
            with this entire batch. It does not create an official revision. Use
            the next review to add manual records, check coverage and inspect
            evidence before confirming revision 1.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={dirty || pending}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the mappings, included rows, duplicate decisions and
            defaults. I confirm these facts and replacement of the saved
            starting draft.
          </label>
          <Button
            disabled={
              dirty ||
              pending ||
              !confirmed ||
              review.issues.some((i) => i.severity === "error")
            }
            onClick={() => save(true)}
          >
            Check and review starting plan
          </Button>
        </section>
      )}
    </div>
  );
}
