import Link from "next/link";
import { pageOfficialPlan, pageDraft } from "@/features/events/page-data";
import { EventForm } from "@/features/events/event-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id,
    plan = await pageOfficialPlan(id);
  if (plan.approved_revision)
    return (
      <section className="state-page">
        <h1>This event has an approved plan.</h1>
        <p>
          Its setup is part of an approved revision. Changes need a reviewed
          proposal.
        </p>
        <Link className="button" href={`/events/${id}/plan`}>
          View approved plan
        </Link>
      </section>
    );
  const draft = await pageDraft(id);
  return (
    <section className="workspace-page narrow stack">
      <p className="eyebrow">Setup draft · Version {draft.generation}</p>
      <h1>Continue event setup.</h1>
      <EventForm draft={draft} />
    </section>
  );
}
