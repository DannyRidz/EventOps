import { constants } from "node:fs";
import { open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export function fencedWorker(
  worker,
  expectedJob,
  claimSql = [
    "select eventops_worker_api.claim() as job",
    "select eventops_worker_api.claim($1::text) as job",
  ],
) {
  return {
    async query(sql, values) {
      if (
        !(Array.isArray(claimSql) ? claimSql.includes(sql) : sql === claimSql)
      )
        return worker.query(sql, values);
      await worker.query("begin");
      try {
        const result = await worker.query(sql, values);
        const job = result.rows[0]?.job;
        if (!job) {
          await worker.query("rollback");
          return result;
        }
        if (job && job.id !== expectedJob)
          throw new Error("UNEXPECTED_JOB_CLAIM_ROLLED_BACK");
        await worker.query("commit");
        return result;
      } catch (error) {
        await worker.query("rollback");
        throw error;
      }
    },
  };
}

export async function createReceipt(path, initial) {
  const fd = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await fd.writeFile(JSON.stringify(initial, null, 2) + "\n");
    await fd.sync();
  } finally {
    await fd.close();
  }
  return async (value) => {
    const temp = path + "." + randomUUID() + ".tmp";
    try {
      const next = await open(temp, "wx", 0o600);
      try {
        await next.writeFile(JSON.stringify(value, null, 2) + "\n");
        await next.sync();
      } finally {
        await next.close();
      }
      await rename(temp, path);
    } finally {
      await unlink(temp).catch(() => {});
    }
  };
}

// Diagnostics are bounded and best effort; the original response stays authoritative.
export async function responseDiagnostic(response) {
  const reader = response.clone().body?.getReader();
  if (!reader) return { diagnostic: "NO_BODY" };
  let timer;
  try {
    const bounded = async () => {
      const chunks = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 128000) return { diagnostic: "TOO_LARGE" };
        chunks.push(part.value);
      }
      try {
        const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!response.ok)
          return {
            error: {
              code: envelope?.error?.code,
              type: envelope?.error?.type,
              message:
                typeof envelope?.error?.message === "string"
                  ? envelope.error.message.slice(0, 700)
                  : undefined,
            },
          };
        const transcript = typeof envelope?.transcript === "string";
        const content = transcript
          ? envelope.transcript
          : envelope?.choices?.[0]?.message?.content;
        return {
          response: {
            response_kind: transcript ? "transcription" : "chat_or_unknown",
            model: envelope?.model,
            finish_reason: envelope?.choices?.[0]?.finish_reason,
            content_length: typeof content === "string" ? content.length : null,
            refusal: Boolean(envelope?.choices?.[0]?.message?.refusal),
            usage: envelope?.usage,
            usage_reported:
              !!envelope?.usage && typeof envelope.usage === "object",
          },
        };
      } catch {
        return { diagnostic: "INVALID_JSON" };
      }
    };
    return await Promise.race([
      bounded(),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ diagnostic: "TIMEOUT" }), 1000);
      }),
    ]);
  } catch {
    return { diagnostic: "UNAVAILABLE" };
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
