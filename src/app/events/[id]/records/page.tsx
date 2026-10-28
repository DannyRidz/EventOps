import { pageOfficialPlan } from "@/features/events/page-data";
import { PlanEditor } from "@/features/plans/editor";
import { EventNav } from "@/features/plans/event-nav";
export default async function Records({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await pageOfficialPlan(id);
  const revision = data.approved_revision;
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>{revision ? "Propose manual changes" : "Enter starting plan"}</h1>
      {revision && (
        <p role="status">
          A starting plan has already been confirmed. Current approved revision{" "}
          {revision.revision_number}. You can review its briefing or propose a
          new change below.
        </p>
      )}
      <PlanEditor
        eventId={id}
        initial={revision?.snapshot ?? data.draft.plan_snapshot}
        generation={data.draft.generation}
        base={
          revision
            ? { id: revision.id, number: revision.revision_number }
            : undefined
        }
        digest={data.draft.candidate_digest}
        report={data.draft.validation_report}
      />
    </section>
  );
}
