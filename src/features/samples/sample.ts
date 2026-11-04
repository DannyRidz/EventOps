import { resolveSetup } from "@/features/events/validation";
import type { Records } from "@/features/plans/editor-model";

export const sampleSetup = {
  name: "Sample community workshop",
  date: "2026-11-04",
  timezone: "Asia/Brunei",
  start: "09:00",
  end: "17:00",
  locations: ["Main hall", "Side hall"],
  start_offset: "+08:00",
  end_offset: "+08:00",
};

export function matchesSampleSetup(input: unknown) {
  try {
    const actual = resolveSetup(input);
    const expected = resolveSetup(sampleSetup);
    return Object.entries(expected).every(
      ([key, value]) =>
        JSON.stringify(actual[key as keyof typeof actual]) ===
        JSON.stringify(value),
    );
  } catch {
    return false;
  }
}

export const sampleUpdate =
  "Move Opening to Room 2 from 12:00 to 13:00. Record Synthetic Alex as unavailable from 10:00 to 13:00. For Opening, replace Synthetic Alex with Synthetic Sam as the usher from 12:00 to 13:00.";

// Deliberately fictional product sample input. Actual IDs and source receipts
// are assigned only by the normal owner scoped staging function.
export function sampleRecords(): Records {
  const times = { start: "10:00", end: "11:00" };
  return {
    rooms: [
      {
        external_id: "hall",
        name: "Room 1",
        location: "Main hall",
        capacity: 40,
        feature_tags: ["projector"],
      },
      {
        external_id: "side",
        name: "Room 2",
        location: "Side hall",
        capacity: 40,
        feature_tags: ["projector"],
      },
    ],
    sessions: [
      {
        external_id: "opening",
        title: "Opening",
        ...times,
        room_id: "hall",
        required_volunteers: 1,
        expected_attendance: 30,
        required_role_tag: "usher",
        required_feature_tags: ["projector"],
        setup_minutes: 0,
        teardown_minutes: 0,
      },
      {
        external_id: "workshop",
        title: "Workshop",
        ...times,
        room_id: "side",
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
        external_id: "alex",
        display_name: "Synthetic Alex",
        role_tags: ["usher"],
        active: true,
      },
      {
        external_id: "sam",
        display_name: "Synthetic Sam",
        role_tags: ["usher"],
        active: true,
      },
    ],
    availability: ["alex", "sam"].map((volunteer_id) => ({
      external_id: `${volunteer_id}-available`,
      volunteer_id,
      start: "09:00",
      end: "17:00",
      status: "available",
    })),
    assignments: [
      {
        external_id: "opening-alex",
        session_id: "opening",
        volunteer_id: "alex",
        role_tag: "usher",
        ...times,
      },
      {
        external_id: "workshop-sam",
        session_id: "workshop",
        volunteer_id: "sam",
        role_tag: "usher",
        ...times,
      },
    ],
    dependencies: [],
  };
}
