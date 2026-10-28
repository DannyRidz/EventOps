// Synthetic timezone fixture for analysis tests only. Never imported by customer pages.
import { fixturePlan } from "@/features/plans/fixtures";
import { resolveSetup } from "@/features/events/validation";
import { interval } from "./tools";
export function analysisFoldPlan() {
  const p = fixturePlan();
  p.event = {
    ...resolveSetup({
      ...p.event,
      date: "2026-11-01",
      timezone: "America/New_York",
      start: "00:00",
      end: "04:00",
      start_offset: "-04:00",
      end_offset: "-05:00",
    }),
    start_offset: "-04:00",
    end_offset: "-05:00",
  };
  p.dependencies = [];
  p.sessions[0] = {
    ...p.sessions[0]!,
    ...interval(p, {
      start: "01:00",
      end: "01:30",
      start_offset: "-04:00",
      end_offset: "-04:00",
    }),
  };
  p.sessions[1] = {
    ...p.sessions[1]!,
    ...interval(p, {
      start: "03:00",
      end: "03:30",
      start_offset: "-05:00",
      end_offset: "-05:00",
    }),
  };
  p.assignments[0] = {
    ...p.assignments[0]!,
    ...interval(p, {
      start: "00:00",
      end: "01:30",
      start_offset: "-04:00",
      end_offset: "-04:00",
    }),
  };
  p.assignments[1] = {
    ...p.assignments[1]!,
    ...interval(p, {
      start: "03:00",
      end: "03:30",
      start_offset: "-05:00",
      end_offset: "-05:00",
    }),
  };
  p.availability = p.availability.map((a) => ({
    ...a,
    ...interval(p, {
      start: "00:00",
      end: "04:00",
      start_offset: "-04:00",
      end_offset: "-05:00",
    }),
  }));
  return p;
}
