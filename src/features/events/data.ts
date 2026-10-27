import "server-only";
import { z } from "zod";
import { authenticatedClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { resolveSetup, type Snapshot } from "./validation";
export type EventDraft = {
  event_id: string;
  workspace_id: string;
  generation: number;
  saved_at: string;
  snapshot: Snapshot;
};
export async function listEvents() {
  const { data, error } = await (
    await authenticatedClient()
  )
    .from("plan_drafts")
    .select("event_id,workspace_id,generation,saved_at,snapshot")
    .order("saved_at", { ascending: false });
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  return data as EventDraft[];
}
export async function readPlan(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "NOT_FOUND", "Event not found.");
  const { data, error } = await (
    await authenticatedClient()
  )
    .from("plan_drafts")
    .select("event_id,workspace_id,generation,saved_at,snapshot")
    .eq("event_id", id)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Event not found.");
  return data as EventDraft;
}
export async function saveEvent(input: unknown, id?: string) {
  const envelope = z
    .object({
      setup: z.unknown(),
      request_id: z.uuid(),
      expected_generation: z.number().int().positive().optional(),
    })
    .parse(input);
  if (id && !z.uuid().safeParse(id).success)
    throw new ApiError(404, "NOT_FOUND", "Event not found.");
  if (id && envelope.expected_generation === undefined)
    throw new ApiError(
      422,
      "INVALID_INPUT",
      "Reload this draft before saving.",
    );
  let snapshot: Snapshot;
  try {
    snapshot = resolveSetup(envelope.setup);
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new ApiError(
      422,
      "INVALID_INPUT",
      error instanceof Error ? error.message : "Check event details.",
    );
  }
  const { data, error } = await (
    await authenticatedClient()
  ).rpc("save_event", {
    p_snapshot: snapshot,
    p_request_id: envelope.request_id,
    p_event_id: id ?? null,
    p_expected_generation: envelope.expected_generation ?? null,
  });
  if (error) {
    if (error.code === "P0002")
      throw new ApiError(404, "NOT_FOUND", "Event not found.");
    if (error.code === "P0001")
      throw new ApiError(
        409,
        "CONFLICT",
        error.message === "Draft changed"
          ? "This draft changed in another tab. Reload the saved draft before editing again."
          : error.message === "Event limit reached"
            ? "Your workspace has reached its ten event limit."
            : "This request has already been used. Reload your event list.",
      );
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return { event_id: data as string };
}
