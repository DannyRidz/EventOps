"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { planRequest } from "@/features/plans/editor";
import { operationKey } from "@/features/plans/request-key";
export function JobControls({
  eventId,
  jobId,
  state,
  enabled,
  optionId,
  digest,
}: {
  eventId: string;
  jobId: string;
  state: string;
  enabled: boolean;
  optionId?: string;
  digest?: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!["queued", "running"].includes(state)) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [state, router]);
  async function cancel() {
    setPending(true);
    setError("");
    try {
      await planRequest(`/api/events/${eventId}/analysis/${jobId}/cancel`, {});
      router.refresh();
    } catch {
      setError("Could not cancel. Reload to check the saved status.");
    } finally {
      setPending(false);
    }
  }
  async function submit(adopt: boolean) {
    setPending(true);
    setError("");
    try {
      const result = await planRequest(
        `/api/events/${eventId}/analysis/${jobId}/${adopt ? "adopt" : "queue"}`,
        adopt
          ? {
              option_id: optionId,
              result_digest: digest,
              confirmed: true,
              idempotency_key: operationKey(
                `analysis:${eventId}:${jobId}:${optionId}:${digest}`,
              ),
            }
          : {},
      );
      if (adopt) router.push(`/events/${eventId}/proposals/${result.id}`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your text remains saved.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack">
      {optionId && digest ? (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm that every interpreted request shown covers my complete
            update, and I confirm the exact new facts and selected changes.
          </label>
          <Button disabled={!confirmed || pending} onClick={() => submit(true)}>
            Confirm interpretation and check proposal
          </Button>
          <p>
            This creates a checked proposal for separate approval. It does not
            change your approved plan.
          </p>
        </>
      ) : enabled && ["blocked", "failed"].includes(state) ? (
        <Button disabled={pending} onClick={() => submit(false)}>
          {state === "failed" ? "Retry analysis" : "Queue saved analysis"}
        </Button>
      ) : null}
      {["queued", "running"].includes(state) && (
        <p role="status">
          This work is saved and can continue after you close this tab.
        </p>
      )}
      {["queued", "running"].includes(state) && (
        <Button variant="secondary" disabled={pending} onClick={cancel}>
          Cancel analysis
        </Button>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
