import "server-only";
import { z } from "zod";
import { ownedEvent, planRpc } from "@/features/plans/data";
import { analysisRequestsEnabled } from "@/features/analysis/provider";
import { publicJobFields } from "@/features/analysis/data";
import { ApiError } from "@/lib/http";
export async function saveText(id: string, input: unknown, draftId?: string) {
  await ownedEvent(id);
  if (draftId && !z.uuid().safeParse(draftId).success)
    throw new ApiError(404, "NOT_FOUND", "Update not found.");
  const value = z
    .strictObject({
      raw_text: z
        .string()
        .min(1)
        .max(10000)
        .refine((value) => !!value.trim()),
      corrected_text: z
        .string()
        .min(1)
        .max(10000)
        .refine((value) => !!value.trim()),
      idempotency_key: z.uuid(),
      expected_generation: z.number().int().positive().optional(),
    })
    .parse(input);
  if (draftId && !value.expected_generation)
    throw new ApiError(
      422,
      "INVALID_INPUT",
      "Reload the saved update before editing.",
    );
  return planRpc("save_text_update", {
    p_event_id: id,
    p_raw_text: value.raw_text,
    p_corrected_text: value.corrected_text,
    p_key: value.idempotency_key,
    p_draft_id: draftId ?? null,
    p_generation: value.expected_generation ?? null,
  });
}
export async function confirmText(id: string, draftId: string, input: unknown) {
  await ownedEvent(id);
  const value = z
    .strictObject({
      generation: z.number().int().positive(),
      base_revision_id: z.uuid(),
      confirmed_text: z.string().min(1).max(10000),
      confirmed: z.literal(true),
    })
    .parse(input);
  if (!z.uuid().safeParse(draftId).success)
    throw new ApiError(404, "NOT_FOUND", "Update not found.");
  const job = await planRpc("confirm_text_analysis", {
    p_event_id: id,
    p_draft_id: draftId,
    p_generation: value.generation,
    p_base_revision_id: value.base_revision_id,
    p_confirmed_text: value.confirmed_text,
    p_confirmed: true,
  });
  // Deletion is due in the confirmation transaction. A worker retries failed cleanup.
  const { client } = await ownedEvent(id);
  const audio = await client
    .from("voice_jobs")
    .select("id,object_key")
    .eq("event_id", id)
    .eq("draft_id", draftId);
  if (audio.data?.length) {
    const removed = await client.storage
      .from("event-audio")
      .remove(audio.data.map((row) => row.object_key));
    if (!removed.error)
      for (const row of audio.data)
        await client.rpc("ack_voice_deleted", {
          p_event_id: id,
          p_job_id: row.id,
        });
  }
  if (analysisRequestsEnabled() && ["blocked", "failed"].includes(job.state))
    return planRpc("queue_analysis_job", { p_event_id: id, p_job_id: job.id });
  return job;
}
export async function updateData(id: string, draftId?: string) {
  const { client } = await ownedEvent(id);
  if (draftId && !z.uuid().safeParse(draftId).success)
    throw new ApiError(404, "NOT_FOUND", "Update not found.");
  const [drafts, jobs, proposals] = await Promise.all([
    client
      .from("text_update_drafts")
      .select("*")
      .eq("event_id", id)
      .order("saved_at", { ascending: false })
      .limit(100),
    client
      .from("analysis_jobs")
      .select(publicJobFields)
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("proposals")
      .select("id,state,base_revision_id,created_at,update_id")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (drafts.error || jobs.error || proposals.error)
    throw new Error("SERVICE_UNAVAILABLE");
  let draft = null;
  if (draftId) {
    const row = await client
      .from("text_update_drafts")
      .select("*")
      .eq("event_id", id)
      .eq("id", draftId)
      .maybeSingle();
    if (row.error) throw new Error("SERVICE_UNAVAILABLE");
    if (!row.data) throw new ApiError(404, "NOT_FOUND", "Update not found.");
    draft = row.data;
  }
  return {
    draft,
    enabled: analysisRequestsEnabled(),
    drafts: drafts.data,
    jobs: jobs.data,
    proposals: proposals.data,
  };
}
