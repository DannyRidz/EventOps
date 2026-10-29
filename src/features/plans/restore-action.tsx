"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { planRequest } from "./editor";
import { operationKey } from "./request-key";
export function RestoreAction({
  eventId,
  target,
  head,
  contextDigest,
}: {
  eventId: string;
  target: string;
  head: string;
  contextDigest: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="stack">
      <h2>Reconfirm historical facts</h2>
      <p>
        Restoring can reinstate cancelled sessions or earlier availability.
        Review every difference and outstanding update above. Resolve
        contradictions before confirming.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I have reviewed every difference and outstanding update. I explicitly
        reconfirm the historical availability, volunteer activity and any
        reinstated sessions as current organizer facts.
      </label>
      <Button
        disabled={!confirmed || pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const p = await planRequest(`/api/events/${eventId}/restore`, {
              target_revision_id: target,
              context_digest: contextDigest,
              expected_head: head,
              confirmed: true,
              idempotency_key: operationKey(
                `restore:${eventId}:${head}:${target}`,
              ),
            });
            router.push(`/events/${eventId}/proposals/${p.id}`);
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not prepare restoration.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        Create restoration proposal
      </Button>
      <p>Your approved plan stays unchanged until separate approval.</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
