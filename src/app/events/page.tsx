import Link from "next/link";
import { listEvents } from "@/features/events/data";
export default async function Events() {
  const events = await listEvents();
  return (
    <section className="workspace-page stack">
      <p className="eyebrow">Your workspace</p>
      <div className="section-actions">
        <h1>My events</h1>
        <Link className="button" href="/events/new">
          Create event
        </Link>
      </div>
      <p>Open a saved event to review or continue its setup.</p>
      {events.length === 0 ? (
        <div className="state-panel">
          <h2>Your first event starts here.</h2>
          <p>
            No events have been saved in this workspace. Prepare the date,
            operating hours, timezone and locations.
          </p>
          <Link href="/events/new">Set up an event</Link>
        </div>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.event_id}>
              <div>
                <p className="eyebrow">
                  {event.status === "active" ? "Approved plan" : "Setup draft"}{" "}
                  · {event.snapshot.date}
                </p>
                <h2>
                  <Link href={`/events/${event.event_id}/plan`}>
                    {event.snapshot.name}
                  </Link>
                </h2>
                <p>
                  {event.snapshot.timezone}
                  {event.status !== "active" &&
                    ` · Saved setup version ${event.generation}`}
                </p>
              </div>
              <Link
                href={`/events/${event.event_id}/${event.status === "active" ? "plan" : "edit"}`}
              >
                {event.status === "active"
                  ? "View approved plan"
                  : "Continue setup"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
