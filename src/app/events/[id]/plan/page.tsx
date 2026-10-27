import Link from "next/link";
import { pageDraft } from "@/features/events/page-data";
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const draft = await pageDraft((await params).id),
    setup = draft.snapshot;
  return (
    <section className="workspace-page stack">
      <p className="eyebrow">Setup draft · Version {draft.generation}</p>
      <h1>{setup.name}</h1>
      <div className="state-panel">
        <h2>No approved plan yet</h2>
        <p>
          These are your saved setup details. They are not an approved
          operational plan.
        </p>
      </div>
      <dl className="setup-details">
        <div>
          <dt>Event date</dt>
          <dd>{setup.date}</dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>{setup.timezone}</dd>
        </div>
        <div>
          <dt>Operating hours</dt>
          <dd>
            {setup.start} to {setup.end}
          </dd>
        </div>
        <div>
          <dt>Locations</dt>
          <dd>{setup.locations.join(", ")}</dd>
        </div>
        <div>
          <dt>Last saved</dt>
          <dd>
            <time dateTime={draft.saved_at}>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: setup.timezone,
              }).format(new Date(draft.saved_at))}{" "}
              ({setup.timezone})
            </time>
          </dd>
        </div>
      </dl>
      <div className="actions">
        <Link className="button" href={`/events/${draft.event_id}/edit`}>
          Edit setup
        </Link>
        <Link href="/events">All events</Link>
      </div>
    </section>
  );
}
