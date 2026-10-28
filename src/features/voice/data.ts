import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ownedEvent, planRpc } from "@/features/plans/data";
import { ApiError, checkOrigin } from "@/lib/http";
import { audioMime, MAX_AUDIO_BYTES, voiceEnabled } from "./contracts";
export async function listVoice(id: string) {
  const { client } = await ownedEvent(id);
  const { data, error } = await client
    .from("voice_jobs")
    .select("id,state,draft_id,audio_deleted_at,delete_after")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  return data;
}
export async function uploadVoice(id: string, request: Request) {
  const { client } = await ownedEvent(id);
  checkOrigin(request);
  if (!voiceEnabled())
    throw new ApiError(
      503,
      "VOICE_UNAVAILABLE",
      "Transcription is unavailable. Your text draft is safe. You can type the update.",
    );
  const key = z.uuid().parse(request.headers.get("idempotency-key"));
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(
      422,
      "AUDIO_REQUIRED",
      "Record a short update or type it.",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "TOO_LARGE", "Recordings cannot exceed 10 MiB.");
    }
    chunks.push(item.value);
  }
  const bytes = Buffer.concat(chunks);
  let mime;
  try {
    mime = audioMime(request.headers.get("content-type") ?? "", bytes);
  } catch {
    throw new ApiError(
      415,
      "UNSUPPORTED_AUDIO",
      "Use WebM with Opus or MP4 with AAC, or type the update.",
    );
  }
  const job = await planRpc("begin_voice", {
    p_event_id: id,
    p_key: key,
    p_sha256: createHash("sha256").update(bytes).digest("hex"),
    p_bytes: bytes.length,
    p_mime: mime,
  });
  if (job.state !== "uploading") return job;
  const storage = client.storage.from("event-audio");
  const uploaded = await storage.upload(job.object_key, bytes, {
    contentType: mime,
    upsert: false,
  });
  // A lost response can leave the immutable object already uploaded. Queue checks it exists;
  // the worker independently checks its exact byte receipt before decoding.
  if (
    uploaded.error &&
    !["409", "400"].includes(String(uploaded.error.statusCode))
  )
    throw new Error("SERVICE_UNAVAILABLE");
  return planRpc("queue_voice", { p_event_id: id, p_job_id: job.id });
}
export async function voiceJob(id: string, jobId: string) {
  const { client } = await ownedEvent(id);
  if (!z.uuid().safeParse(jobId).success)
    throw new ApiError(404, "NOT_FOUND", "Recording not found.");
  const { data, error } = await client
    .from("voice_jobs")
    .select("*")
    .eq("event_id", id)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Recording not found.");
  return { client, job: data };
}
export async function discardVoice(id: string, jobId: string) {
  const { client } = await voiceJob(id, jobId);
  const job = await planRpc("discard_voice", {
    p_event_id: id,
    p_job_id: jobId,
  });
  const result = await client.storage
    .from("event-audio")
    .remove([job.object_key]);
  const receipt = result.error
    ? { audio_deleted: false }
    : await planRpc("ack_voice_deleted", { p_event_id: id, p_job_id: jobId });
  return { id: job.id, state: job.state, audio_deleted: receipt.audio_deleted };
}
export async function playVoice(id: string, jobId: string) {
  const { client, job } = await voiceJob(id, jobId);
  if (job.audio_deleted_at || Date.parse(job.delete_after) <= Date.now())
    throw new ApiError(
      410,
      "AUDIO_DELETED",
      "Playback is no longer available. Saved transcript text remains available.",
    );
  const { data, error } = await client.storage
    .from("event-audio")
    .download(job.object_key);
  if (error)
    throw new ApiError(
      410,
      "AUDIO_DELETED",
      "The recording is no longer available.",
    );
  const bytes = Buffer.from(await data.arrayBuffer());
  if (
    bytes.length !== job.byte_length ||
    createHash("sha256").update(bytes).digest("hex") !== job.sha256
  )
    throw new ApiError(
      422,
      "AUDIO_INTEGRITY",
      "The recording could not be verified. Use your saved text.",
    );
  return new Response(bytes, {
    headers: {
      "Content-Type": job.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function retryVoiceUpload(id: string, jobId: string) {
  await voiceJob(id, jobId);
  return planRpc("queue_voice", { p_event_id: id, p_job_id: jobId });
}
