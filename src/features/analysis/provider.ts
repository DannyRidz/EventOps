import { z } from "zod";
export const MODEL_ID = "muse-spark-1.3";
export class AnalysisError extends Error {
  code: string;
  retryAfter: number;
  constructor(code: string, retryAfter = 0) {
    super(code);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
export type Usage = {
  input_tokens: number;
  output_tokens: number;
  reported: boolean;
  calls: number;
  request_ids?: string[];
  latency_ms?: number;
  constraint_failures?: number;
  citation_failures?: number;
};
export type ModelCall = (
  name: string,
  schema: z.ZodType,
  policy: string,
  input: unknown,
) => Promise<unknown>;
export function analysisRequestsEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.EVENTOPS_MODEL_ENABLED === "1" &&
    env.EVENTOPS_META_ACCESS_VERIFIED === "1" &&
    env.EVENTOPS_META_BILLING_BOUND_VERIFIED === "1"
  );
}
export function liveModelEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return analysisRequestsEnabled(env) && !!env.MODEL_API_KEY;
}
export function createMetaTransport({
  key,
  fetcher = fetch,
  now = Date.now,
  random = Math.random,
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  deadline,
  usage,
}: {
  key: string;
  fetcher?: typeof fetch;
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  deadline: number;
  usage: Usage;
}): ModelCall {
  return async (name, schema, policy, input) => {
    const messages = [
      { role: "system", content: policy },
      { role: "user", content: JSON.stringify(input) },
    ];
    // UTF-8 bytes conservatively bound token count without assuming tokenizer compression.
    const responseSchema = modelJsonSchema(schema);
    const bytes =
      Buffer.byteLength(JSON.stringify({ messages, responseSchema })) + 512;
    if (bytes > 16000) throw new AnalysisError("CONTEXT_TOO_LARGE");
    let retries = 0;
    while (true) {
      if (usage.calls >= 3 || now() >= deadline)
        throw new AnalysisError("ANALYSIS_LIMIT");
      usage.calls++;
      const priorUsageKnown = usage.reported;
      usage.reported = false;
      let response: Response;
      const headerController = new AbortController();
      const headerTimer = setTimeout(
        () => headerController.abort(),
        Math.min(10000, Math.max(1, deadline - now())),
      );
      try {
        response = await fetcher("https://api.meta.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL_ID,
            messages,
            store: false,
            max_completion_tokens: 4000,
            response_format: {
              type: "json_schema",
              json_schema: {
                name,
                strict: true,
                schema: responseSchema,
              },
            },
          }),
          signal: AbortSignal.any([
            headerController.signal,
            AbortSignal.timeout(Math.min(35000, Math.max(1, deadline - now()))),
          ]),
        });
      } catch {
        usage.reported = false;
        if (retries++ >= 2 || usage.calls >= 3)
          throw new AnalysisError("PROVIDER_NETWORK");
        await sleep(
          Math.min(
            500 * 2 ** retries + Math.floor(random() * 250),
            Math.max(0, deadline - now()),
          ),
        );
        continue;
      } finally {
        clearTimeout(headerTimer);
      }
      if (response.status === 429 || response.status >= 500) {
        usage.reported = false;
        const header = response.headers.get("retry-after");
        const delay = header
          ? Number.isFinite(Number(header))
            ? Number(header) * 1000
            : Math.max(0, Date.parse(header) - now())
          : 500 * 2 ** retries + Math.floor(random() * 250);
        await response.body?.cancel();
        if (retries++ >= 2 || usage.calls >= 3 || delay >= deadline - now())
          throw new AnalysisError(
            response.status === 429
              ? "PROVIDER_RATE_LIMIT"
              : "PROVIDER_UNAVAILABLE",
            Math.ceil(delay / 1000),
          );
        await sleep(Math.max(0, delay));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        usage.reported = false;
        throw new AnalysisError(
          [401, 403].includes(response.status)
            ? "PROVIDER_ACCESS"
            : "PROVIDER_REQUEST",
        );
      }
      // Bound both response bytes and body-read time, not just response headers.
      const reader = response.body?.getReader();
      if (!reader) throw new AnalysisError("PROVIDER_SHAPE");
      let body = "";
      const decoder = new TextDecoder();
      while (true) {
        if (now() >= deadline) {
          await reader.cancel();
          throw new AnalysisError("ANALYSIS_LIMIT");
        }
        const item = await readBeforeDeadline(
          reader,
          Math.max(1, Math.min(35000, deadline - now())),
        );
        if (item.done) break;
        body += decoder.decode(item.value, { stream: true });
        if (Buffer.byteLength(body) > 128000) {
          await reader.cancel();
          throw new AnalysisError("PROVIDER_TOO_LARGE");
        }
      }
      let envelope;
      try {
        envelope = z
          .object({
            id: z
              .string()
              .regex(/^[A-Za-z0-9_-]{1,128}$/)
              .optional(),
            model: z.string(),
            choices: z
              .array(
                z.object({
                  finish_reason: z.string(),
                  message: z.object({
                    content: z.string().nullable(),
                    refusal: z.string().nullable().optional(),
                  }),
                }),
              )
              .min(1),
            usage: z
              .object({
                prompt_tokens: z.number().int().nonnegative().max(16000),
                completion_tokens: z.number().int().nonnegative().max(4000),
              })
              .optional(),
          })
          .parse(JSON.parse(body));
      } catch {
        usage.reported = false;
        throw new AnalysisError("PROVIDER_SHAPE");
      }
      if (envelope.model !== MODEL_ID)
        throw new AnalysisError("PROVIDER_MODEL");
      if (envelope.id) (usage.request_ids ??= []).push(envelope.id);
      if (envelope.usage) {
        usage.reported = priorUsageKnown;
        usage.input_tokens += envelope.usage.prompt_tokens;
        usage.output_tokens += envelope.usage.completion_tokens;
      } else usage.reported = false;
      const choice = envelope.choices[0]!;
      if (
        choice.message.refusal ||
        choice.finish_reason !== "stop" ||
        choice.message.content === null
      )
        throw new AnalysisError("PROVIDER_REFUSAL");
      try {
        return JSON.parse(choice.message.content);
      } catch {
        throw new AnalysisError("INVALID_MODEL_JSON");
      }
    }
  };
}

export function modelJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const convert = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(convert)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key === "oneOf" ? "anyOf" : key,
              convert(item),
            ]),
          )
        : value;
  return convert(z.toJSONSchema(schema)) as Record<string, unknown>;
}

async function readBeforeDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  milliseconds: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AnalysisError("ANALYSIS_LIMIT"));
          void reader.cancel().catch(() => {});
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
