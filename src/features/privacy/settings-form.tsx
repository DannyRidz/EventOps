"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Temporal } from "@js-temporal/polyfill";
import type { Settings, LifecycleEvent } from "./data";
function deadline(event: LifecycleEvent, days: number) {
  return Temporal.PlainDate.from(event.event_date)
    .add({ days: days + 1 })
    .toZonedDateTime({ timeZone: event.timezone, plainTime: "00:00" })
    .toInstant()
    .toString();
}
export function PrivacySettings({ initial }: { initial: Settings }) {
  const [saved, setSaved] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [days, setDays] = useState<Record<string, number>>({}),
    [confirm, setConfirm] = useState("");
  async function change(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      const fresh = await fetch("/api/workspace/settings");
      setSaved(fresh.ok ? await fresh.json() : result);
      setConfirm("");
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save. Reload settings and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteOriginal(event_id: string, artifact_id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspace/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id, artifact_id }),
      });
      if (!response.ok)
        throw new Error("Could not schedule original deletion.");
      const next = await fetch("/api/workspace/settings");
      if (!next.ok) throw new Error("Reload settings to see original status.");
      setSaved(await next.json());
      setMessage(
        "Original CSV is unavailable. Byte cleanup is scheduled; frozen cells remain.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not delete original.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <p role="status" aria-live="polite">
        {message}
      </p>
      {saved.deletion_requested_at ? (
        <section className="state-panel stack">
          <h2>Account deletion scheduled</h2>
          <p>
            Event access and processing are disabled. Your account will be
            purged after {saved.purge_after}. Recovery is available until that
            deadline.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              change({
                kind: "account",
                generation: saved.generation,
                action: "recover",
                confirmed: true,
              })
            }
          >
            Cancel account deletion
          </Button>
        </section>
      ) : (
        <>
          <section className="state-panel stack">
            <h2>Download your workspace</h2>
            <p>
              The private ZIP includes saved records, revisions, safe CSV tables
              and available originals. The manifest identifies expired
              originals. It may contain personal information. Keep your
              downloaded copy private.
            </p>
            <a className="button button-secondary" href="/api/workspace/export">
              Download workspace ZIP
            </a>
          </section>
          <section className="stack">
            <h2>Event retention and recovery</h2>
            <p>
              Retention runs from the end of the event date in its timezone.
              Setup drafts also expire after 30 days without a save. Trash has a
              seven day recovery window, limited by the earlier retention
              deadline. Archiving makes an event read only.
            </p>
            {saved.events.length === 0 && <p>No retained events.</p>}
            {saved.events.map((event) => (
              <article className="state-panel stack" key={event.id}>
                <h3>{event.name}</h3>
                <p>
                  {event.status} · {event.timezone}
                </p>
                <p>
                  Purge after{" "}
                  <time dateTime={event.purge_after}>{event.purge_after}</time>
                </p>
                {event.status !== "trashed" && (
                  <>
                    <Link href={`/events/${event.id}/plan`}>Open event</Link>
                    <div className="field">
                      <label htmlFor={`retention-${event.id}`}>
                        Event retention
                      </label>
                      <select
                        id={`retention-${event.id}`}
                        value={days[event.id] ?? event.retention_days}
                        onChange={(e) =>
                          setDays({
                            ...days,
                            [event.id]: Number(e.target.value),
                          })
                        }
                      >
                        {[30, 90, 365].map((n) => (
                          <option key={n} value={n}>
                            {n} days
                          </option>
                        ))}
                      </select>
                    </div>
                    <p>
                      Selected retention ends{" "}
                      {deadline(event, days[event.id] ?? event.retention_days)}.
                      An earlier setup expiry still applies. A past deadline
                      makes the event eligible for immediate purge.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        change({
                          kind: "event",
                          id: event.id,
                          generation: event.generation,
                          action: "retention",
                          days: days[event.id] ?? event.retention_days,
                        })
                      }
                    >
                      Save retention
                    </Button>
                  </>
                )}
                {(saved.originals ?? [])
                  .filter((o) => o.event_id === event.id)
                  .map((o) => (
                    <div key={o.artifact_id}>
                      <p>
                        {o.filename}:{" "}
                        {o.available
                          ? "Original CSV retained"
                          : "Original CSV deleted or expired"}
                      </p>
                      {o.available && event.status !== "archived" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            deleteOriginal(event.id, o.artifact_id)
                          }
                        >
                          Delete original CSV
                        </Button>
                      )}
                    </div>
                  ))}
                <div className="section-actions">
                  {event.status === "trashed" ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        change({
                          kind: "event",
                          id: event.id,
                          generation: event.generation,
                          action: "restore",
                        })
                      }
                    >
                      Restore event
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          change({
                            kind: "event",
                            id: event.id,
                            generation: event.generation,
                            action:
                              event.status === "archived"
                                ? "reopen"
                                : "archive",
                          })
                        }
                      >
                        {event.status === "archived"
                          ? "Reopen event"
                          : "Archive event"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setConfirm(event.id)}
                      >
                        Move to trash
                      </Button>
                    </>
                  )}
                </div>
                {confirm === event.id && (
                  <div className="stack">
                    <p>
                      Hide this event and cancel pending processing? You can
                      restore it for seven days, unless retention expires
                      sooner.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        change({
                          kind: "event",
                          id: event.id,
                          generation: event.generation,
                          action: "trash",
                        })
                      }
                    >
                      Confirm move to trash
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirm("")}>
                      Keep event
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </section>
          <section className="state-panel stack">
            <h2>Delete account</h2>
            <p>
              Export first. Deletion immediately disables event access and
              processing. After seven days, your event content, private files
              and sign in identity are purged. Backups can retain deleted bytes
              until their expiry; deletion identifiers must be reapplied on
              recovery.
            </p>
            <p>
              You must have signed in within the last ten minutes. A refreshed
              session alone does not count.
            </p>
            {confirm === "account" ? (
              <>
                <p>Schedule deletion of your entire account?</p>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    change({
                      kind: "account",
                      generation: saved.generation,
                      action: "delete",
                      confirmed: true,
                    })
                  }
                >
                  Confirm account deletion
                </Button>
                <Button variant="secondary" onClick={() => setConfirm("")}>
                  Keep account
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("account")}
              >
                Request account deletion
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
