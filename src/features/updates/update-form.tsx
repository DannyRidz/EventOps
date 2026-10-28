"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { planRequest } from "@/features/plans/editor";
export type TextDraft = {
  id: string;
  raw_text: string;
  corrected_text: string;
  generation: number;
};
export function UpdateForm({
  eventId,
  baseId,
  initial,
  analysisEnabled = false,
}: {
  eventId: string;
  baseId: string;
  initial?: TextDraft | null;
  analysisEnabled?: boolean;
}) {
  const [draft, setDraft] = useState(initial ?? null);
  const [text, setText] = useState(initial?.corrected_text ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<{
    id: string;
    state: string;
    stage: string;
  } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const dirty = text !== (draft?.corrected_text ?? "");
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    setPending(true);
    setError("");
    try {
      const saved = await planRequest(
        `/api/events/${eventId}/updates${draft ? `/${draft.id}` : ""}`,
        {
          raw_text: draft?.raw_text ?? text,
          corrected_text: text,
          idempotency_key: key,
          ...(draft ? { expected_generation: draft.generation } : {}),
        },
        draft ? "PUT" : "POST",
      );
      setDraft(saved);
      setText(saved.corrected_text);
      setConfirmed(false);
      setJob(null);
      window.history.replaceState(
        null,
        "",
        `/events/${eventId}/updates/${saved.id}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }
  async function analyze() {
    if (!draft) return;
    setPending(true);
    setError("");
    try {
      const result = await planRequest(
        `/api/events/${eventId}/updates/${draft.id}/analyze`,
        {
          generation: draft.generation,
          base_revision_id: baseId,
          confirmed_text: draft.corrected_text,
          confirmed: true,
        },
      );
      setJob({
        id: result.id,
        state: result.state ?? "blocked",
        stage: result.stage ?? "Awaiting model access",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack">
      <h2>{draft ? "Review saved update text" : "Add a text update"}</h2>
      <p>
        {analysisEnabled
          ? "Confirm saved text before analysis. Event records and your confirmed text are processed by Meta. New facts and interpreted requests require your review before a proposal can be approved."
          : "Analysis is unavailable while model access is being verified. You can save and confirm your text, then prepare exact manual changes with the same plan checks and approval review. Text is not sent to a provider."}
      </p>
      <div className="field">
        <label htmlFor="update-text">Organizer update</label>
        <p id="update-hint">
          Up to 10,000 characters. Saving or confirming text does not change the
          approved plan.
        </p>
        <textarea
          id="update-text"
          rows={6}
          maxLength={10000}
          aria-describedby="update-hint"
          value={text}
          disabled={pending}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmed(false);
            setKey(crypto.randomUUID());
            setJob(null);
          }}
        />
      </div>
      <Button
        disabled={pending || !text.trim() || (!dirty && !!draft)}
        onClick={save}
      >
        Save update text
      </Button>
      <p role="status">
        {dirty
          ? "Text has not been saved."
          : draft
            ? `Saved text generation ${draft.generation}.`
            : ""}
      </p>
      {draft && (
        <>
          <details>
            <summary>Original saved text</summary>
            <p className="preserve-text">{draft.raw_text}</p>
          </details>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={pending || dirty}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this exact text for analysis.
          </label>
          <Button disabled={!confirmed || dirty || pending} onClick={analyze}>
            {analysisEnabled
              ? "Analyze confirmed text"
              : "Confirm text and record analysis request"}
          </Button>
        </>
      )}
      {job && (
        <div role="status" className="state-panel">
          <h3>{job.stage}</h3>
          <p>
            {job.state === "blocked"
              ? "Your confirmed text and blocked job are saved. No analysis has run."
              : "Your confirmed text and analysis request are saved."}{" "}
            Job <span className="break-text">{job.id}</span>.
          </p>
          <Link href={`/events/${eventId}/analysis/${job.id}`}>
            Open saved analysis
          </Link>
          <Link href={`/events/${eventId}/records`}>
            Prepare manual changes
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
