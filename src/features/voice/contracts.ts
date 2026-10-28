export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 120;
export const recordingTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;
export function voiceEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.EVENTOPS_VOICE_ENABLED === "1" &&
    env.EVENTOPS_META_ACCESS_VERIFIED === "1" &&
    env.EVENTOPS_META_BILLING_BOUND_VERIFIED === "1"
  );
}
export type VoiceJob = {
  id: string;
  state:
    "uploading" | "queued" | "running" | "completed" | "failed" | "discarded";
  draft_id: string | null;
  audio_deleted_at: string | null;
  delete_after: string;
};
export function audioMime(type: string, bytes: Uint8Array) {
  const mime = type.split(";")[0]?.trim();
  if (
    mime === "audio/webm" &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return mime;
  if (
    mime === "audio/mp4" &&
    Buffer.from(bytes.slice(4, 8)).toString("ascii") === "ftyp"
  )
    return mime;
  throw new Error("UNSUPPORTED_AUDIO");
}
