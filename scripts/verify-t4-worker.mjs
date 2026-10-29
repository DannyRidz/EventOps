// Real local service verification. Only synthetic loopback accounts and records.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      return next(
        pathToFileURL(resolve("src", specifier.slice(2)) + ".ts").href,
        context,
      );
    if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) {
      const url = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  },
});
const { fixturePlan, fixtureSetup } =
  await import("../src/features/plans/fixtures.ts");
const origin = process.env.T4_WORKER_APP_URL ?? "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T4_WORKER_STATUS_FILE ??
        "/private/tmp/eventops-local-status.json",
      "utf8",
    ),
  ),
  env = local.env ?? local;
assert.match(env.API_URL, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(
  env.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
let checks = 0;
function pass(name) {
  checks++;
  console.log("PASS", name);
}
function actor() {
  const jar = new Map();
  return {
    jar,
    async request(path, body, method = body ? "POST" : "GET") {
      const response = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          Connection: "close",
          "Content-Type": "application/json",
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const pos = pair.indexOf("=");
        jar.set(pair.slice(0, pos), pair.slice(pos + 1));
      }
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      return { status: response.status, body: await response.json() };
    },
  };
}
async function signIn(client, label) {
  const email = `t4-worker-${label}-${randomUUID()}@example.test`;
  const sent = await client.request("/api/auth/code", {
    email,
    attested: true,
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  let code;
  for (let n = 0; n < 20; n++) {
    const messages = await (
      await fetch(env.MAILPIT_URL + "/api/v1/messages")
    ).json();
    const mail = messages.messages.find((m) =>
      m.To.some((t) => t.Address === email),
    );
    if (mail) {
      const detail = await (
        await fetch(env.MAILPIT_URL + "/api/v1/message/" + mail.ID)
      ).json();
      code = detail.Text.match(/code is (\d{6})/)?.[1];
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(code);
  const verified = await client.request("/api/auth/verify", {
    email,
    code,
    attested: true,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const cookie = [...client.jar]
    .filter(([name]) => /auth-token(?:\.\d+)?$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => decodeURIComponent(value))
    .join("");
  return JSON.parse(Buffer.from(cookie.slice(7), "base64url").toString());
}
async function rest(session, path, body, method = "POST") {
  const response = await fetch(env.API_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: env.PUBLISHABLE_KEY,
      Connection: "close",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.text() };
}
const { default: pg } = await import("pg");
const { runOne } = await import("../src/features/analysis/worker.ts");
const { applyIntents } = await import("../src/features/analysis/tools.ts");
const { editableRecords, planInput } =
  await import("../src/features/plans/editor-model.ts");
const { z } = await import("zod");
const { intentSchema, analysisResultSchema } =
  await import("../src/features/analysis/contracts.ts");
const migration = await readFile(
  "supabase/migrations/202610280003_analysis_worker.sql",
  "utf8",
);
const embedded = JSON.parse(
  migration
    .match(/jsonb_matches_schema\('(.+)'::json,p\)/)[1]
    .replaceAll("''", "'"),
);
assert.deepEqual(
  embedded,
  z.toJSONSchema(z.array(intentSchema).min(1).max(20)),
);
pass("TypeScript and PostgreSQL interpreted request schema have no drift");
const resultMigration = await readFile(
  "supabase/migrations/202610280004_analysis_failure_guards.sql",
  "utf8",
);
const resultSchema = JSON.parse(
  resultMigration
    .match(/jsonb_matches_schema\('(.+)'::json,p\)/)[1]
    .replaceAll("''", "'"),
);
assert.deepEqual(resultSchema, z.toJSONSchema(analysisResultSchema));

try {
  execFileSync(process.execPath, ["scripts/analysis-worker.mjs"], {
    env: { ...process.env, EVENTOPS_MODEL_ENABLED: "0" },
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.fail("Worker should remain disabled");
} catch (e) {
  assert.equal(e.status, 1);
  assert.match(e.stderr, /WORKER_CONFIGURATION_REQUIRED/);
}
pass(
  "actual worker entrypoint refuses processing while live prerequisites are disabled",
);

const owner = actor(),
  other = actor();
const session = await signIn(owner, "owner");
const otherSession = await signIn(other, "other");
const admin = new pg.Client({ connectionString: env.DB_URL });
await admin.connect();
const login = "eventops_t4_worker_" + randomUUID().replaceAll("-", "");
const password = randomUUID();
const dburl = new URL(env.DB_URL);
dburl.username = login;
dburl.password = password;
await admin.query(
  `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login};`,
);
const worker = new pg.Client({ connectionString: dburl.href });
await worker.connect();
await worker.query("set role eventops_worker");
const prior = (
  await admin.query(
    "select enabled from eventops_private.analysis_budget_lock where id=1",
  )
).rows[0].enabled;

try {
  await admin.query(
    "update eventops_private.analysis_budget_lock set enabled=true where id=1",
  );
  const capabilities = await worker.query(
    "select has_table_privilege(current_user,'public.revisions','select') as reads,has_function_privilege(current_user,'public.approve_proposal(uuid,uuid,uuid,integer,text,uuid)','execute') as approves",
  );
  assert.equal(capabilities.rows[0].reads, false);
  assert.equal(capabilities.rows[0].approves, false);
  await assert.rejects(
    worker.query("select * from public.analysis_jobs"),
    (e) => e.code === "42501",
  );
  pass(
    "real dedicated worker login can use only restricted functions, cannot read tables or approve",
  );
  const created = await owner.request("/api/events", {
    setup: fixtureSetup,
    request_id: randomUUID(),
  });
  assert.equal(created.status, 201);
  const id = created.body.event_id;
  const initial = fixturePlan(),
    aliases = new Map();
  for (const c of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of initial[c]) aliases.set(r.id, r.external_id);
  const rows = editableRecords(initial);
  for (const c of Object.keys(rows))
    for (const r of rows[c]) {
      delete r.id;
      for (const k of [
        "room_id",
        "session_id",
        "volunteer_id",
        "predecessor_session_id",
        "successor_session_id",
      ])
        if (k in r) r[k] = aliases.get(r[k]);
    }
  const stage = await owner.request(
    `/api/events/${id}/draft`,
    { plan: planInput(rows), expected_generation: 1, confirmed: true },
    "PUT",
  );
  assert.equal(stage.status, 200, JSON.stringify(stage.body));
  const receipt = await owner.request(`/api/events/${id}/confirm-plan`, {
    expected_generation: stage.body.generation,
    candidate_digest: stage.body.candidate_digest,
    idempotency_key: randomUUID(),
  });
  assert.equal(receipt.status, 200);
  const base = receipt.body.revision_id;
  const plan = stage.body.snapshot;
  async function saveJob(text) {
    const saved = await owner.request(`/api/events/${id}/updates`, {
      raw_text: text,
      corrected_text: text,
      idempotency_key: randomUUID(),
    });
    assert.equal(saved.status, 201);
    const confirmed = await owner.request(
      `/api/events/${id}/updates/${saved.body.id}/analyze`,
      {
        generation: 1,
        base_revision_id: base,
        confirmed_text: text,
        confirmed: true,
      },
    );
    assert.equal(confirmed.status, 202, JSON.stringify(confirmed.body));
    return { draft: saved.body, job: confirmed.body };
  }
  const text = "Move workshop to 12:00 to 13:00.";
  const saved = await saveJob(text);

  const request = {
    action: "change_time",
    intent_id: "move-workshop",
    session_id: plan.sessions[1].id,
    time_choices: [
      { start: "12:00", end: "13:00", start_offset: null, end_offset: null },
    ],
    span: { start: 0, end: text.length, quote: text },
  };
  const frozen = {
    schema_version: 1,
    base_revision_id: base,
    intents: [request],
    questions: [],
    unsupported_requests: [],
  };
  // Each allowlisted action is independently recomputed by SQL and TypeScript.
  const allText = "10:00 to 11:00 and 12:00 to 13:00";
  const span = { start: 0, end: allText.length, quote: allText };
  const cases = [
    request,
    {
      action: "move_session",
      intent_id: "room",
      session_id: plan.sessions[1].id,
      room_id: plan.rooms[1].id,
      time_choices: [],
      span,
    },
    {
      action: "cancel_session",
      intent_id: "cancel",
      session_id: plan.sessions[1].id,
      span,
    },
    {
      action: "change_assignment",
      intent_id: "assign",
      session_id: plan.sessions[0].id,
      from_volunteer_id: plan.volunteers[0].id,
      to_volunteer_id: plan.volunteers[1].id,
      find_replacement: true,
      role_tag: "usher",
      span,
    },
    {
      action: "change_assignment",
      intent_id: "newassign",
      session_id: plan.sessions[0].id,
      from_volunteer_id: null,
      to_volunteer_id: plan.volunteers[1].id,
      find_replacement: false,
      role_tag: "usher",
      span,
    },
    {
      action: "record_availability",
      intent_id: "availability",
      volunteer_id: plan.volunteers[1].id,
      status: "unavailable",
      interval: {
        start: "10:00",
        end: "11:00",
        start_offset: null,
        end_offset: null,
      },
      span,
    },
    {
      action: "change_room_facts",
      intent_id: "facts",
      room_id: plan.rooms[1].id,
      capacity: 50,
      feature_tags: ["projector"],
      span,
    },
  ];
  for (const r of cases) {
    const txt = r === request ? text : allText;
    const expected = applyIntents(plan, [r], saved.job.id);
    const actual = (
      await admin.query(
        "select eventops_private.apply_analysis_intents($1::jsonb,$2::jsonb,$3,$4) as candidate",
        [JSON.stringify(plan), JSON.stringify([r]), saved.job.id, txt],
      )
    ).rows[0].candidate;
    assert.deepEqual(actual, expected, r.action);
  }
  pass(
    "all six request actions plus new assignments have exact independent SQL/TypeScript candidate parity",
  );

  const { analysisFoldPlan } =
    await import("../src/features/analysis/fixtures.ts");
  const fold = analysisFoldPlan();
  const foldText = "Move to 01:30 to 02:00.";
  const foldRequest = {
    ...request,
    session_id: fold.sessions[0].id,
    time_choices: [
      {
        start: "01:30",
        end: "02:00",
        start_offset: "-05:00",
        end_offset: "-05:00",
      },
    ],
    span: { start: 0, end: foldText.length, quote: foldText },
  };
  const foldSql = (
    await admin.query(
      "select eventops_private.apply_analysis_intents($1::jsonb,$2::jsonb,$3,$4) as candidate",
      [
        JSON.stringify(fold),
        JSON.stringify([foldRequest]),
        saved.job.id,
        foldText,
      ],
    )
  ).rows[0].candidate;
  assert.deepEqual(foldSql, applyIntents(fold, [foldRequest], saved.job.id));
  assert.equal(foldSql.assignments[0].start_offset, "-04:00");
  const conflictRequests = [
    request,
    { ...request, intent_id: "conflicting-time" },
  ];
  await assert.rejects(
    admin.query(
      "select eventops_private.apply_analysis_intents($1::jsonb,$2::jsonb,$3,$4)",
      [
        JSON.stringify(plan),
        JSON.stringify(conflictRequests),
        saved.job.id,
        text,
      ],
    ),
    (e) => e.code === "22023",
  );
  pass(
    "timezone folds retain elapsed assignment buffers and SQL rejects contradictory typed requests",
  );
  const queued = await rest(session, "rpc/queue_analysis_job", {
    p_event_id: id,
    p_job_id: saved.job.id,
  });
  assert.equal(queued.status, 200, queued.body);
  const active = await saveJob("Another workshop move from 12:00 to 13:00.");
  const conflict = await rest(session, "rpc/queue_analysis_job", {
    p_event_id: id,
    p_job_id: active.job.id,
  });
  assert.equal(conflict.status, 400, conflict.body);
  const claims = await Promise.all([
    worker.query("select eventops_worker_api.claim() as job"),
    admin.query("select eventops_worker_api.claim() as job"),
  ]);
  const jobs = claims.map((r) => r.rows[0].job).filter(Boolean);
  assert.equal(jobs.length, 1);
  const lease = jobs[0];
  pass("one active analysis per event and concurrent claims return one lease");
  await admin.query(
    "update public.analysis_jobs set lease_until=now()-interval '1 second' where id=$1",
    [saved.job.id],
  );
  const replacement = (
    await worker.query("select eventops_worker_api.claim() as job")
  ).rows[0].job;
  assert.notEqual(replacement.lease_token, lease.lease_token);
  const late = await worker.query(
    "select eventops_worker_api.finish($1,$2,null,'ANALYSIS_FAILED',$3::jsonb) as accepted",
    [
      saved.job.id,
      lease.lease_token,
      JSON.stringify({
        calls: 1,
        input_tokens: 10,
        output_tokens: 10,
        reported: true,
      }),
    ],
  );
  assert.equal(late.rows[0].accepted, false);
  const charges = await admin.query(
    "select attempt,charged_usd,state from public.model_runs where job_id=$1 order by attempt",
    [saved.job.id],
  );
  assert.equal(charges.rows[0].state, "abandoned");
  assert.equal(Number(charges.rows[0].charged_usd), 0.15);
  assert.equal(charges.rows.length, 2);
  pass(
    "expired leases are fenced and abandoned calls retain their full reserved charge",
  );
  // Return this replacement to queued only as a synthetic restart fixture, preserving its reservation.
  await admin.query(
    "update public.analysis_jobs set state='queued',lease_token=null,lease_until=null where id=$1",
    [saved.job.id],
  );
  let modelCalls = 0;
  await runOne(worker, (usage) => async (name, _schema, _policy, input) => {
    modelCalls++;
    (usage.request_ids ??= []).push(`controlled-request-${modelCalls}`);
    usage.calls++;
    usage.input_tokens += 100;
    usage.output_tokens += 50;
    if (name === "EventOpsIntent")
      return {
        ...frozen,
        intents: frozen.intents.map((r) => ({
          ...r,
          span: {
            start: 0,
            end: input.confirmed_text.length,
            quote: input.confirmed_text,
          },
        })),
      };
    return {
      base_revision_id: base,
      selected_option_id: "option-1",
      dispositions: [
        {
          intent_id: request.intent_id,
          status: "satisfied",
          evidence_refs: input.allowed_evidence_refs,
        },
      ],
    };
  });
  assert.equal(modelCalls, 2);
  const completed = (
    await admin.query("select * from public.analysis_jobs where id=$1", [
      saved.job.id,
    ])
  ).rows[0];
  assert.equal(completed.state, "completed");
  assert.equal(completed.result.status, "ready_for_confirmation");
  const safeRun = (
    await admin.query(
      "select request_ids,latency_ms,calls,charged_usd,constraint_failures,citation_failures from public.model_runs where job_id=$1 and attempt=$2",
      [saved.job.id, completed.attempts],
    )
  ).rows[0];
  assert.deepEqual(safeRun.request_ids, [
    "controlled-request-1",
    "controlled-request-2",
  ]);
  assert.ok(safeRun.latency_ms >= 0 && safeRun.latency_ms <= 90000);
  assert.equal(safeRun.calls, 2);
  assert.equal(Number(safeRun.charged_usd), 0.000675);
  pass(
    "safe request IDs, latency, usage and reconciled cost persist without prompts or provider error bodies",
  );

  assert.equal(
    (await owner.request(`/api/events/${id}/plan`)).body.approved_revision.id,
    base,
  );
  pass(
    "real restricted worker runs controlled interpreter and selection, saves result without any official write",
  );
  const fetched = await owner.request(
    `/api/events/${id}/analysis/${saved.job.id}`,
  );
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.job.result.status, "ready_for_confirmation");
  assert.equal(
    (await other.request(`/api/events/${id}/analysis/${saved.job.id}`)).status,
    404,
  );
  const adopt = {
    option_id: "option-1",
    result_digest: completed.result_digest,
    confirmed: true,
    idempotency_key: randomUUID(),
  };
  assert.equal(
    (
      await owner.request(`/api/events/${id}/analysis/${saved.job.id}/adopt`, {
        ...adopt,
        confirmed: false,
      })
    ).status,
    422,
  );
  const proposal = await owner.request(
    `/api/events/${id}/analysis/${saved.job.id}/adopt`,
    adopt,
  );
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
  assert.equal(proposal.body.analysis_job_id, saved.job.id);
  assert.equal(proposal.body.state, "ready");
  assert.deepEqual(proposal.body.confirmed_requests, [request]);
  assert.equal(
    (
      await owner.request(
        `/api/events/${id}/analysis/${saved.job.id}/adopt`,
        adopt,
      )
    ).body.id,
    proposal.body.id,
  );
  const approval = {
    base_revision_id: base,
    generation: 1,
    candidate_digest: proposal.body.candidate_digest,
    idempotency_key: randomUUID(),
  };
  const approved = await owner.request(
    `/api/events/${id}/proposals/${proposal.body.id}/approve`,
    approval,
  );
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const official = (await owner.request(`/api/events/${id}/plan`)).body
    .approved_revision;
  assert.equal(official.revision_number, 2);
  assert.equal(official.snapshot.sessions[1].start, "12:00");
  assert.equal(official.snapshot.assignments[1].start, "12:00");
  pass(
    "explicit complete-interpretation confirmation creates one evidence-backed proposal; separate guarded approval commits revision 2",
  );
  // A confirmed job based on the old head cannot be queued now.
  const stale = await rest(session, "rpc/queue_analysis_job", {
    p_event_id: id,
    p_job_id: active.job.id,
  });
  assert.equal(stale.status, 400);
  const currentText = "Move workshop to 13:00 to 14:00.";
  const nextDraft = await owner.request(`/api/events/${id}/updates`, {
    raw_text: currentText,
    corrected_text: currentText,
    idempotency_key: randomUUID(),
  });
  const nextJob = await owner.request(
    `/api/events/${id}/updates/${nextDraft.body.id}/analyze`,
    {
      generation: 1,
      base_revision_id: official.id,
      confirmed_text: currentText,
      confirmed: true,
    },
  );
  assert.equal(
    (
      await rest(session, "rpc/queue_analysis_job", {
        p_event_id: id,
        p_job_id: nextJob.body.id,
      })
    ).status,
    200,
  );
  const running = (
    await worker.query("select eventops_worker_api.claim() as job")
  ).rows[0].job;
  await owner.request(
    `/api/events/${id}/updates/${nextDraft.body.id}`,
    {
      raw_text: currentText,
      corrected_text: currentText + " Corrected.",
      expected_generation: 1,
      idempotency_key: randomUUID(),
    },
    "PUT",
  );
  const oldFinish = await worker.query(
    "select eventops_worker_api.finish($1,$2,null,'PROVIDER_NETWORK',$3::jsonb) as accepted",
    [
      running.id,
      running.lease_token,
      JSON.stringify({
        calls: 1,
        input_tokens: 0,
        output_tokens: 0,
        reported: false,
      }),
    ],
  );
  assert.equal(oldFinish.rows[0].accepted, true);
  assert.equal(
    (
      await admin.query("select state from public.analysis_jobs where id=$1", [
        running.id,
      ])
    ).rows[0].state,
    "stale",
  );
  pass(
    "changed heads cannot queue; late results from an earlier text generation become stale with no official write",
  );
  const budgetDraft = await owner.request(`/api/events/${id}/updates`, {
    raw_text: "Budget check",
    corrected_text: "Budget check",
    idempotency_key: randomUUID(),
  });
  const budgetJob = await owner.request(
    `/api/events/${id}/updates/${budgetDraft.body.id}/analyze`,
    {
      generation: 1,
      base_revision_id: official.id,
      confirmed_text: "Budget check",
      confirmed: true,
    },
  );
  const workspace = saved.job.workspace_id;
  await admin.query(
    // Keep the fixture in today's UTC ledger, including the first two hours.
    // Near midnight the hourly quota can also deny these synthetic attempts.
    "insert into public.model_runs(workspace_id,event_id,job_id,attempt,created_at) select $1,$2,$3,10000+n,greatest(now()-interval '2 hours',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') from generate_series(1,14) n",
    [workspace, id, budgetJob.body.id],
  );
  try {
    const denied = await rest(session, "rpc/queue_analysis_job", {
      p_event_id: id,
      p_job_id: budgetJob.body.id,
    });
    assert.equal(denied.status, 400);
    assert.equal(
      (
        await admin.query(
          "select state from public.analysis_jobs where id=$1",
          [budgetJob.body.id],
        )
      ).rows[0].state,
      "blocked",
    );
  } finally {
    await admin.query(
      "delete from public.model_runs where job_id=$1 and attempt between 10001 and 10014",
      [budgetJob.body.id],
    );
  }
  pass(
    "workspace daily reservations deny more work atomically without consuming a new attempt",
  );

  // Three events in one owner workspace verify the two-job workspace limit.
  async function otherEventJob(label, client = owner) {
    const e = await client.request("/api/events", {
      setup: { ...fixtureSetup, name: label },
      request_id: randomUUID(),
    });
    assert.equal(e.status, 201);
    const eid = e.body.event_id;
    const st = await client.request(
      `/api/events/${eid}/draft`,
      { plan: planInput(rows), expected_generation: 1, confirmed: true },
      "PUT",
    );
    assert.equal(st.status, 200);
    const rev = await client.request(`/api/events/${eid}/confirm-plan`, {
      expected_generation: st.body.generation,
      candidate_digest: st.body.candidate_digest,
      idempotency_key: randomUUID(),
    });
    assert.equal(rev.status, 200);
    const d = await client.request(`/api/events/${eid}/updates`, {
      raw_text: label,
      corrected_text: label,
      idempotency_key: randomUUID(),
    });
    const j = await client.request(
      `/api/events/${eid}/updates/${d.body.id}/analyze`,
      {
        generation: 1,
        base_revision_id: rev.body.revision_id,
        confirmed_text: label,
        confirmed: true,
      },
    );
    assert.equal(j.status, 202);
    return { id: eid, job: j.body };
  }
  assert.equal(
    (
      await rest(session, "rpc/queue_analysis_job", {
        p_event_id: id,
        p_job_id: budgetJob.body.id,
      })
    ).status,
    200,
  );
  const second = await otherEventJob("Synthetic second active job");
  const third = await otherEventJob("Synthetic third denied job");
  assert.equal(
    (
      await rest(session, "rpc/queue_analysis_job", {
        p_event_id: second.id,
        p_job_id: second.job.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await rest(session, "rpc/queue_analysis_job", {
        p_event_id: third.id,
        p_job_id: third.job.id,
      })
    ).status,
    400,
  );
  for (const item of [{ id, job: budgetJob.body }, second]) {
    assert.equal(
      (
        await owner.request(
          `/api/events/${item.id}/analysis/${item.job.id}/cancel`,
          {},
        )
      ).status,
      200,
    );
    const cost = (
      await admin.query(
        "select charged_usd from public.model_runs where job_id=$1 order by attempt desc limit 1",
        [item.job.id],
      )
    ).rows[0];
    assert.equal(Number(cost.charged_usd), 0);
  }
  pass(
    "two active jobs per workspace are enforced; queued cancellation refunds only known unstarted work",
  );

  const rival = await otherEventJob(
    "Synthetic other workspace budget contender",
    other,
  );
  await admin.query(
    "insert into public.model_runs(workspace_id,event_id,job_id,attempt) select $1,$2,$3,100000+n from generate_series(1,greatest(0,(select floor((10-coalesce(sum(charged_usd),0)-(select coalesce(sum(reserved_usd),0) from public.voice_jobs where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date)-0.15)/0.15)::integer from public.model_runs where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date))) n",
    [workspace, id, budgetJob.body.id],
  );
  let blockedTarget, blockedClient, blockedSession;
  try {
    const contenders = [third, rival],
      sessions = [session, otherSession],
      clients = [owner, other];
    const raced = await Promise.all(
      contenders.map((item, i) =>
        rest(sessions[i], "rpc/queue_analysis_job", {
          p_event_id: item.id,
          p_job_id: item.job.id,
        }),
      ),
    );
    assert.deepEqual(raced.map((r) => r.status).sort(), [200, 400]);
    assert.ok(
      Number(
        (
          await admin.query(
            "select sum(charged_usd)+(select coalesce(sum(reserved_usd),0) from public.voice_jobs where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date) as cost from public.model_runs where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date",
          )
        ).rows[0].cost,
      ) <= 10,
    );
    const accepted = raced.findIndex((r) => r.status === 200);
    assert.equal(
      (
        await clients[accepted].request(
          `/api/events/${contenders[accepted].id}/analysis/${contenders[accepted].job.id}/cancel`,
          {},
        )
      ).status,
      200,
    );
    const denied = raced.findIndex((r) => r.status === 400);
    blockedTarget = contenders[denied];
    blockedClient = clients[denied];
    blockedSession = sessions[denied];
  } finally {
    await admin.query(
      "delete from public.model_runs where job_id=$1 and attempt between 100001 and 100999",
      [budgetJob.body.id],
    );
  }
  pass(
    "concurrent reservations from different workspaces cannot exceed the global daily budget",
  );
  await admin.query(
    "insert into public.model_runs(workspace_id,event_id,job_id,attempt,created_at) select $1,$2,$3,200000+n,now()-interval '1 day' from generate_series(1,334) n",
    [workspace, id, budgetJob.body.id],
  );
  try {
    assert.equal(
      (
        await rest(blockedSession, "rpc/queue_analysis_job", {
          p_event_id: blockedTarget.id,
          p_job_id: blockedTarget.job.id,
        })
      ).status,
      400,
    );
  } finally {
    await admin.query(
      "delete from public.model_runs where job_id=$1 and attempt between 200001 and 200334",
      [budgetJob.body.id],
    );
  }
  pass(
    "lifetime development reservations fail closed independently of the daily limits",
  );
  const oldDraft = (
    await blockedClient.request(
      `/api/events/${blockedTarget.id}/updates/${blockedTarget.job.draft_id}`,
    )
  ).body.draft;
  const corrected = await blockedClient.request(
    `/api/events/${blockedTarget.id}/updates/${oldDraft.id}`,
    {
      raw_text: oldDraft.raw_text,
      corrected_text: oldDraft.corrected_text + " Generation guard.",
      expected_generation: oldDraft.generation,
      idempotency_key: randomUUID(),
    },
    "PUT",
  );
  assert.equal(corrected.status, 200);
  const generationJob = await blockedClient.request(
    `/api/events/${blockedTarget.id}/updates/${oldDraft.id}/analyze`,
    {
      generation: corrected.body.generation,
      base_revision_id: blockedTarget.job.base_revision_id,
      confirmed_text: corrected.body.corrected_text,
      confirmed: true,
    },
  );
  assert.equal(generationJob.status, 202);
  await admin.query("update public.analysis_jobs set attempts=10 where id=$1", [
    blockedTarget.job.id,
  ]);
  try {
    assert.equal(
      (
        await rest(blockedSession, "rpc/queue_analysis_job", {
          p_event_id: blockedTarget.id,
          p_job_id: generationJob.body.id,
        })
      ).status,
      400,
    );
  } finally {
    await admin.query(
      "update public.analysis_jobs set attempts=0 where id=$1",
      [blockedTarget.job.id],
    );
  }
  pass(
    "the attempt ceiling applies across every saved generation of the same update",
  );
  // Leave one completed, unadopted result for the real browser review path.
  const browserText = "Move workshop to 13:15 to 14:15.";
  const browserDraft = await owner.request(`/api/events/${id}/updates`, {
    raw_text: browserText,
    corrected_text: browserText,
    idempotency_key: randomUUID(),
  });
  const browserJob = await owner.request(
    `/api/events/${id}/updates/${browserDraft.body.id}/analyze`,
    {
      generation: 1,
      base_revision_id: official.id,
      confirmed_text: browserText,
      confirmed: true,
    },
  );
  assert.equal(browserJob.status, 202);
  assert.equal(
    (
      await rest(session, "rpc/queue_analysis_job", {
        p_event_id: id,
        p_job_id: browserJob.body.id,
      })
    ).status,
    200,
  );
  await runOne(worker, (usage) => async (name, _schema, _policy, input) => {
    usage.calls++;
    usage.input_tokens += 100;
    usage.output_tokens += 50;
    if (name === "EventOpsIntent")
      return {
        schema_version: 1,
        base_revision_id: official.id,
        intents: [
          {
            ...request,
            time_choices: [
              {
                start: "13:15",
                end: "14:15",
                start_offset: null,
                end_offset: null,
              },
            ],
            span: {
              start: 0,
              end: input.confirmed_text.length,
              quote: input.confirmed_text,
            },
          },
        ],
        questions: [],
        unsupported_requests: [],
      };
    return {
      base_revision_id: official.id,
      selected_option_id: "option-1",
      dispositions: [
        {
          intent_id: request.intent_id,
          status: "satisfied",
          evidence_refs: input.allowed_evidence_refs,
        },
      ],
    };
  });
  assert.equal(
    (
      await admin.query("select state from public.analysis_jobs where id=$1", [
        browserJob.body.id,
      ])
    ).rows[0].state,
    "completed",
  );
  await writeFile(
    "/private/tmp/eventops-t4-worker-browser-state.json",
    JSON.stringify({
      cookies: [...owner.jar].map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: -1,
      })),
      origins: [],
    }),
    { mode: 0o600 },
  );
  await writeFile(
    "/private/tmp/eventops-t4-worker-browser-fixture.json",
    JSON.stringify({
      id,
      job: browserJob.body.id,
      completed_job: saved.job.id,
      proposal: proposal.body.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    `PASS ${checks} worker integration groups; provider responses were controlled and no live Meta call occurred`,
  );
} finally {
  await admin.query(
    "update eventops_private.analysis_budget_lock set enabled=$1 where id=1",
    [prior],
  );
  await worker.end();
  await admin.query(`drop role ${login}`);
  await admin.end();
}
