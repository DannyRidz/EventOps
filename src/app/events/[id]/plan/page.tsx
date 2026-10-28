import Link from "next/link";
import { EventNav } from "@/features/plans/event-nav";
import { pageOfficialPlan } from "@/features/events/page-data";
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const plan = await pageOfficialPlan((await params).id),
    draft = plan.draft,
    approved = plan.approved_revision,
    setup = approved?.snapshot.event ?? draft.snapshot;
  return (
    <section className="workspace-page stack">
      <EventNav id={draft.event_id} />
      <p className="eyebrow">
        {approved
          ? `Approved plan · Revision ${approved.revision_number}`
          : `Setup draft · Version ${draft.generation}`}
      </p>
      <h1>{setup.name}</h1>
      <div className="state-panel">
        <h2>{approved ? "Current approved plan" : "No approved plan yet"}</h2>
        <p>
          {approved
            ? "These records were checked and explicitly approved. Saved drafts do not change this revision."
            : "These are your saved setup details. They are not an approved operational plan."}
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
          <dt>{approved ? "Approved at" : "Last saved"}</dt>
          <dd>
            <time dateTime={approved?.approved_at ?? draft.saved_at}>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: setup.timezone,
              }).format(new Date(approved?.approved_at ?? draft.saved_at))}{" "}
              ({setup.timezone})
            </time>
          </dd>
        </div>
      </dl>
      {approved && (
        <section className="stack">
          <h2>Schedule</h2>
          <p>
            {setup.date} · {setup.timezone}
          </p>
          <ul className="event-list">
            {approved.snapshot.sessions.map((session) => (
              <li key={session.id}>
                <div>
                  <h3>{session.title}</h3>
                  <p>
                    {session.start} ({session.start_offset}) to {session.end} (
                    {session.end_offset}) ·{" "}
                    {
                      approved.snapshot.rooms.find(
                        (room) => room.id === session.room_id,
                      )?.name
                    }
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p>
            {approved.snapshot.rooms.length} rooms ·{" "}
            {approved.snapshot.volunteers.length} volunteers ·{" "}
            {approved.snapshot.assignments.length} assignments
          </p>
        </section>
      )}
      <div className="actions">
        <Link className="button" href={`/events/${draft.event_id}/records`}>
          {approved ? "Propose manual changes" : "Enter starting plan"}
        </Link>
        {!approved && (
          <Link className="button" href={`/events/${draft.event_id}/edit`}>
            Edit setup
          </Link>
        )}
        <Link href="/events">All events</Link>
      </div>
    </section>
  );
}
