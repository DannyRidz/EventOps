// One authorized synthetic browser job, never a general queue worker.
import "./register-app-modules.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { campaignCall } from "./lib/t9-allowance.mjs";
import {
  createReceipt,
  responseDiagnostic,
  fencedWorker,
} from "./lib/live-evidence.mjs";
const { runOne } = await import("../src/features/analysis/worker.ts");
const { createMetaTransport, liveModelEnabled } =
  await import("../src/features/analysis/provider.ts");
const { providerContext } = await import("../src/features/analysis/privacy.ts");
assert.equal(process.env.EVENTOPS_SYNTHETIC_LIVE_APPROVED, "1");
assert.ok(liveModelEnabled());
const event = process.env.EVENTOPS_BROWSER_EVENT_ID;
const jobId = process.env.EVENTOPS_BROWSER_JOB_ID;
for (const id of [event, jobId]) assert.match(id ?? "", /^[a-f0-9-]{36}$/);
const attempt = process.env.EVENTOPS_LIVE_ATTEMPT;
assert.match(attempt ?? "", /^[A-Za-z0-9_-]{1,40}$/);
const folder = resolve("output/live-analysis-private");
await mkdir(folder, { recursive: true, mode: 0o700 });
const report = {
  attempt,
  event,
  job_id: jobId,
  synthetic: true,
  requests: [],
  state: "preflight",
};
const save = await createReceipt(
  resolve(folder, `${attempt}-receipt.json`),
  report,
);
const status = JSON.parse(
  await readFile("/private/tmp/eventops-local-status.json", "utf8"),
);
const url = (status.env ?? status).DB_URL;
assert.match(
  url,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
const admin = new pg.Client({ connectionString: url });
await admin.connect();
let worker,
  gateChanged = false,
  roleCreated = false;
const login = "eventops_browser_worker_" + randomUUID().replaceAll("-", "");
try {
  const gates = (
    await admin.query(
      "select (select enabled from eventops_private.analysis_budget_lock) a,(select enabled from eventops_private.voice_gate) v",
    )
  ).rows[0];
  assert.deepEqual(gates, { a: false, v: false });
  const job = (
    await admin.query(
      "select j.*,e.name,r.snapshot,u.confirmed_text,s.id source_id from public.analysis_jobs j join public.events e on e.id=j.event_id join public.revisions r on r.id=j.base_revision_id join public.updates u on u.id=j.update_id join public.source_records s on s.record_id=u.id::text and s.event_id=e.id and s.field_path='confirmed_text' where j.id=$1 and j.event_id=$2",
      [jobId, event],
    )
  ).rows[0];
  assert.equal(job.state, "blocked");
  assert.equal(job.name, "Synthetic T9 browser verification");
  assert.ok(
    [
      "Move Opening to Room 2 from 12:00 to 13:00. Synthetic Alex cannot cover Opening; assign Synthetic Sam as the usher instead.",
      "Move Opening to Room 2 from 12:00 to 13:00. Synthetic Alex is unavailable from 10:00 to 13:00. Assign Synthetic Sam as the usher for Opening from 12:00 to 13:00.",
      "Move Opening to Room 2 from 12:00 to 13:00. Synthetic Alex cannot cover Opening; assign Synthetic Sam as the usher instead.\n\nClarification for: For Volunteer 1 cannot cover sessions-1, what exact start and end time should be marked unavailable?\nOrganizer answer: Synthetic Alex is unavailable from 10:00 to 13:00. Assign Synthetic Sam as the usher for Opening from 12:00 to 13:00.",
    ].includes(job.confirmed_text),
  );
  assert.deepEqual(job.snapshot.volunteers.map((v) => v.display_name).sort(), [
    "Synthetic Alex",
    "Synthetic Sam",
  ]);
  assert.equal(
    (
      await admin.query(
        "select count(*)::int n from public.analysis_jobs where state in ('queued','running')",
      )
    ).rows[0].n,
    0,
  );
  const context = providerContext(job.snapshot, job.confirmed_text);
  const password = randomUUID();
  await admin.query(
    `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
  );
  roleCreated = true;
  const workerUrl = new URL(url);
  workerUrl.username = login;
  workerUrl.password = password;
  worker = new pg.Client({ connectionString: workerUrl.href });
  await worker.connect();
  await worker.query("set role eventops_worker");
  await admin.query(
    "update eventops_private.analysis_budget_lock set enabled=true",
  );
  gateChanged = true;
  report.state = "waiting_for_browser_queue";
  await save(report);
  console.log(JSON.stringify({ state: report.state, job_id: jobId }));
  let callIndex = 0;
  const fetcher = async (endpoint, options) => {
    assert.equal(endpoint, "https://api.meta.ai/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "muse-spark-1.3");
    assert.equal(body.max_completion_tokens, 4000);
    assert.equal(body.store, false);
    assert.equal(body.tools, undefined);
    assert.ok(Buffer.byteLength(options.body) < 17000);
    return campaignCall(
      {
        path: resolve(folder, "usd1-reservations.jsonl"),
        limitMicrousd: 1000000,
        amountMicrousd: 50000,
        key: `${attempt}-call-${++callIndex}`,
      },
      async () => {
        const receipt = { reserved_usd: 0.05 };
        report.requests.push(receipt);
        await save(report);
        const started = Date.now();
        try {
          const response = await fetch(endpoint, options);
          receipt.status = response.status;
          receipt.latency_ms = Date.now() - started;
          receipt.request_id = response.headers.get("x-request-id");
          Object.assign(receipt, await responseDiagnostic(response));
          await save(report);
          return response;
        } catch (e) {
          receipt.transport_error = { name: e.name, code: e.cause?.code };
          await save(report);
          throw e;
        }
      },
    )();
  };
  const expires = Date.now() + 180000;
  let worked = false;
  while (Date.now() < expires && !worked) {
    const active = (
      await admin.query(
        "select id from public.analysis_jobs where state in ('queued','running')",
      )
    ).rows;
    assert.ok(
      active.every((j) => j.id === jobId),
      "Another job is active; stop without processing it",
    );
    worked = await runOne(fencedWorker(worker, jobId), (usage, deadline) => {
      const call = createMetaTransport({
        key: process.env.MODEL_API_KEY,
        fetcher,
        usage,
        deadline,
      });
      return (name, schema, policy, input) => {
        assert.equal(input.base_revision_id, job.base_revision_id);
        if (name === "EventOpsIntent") {
          assert.equal(input.text_source_id, job.source_id);
          assert.equal(input.confirmed_text, context.text);
          assert.deepEqual(input.plan, context.plan);
        } else {
          assert.equal(name, "EventOpsSelection");
          assert.deepEqual(input.allowed_evidence_refs, [job.source_id]);
        }
        return call(name, schema, policy, input);
      };
    });
    if (!worked) await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(worked, "Browser did not queue the job before timeout");
  report.worker = (
    await admin.query(
      "select state,error_code,result,result_digest from public.analysis_jobs where id=$1",
      [jobId],
    )
  ).rows[0];
  report.billing = (
    await admin.query(
      "select state,input_tokens,output_tokens,calls,charged_usd from public.model_runs where job_id=$1",
      [jobId],
    )
  ).rows;
  report.state =
    report.worker.result?.status === "ready_for_confirmation"
      ? "ready_for_browser_confirmation"
      : "failed";
  if (report.state === "failed") process.exitCode = 1;
} catch (e) {
  report.state = "failed";
  report.error = { code: e.code, message: e.message?.slice(0, 500) };
  process.exitCode = 1;
} finally {
  if (gateChanged)
    await admin.query(
      "update eventops_private.analysis_budget_lock set enabled=false",
    );
  await worker?.end();
  if (roleCreated) await admin.query(`drop role ${login}`);
  report.gates = (
    await admin.query(
      "select (select enabled from eventops_private.analysis_budget_lock) analysis,(select enabled from eventops_private.voice_gate) voice",
    )
  ).rows[0];
  await admin.end();
  await save(report);
  console.log(JSON.stringify(report));
}
