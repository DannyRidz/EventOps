import { z } from "zod";
export const TRANSCRIPTION_MODEL = "muse-voice-transcribe-1.0";
export type Transcribe = (wav: Uint8Array) => Promise<string>;
export function createTranscriber(
  key: string,
  fetcher: typeof fetch = fetch,
): Transcribe {
  return async (wav) => {
    const deadline = Date.now() + 45000;
    const form = new FormData();
    form.set(
      "request",
      new Blob(
        [
          JSON.stringify({
            model: TRANSCRIPTION_MODEL,
            mode: "PUSH_TO_TALK",
            audioEncoding: "WAV",
          }),
        ],
        { type: "application/json" },
      ),
    );
    form.set(
      "audio",
      new Blob([Uint8Array.from(wav)], { type: "audio/wav" }),
      "recording.wav",
    );
    const controller = new AbortController();
    const headersTimer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher("https://api.meta.ai/v1/asr/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45000),
        ]),
      });
      clearTimeout(headersTimer);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("TRANSCRIPTION_FAILED");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("TRANSCRIPTION_FAILED");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const item = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => {
                  reject(new Error("TRANSCRIPTION_TIMEOUT"));
                  controller.abort();
                  void reader.cancel().catch(() => {});
                },
                Math.max(1, deadline - Date.now()),
              );
            }),
          ]).finally(() => {
            if (timer) clearTimeout(timer);
          });
          if (item.done) break;
          size += item.value.length;
          if (size > 64000) {
            await reader.cancel();
            throw new Error("TRANSCRIPTION_FAILED");
          }
          chunks.push(item.value);
        }
        const result = z
          .object({
            transcript: z
              .string()
              .refine((t) => !!t.trim())
              .max(10000),
          })
          .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        return result.transcript;
      } finally {
        void reader.cancel().catch(() => {});
      }
    } finally {
      clearTimeout(headersTimer);
    }
  };
}
