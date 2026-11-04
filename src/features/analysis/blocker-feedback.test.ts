import { expect, it } from "vitest";
import {
  fixtureId,
  fixturePlan,
  fixtureInterval,
} from "@/features/plans/fixtures";
import { findAlternatives } from "./tools";
import type { Intent, Interpretation } from "./contracts";

const seed = fixtureId(901);
const interpretation = (
  intents: Intent[],
  questions: string[] = [],
): Interpretation => ({
  schema_version: 1,
  base_revision_id: fixtureId(900),
  intents,
  questions,
  unsupported_requests: [],
});
const timeChange = (): Extract<Intent, { action: "change_time" }> => ({
  intent_id: "move",
  action: "change_time",
  session_id: fixtureId(3),
  time_choices: [
    { start: "11:00", end: "12:00", start_offset: null, end_offset: null },
  ],
  span: { start: 0, end: 1, quote: "x" },
});

it("shows a known room conflict alongside unresolved interpretation questions", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const result = findAlternatives(
    plan,
    interpretation([timeChange()], ["May the session move later?"]),
    seed,
  );
  expect(result.options).toEqual([]);
  expect(result.issues.some((issue) => issue.rule === "ROOM_OVERLAP")).toBe(
    true,
  );
  expect(result.questions.join(" ")).toContain("Workshop");
  expect(result.questions.join(" ")).toContain("11:00");
  expect(result.questions).toContain("May the session move later?");
});

it("names missing availability even while a model question blocks approval", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  plan.availability = plan.availability.filter(
    (row) => row.volunteer_id !== fixtureId(6),
  );
  const replace: Intent = {
    action: "change_assignment",
    intent_id: "replace",
    session_id: fixtureId(3),
    from_volunteer_id: fixtureId(5),
    to_volunteer_id: fixtureId(6),
    find_replacement: false,
    role_tag: "usher",
    span: { start: 0, end: 1, quote: "x" },
  };
  const result = findAlternatives(
    plan,
    interpretation([replace], ["Which time?"]),
    seed,
  );
  expect(result.options).toEqual([]);
  expect(result.questions.join(" ")).toContain("Synthetic Sam");
  expect(result.questions.join(" ")).toMatch(/availability/i);
  expect(result.questions).toContain("Which time?");
});

it("names the destination whose capacity is missing", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  plan.rooms[1]!.capacity = null;
  const move: Intent = {
    ...timeChange(),
    action: "move_session",
    room_id: fixtureId(2),
  };
  const result = findAlternatives(plan, interpretation([move]), seed);
  expect(result.options).toEqual([]);
  expect(result.questions.join(" ")).toContain("Side hall");
  expect(result.questions.join(" ")).toMatch(/capacity/i);
});

it("keeps valid options hidden until all clarification is resolved", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const move = timeChange();
  if (move.action === "change_time")
    move.time_choices[0] = {
      start: "12:00",
      end: "13:00",
      start_offset: null,
      end_offset: null,
    };
  const result = findAlternatives(
    plan,
    interpretation([move], ["Which date?"]),
    seed,
  );
  expect(result.options).toEqual([]);
  expect(result.issues).toEqual([]);
  expect(result.questions).toContain("Which date?");
});

it("explains recorded unavailability rather than asking to ignore it", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  plan.availability.push({
    id: fixtureId(903),
    external_id: "sam-away",
    volunteer_id: fixtureId(6),
    ...fixtureInterval("10:00", "11:00"),
    status: "unavailable",
  });
  const replace: Intent = {
    action: "change_assignment",
    intent_id: "replace",
    session_id: fixtureId(3),
    from_volunteer_id: fixtureId(5),
    to_volunteer_id: fixtureId(6),
    find_replacement: false,
    role_tag: "usher",
    span: { start: 0, end: 1, quote: "x" },
  };
  const result = findAlternatives(
    plan,
    interpretation([replace], ["Which time?"]),
    seed,
  );
  expect(result.questions.join(" ")).toMatch(
    /Synthetic Sam has recorded unavailability/,
  );
  expect(result.questions.join(" ")).toContain("10:00 to 11:00");
  expect(result.options).toEqual([]);
});

it("does not turn partial interpretation into a candidate or hide question overflow", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const value = interpretation(
    [timeChange()],
    Array.from({ length: 20 }, (_, i) => `Clarify field ${i + 1}.`),
  );
  value.unsupported_requests = ["Unsupported change remains unresolved."];
  const result = findAlternatives(plan, value, seed);
  expect(result.options).toEqual([]);
  expect(result.questions).toHaveLength(20);
  expect(result.questions[0]).toContain("overlap");
  expect(result.questions[19]).toContain(
    "Additional questions remain unresolved",
  );
});

it("does not present a rejected alternative as a blocker when another explicit time is valid", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const move = timeChange();
  if (move.action === "change_time")
    move.time_choices.push({
      start: "12:00",
      end: "13:00",
      start_offset: null,
      end_offset: null,
    });
  const result = findAlternatives(
    plan,
    interpretation([move], ["Which date?"]),
    seed,
  );
  expect(result.options).toEqual([]);
  expect(result.questions).toEqual(["Which date?"]);
});

it("labels newly proposed unavailability as proposed rather than recorded", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const unavailable: Intent = {
    action: "record_availability",
    intent_id: "away",
    volunteer_id: fixtureId(5),
    status: "unavailable",
    interval: {
      start: "10:00",
      end: "11:00",
      start_offset: null,
      end_offset: null,
    },
    span: { start: 0, end: 1, quote: "x" },
  };
  const result = findAlternatives(plan, interpretation([unavailable]), seed);
  expect(result.questions.join(" ")).toContain("proposed unavailability");
  expect(result.questions.join(" ")).not.toContain(
    "has recorded unavailability",
  );
  expect(
    result.questions.every((q) => q.startsWith("For the proposed changes")),
  ).toBe(true);
  expect(plan.availability.some((a) => a.status === "unavailable")).toBe(false);
});

it("labels a proposed capacity edit and identifies separate rejected choices", () => {
  const plan = fixturePlan();
  plan.dependencies = [];
  const facts: Intent = {
    action: "change_room_facts",
    intent_id: "capacity",
    room_id: fixtureId(1),
    capacity: 5,
    feature_tags: ["projector"],
    span: { start: 0, end: 1, quote: "x" },
  };
  const result = findAlternatives(plan, interpretation([facts]), seed);
  expect(result.questions[0]).toMatch(
    /^For the proposed changes in checked choice 1:/,
  );
  expect(result.questions.join(" ")).toContain("capacity 5");
  expect(plan.rooms[0]!.capacity).toBe(40);
  const move = timeChange();
  move.time_choices.push({
    start: "11:15",
    end: "11:45",
    start_offset: null,
    end_offset: null,
  });
  const alternatives = findAlternatives(plan, interpretation([move]), seed);
  expect(
    alternatives.questions.some((q) => q.includes("checked choice 1:")),
  ).toBe(true);
  expect(
    alternatives.questions.some((q) => q.includes("checked choice 2:")),
  ).toBe(true);
});

it("shows overflow even when no complete intent can be extracted", () => {
  const result = findAlternatives(
    fixturePlan(),
    interpretation(
      [],
      Array.from({ length: 20 }, (_, i) => `Question ${i}`),
    ),
    seed,
  );
  expect(result.questions).toHaveLength(20);
  expect(result.questions[19]).toContain(
    "Additional questions remain unresolved",
  );
});
