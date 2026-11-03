// Explicitly authorized synthetic verification, never a general worker launcher.
import "./register-app-modules.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { campaignCall } from "./lib/t9-allowance.mjs";
const { runOne } = await import("../src/features/analysis/worker.ts");
const { createMetaTransport, liveModelEnabled } =
  await import("../src/features/analysis/provider.ts");
const { editableRecords, planInput } =
  await import("../src/features/plans/editor-model.ts");

assert.equal(process.env.EVENTOPS_SYNTHETIC_LIVE_APPROVED, "1");
assert.ok(liveModelEnabled(), "Temporary verified probe gates required");
const attempt = process.env.EVENTOPS_LIVE_ATTEMPT;
assert.match(attempt ?? "", /^[a-zA-Z0-9_-]{1,40}$/);
const controlled = process.argv.includes("--check-local");
const voice = process.argv.includes("--voice");
assert.ok(
  process.argv
    .slice(2)
    .every((a) => ["--check-local", "--voice", "--clear-speech"].includes(a)),
);
const folder = resolve("output/live-analysis-private");
await mkdir(folder, { recursive: true, mode: 0o700 });
const report = {
  started_at: new Date().toISOString(),
  attempt,
  synthetic: true,
  live_provider: !controlled,
  kind: voice ? "voice" : "text",
  scope: "isolated SQL database, normal restricted worker runOne",
  requests: [],
  allowance_usd: 1,
  outcome: "not_run",
};
const status = JSON.parse(
  await readFile("/private/tmp/eventops-local-status.json", "utf8"),
);
const env = status.env ?? status;
assert.match(
  env.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
const admin = new pg.Client({ connectionString: env.DB_URL });
await admin.connect();
const name = "eventops_live_test_" + randomUUID().replaceAll("-", "");
const login = "eventops_live_worker_" + randomUUID().replaceAll("-", "");
let db, worker;
const checkOriginalGates = async () => {
  const { rows } = await admin.query(
    "select (select enabled from eventops_private.analysis_budget_lock) analysis,(select enabled from eventops_private.voice_gate) voice",
  );
  assert.deepEqual(rows[0], { analysis: false, voice: false });
};
try {
  await checkOriginalGates();
  await admin.query(`create database ${name} template template0`);
  db = new pg.Client({
    connectionString: env.DB_URL.replace(/\/postgres$/, "/" + name),
  });
  await db.connect();
  await db.query(
    "create schema auth;create schema extensions;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;",
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    if (file.endsWith(".sql"))
      await db.query(
        "begin;" +
          (await readFile("supabase/migrations/" + file, "utf8")) +
          "commit;",
      );
  // Disposable SQL fixtures only. No user sign in or legal acceptance occurs.
  const owner = randomUUID();
  const workspace = randomUUID();
  await db.query(
    "insert into auth.users(id,email_confirmed_at) values($1,now());",
    [owner],
  );
  await db.query(
    "insert into public.profiles(user_id,terms_version,privacy_version) values($1,'2026-10-27','2026-10-27')",
    [owner],
  );
  await db.query(
    "insert into public.workspaces(id,owner_user_id,name) values($1,$2,'Synthetic live verification')",
    [workspace, owner],
  );
  await db.query(
    "insert into public.memberships(workspace_id,user_id) values($1,$2)",
    [workspace, owner],
  );
  const one = async (sql, values) => {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      const r = await db.query(sql, values);
      await db.query("commit");
      return r.rows[0].value;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  };
  const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8"));
  const fixture = corpus.cases.find((c) => c.case_id === "E02");
  const plan = fixture.input.plan;
  const aliases = new Map();
  for (const rows of Object.values(editableRecords(plan)))
    for (const row of rows) aliases.set(row.id, row.external_id);
  const records = editableRecords(plan);
  for (const rows of Object.values(records))
    for (const row of rows) {
      delete row.id;
      for (const key of [
        "room_id",
        "session_id",
        "volunteer_id",
        "predecessor_session_id",
        "successor_session_id",
      ])
        if (key in row) row[key] = aliases.get(row[key]);
    }
  const event = await one("select public.save_event($1::jsonb,$2) value", [
    JSON.stringify(plan.event),
    randomUUID(),
  ]);
  const stage = await one(
    "select public.stage_plan($1,$2::jsonb,1,true) value",
    [event, JSON.stringify(planInput(records))],
  );
  assert.deepEqual(stage.validation_report, []);
  const base = await one("select public.confirm_plan($1,$2,$3,$4) value", [
    event,
    stage.generation,
    stage.candidate_digest,
    randomUUID(),
  ]);
  if (voice) {
    const { verifyLiveVoice } = await import("./lib/live-voice-probe.mjs");
    report.voice = await verifyLiveVoice({
      admin,
      db,
      one,
      event,
      base,
      login,
      databaseName: name,
      databaseUrl: env.DB_URL,
      folder,
      attempt,
      controlled,
      clearSpeech: process.argv.includes("--clear-speech"),
      report,
      save,
    });
    report.outcome = "confirmed_synthetic_voice";
  } else {
    const text = fixture.input.confirmed_text;
    const draft = await one(
      "select public.save_text_update($1,$2,$2,$3) value",
      [event, text, randomUUID()],
    );
    const job = await one(
      "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
      [event, draft.id, base.revision_id, text],
    );
    assert.equal(job.state, "blocked");
    // Only this disposable database is enabled. The running project stays off.
    await db.query(
      "update eventops_private.analysis_budget_lock set enabled=true",
    );
    await one("select public.queue_analysis_job($1,$2) value", [event, job.id]);
    assert.equal(
      (await db.query("select count(*)::int n from public.analysis_jobs"))
        .rows[0].n,
      1,
    );
    const password = randomUUID();
    await admin.query(
      `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
    );
    const workerUrl = new URL(env.DB_URL);
    workerUrl.pathname = "/" + name;
    workerUrl.username = login;
    workerUrl.password = password;
    worker = new pg.Client({ connectionString: workerUrl.href });
    await worker.connect();
    await worker.query("set role eventops_worker");
    assert.equal(
      (
        await worker.query(
          "select has_table_privilege(current_user,'public.revisions','select') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    let index = 0;
    const guardedFetch = async (url, options) => {
      assert.equal(url, "https://api.meta.ai/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "muse-spark-1.3");
      assert.equal(body.max_completion_tokens, 4000);
      assert.equal(body.store, false);
      assert.equal(body.tools, undefined);
      assert.ok(Buffer.byteLength(options.body) < 17000);
      const key = `${attempt}-call-${++index}`;
      return campaignCall(
        {
          path: resolve(
            folder,
            controlled
              ? "controlled-reservations.jsonl"
              : "usd1-reservations.jsonl",
          ),
          limitMicrousd: 1000000,
          amountMicrousd: 50000,
          key,
        },
        async () => {
          const receipt = { key, reserved_usd: 0.05 };
          report.requests.push(receipt);
          await save();
          const started = Date.now();
          let response;
          try {
            response = controlled
              ? new Response(
                  JSON.stringify({
                    error: {
                      code: "controlled_access_denied",
                      message: "Local harness verification only",
                    },
                  }),
                  { status: 403 },
                )
              : await fetch(url, options);
          } catch (error) {
            receipt.latency_ms = Date.now() - started;
            receipt.transport_error = {
              name: error.name,
              code: error.cause?.code,
              message: error.cause?.message?.slice(0, 300),
            };
            await save();
            throw error;
          }
          receipt.status = response.status;
          receipt.latency_ms = Date.now() - started;
          receipt.request_id = response.headers.get("x-request-id");
          if (response.ok) {
            const envelope = await response.clone().json();
            receipt.response = {
              model: envelope.model,
              finish_reason: envelope.choices?.[0]?.finish_reason,
              content_length:
                envelope.choices?.[0]?.message?.content?.length ?? 0,
              refusal: Boolean(envelope.choices?.[0]?.message?.refusal),
              usage: envelope.usage,
            };
          }
          if (!response.ok) {
            const raw = await response.clone().text();
            try {
              const error = JSON.parse(raw).error;
              receipt.error = {
                code: error?.code,
                type: error?.type,
                message: error?.message?.slice(0, 700),
              };
            } catch {
              receipt.error = { code: "NON_JSON_PROVIDER_ERROR" };
            }
          }
          await save();
          return response;
        },
      )();
    };
    await runOne(worker, (usage, deadline) =>
      createMetaTransport({
        key: process.env.MODEL_API_KEY,
        fetcher: guardedFetch,
        deadline,
        usage,
      }),
    );
    const result = (
      await db.query(
        "select state,error_code,result,result_digest from public.analysis_jobs where id=$1",
        [job.id],
      )
    ).rows[0];
    report.worker = result;
    report.billing = (
      await db.query(
        "select state,input_tokens,output_tokens,calls,charged_usd from public.model_runs where job_id=$1",
        [job.id],
      )
    ).rows;
    report.official_head_unchanged =
      (
        await db.query(
          "select current_revision_id from public.events where id=$1",
          [event],
        )
      ).rows[0].current_revision_id === base.revision_id;
    assert.equal(report.official_head_unchanged, true);
    report.outcome = result.state === "completed" ? "completed" : "failed";
    if (result.result?.status === "ready_for_confirmation") {
      assert.equal(result.result.options.length, 1);
      const proposal = await one(
        "select public.adopt_analysis_option($1,$2,$3,$4,true,$5) value",
        [
          event,
          job.id,
          result.result.options[0].id,
          result.result_digest,
          randomUUID(),
        ],
      );
      const candidate = proposal.candidate_snapshot;
      const opening = candidate.sessions.find(
        (s) => s.external_id === "opening",
      );
      const room = candidate.rooms.find((r) => r.id === opening.room_id);
      const assignment = candidate.assignments.find(
        (a) => a.session_id === opening.id,
      );
      const volunteer = candidate.volunteers.find(
        (v) => v.id === assignment.volunteer_id,
      );
      assert.equal(room.name, "Room 2");
      assert.equal(opening.start, "12:00");
      assert.equal(opening.end, "13:00");
      assert.equal(volunteer.display_name, "Synthetic Sam");
      assert.deepEqual(proposal.constraint_report, []);
      const approvalKey = randomUUID();
      const approve = () =>
        one("select public.approve_proposal($1,$2,$3,$4,$5,$6) value", [
          event,
          proposal.id,
          proposal.base_revision_id,
          proposal.generation,
          proposal.candidate_digest,
          approvalKey,
        ]);
      const approved = await approve();
      assert.deepEqual(await approve(), approved);
      const revision = await one(
        "select to_jsonb(r) value from public.revisions r where id=$1",
        [approved.revision_id],
      );
      const { briefingText } =
        await import("../src/features/plans/briefing.ts");
      const briefing = briefingText(revision);
      assert.ok(
        briefing.includes("Opening") && briefing.includes("Synthetic Sam"),
      );
      report.confirmation_approval_briefing = {
        semantic_candidate_verified: true,
        transactional_approval: true,
        idempotent_approval: true,
        briefing_verified: true,
        revision_id: approved.revision_id,
      };
      report.outcome = "approved_synthetic_workflow";
    }
  }
} catch (e) {
  report.outcome = "harness_failed";
  report.error = {
    code: e.code,
    message: e.message?.slice(0, 500),
    location: e.stack
      ?.split("\n")
      .filter((line) => line.trim().startsWith("at "))
      .slice(0, 2)
      .join("\n"),
  };
  process.exitCode = 1;
} finally {
  if (db)
    await db
      .query("update eventops_private.analysis_budget_lock set enabled=false")
      .catch(() => {});
  if (db)
    await db
      .query("update eventops_private.voice_gate set enabled=false")
      .catch(() => {});
  await worker?.end();
  await db?.end();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`drop role if exists ${login}`);
  await checkOriginalGates();
  report.original_gates_disabled = true;
  await admin.end();
  report.finished_at = new Date().toISOString();
  await save();
  const passed = voice
    ? report.outcome === "confirmed_synthetic_voice"
    : controlled
      ? report.worker?.error_code === "PROVIDER_ACCESS" &&
        report.requests.length === 1 &&
        report.requests[0].error?.code === "controlled_access_denied"
      : report.outcome === "approved_synthetic_workflow";
  if (!passed) process.exitCode = 1;
  console.log(
    JSON.stringify({
      outcome: report.outcome,
      requests: report.requests,
      worker_state: report.worker?.state,
      worker_error: report.worker?.error_code,
      result_status: report.worker?.result?.status,
      billing: report.billing,
      voice: report.voice,
      error: report.error,
      original_gates_disabled: report.original_gates_disabled,
    }),
  );
}
async function save() {
  await writeFile(
    resolve(folder, `${attempt}-receipt.json`),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
}
