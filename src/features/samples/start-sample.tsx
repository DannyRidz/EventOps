"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { loadSample, sampleRequestKey } from "./create";

export function StartSample() {
  const router = useRouter();
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  async function start() {
    if (!reviewed || pending) return;
    setPending(true);
    setError("");
    try {
      let key: string;
      try {
        key = sampleRequestKey(window.sessionStorage);
      } catch {
        throw new Error(
          "Your browser cannot retain this sample request. Enable session storage or create an event manually. Nothing new has been created by this attempt.",
        );
      }
      const id = await loadSample(
        async (path, body, method = "POST") => {
          const response = await fetch(path, {
            method,
            ...(body === undefined
              ? {}
              : {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(
              data.message ??
                "Could not load the sample. Retry or open the saved draft.",
            );
          return data;
        },
        key,
        setEventId,
      );
      router.push(`/events/${id}/guide`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load the sample. Retry or open the saved draft.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack" aria-busy={pending}>
      <label className="check-label">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={pending}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        <span>
          I have reviewed these fictional records and want to load them as a
          private draft.
        </span>
      </label>
      <p>
        Loading does not approve a starting plan, send data to AI or accept any
        terms. Repeating this action in this tab resumes the same sample event.
      </p>
      <Button disabled={!reviewed || pending} onClick={start}>
        {pending ? "Loading sample…" : "Load or resume sample event"}
      </Button>
      {error && (
        <div role="alert" className="state-panel">
          <p>{error}</p>
          {eventId && (
            <Link href={`/events/${eventId}/records`}>
              Open saved sample draft
            </Link>
          )}
          <p>
            <Link href="/events/new">Create an event manually</Link>
          </p>
        </div>
      )}
    </div>
  );
}
