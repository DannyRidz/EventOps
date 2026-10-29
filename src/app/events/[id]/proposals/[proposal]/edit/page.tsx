import Link from "next/link";
import { restoreContext } from "@/features/plans/review-data";
import { notFound } from "next/navigation";
import { readProposal } from "@/features/plans/data";
import { pageOfficialPlan } from "@/features/events/page-data";
import { EventNav } from "@/features/plans/event-nav";
import { PlanEditor } from "@/features/plans/editor";
import { ApiError } from "@/lib/http";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string; proposal: string }>;
}) {
  const { id, proposal } = await params;
  let p;
  try {
    p = await readProposal(id, proposal);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const current = (await pageOfficialPlan(id)).approved_revision;
  const context = p.restores_revision_id
    ? await restoreContext(id, proposal)
    : null;
  const allowed =
    current &&
    current.id === p.base_revision_id &&
    ["ready", "infeasible"].includes(p.state);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Edit proposed changes</h1>
      <Link href={`/events/${id}/proposals/${proposal}`}>
        Review saved candidate and evidence
      </Link>
      {context && (
        <section className="state-panel">
          <h2>
            Review current statements before reconfirming historical facts
          </h2>
          {context.context.manual_proposals.map((p) => (
            <p key={p.id}>
              <Link href={`/events/${id}/proposals/${p.id}`}>
                Review pending manual proposal
              </Link>
              : {p.text}
            </p>
          ))}
          {context.context.drafts.map((d) => (
            <p key={d.id} className="preserve-text">
              {d.text}
            </p>
          ))}
          {context.context.jobs.map((j) => (
            <p key={j.id} className="preserve-text">
              {j.text}
            </p>
          ))}
        </section>
      )}
      {allowed ? (
        <PlanEditor
          eventId={id}
          initial={p.candidate_snapshot}
          patchBase={current.snapshot}
          generation={p.generation}
          base={{ id: current.id, number: current.revision_number }}
          editing={{
            id: proposal,
            generation: p.generation,
            interpreted: !!p.analysis_job_id,
            restores: !!p.restores_revision_id,
            contextDigest: context?.digest,
          }}
        />
      ) : (
        <p role="alert">
          This candidate is no longer editable against the current plan. Return
          to Updates to review its saved status.
        </p>
      )}
    </section>
  );
}
