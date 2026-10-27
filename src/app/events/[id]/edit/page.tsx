import { pageDraft } from "@/features/events/page-data";
import { EventForm } from "@/features/events/event-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const draft = await pageDraft((await params).id);
  return (
    <section className="workspace-page narrow stack">
      <p className="eyebrow">Setup draft · Version {draft.generation}</p>
      <h1>Continue event setup.</h1>
      <EventForm draft={draft} />
    </section>
  );
}
