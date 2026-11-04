import Link from "next/link";
import { StartSample } from "@/features/samples/start-sample";
import { sampleRecords, sampleSetup } from "@/features/samples/sample";

export default function SampleEvent() {
  const records = sampleRecords();
  return (
    <section className="workspace-page stack">
      <p className="eyebrow">Fictional sample</p>
      <h1>Try the workflow with a sample event</h1>
      <p>
        Review the records below, then load a private draft. You will separately
        confirm the starting plan before trying an update. You can return to the
        guide from any event screen.
      </p>
      <div className="state-panel stack">
        <h2>{sampleSetup.name}</h2>
        <p>
          {sampleSetup.date} · {sampleSetup.timezone} · {sampleSetup.start} to{" "}
          {sampleSetup.end}
        </p>
        <p>
          Locations: {sampleSetup.locations.join(", ")}. All names and records
          on this page are fictional.
        </p>
      </div>
      <section className="stack">
        <h2>Rooms</h2>
        <ul className="event-list">
          {records.rooms.map((r) => (
            <li key={String(r.external_id)}>
              <div>
                <h3>{String(r.name)}</h3>
                <p>
                  {String(r.location)} · Capacity {String(r.capacity)} ·
                  Features: {String(r.feature_tags)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="stack">
        <h2>Starting schedule and assignments</h2>
        <ul className="event-list">
          {records.sessions.map((s) => {
            const room = records.rooms.find((r) => r.external_id === s.room_id);
            const assignment = records.assignments.find(
              (a) => a.session_id === s.external_id,
            );
            const volunteer = records.volunteers.find(
              (v) => v.external_id === assignment?.volunteer_id,
            );
            return (
              <li key={String(s.external_id)}>
                <div>
                  <h3>{String(s.title)}</h3>
                  <p>
                    {String(s.start)} to {String(s.end)} · {String(room?.name)}{" "}
                    · {String(s.expected_attendance)} expected
                  </p>
                  <p>
                    {String(s.required_volunteers)}{" "}
                    {String(s.required_role_tag)} required. Assigned:{" "}
                    {String(volunteer?.display_name)},{" "}
                    {String(assignment?.start)} to {String(assignment?.end)}.
                  </p>
                  <p>
                    Required features:{" "}
                    {String(s.required_feature_tags) || "None"}. Setup:{" "}
                    {String(s.setup_minutes)} minutes. Teardown:{" "}
                    {String(s.teardown_minutes)} minutes.
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="stack">
        <h2>Volunteers and availability</h2>
        <ul>
          {records.volunteers.map((v) => {
            const availability = records.availability.find(
              (a) => a.volunteer_id === v.external_id,
            );
            return (
              <li key={String(v.external_id)}>
                {String(v.display_name)} · Active · Roles: {String(v.role_tags)}{" "}
                · Available {String(availability?.start)} to{" "}
                {String(availability?.end)}
              </li>
            );
          })}
        </ul>
        <p>
          No dependencies are recorded. Both sessions have one assignment.
          Opening and Workshop use different rooms at the same time.
        </p>
      </section>
      <StartSample />
      <Link href="/events">Back to my events</Link>
    </section>
  );
}
