import { EventNav } from "@/features/plans/event-nav";
import { pageOfficialPlan } from "@/features/events/page-data";
import { analysisRequestsEnabled } from "@/features/analysis/provider";
import { isSampleEvent } from "@/features/samples/data";
import { WorkflowGuide } from "@/features/samples/workflow-guide";

export default async function Guide({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await pageOfficialPlan(id);
  const sample = await isSampleEvent(id);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <p className="eyebrow">
        {sample ? "Fictional sample walkthrough" : "Workflow guide"}
      </p>
      <h1>From an update to an approved briefing</h1>
      <p>
        {data.approved_revision?.snapshot.event.name ??
          data.draft.snapshot.name}
      </p>
      <p>
        Describe → Review → Confirm → Approve → Briefing. Each decision is
        yours, and only explicit approval changes the official plan.
      </p>
      <WorkflowGuide
        eventId={id}
        hasStartingPlan={!!data.approved_revision}
        sample={sample}
        analysisEnabled={analysisRequestsEnabled()}
      />
    </section>
  );
}
