import { z } from "zod";
import { setupSchema } from "@/features/events/validation";
const id = z.uuid();
const text = z
  .string()
  .min(1)
  .max(160)
  .regex(/^\S(?:[\s\S]*\S)?$/);
const tag = z
  .string()
  .min(1)
  .max(64)
  .regex(/^\S(?:[\s\S]*\S)?$/);
const tags = z.array(tag).max(20);
const integer = z.number().int().min(0).max(1000000);
const common = {
  id,
  external_id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\x21-\x7e]+$/),
};
const interval = {
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  start_offset: z.string(),
  end_offset: z.string(),
};
export const collections = [
  "rooms",
  "sessions",
  "volunteers",
  "availability",
  "assignments",
  "dependencies",
] as const;
export const planSchema = z.strictObject({
  schema_version: z.literal(1),
  event: setupSchema
    .extend({
      name: z
        .string()
        .min(1)
        .max(120)
        .regex(/^\S(?:[\s\S]*\S)?$/),
      locations: z
        .array(
          z
            .string()
            .min(1)
            .max(120)
            .regex(/^\S(?:[\s\S]*\S)?$/),
        )
        .min(1)
        .max(20),
      starts_at: z.iso.datetime(),
      ends_at: z.iso.datetime(),
      start_offset: z.string(),
      end_offset: z.string(),
    })
    .strict(),
  rooms: z
    .array(
      z.strictObject({
        ...common,
        name: text,
        location: z
          .string()
          .min(1)
          .max(240)
          .regex(/^\S(?:[\s\S]*\S)?$/),
        capacity: integer.positive().nullable(),
        feature_tags: tags,
      }),
    )
    .max(20),
  sessions: z
    .array(
      z.strictObject({
        ...common,
        title: text,
        ...interval,
        room_id: id,
        required_volunteers: integer.max(100),
        expected_attendance: integer.nullable(),
        required_role_tag: tag.nullable(),
        required_feature_tags: tags,
        setup_minutes: integer.max(1440),
        teardown_minutes: integer.max(1440),
      }),
    )
    .max(100),
  volunteers: z
    .array(
      z.strictObject({
        ...common,
        display_name: text,
        role_tags: tags,
        active: z.boolean(),
      }),
    )
    .max(100),
  availability: z
    .array(
      z.strictObject({
        ...common,
        volunteer_id: id,
        ...interval,
        status: z.enum(["available", "unavailable"]),
      }),
    )
    .max(1000),
  assignments: z
    .array(
      z.strictObject({
        ...common,
        volunteer_id: id,
        session_id: id,
        role_tag: tag,
        ...interval,
      }),
    )
    .max(500),
  dependencies: z
    .array(
      z.strictObject({
        ...common,
        predecessor_session_id: id,
        successor_session_id: id,
        minimum_gap_minutes: integer.max(1440),
      }),
    )
    .max(100),
  provenance: z
    .array(
      z.strictObject({
        record_id: z.string(),
        field_path: z.string(),
        source_record_ids: z.array(id).min(1),
        derivation_kind: z.enum(["manual", "inherited"]),
      }),
    )
    .max(25000),
});
export type Plan = z.infer<typeof planSchema>;
export type Rule =
  | "SHAPE"
  | "LIMITS"
  | "REFERENCES"
  | "TIME"
  | "ROOM_OVERLAP"
  | "VOLUNTEER_OVERLAP"
  | "AVAILABILITY"
  | "ROLE"
  | "COVERAGE"
  | "CAPACITY"
  | "FEATURES"
  | "DEPENDENCY";
export type Issue = {
  rule: Rule;
  record_ids: string[];
  message: string;
  interval?: { start: string; end: string };
};
