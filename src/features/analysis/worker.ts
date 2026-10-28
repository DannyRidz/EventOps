import pg from "pg";
import { z } from "zod";
import { planSchema } from "@/features/plans/schema";
import { analysisResultSchema } from "./contracts";
import { analyzeUpdate } from "./orchestrate";
import {
  AnalysisError,
  createMetaTransport,
  liveModelEnabled,
  type ModelCall,
  type Usage,
} from "./provider";
const claimSchema = z.strictObject({
  id: z.uuid(),
  lease_token: z.uuid(),
  base_revision_id: z.uuid(),
  plan: planSchema,
  text: z.string().min(1).max(10000),
  source_id: z.uuid(),
});
export type WorkerDatabase = Pick<pg.Client, "query">;
export async function runOne(
  db: WorkerDatabase,
  makeCall: (usage: Usage, deadline: number) => ModelCall,
) {
  const claimed = await db.query("select eventops_worker_api.claim() as job");
  const raw = claimed.rows[0]?.job;
  if (!raw) return false;
  const job = claimSchema.parse(raw);
  const usage: Usage = {
    input_tokens: 0,
    output_tokens: 0,
    reported: true,
    calls: 0,
  };
  const started = Date.now();
  const deadline = started + 90000;
  let result = null,
    error: string | null = null;
  try {
    result = await analyzeUpdate({
      plan: job.plan,
      text: job.text,
      baseId: job.base_revision_id,
      sourceId: job.source_id,
      jobId: job.id,
      call: makeCall(usage, deadline),
      validation: (kind, count) => {
        const key =
          kind === "constraint" ? "constraint_failures" : "citation_failures";
        usage[key] = (usage[key] ?? 0) + count;
      },
      stage: async (stage) => {
        const updated = await db.query(
          "select eventops_worker_api.stage($1,$2,$3) as accepted",
          [job.id, job.lease_token, stage],
        );
        if (!updated.rows[0]?.accepted) throw new AnalysisError("LEASE_LOST");
      },
    });
    result = analysisResultSchema.parse(result);
  } catch (e) {
    error = e instanceof AnalysisError ? e.code : "ANALYSIS_FAILED";
  }
  usage.latency_ms = Math.min(90000, Math.max(0, Date.now() - started));
  let saved;
  try {
    saved = await db.query(
      "select eventops_worker_api.finish($1,$2,$3::jsonb,$4,$5::jsonb) as accepted",
      [
        job.id,
        job.lease_token,
        result ? JSON.stringify(result) : null,
        error,
        JSON.stringify(usage),
      ],
    );
  } catch {
    error = "ANALYSIS_FAILED";
    saved = await db.query(
      "select eventops_worker_api.finish($1,$2,null,$3,$4::jsonb) as accepted",
      [job.id, job.lease_token, error, JSON.stringify(usage)],
    );
  }
  console.log(
    JSON.stringify({
      job_id: job.id,
      state: saved.rows[0]?.accepted
        ? error
          ? "failed"
          : "completed"
        : "lease_lost",
      error_code: error,
      calls: usage.calls,
    }),
  );
  return true;
}
export async function startWorker() {
  if (!liveModelEnabled())
    throw new Error(
      "Worker disabled: verified provider access and billing prerequisites are required.",
    );
  const value = process.env.WORKER_DATABASE_URL;
  if (!value) throw new Error("WORKER_DATABASE_URL is required.");
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const db = new pg.Client({
    connectionString: url.href,
    ssl: loopback ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  await db.connect();
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    const identity = await db.query("select session_user as login");
    if (
      [
        "postgres",
        "supabase_admin",
        "service_role",
        "authenticated",
        "anon",
        "authenticator",
      ].includes(identity.rows[0]?.login)
    )
      throw new Error("Use a dedicated restricted worker login.");
    await db.query("set role eventops_worker");
    while (!stopping) {
      try {
        const worked = await runOne(db, (usage, deadline) =>
          createMetaTransport({
            key: process.env.MODEL_API_KEY!,
            deadline,
            usage,
          }),
        );
        if (!worked) await new Promise((r) => setTimeout(r, 1000));
      } catch {
        console.error(
          JSON.stringify({ error_code: "WORKER_DATABASE_FAILURE" }),
        );
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    await db.end();
  }
}
