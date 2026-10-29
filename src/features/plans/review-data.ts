import "server-only";
import { z } from "zod";
import { ownedEvent, planRpc, readProposal } from "./data";
const key = z.uuid();
export const patchSchema = z
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
  .max(7);
export async function editProposal(
  id: string,
  proposal: string,
  input: unknown,
) {
  await readProposal(id, proposal);
  const v = z
    .strictObject({
      generation: z.number().int().positive(),
      patch: patchSchema,
      reason: z.string().trim().min(1).max(2000),
      idempotency_key: key,
      confirmed: z.literal(true),
      withdraw_interpreted_requests: z.boolean(),
      context_digest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    })
    .parse(input);
  return planRpc("edit_proposal", {
    p_event_id: id,
    p_proposal_id: proposal,
    p_generation: v.generation,
    p_patch: v.patch,
    p_reason: v.reason,
    p_key: v.idempotency_key,
    p_confirmed: v.confirmed,
    p_withdraw: v.withdraw_interpreted_requests,
    p_context_digest: v.context_digest ?? null,
  });
}
export async function restoreRevision(id: string, input: unknown) {
  await ownedEvent(id);
  const v = z
    .strictObject({
      target_revision_id: key,
      context_digest: z.string().regex(/^[a-f0-9]{64}$/),
      expected_head: key,
      idempotency_key: key,
      confirmed: z.literal(true),
    })
    .parse(input);
  return planRpc("restore_revision", {
    p_event_id: id,
    p_target: v.target_revision_id,
    p_context_digest: v.context_digest,
    p_head: v.expected_head,
    p_key: v.idempotency_key,
    p_confirmed: v.confirmed,
  });
}
export async function answerAnalysis(id: string, job: string, input: unknown) {
  await ownedEvent(id);
  const v = z
    .strictObject({
      result_digest: z.string().regex(/^[a-f0-9]{64}$/),
      generation: z.number().int().positive(),
      question_index: z.number().int().min(0).max(19),
      answer: z.string().trim().min(1).max(2000),
      idempotency_key: key,
    })
    .parse(input);
  key.parse(job);
  return planRpc("answer_analysis", {
    p_event_id: id,
    p_job_id: job,
    p_result_digest: v.result_digest,
    p_generation: v.generation,
    p_question: v.question_index,
    p_answer: v.answer,
    p_key: v.idempotency_key,
  });
}
export async function reviewDetails(id: string, proposalId: string) {
  const { client } = await ownedEvent(id);
  const [reason, successor] = await Promise.all([
    client
      .from("proposal_rejections")
      .select("reason,created_at")
      .eq("event_id", id)
      .eq("proposal_id", proposalId)
      .maybeSingle(),
    client
      .from("proposals")
      .select("id,generation,state")
      .eq("event_id", id)
      .eq("parent_proposal_id", proposalId)
      .maybeSingle(),
  ]);
  if (reason.error || successor.error) throw new Error("SERVICE_UNAVAILABLE");
  return { rejection: reason.data, successor: successor.data };
}
export async function savedAnswers(id: string, jobId?: string) {
  const { client } = await ownedEvent(id);
  let query = client
    .from("review_answers")
    .select(
      "id,job_id,draft_id,question,answer_json,source_record_id,draft_generation,created_at",
    )
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  return data ?? [];
}

export async function restoreContext(
  id: string,
  excludeId?: string,
): Promise<{
  context: {
    drafts: { id: string; generation: number; text: string }[];
    jobs: { id: string; state: string; text: string }[];
    manual_proposals: {
      id: string;
      generation: number;
      digest: string;
      text: string;
    }[];
  };
  digest: string;
}> {
  await ownedEvent(id);
  return planRpc("restore_review_context", {
    p_event_id: id,
    p_exclude_id: excludeId ?? null,
  });
}
