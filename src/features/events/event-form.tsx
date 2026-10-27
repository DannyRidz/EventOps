"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import type { EventDraft } from "./data";
export function EventForm({ draft }: { draft?: EventDraft }) {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [timezone, setTimezone] = useState(draft?.snapshot.timezone ?? "");
  const [confirmed, setConfirmed] = useState(!!draft);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string[]>>({});
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    const values = new FormData(event.currentTarget);
    const setup = Object.fromEntries(values);
    const body = {
      setup: {
        ...setup,
        locations: String(values.get("locations") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        start_offset: values.get("start_offset") || undefined,
        end_offset: values.get("end_offset") || undefined,
      },
      request_id: requestId,
      expected_generation: draft?.generation,
    };
    try {
      const response = await fetch(
        draft ? `/api/events/${draft.event_id}/draft` : "/api/events",
        {
          method: draft ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setFields(result.field_errors ?? {});
        throw new Error(result.message);
      }
      router.push(`/events/${result.event_id}/plan`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not connect. Your changes have not been saved.",
      );
      setPending(false);
    }
  }
  return (
    <form onSubmit={save} className="stack form-panel" aria-busy={pending}>
      <TextField
        label="Event name"
        name="name"
        required
        maxLength={120}
        defaultValue={draft?.snapshot.name}
        error={fields.name?.join(" ")}
      />
      <TextField
        label="Event date"
        name="date"
        type="date"
        required
        defaultValue={draft?.snapshot.date}
        error={fields.date?.join(" ")}
      />
      <TextField
        label="Timezone"
        name="timezone"
        required
        value={timezone}
        onChange={(e) => {
          setTimezone(e.target.value);
          setConfirmed(false);
        }}
        hint="Use an IANA name, for example Asia/Brunei or America/New_York."
        error={fields.timezone?.join(" ")}
      />
      <Button
        variant="secondary"
        onClick={() => {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
          setConfirmed(false);
        }}
      >
        Use this device’s timezone
      </Button>
      <label className="check-label">
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I confirm this is the event’s timezone.</span>
      </label>
      <div className="form-columns">
        <TextField
          label="Operating start"
          name="start"
          type="time"
          required
          defaultValue={draft?.snapshot.start}
          error={fields.start?.join(" ")}
        />
        <TextField
          label="Operating end"
          name="end"
          type="time"
          required
          defaultValue={draft?.snapshot.end}
          error={fields.end?.join(" ")}
        />
      </div>
      <p className="field-hint">
        Both times must be on the event date. Overnight events are not
        supported.
      </p>
      <div className="field">
        <label htmlFor="locations">Location labels (Required)</label>
        <p id="locations-hint" className="field-hint">
          One per line, up to 20. Use labels such as Main hall or Workshop room.
        </p>
        <textarea
          id="locations"
          name="locations"
          rows={4}
          required
          maxLength={2500}
          aria-describedby="locations-hint"
          defaultValue={draft?.snapshot.locations.join("\n")}
        />
      </div>
      <details>
        <summary>When a clock time repeats</summary>
        <div className="stack">
          <p className="field-hint">
            On a daylight saving clock change, enter the UTC offset to choose
            the intended occurrence.
          </p>
          <TextField
            label="Start UTC offset"
            name="start_offset"
            placeholder="-04:00"
            defaultValue={draft?.snapshot.start_offset}
          />
          <TextField
            label="End UTC offset"
            name="end_offset"
            placeholder="-05:00"
            defaultValue={draft?.snapshot.end_offset}
          />
        </div>
      </details>
      {error && (
        <div role="alert" className="state-panel">
          <p className="field-error">{error}</p>
          <a href={draft ? `/events/${draft.event_id}/edit` : "/events"}>
            Reload saved data
          </a>
        </div>
      )}
      <p className="field-hint">
        Changes are saved only when the server confirms. This saves setup as a
        draft.
      </p>
      <Button type="submit" disabled={pending || !confirmed}>
        {pending ? "Saving draft…" : "Save setup draft"}
      </Button>
    </form>
  );
}
