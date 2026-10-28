import type { Plan, Issue } from "./schema";
export function ValidationReport({ issues }: { issues: Issue[] }) {
  return (
    <section className="state-panel">
      <h2>{issues.length ? "Changes need attention" : "Plan checks passed"}</h2>
      {issues.length ? (
        <ul>
          {issues.map((issue, i) => (
            <li key={i}>
              <strong>{issue.rule}</strong>: {issue.message}{" "}
              {issue.record_ids.join(", ")}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No blocking conflicts were found against the recorded constraints.
          Unknown facts are not a guarantee of suitability.
        </p>
      )}
    </section>
  );
}
export function PlanRecords({ plan }: { plan: Plan }) {
  return (
    <div className="stack">
      <section>
        <h2>Schedule</h2>
        <p>
          {plan.event.name} · {plan.event.date} · {plan.event.timezone}
          <br />
          Operating hours {plan.event.start} ({plan.event.start_offset}) to{" "}
          {plan.event.end} ({plan.event.end_offset})
          <br />
          Locations: {plan.event.locations.join(", ")}
        </p>
        <ul className="event-list">
          {plan.sessions.map((s) => (
            <li key={s.id}>
              <div>
                <h3>
                  {s.title} ({s.external_id})
                </h3>
                <p>
                  Required features:{" "}
                  {s.required_feature_tags.join(", ") || "None recorded"}
                </p>
                <p>
                  {s.start} ({s.start_offset}) to {s.end} ({s.end_offset}) ·{" "}
                  {plan.rooms.find((r) => r.id === s.room_id)?.name}
                </p>
                <p>
                  Setup {s.setup_minutes} min · Teardown {s.teardown_minutes}{" "}
                  min ·{" "}
                  {s.expected_attendance === null
                    ? "Attendance unknown"
                    : `${s.expected_attendance} expected`}{" "}
                  ·{" "}
                  {s.required_role_tag
                    ? `Required role: ${s.required_role_tag}`
                    : "No specific role required"}
                </p>
                <p>
                  {s.required_volunteers} volunteers required,{" "}
                  {
                    new Set(
                      plan.assignments
                        .filter((a) => a.session_id === s.id)
                        .map((a) => a.volunteer_id),
                    ).size
                  }{" "}
                  assigned
                </p>
                <ul>
                  {plan.assignments
                    .filter((a) => a.session_id === s.id)
                    .map((a) => (
                      <li key={a.id}>
                        {
                          plan.volunteers.find((v) => v.id === a.volunteer_id)
                            ?.display_name
                        }{" "}
                        · {a.role_tag} · {a.start} ({a.start_offset}) to {a.end}{" "}
                        ({a.end_offset})
                      </li>
                    ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Rooms</h2>
        <ul>
          {plan.rooms.map((r) => (
            <li key={r.id}>
              {r.name} ({r.external_id}) · {r.location} ·{" "}
              {r.capacity === null
                ? "Capacity unknown"
                : `Capacity ${r.capacity}`}{" "}
              ·{" "}
              {r.feature_tags.length
                ? r.feature_tags.join(", ")
                : "No features recorded"}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Volunteers and availability</h2>
        {plan.volunteers.length ? (
          <ul>
            {plan.volunteers.map((v) => (
              <li key={v.id}>
                {v.display_name} ({v.external_id}) ·{" "}
                {v.active ? "Active" : "Inactive"} ·{" "}
                {v.role_tags.join(", ") || "No roles recorded"}
                <ul>
                  {plan.availability
                    .filter((a) => a.volunteer_id === v.id)
                    .map((a) => (
                      <li key={a.id}>
                        {a.status} · {a.start} ({a.start_offset}) to {a.end} (
                        {a.end_offset})
                      </li>
                    ))}
                </ul>
                {!plan.availability.some((a) => a.volunteer_id === v.id) && (
                  <p>Availability unknown</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No volunteers recorded.</p>
        )}
      </section>
      <section>
        <h2>Dependencies</h2>
        {plan.dependencies.length ? (
          <ul>
            {plan.dependencies.map((d) => (
              <li key={d.id}>
                {
                  plan.sessions.find((s) => s.id === d.predecessor_session_id)
                    ?.title
                }{" "}
                before{" "}
                {
                  plan.sessions.find((s) => s.id === d.successor_session_id)
                    ?.title
                }
                , minimum gap {d.minimum_gap_minutes} min
              </li>
            ))}
          </ul>
        ) : (
          <p>No dependencies recorded.</p>
        )}
      </section>
    </div>
  );
}
