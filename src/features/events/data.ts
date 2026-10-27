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
  status?: string;
};
export async function listEvents() {
  const client = await authenticatedClient();
  const { data, error } = await client
    .from("plan_drafts")
    .select(
      "event_id,workspace_id,generation,saved_at,snapshot,events!inner(name,status,current_revision_id)",
    )
    .order("saved_at", { ascending: false });
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  type EventHead = {
    name: string;
    status: string;
    current_revision_id: string | null;
  };
  const heads = data
    .map((row) => (row.events as unknown as EventHead).current_revision_id)
    .filter((id): id is string => id !== null);
  const approved = new Map<string, Snapshot>();
  if (heads.length) {
    const revisions = await client
      .from("revisions")
      .select("event_id,snapshot")
      .in("id", heads);
    if (revisions.error) throw new Error("SERVICE_UNAVAILABLE");
    for (const row of revisions.data)
      approved.set(row.event_id, row.snapshot.event);
  }
  return data.map((row) => {
    const event = row.events as unknown as EventHead;
    return {
      ...row,
      snapshot: approved.get(row.event_id) ?? {
        ...row.snapshot,
        name: event.name,
      },
      status: event.status,
    };
  }) as EventDraft[];
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
        error.message === "Use a proposal for approved plans"
          ? "Use a reviewed proposal to change an approved plan."
          : error.message === "Draft changed"
            ? "This draft changed in another tab. Reload the saved draft before editing again."
            : error.message === "Event limit reached"
              ? "Your workspace has reached its ten event limit."
              : "This request has already been used. Reload your event list.",
      );
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return { event_id: data as string };
}
