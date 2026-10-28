import { Temporal } from "@js-temporal/polyfill";
import { createHash } from "node:crypto";
import { resolveSetup } from "@/features/events/validation";
import { collections, type Plan } from "@/features/plans/schema";
import { validatePlan } from "@/features/plans/validate";
import { comparePlans } from "@/features/plans/comparison";
import {
  interpretationSchema,
  type Intent,
  type Interpretation,
  type AnalysisOption,
  type TimeChoice,
} from "./contracts";
export function generatedId(seed: string, kind: string, intentId: string) {
  const hex = createHash("md5")
    .update(`${seed}:${intentId}:${kind}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${"4" + hex.slice(13, 16)}-${"8" + hex.slice(17, 20)}-${hex.slice(20)}`;
}
export function resolveRecords(
  plan: Plan,
  collection: (typeof collections)[number],
  reference: string,
) {
  return plan[collection]
    .filter(
      (r) =>
        r.id === reference ||
        r.external_id === reference ||
        ("name" in r && r.name === reference) ||
        ("title" in r && r.title === reference) ||
        ("display_name" in r && r.display_name === reference),
    )
    .map((r) => r.id);
}
export function interval(plan: Plan, time: TimeChoice) {
  const resolved = resolveSetup({
    ...plan.event,
    start: time.start,
    end: time.end,
    start_offset: time.start_offset ?? undefined,
    end_offset: time.end_offset ?? undefined,
  });
  return {
    start: time.start,
    end: time.end,
    starts_at: resolved.starts_at,
    ends_at: resolved.ends_at,
    start_offset: resolved.start_offset!,
    end_offset: resolved.end_offset!,
  };
}
export function validateInterpretation(
  input: unknown,
  plan: Plan,
  text: string,
  baseId: string,
): Interpretation {
  const value = interpretationSchema.parse(input);
  if (value.base_revision_id !== baseId) throw new Error("WRONG_BASE");
  const seen = new Set<string>();
  for (const intent of value.intents) {
    if (seen.has(intent.intent_id)) throw new Error("DUPLICATE_REQUEST");
    seen.add(intent.intent_id);
    if (
      intent.span.end <= intent.span.start ||
      Array.from(text).slice(intent.span.start, intent.span.end).join("") !==
        intent.span.quote
    )
      throw new Error("INVALID_TEXT_EVIDENCE");
    const references: [(typeof collections)[number], string][] = [];
    if ("session_id" in intent)
      references.push(["sessions", intent.session_id]);
    if ("room_id" in intent) references.push(["rooms", intent.room_id]);
    if ("volunteer_id" in intent)
      references.push(["volunteers", intent.volunteer_id]);
    if (intent.action === "change_assignment")
      for (const ref of [intent.from_volunteer_id, intent.to_volunteer_id])
        if (ref) references.push(["volunteers", ref]);
    for (const [c, ref] of references) {
      if (!plan[c].some((r) => r.id === ref)) throw new Error("UNKNOWN_RECORD");
    }
    if ("time_choices" in intent)
      for (const t of intent.time_choices) {
        if (
          !intent.span.quote.includes(t.start) ||
          !intent.span.quote.includes(t.end)
        )
          throw new Error("UNCONFIRMED_TIME_FLEXIBILITY");
        interval(plan, t);
      }
    if (intent.action === "record_availability") {
      if (
        !intent.span.quote.includes(intent.interval.start) ||
        !intent.span.quote.includes(intent.interval.end)
      )
        throw new Error("UNCONFIRMED_INTERVAL");
      interval(plan, intent.interval);
    }
    // Names are display values, not identity. An exact external identifier must disambiguate duplicates.
    for (const [c, ref] of references) {
      const row = plan[c].find((r) => r.id === ref)!;
      const name =
        "display_name" in row
          ? row.display_name
          : "title" in row
            ? row.title
            : "name" in row
              ? row.name
              : null;
      if (
        name &&
        resolveRecords(plan, c, name).length > 1 &&
        !intent.span.quote.includes(row.external_id)
      )
        throw new Error("AMBIGUOUS_RECORD");
    }
  }
  return value;
}
export function applyIntents(
  base: Plan,
  requests: Intent[],
  seed: string,
): Plan {
  let p = structuredClone(base);
  for (const r of requests) {
    switch (r.action) {
      case "move_session":
      case "change_time": {
        const s = p.sessions.find((s) => s.id === r.session_id);
        if (!s) throw new Error("UNKNOWN_SESSION");
        if (r.action === "move_session") s.room_id = r.room_id;
        const choice = r.time_choices[0];
        if (choice) {
          const old = Date.parse(s.starts_at),
            next = interval(p, choice),
            delta = Date.parse(next.starts_at) - old;
          Object.assign(s, next);
          p.assignments = p.assignments.map((a) => {
            if (a.session_id !== s.id) return a;
            const local = (instant: string) => {
              const shifted = Temporal.Instant.from(instant)
                .add({ milliseconds: delta })
                .toZonedDateTimeISO(p.event.timezone);
              if (shifted.toPlainDate().toString() !== p.event.date)
                throw new Error("ASSIGNMENT_CROSSES_DATE");
              return {
                time: shifted
                  .toPlainTime()
                  .toString({ smallestUnit: "minute" }),
                offset: shifted.offset,
              };
            };
            const start = local(a.starts_at),
              end = local(a.ends_at);
            return {
              ...a,
              ...interval(p, {
                start: start.time,
                end: end.time,
                start_offset: start.offset,
                end_offset: end.offset,
              }),
            };
          });
        }
        break;
      }
      case "cancel_session":
        p = {
          ...p,
          sessions: p.sessions.filter((s) => s.id !== r.session_id),
          assignments: p.assignments.filter(
            (a) => a.session_id !== r.session_id,
          ),
          dependencies: p.dependencies.filter(
            (d) =>
              d.predecessor_session_id !== r.session_id &&
              d.successor_session_id !== r.session_id,
          ),
        };
        break;
      case "change_assignment": {
        const s = p.sessions.find((s) => s.id === r.session_id);
        if (!s) throw new Error("UNKNOWN_SESSION");
        const old = p.assignments.find(
          (a) =>
            a.session_id === r.session_id &&
            a.volunteer_id === r.from_volunteer_id &&
            a.role_tag === r.role_tag,
        );
        if (r.from_volunteer_id && !old) throw new Error("UNKNOWN_ASSIGNMENT");
        p.assignments = p.assignments.filter((a) => a !== old);
        if (r.to_volunteer_id)
          p.assignments.push({
            ...old,
            id: old?.id ?? generatedId(seed, "assignment", r.intent_id),
            external_id: old?.external_id ?? `analysis-${r.intent_id}`,
            volunteer_id: r.to_volunteer_id,
            session_id: r.session_id,
            role_tag: r.role_tag,
            start: s.start,
            end: s.end,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            start_offset: s.start_offset,
            end_offset: s.end_offset,
          });
        break;
      }
      case "record_availability":
        p.availability.push({
          id: generatedId(seed, "availability", r.intent_id),
          external_id: `analysis-${r.intent_id}`,
          volunteer_id: r.volunteer_id,
          status: r.status,
          ...interval(p, r.interval),
        });
        break;
      case "change_room_facts": {
        const room = p.rooms.find((room) => room.id === r.room_id);
        if (!room) throw new Error("UNKNOWN_ROOM");
        Object.assign(room, {
          capacity: r.capacity,
          feature_tags: r.feature_tags,
        });
        break;
      }
    }
  }
  return p;
}
export function getImpactedRecords(plan: Plan, requests: Intent[]) {
  const ids = new Set<string>();
  for (const r of requests)
    for (const [k, v] of Object.entries(r))
      if (k.endsWith("_id") && typeof v === "string" && k !== "intent_id")
        ids.add(v);
  let changed = true;
  while (changed) {
    const before = ids.size;
    for (const s of plan.sessions)
      if (ids.has(s.id) || ids.has(s.room_id)) {
        ids.add(s.id);
        ids.add(s.room_id);
      }
    for (const a of plan.assignments)
      if (ids.has(a.session_id) || ids.has(a.volunteer_id) || ids.has(a.id)) {
        ids.add(a.id);
        ids.add(a.session_id);
        ids.add(a.volunteer_id);
      }
    for (const d of plan.dependencies)
      if (
        ids.has(d.predecessor_session_id) ||
        ids.has(d.successor_session_id)
      ) {
        ids.add(d.id);
        ids.add(d.predecessor_session_id);
        ids.add(d.successor_session_id);
      }
    for (const a of plan.availability)
      if (ids.has(a.volunteer_id)) ids.add(a.id);
    changed = before !== ids.size;
  }
  return [...ids].sort();
}
export const checkCandidate = (p: Plan) => validatePlan(p);
export function requestConflicts(plan: Plan, requests: Intent[]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const r of requests) {
    const keys: string[] = [];
    if (r.action === "move_session") keys.push(`room:${r.session_id}`);
    if (
      r.action === "change_time" ||
      (r.action === "move_session" && r.time_choices.length)
    )
      keys.push(`time:${r.session_id}`);
    if (r.action === "change_room_facts") keys.push(`facts:${r.room_id}`);
    if (
      "session_id" in r &&
      requests.some(
        (other) =>
          other.intent_id !== r.intent_id &&
          "session_id" in other &&
          other.session_id === r.session_id &&
          (r.action === "cancel_session" || other.action === "cancel_session"),
      )
    )
      questions.push(
        "A session is both cancelled and changed. Which request should apply?",
      );
    for (const key of keys) {
      if (seen.has(key))
        questions.push(
          "More than one request changes the same room, time or room facts. Confirm one exact value.",
        );
      seen.add(key);
    }
    if (r.action === "record_availability") {
      const value = interval(plan, r.interval);
      const overlaps = (s: string, e: string) =>
        Date.parse(value.starts_at) < Date.parse(e) &&
        Date.parse(s) < Date.parse(value.ends_at);
      if (
        r.status === "available" &&
        plan.availability.some(
          (a) =>
            a.volunteer_id === r.volunteer_id &&
            a.status === "unavailable" &&
            overlaps(a.starts_at, a.ends_at),
        )
      )
        questions.push(
          "This availability conflicts with recorded unavailability. Confirm the exact replacement facts through manual editing.",
        );
      if (
        requests.some((other) => {
          if (
            other.action !== "record_availability" ||
            other.intent_id === r.intent_id ||
            other.volunteer_id !== r.volunteer_id ||
            other.status === r.status
          )
            return false;
          const next = interval(plan, other.interval);
          return overlaps(next.starts_at, next.ends_at);
        })
      )
        questions.push(
          "The update contains contradictory availability. Confirm which interval and status apply.",
        );
    }
  }
  return [...new Set(questions)];
}
export function findAlternatives(
  plan: Plan,
  value: Interpretation,
  seed: string,
): {
  options: AnalysisOption[];
  questions: string[];
  issues: ReturnType<typeof validatePlan>;
} {
  const conflicts = requestConflicts(plan, value.intents);
  if (
    conflicts.length ||
    value.questions.length ||
    value.unsupported_requests.length ||
    !value.intents.length
  )
    return {
      options: [],
      questions: [
        ...conflicts,
        ...value.questions,
        ...value.unsupported_requests,
        ...(!value.intents.length
          ? ["Confirm the exact changes you need, or use the manual editor."]
          : []),
      ].slice(0, 20),
      issues: [],
    };
  let combinations: Intent[][] = [[]];
  for (const r of value.intents) {
    let choices: Intent[] = [r];
    if ("time_choices" in r && r.time_choices.length)
      choices = r.time_choices.map((t) => ({ ...r, time_choices: [t] }));
    if (
      r.action === "change_assignment" &&
      r.find_replacement &&
      !r.to_volunteer_id
    )
      choices = plan.volunteers
        .filter((v) => v.active && v.id !== r.from_volunteer_id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((v) => ({ ...r, to_volunteer_id: v.id }));
    combinations = combinations
      .flatMap((c) => choices.map((r) => [...c, r]))
      .slice(0, 20);
  }
  const options: AnalysisOption[] = [];
  const issues: ReturnType<typeof validatePlan> = [];
  for (const requests of combinations) {
    try {
      const candidate = applyIntents(plan, requests, seed),
        report = checkCandidate(candidate);
      if (report.length) {
        issues.push(...report);
        continue;
      }
      const changed = comparePlans(plan, candidate);
      if (!changed.length) continue;
      const changedSessions = new Set(
        changed
          .filter((c) => plan.sessions.some((s) => s.id === c.record_id))
          .map((c) => c.record_id),
      );
      let displacement = 0;
      for (const s of candidate.sessions) {
        const old = plan.sessions.find((old) => old.id === s.id);
        if (old)
          displacement +=
            Math.abs(Date.parse(s.starts_at) - Date.parse(old.starts_at)) /
            60000;
      }
      options.push({
        id: "",
        requests,
        changed_sessions: changedSessions.size,
        displacement_minutes: displacement,
      });
    } catch {
      issues.push({
        rule: "SHAPE",
        record_ids: [],
        message: "Check request identifiers and explicit times.",
      });
    }
  }
  options.sort(
    (a, b) =>
      a.changed_sessions - b.changed_sessions ||
      a.displacement_minutes - b.displacement_minutes ||
      JSON.stringify(a.requests).localeCompare(JSON.stringify(b.requests)),
  );
  return {
    options: options
      .slice(0, 3)
      .map((o, i) => ({ ...o, id: `option-${i + 1}` })),
    questions: options.length
      ? []
      : [
          "No valid option found within these choices. Confirm missing facts, room requirements and permitted times, or edit manually.",
          ...Array.from(new Set(issues.map((i) => i.message))).slice(0, 8),
        ],
    issues,
  };
}
