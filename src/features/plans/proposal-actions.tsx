"use client";
import { operationKey } from "./request-key";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { planRequest } from "./editor";
export function ProposalActions({
  eventId,
  proposalId,
  baseId,
  generation,
  digest,
  next,
  allowed,
}: {
  eventId: string;
  proposalId: string;
  baseId: string;
  generation: number;
  digest: string;
  next: number;
  allowed: boolean;
}) {
  const router = useRouter();
  const [review, setReview] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [key] = useState(() =>
    operationKey(`approve:${eventId}:${proposalId}:${generation}`),
  );
  async function act(action: "approve" | "reject") {
    setPending(true);
    setError("");
    try {
      await planRequest(
        `/api/events/${eventId}/proposals/${proposalId}/${action}`,
        action === "approve"
          ? {
              base_revision_id: baseId,
              generation,
              candidate_digest: digest,
              idempotency_key: key,
            }
          : { generation, reason },
      );
      router.push(
        `/events/${eventId}/${action === "approve" ? "briefing" : "updates"}`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack">
      <label className="field">
        Optional rejection reason
        <textarea
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {review ? (
        <>
          <h2>Confirm approval</h2>
          <p>
            Save these changes as revision {next}. This updates your event plan
            and briefing. No messages will be sent.
          </p>
          <p>
            Candidate digest: <code className="break-text">{digest}</code>
          </p>
          <div className="actions">
            <Button
              disabled={pending || !allowed}
              onClick={() => act("approve")}
            >
              Approve revision {next}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setReview(false)}
            >
              Back to proposal
            </Button>
          </div>
        </>
      ) : (
        <div className="actions">
          <Button
            disabled={!allowed || pending}
            onClick={() => setReview(true)}
          >
            Review approval
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => act("reject")}
          >
            Reject proposal
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}{" "}
          <a href={`/events/${eventId}/proposals/${proposalId}`}>
            Reload proposal
          </a>
        </p>
      )}
    </section>
  );
}
