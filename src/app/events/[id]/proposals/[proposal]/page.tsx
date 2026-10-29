import Link from "next/link";
import { reviewDetails } from "@/features/plans/review-data";
import { notFound } from "next/navigation";
import {
  officialPlan,
  readProposal,
  proposalRevision,
} from "@/features/plans/data";
import { readAnalysis } from "@/features/analysis/data";
import { ApiError } from "@/lib/http";
import {
  comparePlans,
  displayValue,
  recordName,
} from "@/features/plans/comparison";
import { PlanRecords, ValidationReport } from "@/features/plans/plan-records";
import { ProposalActions } from "@/features/plans/proposal-actions";
import { EventNav } from "@/features/plans/event-nav";
import type { Plan } from "@/features/plans/schema";
export default async function Proposal({
  params,
}: {
  params: Promise<{ id: string; proposal: string }>;
}) {
  const { id, proposal: proposalId } = await params;
  let proposal;
  try {
    proposal = await readProposal(id, proposalId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const savedRevision =
    proposal.state === "approved"
      ? await proposalRevision(id, proposalId)
      : null;
  const details = await reviewDetails(id, proposalId);
  const current = await officialPlan(id);
  const base = await officialPlan(id, proposal.base_revision_id);
  if (!base.approved_revision) notFound();
  const candidate = proposal.candidate_snapshot as Plan;
  const changes = comparePlans(base.approved_revision.snapshot, candidate);
  const analysis = proposal.analysis_job_id
    ? await readAnalysis(id, proposal.analysis_job_id)
    : null;
  const inputChanged =
    !!analysis &&
    (analysis.current_generation !== analysis.job.draft_generation ||
      analysis.job.state !== "completed");
  const stale =
    current.approved_revision?.id !== proposal.base_revision_id || inputChanged;
  const open = ["ready", "infeasible"].includes(proposal.state);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <p className="eyebrow">
        Proposed · Based on revision {base.approved_revision.revision_number}
      </p>
      <h1>
        {proposal.analysis_job_id
          ? "Review confirmed interpreted changes"
          : "Review manual changes"}
      </h1>
      <p>
        {candidate.event.name} · {candidate.event.date} ·{" "}
        {candidate.event.timezone}
      </p>
      <p>
        Status: {proposal.state}.{" "}
        {proposal.analysis_job_id
          ? "You confirmed the interpreted requests and exact new facts. Approval rechecks the complete candidate and that confirmed request contract."
          : "Manual request coverage confirms the exact field changes shown here. It does not interpret free text."}
      </p>
      {stale && open && (
        <p role="alert">
          {inputChanged
            ? "Your update text changed since this proposal was prepared. Confirm and analyze its current saved generation."
            : "Your plan changed since this proposal was prepared."}{" "}
          Review it against revision{" "}
          {current.approved_revision?.revision_number}. Approval is unavailable.
        </p>
      )}
      {proposal.analysis_job_id && (
        <Link href={`/events/${id}/analysis/${proposal.analysis_job_id}`}>
          Open confirmed interpretation and original text
        </Link>
      )}
      <p>Saved candidate generation {proposal.generation}.</p>
      {proposal.parent_proposal_id && (
        <p>
          <Link href={`/events/${id}/proposals/${proposal.parent_proposal_id}`}>
            View previous candidate and original requests
          </Link>
        </p>
      )}
      {proposal.review_assertions?.original_interpreted_requests_withdrawn && (
        <p>
          The organizer explicitly withdrew all interpreted requests from the
          previous proposal and replaced them with these manual field changes.
        </p>
      )}
      {proposal.restores_revision_id && (
        <p>
          The organizer explicitly reconfirmed historical facts for this
          restoration.{" "}
          <Link
            href={`/events/${id}/history?revision=${proposal.restores_revision_id}`}
          >
            View historical origin
          </Link>
          .
        </p>
      )}
      {details.successor && (
        <p>
          <Link href={`/events/${id}/proposals/${details.successor.id}`}>
            Open latest edited generation {details.successor.generation}
          </Link>
        </p>
      )}
      {details.rejection && (
        <p>
          Rejection reason: {details.rejection.reason || "No reason supplied."}
        </p>
      )}
      {open && !stale && (
        <Link href={`/events/${id}/proposals/${proposalId}/edit`}>
          Edit this candidate
        </Link>
      )}
      {savedRevision && (
        <div className="state-panel" role="status">
          <h2>Changes saved as revision {savedRevision.revision_number}</h2>
          <p>
            This proposal was approved at {savedRevision.approved_at}. Its saved
            revision remains available even if the current plan has changed.
          </p>
          <Link href={`/events/${id}/briefing?revision=${savedRevision.id}`}>
            Open this saved revision briefing
          </Link>
        </div>
      )}
      <ValidationReport issues={proposal.constraint_report} />
      <h2>Before, proposed, evidence</h2>
      <div className="comparison-list">
        {changes.map((c, i) => (
          <article className="comparison-row" key={i}>
            <h3>
              {recordName(candidate, c.record_id) ??
                recordName(base.approved_revision.snapshot, c.record_id) ??
                c.record_id}{" "}
              · {c.field}
            </h3>
            <dl>
              <div>
                <dt>Before</dt>
                <dd>{displayValue(c.before)}</dd>
              </div>
              <div>
                <dt>Proposed</dt>
                <dd>{displayValue(c.after)}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>
                  {c.sources.length ? (
                    <ul>
                      {c.sources.map((s) => (
                        <li key={s}>
                          <Link href={`/events/${id}/evidence/${s}`}>
                            Open frozen {c.field} source
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "See the recorded removal and full candidate below."
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <details>
        <summary>Full proposed plan</summary>
        <PlanRecords plan={candidate} />
      </details>
      {open && (
        <ProposalActions
          eventId={id}
          proposalId={proposalId}
          baseId={proposal.base_revision_id}
          generation={proposal.generation}
          digest={proposal.candidate_digest}
          next={(current.approved_revision?.revision_number ?? 0) + 1}
          allowed={
            !stale &&
            proposal.state === "ready" &&
            proposal.constraint_report.length === 0
          }
        />
      )}
      <Link href={`/events/${id}/records`}>
        Prepare another manual candidate from the current plan
      </Link>
    </section>
  );
}
