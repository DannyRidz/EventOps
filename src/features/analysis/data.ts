import "server-only";
import { z } from "zod";
import { ownedEvent, planRpc } from "@/features/plans/data";
import { ApiError } from "@/lib/http";
import { analysisRequestsEnabled } from "./provider";
export const publicJobFields =
  "id,event_id,workspace_id,update_id,base_revision_id,draft_id,draft_generation,state,stage,error_code,confirmed_text_digest,created_at,result,result_digest,attempts,not_before,completed_at";
export async function readAnalysis(id: string, jobId: string) {
  const { client } = await ownedEvent(id);
  if (!z.uuid().safeParse(jobId).success)
    throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  const row = await client
    .from("analysis_jobs")
    .select(publicJobFields)
    .eq("event_id", id)
    .eq("id", jobId)
    .maybeSingle();
  if (row.error) throw new Error("SERVICE_UNAVAILABLE");
  if (!row.data) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  const [update, proposal, draft, source] = await Promise.all([
    client
      .from("updates")
      .select("confirmed_text")
      .eq("id", row.data.update_id)
      .eq("event_id", id)
      .single(),
    client
      .from("proposals")
      .select("id,state")
      .eq("event_id", id)
      .eq("analysis_job_id", jobId)
      .maybeSingle(),
    client
      .from("text_update_drafts")
      .select("generation")
      .eq("id", row.data.draft_id)
      .eq("event_id", id)
      .single(),
    client
      .from("source_records")
      .select("id")
      .eq("event_id", id)
      .eq("record_id", row.data.update_id)
      .eq("field_path", "confirmed_text")
      .single(),
  ]);
  if (update.error || proposal.error || draft.error || source.error)
    throw new Error("SERVICE_UNAVAILABLE");
  return {
    job: row.data,
    text: update.data.confirmed_text as string,
    proposal: proposal.data,
    current_generation: draft.data.generation as number,
    source_id: source.data.id as string,
    enabled: analysisRequestsEnabled(),
  };
}
export async function queueAnalysis(id: string, jobId: string) {
  await readAnalysis(id, jobId);
  if (!analysisRequestsEnabled())
    throw new ApiError(
      503,
      "MODEL_ACCESS_REQUIRED",
      "Model access and billing prerequisites have not been enabled. Your text is saved; you can edit the plan manually.",
    );
  return planRpc("queue_analysis_job", { p_event_id: id, p_job_id: jobId });
}
export async function adoptAnalysis(id: string, jobId: string, input: unknown) {
  await readAnalysis(id, jobId);
  const value = z
    .strictObject({
      option_id: z.string().regex(/^option-[1-3]$/),
      result_digest: z.string().regex(/^[a-f0-9]{64}$/),
      confirmed: z.literal(true),
      idempotency_key: z.uuid(),
    })
    .parse(input);
  return planRpc("adopt_analysis_option", {
    p_event_id: id,
    p_job_id: jobId,
    p_option_id: value.option_id,
    p_result_digest: value.result_digest,
    p_confirmed: value.confirmed,
    p_key: value.idempotency_key,
  });
}

export async function cancelAnalysis(id: string, jobId: string) {
  await readAnalysis(id, jobId);
  return planRpc("cancel_analysis_job", { p_event_id: id, p_job_id: jobId });
}
