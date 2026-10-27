// Internal synthetic fixtures, never imported by customer surfaces.
import type { Plan } from "./schema";
export const fixtureId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const fixtureSetup = {
  name: "Synthetic operations day",
  date: "2026-11-02",
  timezone: "Asia/Brunei",
  start: "09:00",
  end: "17:00",
  locations: ["Main hall", "Side hall"],
  start_offset: "+08:00",
  end_offset: "+08:00",
  starts_at: "2026-11-02T01:00:00Z",
  ends_at: "2026-11-02T09:00:00Z",
};
export function fixtureInterval(start: string, end: string) {
  return {
    start,
    end,
    start_offset: "+08:00",
    end_offset: "+08:00",
    starts_at: `2026-11-02T${String(Number(start.slice(0, 2)) - 8).padStart(2, "0")}:${start.slice(3)}:00Z`,
    ends_at: `2026-11-02T${String(Number(end.slice(0, 2)) - 8).padStart(2, "0")}:${end.slice(3)}:00Z`,
  };
}
export function fixturePlan(): Plan {
  return {
    schema_version: 1,
    event: { ...fixtureSetup, locations: [...fixtureSetup.locations] },
    rooms: [
      {
        id: fixtureId(1),
        external_id: "hall",
        name: "Main hall",
        location: "Main hall",
        capacity: 40,
        feature_tags: ["projector"],
      },
      {
        id: fixtureId(2),
        external_id: "side",
        name: "Side hall",
        location: "Side hall",
        capacity: 20,
        feature_tags: [],
      },
    ],
    sessions: [
      {
        id: fixtureId(3),
        external_id: "opening",
        title: "Opening",
        ...fixtureInterval("10:00", "11:00"),
        room_id: fixtureId(1),
        required_volunteers: 1,
        expected_attendance: 30,
        required_role_tag: "usher",
        required_feature_tags: ["projector"],
        setup_minutes: 0,
        teardown_minutes: 0,
      },
      {
        id: fixtureId(4),
        external_id: "workshop",
        title: "Workshop",
        ...fixtureInterval("11:00", "12:00"),
        room_id: fixtureId(1),
        required_volunteers: 1,
        expected_attendance: 10,
        required_role_tag: "usher",
        required_feature_tags: [],
        setup_minutes: 0,
        teardown_minutes: 0,
      },
    ],
    volunteers: [
      {
        id: fixtureId(5),
        external_id: "alex",
        display_name: "Synthetic Alex",
        role_tags: ["usher"],
        active: true,
      },
      {
        id: fixtureId(6),
        external_id: "sam",
        display_name: "Synthetic Sam",
        role_tags: ["usher"],
        active: true,
      },
    ],
    availability: [
      {
        id: fixtureId(7),
        external_id: "alex-available",
        volunteer_id: fixtureId(5),
        ...fixtureInterval("09:00", "17:00"),
        status: "available",
      },
      {
        id: fixtureId(8),
        external_id: "sam-available",
        volunteer_id: fixtureId(6),
        ...fixtureInterval("09:00", "17:00"),
        status: "available",
      },
    ],
    assignments: [
      {
        id: fixtureId(9),
        external_id: "opening-alex",
        volunteer_id: fixtureId(5),
        session_id: fixtureId(3),
        role_tag: "usher",
        ...fixtureInterval("10:00", "11:00"),
      },
      {
        id: fixtureId(10),
        external_id: "workshop-alex",
        volunteer_id: fixtureId(5),
        session_id: fixtureId(4),
        role_tag: "usher",
        ...fixtureInterval("11:00", "12:00"),
      },
    ],
    dependencies: [
      {
        id: fixtureId(11),
        external_id: "opening-before-workshop",
        predecessor_session_id: fixtureId(3),
        successor_session_id: fixtureId(4),
        minimum_gap_minutes: 0,
      },
    ],
    provenance: [],
  };
}
export function parityCases() {
  const cases: { name: string; plan: unknown }[] = [
    { name: "valid", plan: fixturePlan() },
  ];
  const change = (name: string, fn: (p: Plan) => void) => {
    const p = fixturePlan();
    fn(p);
    cases.push({ name, plan: p });
  };
  change("capacity unknown", (p) => {
    p.rooms[0]!.capacity = null;
  });
  change("features missing", (p) => {
    p.rooms[0]!.feature_tags = [];
  });
  change("buffer overlap", (p) => {
    p.sessions[0]!.teardown_minutes = 10;
  });
  change("volunteer overlap", (p) => {
    p.assignments[0]!.end = "11:15";
    p.assignments[0]!.ends_at = "2026-11-02T03:15:00Z";
  });
  change("inactive volunteer", (p) => {
    p.volunteers[0]!.active = false;
  });
  change("wrong role", (p) => {
    p.volunteers[0]!.role_tags = [];
  });
  change("unknown availability", (p) => {
    p.availability = [];
  });
  change("unavailable overrides available", (p) => {
    p.availability.push({
      id: fixtureId(12),
      external_id: "alex-unavailable",
      volunteer_id: fixtureId(5),
      status: "unavailable",
      ...fixtureInterval("10:30", "10:45"),
    });
  });
  change("coverage incomplete", (p) => {
    p.assignments = [];
  });
  change("missing reference", (p) => {
    p.sessions[0]!.room_id = fixtureId(999);
  });
  change("duplicate identifier", (p) => {
    p.rooms[1]!.external_id = "hall";
  });
  change("dependency gap", (p) => {
    p.dependencies[0]!.minimum_gap_minutes = 1;
  });
  change("dependency cycle", (p) => {
    p.dependencies.push({
      id: fixtureId(12),
      external_id: "cycle",
      predecessor_session_id: fixtureId(4),
      successor_session_id: fixtureId(3),
      minimum_gap_minutes: 0,
    });
  });
  change("outside event", (p) => {
    p.sessions[0]!.setup_minutes = 61;
  });
  change("time mismatch", (p) => {
    p.sessions[0]!.starts_at = "2026-11-02T02:01:00Z";
  });
  change("unknown fields", (p) => {
    Object.assign(p.rooms[0]!, { private_notes: "not allowed" });
  });
  change("null field", (p) => {
    Object.assign(p.rooms[0]!, { feature_tags: null });
  });
  change("record limit", (p) => {
    p.rooms = Array.from({ length: 21 }, (_, n) => ({
      ...p.rooms[0]!,
      id: fixtureId(100 + n),
      external_id: `room-${n}`,
    }));
  });
  change("duplicate locations", (p) => {
    p.event.locations = ["Main hall", "main hall"];
  });
  change("duplicate assignment reversed ids", (p) => {
    p.assignments.unshift({
      ...p.assignments[0]!,
      id: fixtureId(500),
      external_id: "duplicate-assignment",
    });
  });
  change("untrimmed tag", (p) => {
    p.volunteers[0]!.role_tags = [" usher "];
  });
  return cases;
}
