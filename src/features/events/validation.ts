import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

export const setupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  locations: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  start_offset: z.string().optional(),
  end_offset: z.string().optional(),
});
export type Setup = z.infer<typeof setupSchema>;
export type Snapshot = Setup & { starts_at: string; ends_at: string };
export function resolveSetup(input: unknown): Snapshot {
  const value = setupSchema.parse(input);
  if (
    new Set(value.locations.map((s) => s.toLowerCase())).size !==
    value.locations.length
  )
    throw new Error("Use a different label for each location.");
  if (value.end <= value.start)
    throw new Error("End time must be after start time on the same date.");
  function instant(time: string, offset?: string) {
    const local = Temporal.PlainDateTime.from(`${value.date}T${time}`, {
      overflow: "reject",
    });
    // Explicit offsets must match the zone. Reject gaps and require an offset for folds.
    return Temporal.ZonedDateTime.from(
      `${local}${offset ?? ""}[${value.timezone}]`,
      { disambiguation: "reject", offset: "reject", overflow: "reject" },
    )
      .toInstant()
      .toString();
  }
  try {
    if (!/^[A-Za-z][A-Za-z0-9_+\/-]*$/.test(value.timezone))
      throw new Error("IANA zone required");
    new Intl.DateTimeFormat("en", { timeZone: value.timezone });
    const starts_at = instant(value.start, value.start_offset);
    const ends_at = instant(value.end, value.end_offset);
    if (Temporal.Instant.compare(starts_at, ends_at) >= 0)
      throw new Error("Invalid interval");
    return {
      ...value,
      starts_at,
      ends_at,
      start_offset: Temporal.Instant.from(starts_at).toZonedDateTimeISO(
        value.timezone,
      ).offset,
      end_offset: Temporal.Instant.from(ends_at).toZonedDateTimeISO(
        value.timezone,
      ).offset,
    };
  } catch {
    throw new Error(
      "Check the date and timezone. If a clock time repeats, enter its UTC offset (for example -04:00). Missing clock times cannot be used.",
    );
  }
}
