import { z } from "zod";
const id = z.uuid();
export const spanSchema = z.strictObject({
  start: z.number().int().nonnegative().max(10000),
  end: z.number().int().positive().max(10000),
  quote: z.string().min(1).max(10000),
});
const common = {
  intent_id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  span: spanSchema,
};
export const timeChoiceSchema = z.strictObject({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  start_offset: z.string().nullable(),
  end_offset: z.string().nullable(),
});
export const intentSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...common,
    action: z.literal("move_session"),
    session_id: id,
    room_id: id,
    time_choices: z.array(timeChoiceSchema).max(20),
  }),
  z.strictObject({
    ...common,
    action: z.literal("change_time"),
    session_id: id,
    time_choices: z.array(timeChoiceSchema).min(1).max(20),
  }),
  z.strictObject({
    ...common,
    action: z.literal("cancel_session"),
    session_id: id,
  }),
  z.strictObject({
    ...common,
    action: z.literal("change_assignment"),
    session_id: id,
    from_volunteer_id: id.nullable(),
    to_volunteer_id: id.nullable(),
    find_replacement: z.boolean(),
    role_tag: z.string().trim().min(1).max(64),
  }),
  z.strictObject({
    ...common,
    action: z.literal("record_availability"),
    volunteer_id: id,
    status: z.enum(["available", "unavailable"]),
    interval: timeChoiceSchema,
  }),
  z.strictObject({
    ...common,
    action: z.literal("change_room_facts"),
    room_id: id,
    capacity: z.number().int().positive().max(1000000).nullable(),
    feature_tags: z.array(z.string().trim().min(1).max(64)).max(20),
  }),
]);
export const interpretationSchema = z.strictObject({
  schema_version: z.literal(1),
  base_revision_id: id,
  intents: z.array(intentSchema).max(20),
  questions: z.array(z.string().min(1).max(500)).max(20),
  unsupported_requests: z.array(z.string().min(1).max(500)).max(20),
});
export const selectionSchema = z.strictObject({
  base_revision_id: id,
  selected_option_id: z.string().max(40).nullable(),
  dispositions: z
    .array(
      z.strictObject({
        intent_id: z.string().max(40),
        status: z.enum(["satisfied", "unresolved"]),
        evidence_refs: z.array(id).min(1).max(20),
      }),
    )
    .max(20),
});
export type Intent = z.infer<typeof intentSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
export type TimeChoice = z.infer<typeof timeChoiceSchema>;
export type AnalysisOption = {
  id: string;
  requests: Intent[];
  changed_sessions: number;
  displacement_minutes: number;
};
export type AnalysisResult = {
  status: "ready_for_confirmation" | "unresolved";
  interpretation: Interpretation;
  options: AnalysisOption[];
  selected_option_id: string | null;
  questions: string[];
  impacted_records: string[];
};
export const PROMPT_VERSION = "eventops-text-v1";
export const analysisResultSchema = z.strictObject({
  status: z.enum(["ready_for_confirmation", "unresolved"]),
  interpretation: interpretationSchema,
  options: z
    .array(
      z.strictObject({
        id: z.string().regex(/^option-[1-3]$/),
        requests: z.array(intentSchema).min(1).max(20),
        changed_sessions: z.number().int().nonnegative().max(100),
        displacement_minutes: z.number().nonnegative().max(144000),
      }),
    )
    .max(3),
  selected_option_id: z.string().nullable(),
  questions: z.array(z.string().min(1).max(1000)).max(20),
  impacted_records: z.array(z.uuid()).max(2000),
});
