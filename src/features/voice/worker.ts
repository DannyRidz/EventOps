import { createHash } from "node:crypto";
import pg from "pg";
import { z } from "zod";
import { convertRecording } from "./conversion";
import { MAX_AUDIO_BYTES, voiceEnabled } from "./contracts";
import { createTranscriber, type Transcribe } from "./provider";
export type AudioStore = {
  read: (path: string) => Promise<Uint8Array>;
  remove: (path: string) => Promise<void>;
};
const claim = z.object({
  id: z.uuid(),
  lease_token: z.uuid(),
  object_key: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  sha256: z.string(),
  byte_length: z.number().int().positive().max(MAX_AUDIO_BYTES),
  mime: z.enum(["audio/webm", "audio/mp4"]),
});
export async function runVoice(
  db: Pick<pg.Client, "query">,
  store: AudioStore,
  transcribe: Transcribe,
  binary: string,
) {
  const result = await db.query(
    "select eventops_worker_api.claim_voice() as job",
  );
  if (!result.rows[0]?.job) return false;
  const job = claim.parse(result.rows[0].job);
  let text: string | null = null,
    duration: number | null = null,
    error: string | null = null;
  try {
    const bytes = await store.read(job.object_key);
    if (
      bytes.length !== job.byte_length ||
      createHash("sha256").update(bytes).digest("hex") !== job.sha256
    )
      throw new Error("AUDIO_INTEGRITY");
    const converted = await convertRecording(bytes, job.mime, binary);
    duration = converted.duration;
    text = await transcribe(converted.wav);
    if (!text.trim() || text.length > 10000)
      throw new Error("INVALID_TRANSCRIPT");
  } catch {
    error = "TRANSCRIPTION_FAILED";
  }
  await db.query("select eventops_worker_api.finish_voice($1,$2,$3,$4,$5)", [
    job.id,
    job.lease_token,
    text,
    duration,
    error,
  ]);
  return true;
}
export async function cleanupVoice(
  db: Pick<pg.Client, "query">,
  store: AudioStore,
) {
  const result = await db.query(
    "select eventops_worker_api.voice_cleanup() as jobs",
  );
  for (const job of result.rows[0]?.jobs ?? []) {
    try {
      await store.remove(job.object_key);
      await db.query("select eventops_worker_api.voice_deleted($1)", [job.id]);
    } catch {
      /* Retry deletion next sweep, never acknowledge a failed deletion. */
    }
  }
}
export function audioStore(
  url: string,
  key: string,
  token: string,
  fetcher: typeof fetch = fetch,
): AudioStore {
  const base = new URL(url);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("STORAGE_CONFIGURATION");
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  return {
    async read(path) {
      const response = await fetcher(
        new URL("/storage/v1/object/authenticated/event-audio/" + path, base),
        { headers, signal: AbortSignal.timeout(10000), redirect: "error" },
      );
      if (!response.ok) throw new Error("AUDIO_UNAVAILABLE");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("AUDIO_UNAVAILABLE");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > MAX_AUDIO_BYTES) {
          await reader.cancel();
          throw new Error("AUDIO_TOO_LARGE");
        }
        chunks.push(item.value);
      }
      return Buffer.concat(chunks);
    },
    async remove(path) {
      const response = await fetcher(
        new URL("/storage/v1/object/event-audio", base),
        {
          method: "DELETE",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [path] }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
      if (!response.ok) throw new Error("AUDIO_DELETE_FAILED");
      await response.body?.cancel();
    },
  };
}
export async function startVoiceWorker(env: NodeJS.ProcessEnv = process.env) {
  if (
    !env.WORKER_DATABASE_URL ||
    !env.EVENTOPS_AUDIO_STORAGE_TOKEN ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("VOICE_CONFIGURATION_REQUIRED");
  const canTranscribe =
    voiceEnabled(env) && !!env.MODEL_API_KEY && !!env.EVENTOPS_FFMPEG_PATH;
  // Cleanup remains active when provider access is disabled or credentials are absent.
  // Storage uses a separately scoped eventops_worker JWT, never an owner/service key.
  const payload = JSON.parse(
    Buffer.from(
      env.EVENTOPS_AUDIO_STORAGE_TOKEN.split(".")[1] ?? "",
      "base64url",
    ).toString(),
  );
  if (payload.role !== "eventops_worker")
    throw new Error("VOICE_CONFIGURATION_REQUIRED");
  const db = new pg.Client({ connectionString: env.WORKER_DATABASE_URL });
  await db.connect();
  try {
    await db.query("set role eventops_worker");
    const store = audioStore(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      env.EVENTOPS_AUDIO_STORAGE_TOKEN,
    );
    while (true) {
      await cleanupVoice(db, store);
      const worked =
        canTranscribe &&
        (await runVoice(
          db,
          store,
          createTranscriber(env.MODEL_API_KEY!),
          env.EVENTOPS_FFMPEG_PATH!,
        ));
      if (!worked) await new Promise((r) => setTimeout(r, 2000));
    }
  } finally {
    await db.end();
  }
}
