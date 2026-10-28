import "server-only";
import { z } from "zod";
import { authenticatedClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { validatePlan } from "./validate";
import type { Plan } from "./schema";
const uuid = z.uuid(),
  digest = z.string().regex(/^[a-f0-9]{64}$/);
export async function ownedEvent(id: string) {
  if (!uuid.safeParse(id).success)
    throw new ApiError(404, "NOT_FOUND", "Event not found.");
  const client = await authenticatedClient();
  const { data, error } = await client
    .from("events")
    .select("id,workspace_id,status,current_revision_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Event not found.");
  return {
    client,
    event: data as {
      id: string;
      workspace_id: string;
      status: string;
      current_revision_id: string | null;
    },
  };
}
export async function planRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (await authenticatedClient()).rpc(name, args);
  if (error) {
    if (error.code === "P0002")
      throw new ApiError(404, "NOT_FOUND", "Event or proposal not found.");
    if (error.code === "42501")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "This account cannot perform that action.",
      );
    if (error.code === "P0001")
      throw new ApiError(
        409,
        error.message === "Stale plan"
          ? "STALE_PLAN"
          : error.message === "Idempotency key reused"
            ? "IDEMPOTENCY_CONFLICT"
            : "PROPOSAL_CHANGED",
        "Saved data changed or this request was already used. Reload the current plan and review again.",
      );
    if (
      ["22023", "22P02", "22007", "22008", "23514", "23502", "23505"].includes(
        error.code,
      )
    )
      throw new ApiError(
        422,
        "INVALID_PLAN",
        "Check plan fields, times, constraints and source evidence before confirming.",
      );
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return data;
}
export async function stagePlan(id: string, input: unknown) {
  await ownedEvent(id);
  const value = z
    .strictObject({
      plan: z.record(z.string(), z.unknown()),
      expected_generation: z.number().int().positive(),
      confirmed: z.literal(true),
    })
    .parse(input);
  return planRpc("stage_plan", {
    p_event_id: id,
    p_plan: value.plan,
    p_expected_generation: value.expected_generation,
    p_confirmed: true,
  });
}
export async function confirmPlan(id: string, input: unknown) {
  const { client } = await ownedEvent(id);
  const value = z
    .strictObject({
      expected_generation: z.number().int().positive(),
      candidate_digest: digest,
      idempotency_key: uuid,
    })
    .parse(input);
  const { data, error } = await client
    .from("plan_drafts")
    .select("plan_snapshot")
    .eq("event_id", id)
    .single();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  // Successful idempotency replay is resolved in the database, even after a newer revision.
  if (data?.plan_snapshot && validatePlan(data.plan_snapshot).length)
    throw new ApiError(
      422,
      "INVALID_PLAN",
      "Resolve plan constraints before confirmation.",
    );
  return planRpc("confirm_plan", {
    p_event_id: id,
    p_expected_generation: value.expected_generation,
    p_candidate_digest: value.candidate_digest,
    p_idempotency_key: value.idempotency_key,
  });
}
export async function createProposal(id: string, input: unknown) {
  await ownedEvent(id);
  const value = z
    .strictObject({
      mode: z.literal("manual"),
      expected_head: uuid,
      patch: z
        .array(
          z.strictObject({
            op: z.literal("replace"),
            path: z.enum([
              "/event",
              "/rooms",
              "/sessions",
              "/volunteers",
              "/availability",
              "/assignments",
              "/dependencies",
            ]),
            value: z.unknown(),
          }),
        )
        .min(1)
        .max(7),
      confirmed: z.literal(true),
      reason: z.string().trim().min(1).max(2000),
      idempotency_key: uuid,
    })
    .parse(input);
  return planRpc("create_manual_proposal", {
    p_event_id: id,
    p_expected_head: value.expected_head,
    p_patch: value.patch,
    p_confirmed: true,
    p_reason: value.reason,
    p_idempotency_key: value.idempotency_key,
  });
}
export async function readProposal(id: string, proposalId: string) {
  const { client } = await ownedEvent(id);
  if (!uuid.safeParse(proposalId).success)
    throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  const { data, error } = await client
    .from("proposals")
    .select("*")
    .eq("event_id", id)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  return data;
}
export async function approveProposal(
  id: string,
  proposalId: string,
  input: unknown,
) {
  const proposal = await readProposal(id, proposalId);
  const value = z
    .strictObject({
      base_revision_id: uuid,
      generation: z.number().int().positive(),
      candidate_digest: digest,
      idempotency_key: uuid,
    })
    .parse(input);
  if (validatePlan(proposal.candidate_snapshot).length)
    throw new ApiError(
      422,
      "INVALID_PLAN",
      "Resolve plan constraints before approval.",
    );
  return planRpc("approve_proposal", {
    p_event_id: id,
    p_proposal_id: proposalId,
    p_base_revision_id: value.base_revision_id,
    p_generation: value.generation,
    p_candidate_digest: value.candidate_digest,
    p_idempotency_key: value.idempotency_key,
  });
}
export async function rejectProposal(
  id: string,
  proposalId: string,
  input: unknown,
) {
  await readProposal(id, proposalId);
  const value = z
    .strictObject({ generation: z.number().int().positive() })
    .parse(input);
  return planRpc("reject_proposal", {
    p_event_id: id,
    p_proposal_id: proposalId,
    p_generation: value.generation,
  });
}
export type Revision = {
  id: string;
  revision_number: number;
  snapshot: Plan;
  sha256: string;
  approved_at: string;
  parent_revision_id: string | null;
};
export async function officialPlan(id: string, revisionId?: string) {
  const { client, event } = await ownedEvent(id);
  const draft = await client
    .from("plan_drafts")
    .select(
      "event_id,generation,snapshot,plan_snapshot,candidate_digest,validation_report,saved_at,base_revision_id",
    )
    .eq("event_id", id)
    .single();
  if (draft.error) throw new Error("SERVICE_UNAVAILABLE");
  const selected = revisionId ?? event.current_revision_id;
  if (!selected)
    return {
      status: "draft" as const,
      approved_revision: null,
      draft: draft.data,
    };
  if (!uuid.safeParse(selected).success)
    throw new ApiError(404, "NOT_FOUND", "Revision not found.");
  const revision = await client
    .from("revisions")
    .select("id,revision_number,snapshot,sha256,approved_at,parent_revision_id")
    .eq("event_id", id)
    .eq("id", selected)
    .maybeSingle();
  if (revision.error) throw new Error("SERVICE_UNAVAILABLE");
  if (!revision.data)
    throw new ApiError(404, "NOT_FOUND", "Revision not found.");
  return {
    status:
      revisionId && revisionId !== event.current_revision_id
        ? ("historical" as const)
        : ("approved" as const),
    approved_revision: revision.data as Revision,
    draft: draft.data,
  };
}
export async function revisions(id: string, cursor?: string) {
  const { client } = await ownedEvent(id);
  const before = cursor
    ? z.coerce.number().int().min(1).max(501).parse(cursor)
    : 501;
  const { data, error } = await client
    .from("revisions")
    .select("id,revision_number,approved_at,reason,parent_revision_id,sha256")
    .eq("event_id", id)
    .lt("revision_number", before)
    .order("revision_number", { ascending: false })
    .limit(26);
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  const rows = data ?? [];
  return {
    revisions: rows.slice(0, 25),
    next_cursor: rows.length > 25 ? String(rows[24]!.revision_number) : null,
  };
}
export async function evidence(id: string, sourceId: string) {
  const { client } = await ownedEvent(id);
  if (!uuid.safeParse(sourceId).success)
    throw new ApiError(404, "NOT_FOUND", "Evidence not found.");
  const { data, error } = await client
    .from("source_records")
    .select(
      "id,record_id,field_path,locator,value_json,sha256,created_at,artifact_id",
    )
    .eq("event_id", id)
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Evidence not found.");
  const artifact = await client
    .from("source_artifacts")
    .select("id,kind,sha256,captured_by,captured_at,metadata")
    .eq("event_id", id)
    .eq("id", data.artifact_id)
    .single();
  if (artifact.error) throw new Error("SERVICE_UNAVAILABLE");
  return { source: data, artifact: artifact.data };
}

export async function proposalRevision(id: string, proposalId: string) {
  const { client } = await ownedEvent(id);
  const { data, error } = await client
    .from("revisions")
    .select("id,revision_number,approved_at")
    .eq("event_id", id)
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  return data;
}
