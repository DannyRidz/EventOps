import { Temporal } from "@js-temporal/polyfill";
import { resolveSetup } from "@/features/events/validation";
import { collections, planSchema, type Issue, type Rule } from "./schema";
export const VALIDATOR_VERSION = "plan-v1";
export function validatePlan(input: unknown): Issue[] {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return [
      {
        rule:
          input !== null &&
          typeof input === "object" &&
          collections.some((key, index) => {
            const rows = (input as Record<string, unknown>)[key];
            return (
              Array.isArray(rows) &&
              rows.length > [20, 100, 100, 1000, 500, 100][index]!
            );
          })
            ? "LIMITS"
            : "SHAPE",
        record_ids: [],
        message: "Check the plan fields and record limits.",
      },
    ];
  const p = parsed.data,
    issues: Issue[] = [];
  const add = (
    rule: Rule,
    ids: string[],
    message: string,
    interval?: Issue["interval"],
  ) =>
    issues.push({
      rule,
      record_ids: ids.sort(),
      message,
      ...(interval ? { interval } : {}),
    });
  const seen = new Set<string>();
  for (const collection of collections) {
    const external = new Set<string>();
    for (const r of p[collection]) {
      if (seen.has(r.id) || external.has(r.external_id))
        add("REFERENCES", [r.id], "Duplicate record identifier.");
      seen.add(r.id);
      external.add(r.external_id);
    }
  }
  if (!p.rooms.length || !p.sessions.length)
    add("REFERENCES", [], "A starting plan needs rooms and sessions.");
  const rooms = new Map(p.rooms.map((r) => [r.id, r])),
    sessions = new Map(p.sessions.map((r) => [r.id, r])),
    volunteers = new Map(p.volunteers.map((r) => [r.id, r]));
  const t = (s: string) => Date.parse(s),
    start = t(p.event.starts_at),
    end = t(p.event.ends_at);
  try {
    const event = resolveSetup(p.event);
    if (
      event.starts_at !== p.event.starts_at ||
      event.ends_at !== p.event.ends_at
    )
      throw new Error();
  } catch {
    add("TIME", [], "Event times do not match its date, timezone and offsets.");
  }
  const overlap = (
    a: { starts_at: string; ends_at: string },
    b: { starts_at: string; ends_at: string },
  ) => t(a.starts_at) < t(b.ends_at) && t(b.starts_at) < t(a.ends_at);
  for (const r of [...p.sessions, ...p.availability, ...p.assignments]) {
    try {
      for (const edge of ["start", "end"] as const) {
        const instant = Temporal.ZonedDateTime.from(
          `${p.event.date}T${r[edge]}${r[`${edge}_offset`]}[${p.event.timezone}]`,
          { offset: "reject", disambiguation: "reject" },
        )
          .toInstant()
          .toString();
        if (instant !== r[edge === "start" ? "starts_at" : "ends_at"])
          throw new Error();
      }
      if (
        t(r.starts_at) >= t(r.ends_at) ||
        t(r.starts_at) < start ||
        t(r.ends_at) > end
      )
        throw new Error();
    } catch {
      add(
        "TIME",
        [r.id],
        "Interval must match the event date, zone and operating hours.",
      );
    }
  }
  for (const s of p.sessions) {
    const room = rooms.get(s.room_id);
    if (!room) {
      add("REFERENCES", [s.id], "Room does not exist.");
      continue;
    }
    if (
      t(s.starts_at) - s.setup_minutes * 60000 < start ||
      t(s.ends_at) + s.teardown_minutes * 60000 > end
    )
      add("TIME", [s.id], "Room buffers exceed operating hours.");
    if (
      s.expected_attendance !== null &&
      (room.capacity === null || room.capacity < s.expected_attendance)
    )
      add(
        "CAPACITY",
        [s.id, room.id],
        "Confirmed room capacity must meet attendance.",
      );
    if (s.required_feature_tags.some((tag) => !room.feature_tags.includes(tag)))
      add("FEATURES", [s.id, room.id], "Room is missing required equipment.");
    const assigned = p.assignments.filter(
      (a) =>
        a.session_id === s.id &&
        t(a.starts_at) <= t(s.starts_at) &&
        t(a.ends_at) >= t(s.ends_at) &&
        (!s.required_role_tag || a.role_tag === s.required_role_tag),
    );
    if (
      new Set(assigned.map((a) => a.volunteer_id)).size < s.required_volunteers
    )
      add("COVERAGE", [s.id], "Mandatory volunteer coverage is incomplete.");
  }
  for (let i = 0; i < p.sessions.length; i++)
    for (const b of p.sessions.slice(i + 1)) {
      const a = p.sessions[i]!;
      if (
        a.room_id === b.room_id &&
        t(a.starts_at) - a.setup_minutes * 60000 <
          t(b.ends_at) + b.teardown_minutes * 60000 &&
        t(b.starts_at) - b.setup_minutes * 60000 <
          t(a.ends_at) + a.teardown_minutes * 60000
      )
        add(
          "ROOM_OVERLAP",
          [a.id, b.id],
          "Room occupancy overlaps, including buffers.",
          {
            start: new Date(
              Math.max(
                t(a.starts_at) - a.setup_minutes * 60000,
                t(b.starts_at) - b.setup_minutes * 60000,
              ),
            ).toISOString(),
            end: new Date(
              Math.min(
                t(a.ends_at) + a.teardown_minutes * 60000,
                t(b.ends_at) + b.teardown_minutes * 60000,
              ),
            ).toISOString(),
          },
        );
    }
  for (const a of p.assignments) {
    const v = volunteers.get(a.volunteer_id),
      s = sessions.get(a.session_id);
    if (!v || !s) {
      add("REFERENCES", [a.id], "Assignment reference does not exist.");
      continue;
    }
    if (
      p.assignments.some(
        (other) =>
          other.volunteer_id === a.volunteer_id &&
          other.session_id === a.session_id &&
          other.role_tag === a.role_tag &&
          other.id < a.id,
      )
    )
      add("REFERENCES", [a.id], "Duplicate volunteer session role assignment.");
    if (
      !v.active ||
      (!v.role_tags.includes(a.role_tag) && a.role_tag !== "general") ||
      (s.required_role_tag !== null &&
        (a.role_tag !== s.required_role_tag ||
          !v.role_tags.includes(s.required_role_tag)))
    )
      add(
        "ROLE",
        [a.id],
        "Volunteer must be active and qualified for the assigned role.",
      );
    const availability = p.availability.filter((x) => x.volunteer_id === v.id);
    if (
      !availability.some(
        (x) =>
          x.status === "available" &&
          t(x.starts_at) <= t(a.starts_at) &&
          t(x.ends_at) >= t(a.ends_at),
      ) ||
      availability.some((x) => x.status === "unavailable" && overlap(x, a))
    )
      add(
        "AVAILABILITY",
        [a.id],
        "Assignment needs confirmed availability with no unavailability.",
      );
  }
  for (const a of p.availability)
    if (!volunteers.has(a.volunteer_id))
      add("REFERENCES", [a.id], "Availability volunteer does not exist.");
  for (let i = 0; i < p.assignments.length; i++)
    for (const b of p.assignments.slice(i + 1)) {
      const a = p.assignments[i]!;
      if (a.volunteer_id === b.volunteer_id && overlap(a, b))
        add(
          "VOLUNTEER_OVERLAP",
          [a.id, b.id],
          "Volunteer assignments overlap.",
          {
            start: new Date(
              Math.max(t(a.starts_at), t(b.starts_at)),
            ).toISOString(),
            end: new Date(Math.min(t(a.ends_at), t(b.ends_at))).toISOString(),
          },
        );
    }
  const graph = new Map<string, string[]>();
  for (const d of p.dependencies) {
    const a = sessions.get(d.predecessor_session_id),
      b = sessions.get(d.successor_session_id);
    if (!a || !b) {
      add("REFERENCES", [d.id], "Dependency session does not exist.");
      continue;
    }
    graph.set(a.id, [...(graph.get(a.id) ?? []), b.id]);
    if (
      a.id === b.id ||
      t(b.starts_at) < t(a.ends_at) + d.minimum_gap_minutes * 60000
    )
      add("DEPENDENCY", [d.id], "Dependency order or gap is not satisfied.");
  }
  const active = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string): boolean => {
    if (active.has(id)) return true;
    if (done.has(id)) return false;
    active.add(id);
    if ((graph.get(id) ?? []).some(visit)) return true;
    active.delete(id);
    done.add(id);
    return false;
  };
  if ([...graph.keys()].some(visit))
    add("DEPENDENCY", [], "Dependency graph contains a cycle.");
  return issues;
}
