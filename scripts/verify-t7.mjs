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
const origin = process.env.T7_APP_URL ?? "http://localhost:3001";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T7_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
function sql(command, values = {}) {
  return execFileSync(
    process.env.T7_PSQL ?? "psql",
    [
      env.DB_URL,
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      ...Object.entries(values).flatMap(([key, value]) => [
        "--set",
        `${key}=${value}`,
      ]),
    ],
    { input: command, encoding: "utf8", timeout: 15000 },
  ).trim();
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
  const email = `t7-${label}-${randomUUID()}@example.test`;
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
const { editableRecords, planInput, manualPatch } =
  await import("../src/features/plans/editor-model.ts");
assert.equal(
  sql(
    "select count(*) from information_schema.tables where table_schema='public' and table_name in ('text_update_drafts','analysis_jobs');",
  ),
  "2",
);
pass("T4 tables are applied to real local PostgreSQL");
const one = actor(),
  two = actor();
const session = await signIn(one, "owner");
await signIn(two, "other");
const created = await one.request("/api/events", {
  setup: fixtureSetup,
  request_id: randomUUID(),
});
assert.equal(created.status, 201);
const id = created.body.event_id;
const initial = fixturePlan();
const aliases = new Map();
for (const c of [
  "rooms",
  "sessions",
  "volunteers",
  "availability",
  "assignments",
  "dependencies",
])
  for (const r of initial[c]) aliases.set(r.id, r.external_id);
const input = editableRecords(initial);
for (const c of Object.keys(input))
  for (const r of input[c]) {
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
const staged = await one.request(
  `/api/events/${id}/draft`,
  { plan: planInput(input), expected_generation: 1, confirmed: true },
  "PUT",
);
assert.equal(staged.status, 200, JSON.stringify(staged.body));
assert.deepEqual(staged.body.validation_report, []);
const confirmed = await one.request(`/api/events/${id}/confirm-plan`, {
  expected_generation: staged.body.generation,
  candidate_digest: staged.body.candidate_digest,
  idempotency_key: randomUUID(),
});
assert.equal(confirmed.status, 200);
const base = confirmed.body.revision_id;
pass(
  "editor input stages all six collections and confirms revision 1 through actual transactions",
);
let plan = (await one.request(`/api/events/${id}/plan`)).body.approved_revision
  .snapshot;
const rows = editableRecords(plan);
rows.sessions[0].title = "=Synthetic revised title";
const original = await one.request(`/api/events/${id}/proposals`, {
  mode: "manual",
  expected_head: base,
  patch: manualPatch(plan, rows),
  confirmed: true,
  reason: "Synthetic T7 candidate",
  idempotency_key: randomUUID(),
});
assert.equal(original.status, 201, JSON.stringify(original.body));
rows.sessions[0].title = "Synthetic edited title";
const editBody = {
  generation: 1,
  patch: manualPatch(plan, rows),
  confirmed: true,
  withdraw_interpreted_requests: false,
  reason: "Synthetic corrected candidate",
  idempotency_key: randomUUID(),
};
const edited = await one.request(
  `/api/events/${id}/proposals/${original.body.id}`,
  editBody,
  "PUT",
);
assert.equal(edited.status, 201, JSON.stringify(edited.body));
assert.equal(edited.body.generation, 2);
assert.equal(edited.body.parent_proposal_id, original.body.id);
assert.equal(
  (await one.request(`/api/events/${id}/proposals/${original.body.id}`)).body
    .state,
  "rejected",
);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${original.body.id}`,
      editBody,
      "PUT",
    )
  ).body.id,
  edited.body.id,
);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${edited.body.id}`,
      { ...editBody, generation: 1, idempotency_key: randomUUID() },
      "PUT",
    )
  ).status,
  409,
);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  base,
);
pass(
  "candidate edits append immutable generation, reject prior candidate, replay receipts and fence stale edits without official writes",
);
async function approve(p) {
  return one.request(`/api/events/${id}/proposals/${p.id}/approve`, {
    base_revision_id: p.base_revision_id,
    generation: p.generation,
    candidate_digest: p.candidate_digest,
    idempotency_key: randomUUID(),
  });
}
const approved = await approve(edited.body);
assert.equal(approved.status, 200, JSON.stringify(approved.body));
const head = approved.body.revision_id;
plan = (await one.request(`/api/events/${id}/plan`)).body.approved_revision
  .snapshot;
pass("edited candidate separately approves against the locked current head");
const context = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
assert.ok(context.digest);
const restoreBody = {
  target_revision_id: base,
  expected_head: head,
  confirmed: true,
  context_digest: context.digest,
  idempotency_key: randomUUID(),
};
assert.equal(
  (
    await one.request(`/api/events/${id}/restore`, {
      ...restoreBody,
      confirmed: false,
    })
  ).status,
  422,
);
const restored = await one.request(`/api/events/${id}/restore`, restoreBody);
assert.equal(restored.status, 201, JSON.stringify(restored.body));
assert.equal(restored.body.restores_revision_id, base);
assert.equal(restored.body.base_revision_id, head);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  head,
);
assert.equal(
  (await one.request(`/api/events/${id}/restore`, restoreBody)).body.id,
  restored.body.id,
);
pass(
  "historical restore requires explicit reconfirmation, appends a checked proposal and leaves current head unchanged",
);
const draft = await one.request(`/api/events/${id}/updates`, {
  raw_text: "Synthetic later information",
  corrected_text: "Synthetic later information",
  idempotency_key: randomUUID(),
});
assert.equal(draft.status, 201);
assert.equal((await approve(restored.body)).status, 409);
const fresh = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
assert.notEqual(fresh.digest, context.digest);
const renewed = await one.request(
  `/api/events/${id}/proposals/${restored.body.id}`,
  {
    generation: 1,
    patch: restored.body.canonical_patch,
    reason: "Reconfirm restoration after reviewing the new saved statement",
    idempotency_key: randomUUID(),
    confirmed: true,
    withdraw_interpreted_requests: false,
    context_digest: JSON.parse(
      (
        await rest(session, "rpc/restore_review_context", {
          p_event_id: id,
          p_exclude_id: restored.body.id,
        })
      ).body,
    ).digest,
  },
  "PUT",
);
assert.equal(renewed.status, 201, JSON.stringify(renewed.body));
const restoredApproval = await approve(renewed.body);
assert.equal(
  restoredApproval.status,
  200,
  JSON.stringify(restoredApproval.body),
);
const current = (await one.request(`/api/events/${id}/plan`)).body
  .approved_revision;
assert.equal(current.revision_number, 3);
assert.equal(current.parent_revision_id, head);
assert.equal(current.restores_revision_id, base);
assert.equal(
  (await one.request(`/api/events/${id}/revisions`)).body.revisions.length,
  3,
);
pass(
  "new organizer text fences restore approval; reconfirmed restoration creates revision 3 retaining parent, origin and intervening history",
);
const job = await one.request(
  `/api/events/${id}/updates/${draft.body.id}/analyze`,
  {
    generation: 1,
    base_revision_id: current.id,
    confirmed_text: "Synthetic later information",
    confirmed: true,
  },
);
assert.equal(job.status, 202, JSON.stringify(job.body));
// Controlled immutable result fixture, no provider or worker enablement.
const result = {
  status: "unresolved",
  interpretation: {
    schema_version: 1,
    base_revision_id: current.id,
    intents: [],
    questions: ["May the workshop start later?"],
    unsupported_requests: [],
  },
  options: [],
  selected_option_id: null,
  questions: ["May the workshop start later?"],
  impacted_records: [],
};
sql(
  "update public.analysis_jobs set state='completed',result=:'result'::jsonb,result_digest=eventops_private.hash(:'result'::jsonb),completed_at=now() where id=:'job'::uuid;",
  { result: JSON.stringify(result), job: job.body.id },
);
const digest = sql(
  "select result_digest from public.analysis_jobs where id=:'job'::uuid",
  { job: job.body.id },
);
const answerBody = {
  result_digest: digest,
  generation: 1,
  question_index: 0,
  answer: "Yes. The organizer allows 11:15 to 12:15.",
  idempotency_key: randomUUID(),
};
assert.equal(
  (
    await one.request(`/api/events/${id}/analysis/${job.body.id}/answers`, {
      ...answerBody,
      question_index: 1,
    })
  ).status,
  422,
);
const answer = await one.request(
  `/api/events/${id}/analysis/${job.body.id}/answers`,
  answerBody,
);
assert.equal(answer.status, 201, JSON.stringify(answer.body));
assert.equal(answer.body.generation, 2);
assert.match(answer.body.corrected_text, /11:15/);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/analysis/${job.body.id}/answers`,
      answerBody,
    )
  ).body.generation,
  2,
);
assert.equal(
  (
    await one.request(`/api/events/${id}/analysis/${job.body.id}/answers`, {
      ...answerBody,
      idempotency_key: randomUUID(),
    })
  ).status,
  409,
);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  current.id,
);
assert.equal(
  sql("select count(*) from public.review_answers where job_id=:'job'::uuid", {
    job: job.body.id,
  }),
  "1",
);
pass(
  "answers bind frozen questions and digest, preserve immutable evidence, append text generation, replay and fence old answers with no plan write",
);
for (const path of [
  `/api/events/${id}/revisions`,
  `/api/events/${id}/briefing?format=text`,
  `/api/events/${id}/briefing?format=csv&collection=sessions`,
]) {
  const r = await fetch(origin + path, {
    headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  const body = await r.text();
  if (path.includes("briefing")) {
    assert.match(body, /Asia\/Brunei/);
    assert.doesNotMatch(body, /Synthetic later information/);
  }
  const denied = await fetch(origin + path, {
    headers: { Cookie: [...two.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  assert.equal(denied.status, 404);
}
assert.equal(
  (await two.request(`/api/events/${id}/restore`, restoreBody)).status,
  404,
);
assert.equal(
  (
    await two.request(
      `/api/events/${id}/analysis/${job.body.id}/answers`,
      answerBody,
    )
  ).status,
  404,
);
assert.equal(
  (
    await two.request(
      `/api/events/${id}/proposals/${edited.body.id}`,
      editBody,
      "PUT",
    )
  ).status,
  404,
);
assert.notEqual(
  (
    await rest(
      session,
      "review_answers",
      { answer_json: { value: "forged" } },
      "POST",
    )
  ).status,
  201,
);
assert.notEqual(
  (await rest(session, "rpc/approve_before_review", {}, "POST")).status,
  200,
);
pass(
  "history and downloads are tenant isolated; new writes and private approval bypass are denied",
);
const proposalRows = editableRecords(current.snapshot);
proposalRows.rooms[0].name = "Synthetic rejected room";
const rejected = await one.request(`/api/events/${id}/proposals`, {
  mode: "manual",
  expected_head: current.id,
  patch: manualPatch(current.snapshot, proposalRows),
  confirmed: true,
  reason: "Reject fixture",
  idempotency_key: randomUUID(),
});
assert.equal(rejected.status, 201);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${rejected.body.id}/reject`,
      { generation: 1, reason: "Organizer chose to keep the room name." },
    )
  ).status,
  200,
);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  current.id,
);
assert.equal(
  sql(
    "select reason from public.proposal_rejections where proposal_id=:'id'::uuid",
    { id: rejected.body.id },
  ),
  "Organizer chose to keep the room name.",
);
pass("rejection reason persists while official head remains unchanged");
// Restoration must also review pending manual statements, not just text jobs.
const beforeManual = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
const pending = await one.request(`/api/events/${id}/proposals`, {
  mode: "manual",
  expected_head: current.id,
  patch: manualPatch(current.snapshot, proposalRows),
  confirmed: true,
  reason: "Pending manual fact must be reviewed before restore",
  idempotency_key: randomUUID(),
});
assert.equal(pending.status, 201);
const staleContextRestore = await one.request(`/api/events/${id}/restore`, {
  target_revision_id: head,
  expected_head: current.id,
  context_digest: beforeManual.digest,
  confirmed: true,
  idempotency_key: randomUUID(),
});
assert.equal(staleContextRestore.status, 409);
const withManual = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
assert.ok(
  withManual.context.manual_proposals.some((p) => p.id === pending.body.id),
);
const r2 = await one.request(`/api/events/${id}/restore`, {
  target_revision_id: head,
  expected_head: current.id,
  context_digest: withManual.digest,
  confirmed: true,
  idempotency_key: randomUUID(),
});
assert.equal(r2.status, 201, JSON.stringify(r2.body));
const competingContext = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
const competing = await one.request(`/api/events/${id}/restore`, {
  target_revision_id: head,
  expected_head: current.id,
  context_digest: competingContext.digest,
  confirmed: true,
  idempotency_key: randomUUID(),
});
assert.equal(competing.status, 201, JSON.stringify(competing.body));
assert.equal((await approve(r2.body)).status, 409);
const otherRestoreContext = JSON.parse(
  (
    await rest(session, "rpc/restore_review_context", {
      p_event_id: id,
      p_exclude_id: r2.body.id,
    })
  ).body,
);
assert.ok(
  otherRestoreContext.context.manual_proposals.some(
    (p) => p.id === competing.body.id,
  ),
);
pass(
  "another pending restoration is visible in context and fences earlier restore approval",
);
const editRestoreBody = {
  generation: 1,
  patch: r2.body.canonical_patch,
  reason: "Reconfirmed restore edit receipt",
  idempotency_key: randomUUID(),
  confirmed: true,
  withdraw_interpreted_requests: false,
  context_digest: JSON.parse(
    (
      await rest(session, "rpc/restore_review_context", {
        p_event_id: id,
        p_exclude_id: r2.body.id,
      })
    ).body,
  ).digest,
};
const editRestore = await one.request(
  `/api/events/${id}/proposals/${r2.body.id}`,
  editRestoreBody,
  "PUT",
);
assert.equal(editRestore.status, 201, JSON.stringify(editRestore.body));
const changed = await one.request(
  `/api/events/${id}/proposals/${pending.body.id}/reject`,
  { generation: 1, reason: "Withdraw this pending manual change" },
);
assert.equal(changed.status, 200);
const replayRestore = await one.request(
  `/api/events/${id}/proposals/${r2.body.id}`,
  editRestoreBody,
  "PUT",
);
assert.equal(replayRestore.status, 201);
assert.equal(replayRestore.body.id, editRestore.body.id);
assert.equal((await approve(editRestore.body)).status, 409);
pass(
  "pending manual changes fence restoration and immutable edit replay survives later context changes",
);

const sourcesBefore = sql(
  "select count(*) from public.source_records where event_id=:'event'::uuid",
  { event: id },
);
const rollbackKey = randomUUID();
sql(
  `create function eventops_private.t7_review_fault() returns trigger language plpgsql as $fn$ begin if new.event_id='${id}'::uuid and new.action='review_candidate_created' then raise exception using errcode='XX000',message='synthetic rollback';end if;return new;end $fn$;create trigger t7_review_fault before insert on public.audit_events for each row execute function eventops_private.t7_review_fault();`,
);
try {
  const faulted = await one.request(
    `/api/events/${id}/proposals/${editRestore.body.id}`,
    {
      ...editRestoreBody,
      generation: 2,
      context_digest: JSON.parse(
        (
          await rest(session, "rpc/restore_review_context", {
            p_event_id: id,
            p_exclude_id: editRestore.body.id,
          })
        ).body,
      ).digest,
      idempotency_key: rollbackKey,
    },
    "PUT",
  );
  assert.equal(faulted.status, 503);
  assert.equal(
    sql("select count(*) from public.proposals where create_key=:'key'::uuid", {
      key: rollbackKey,
    }),
    "0",
  );
  assert.equal(
    sql(
      "select count(*) from public.source_records where event_id=:'event'::uuid",
      { event: id },
    ),
    sourcesBefore,
  );
  assert.equal(
    (await one.request(`/api/events/${id}/proposals/${editRestore.body.id}`))
      .body.state,
    "ready",
  );
} finally {
  sql(
    "drop trigger t7_review_fault on public.audit_events;drop function eventops_private.t7_review_fault();",
  );
}
pass(
  "injected final audit failure rolls back new candidate, fresh evidence and prior candidate rejection",
);

// An interpreted candidate needs explicit withdrawal before manual replacement.
const interpretedText = "Move Workshop to 13:00 to 14:00.";
const interpretedDraft = await one.request(`/api/events/${id}/updates`, {
  raw_text: interpretedText,
  corrected_text: interpretedText,
  idempotency_key: randomUUID(),
});
const interpretedJob = await one.request(
  `/api/events/${id}/updates/${interpretedDraft.body.id}/analyze`,
  {
    generation: 1,
    base_revision_id: current.id,
    confirmed_text: interpretedText,
    confirmed: true,
  },
);
assert.equal(interpretedJob.status, 202);
const intent = {
  intent_id: "move-opening",
  action: "change_time",
  session_id: current.snapshot.sessions[1].id,
  time_choices: [
    { start: "13:00", end: "14:00", start_offset: null, end_offset: null },
  ],
  span: { start: 0, end: interpretedText.length, quote: interpretedText },
};
const readyResult = {
  status: "ready_for_confirmation",
  interpretation: {
    schema_version: 1,
    base_revision_id: current.id,
    intents: [intent],
    questions: [],
    unsupported_requests: [],
  },
  options: [
    {
      id: "option-1",
      requests: [intent],
      changed_sessions: 1,
      displacement_minutes: 180,
    },
  ],
  selected_option_id: "option-1",
  questions: [],
  impacted_records: [intent.session_id],
};
sql(
  "update public.analysis_jobs set state='completed',result=:'result'::jsonb,result_digest=eventops_private.hash(:'result'::jsonb),completed_at=now() where id=:'job'::uuid",
  { result: JSON.stringify(readyResult), job: interpretedJob.body.id },
);
const interpretedDigest = sql(
  "select result_digest from public.analysis_jobs where id=:'job'::uuid",
  { job: interpretedJob.body.id },
);
const adopted = await one.request(
  `/api/events/${id}/analysis/${interpretedJob.body.id}/adopt`,
  {
    option_id: "option-1",
    result_digest: interpretedDigest,
    confirmed: true,
    idempotency_key: randomUUID(),
  },
);
assert.equal(adopted.status, 201);
const replacementRows = editableRecords(current.snapshot);
replacementRows.rooms[0].name = "Synthetic manually confirmed replacement";
const replacementBody = {
  generation: 1,
  patch: manualPatch(current.snapshot, replacementRows),
  reason:
    "Organizer explicitly withdraws the interpreted time move and confirms the manual room name change.",
  idempotency_key: randomUUID(),
  confirmed: true,
  withdraw_interpreted_requests: false,
};
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${adopted.body.id}`,
      replacementBody,
      "PUT",
    )
  ).status,
  422,
);
const withdrawn = await one.request(
  `/api/events/${id}/proposals/${adopted.body.id}`,
  { ...replacementBody, withdraw_interpreted_requests: true },
  "PUT",
);
assert.equal(withdrawn.status, 201, JSON.stringify(withdrawn.body));
assert.equal(
  withdrawn.body.review_assertions.original_interpreted_requests_withdrawn,
  true,
);
assert.equal(withdrawn.body.parent_proposal_id, adopted.body.id);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  current.id,
);
pass(
  "manual replacement cannot silently drop interpreted requests; explicit organizer withdrawal is immutable and linked",
);

// Explicit later cancellation, inactivity and unavailability cannot be restored without reconfirmation.
const cancelledRows = editableRecords(current.snapshot);
cancelledRows.sessions = cancelledRows.sessions
  .slice(1)
  .map((s) => ({ ...s, required_volunteers: 0 }));
cancelledRows.assignments = [];
cancelledRows.dependencies = [];
cancelledRows.volunteers = cancelledRows.volunteers.map((v) => ({
  ...v,
  active: false,
}));
cancelledRows.availability = cancelledRows.availability.map((a) => ({
  ...a,
  status: "unavailable",
}));
const cancellation = await one.request(`/api/events/${id}/proposals`, {
  mode: "manual",
  expected_head: current.id,
  patch: manualPatch(current.snapshot, cancelledRows),
  confirmed: true,
  reason: "Synthetic explicit cancellation and unavailability",
  idempotency_key: randomUUID(),
});
assert.equal(cancellation.status, 201, JSON.stringify(cancellation.body));
const cancelApproval = await approve(cancellation.body);
assert.equal(cancelApproval.status, 200, JSON.stringify(cancelApproval.body));
const cancellationContext = JSON.parse(
  (await rest(session, "rpc/restore_review_context", { p_event_id: id })).body,
);
const reconfirmBody = {
  target_revision_id: base,
  expected_head: cancelApproval.body.revision_id,
  context_digest: cancellationContext.digest,
  confirmed: true,
  idempotency_key: randomUUID(),
};
assert.equal(
  (
    await one.request(`/api/events/${id}/restore`, {
      ...reconfirmBody,
      confirmed: false,
    })
  ).status,
  422,
);
const reconfirm = await one.request(`/api/events/${id}/restore`, reconfirmBody);
assert.equal(reconfirm.status, 201, JSON.stringify(reconfirm.body));
assert.equal(reconfirm.body.candidate_snapshot.volunteers[0].active, true);
const availabilityId = reconfirm.body.candidate_snapshot.availability[0].id;
const evidence = reconfirm.body.candidate_snapshot.provenance.find(
  (p) => p.record_id === availabilityId && p.field_path === "status",
);
assert.ok(evidence.source_record_ids.length);
assert.equal(
  sql(
    "select count(*) from public.source_records s join public.source_artifacts a on a.id=s.artifact_id where s.id=:'source'::uuid and a.captured_by=:'actor'::uuid and s.value_json='\"available\"'::jsonb",
    { source: evidence.source_record_ids[0], actor: session.user.id },
  ),
  "1",
);
const reconfirmed = await approve(reconfirm.body);
assert.equal(reconfirmed.status, 200, JSON.stringify(reconfirmed.body));
pass(
  "restoring later cancellations and unavailability needs explicit organizer reconfirmation and fresh current evidence",
);
for (const path of [
  `/events/${id}/history`,
  `/events/${id}/history?restore=${base}`,
  `/events/${id}/briefing`,
  `/events/${id}/updates`,
  `/events/${id}/analysis/${job.body.id}`,
  `/events/${id}/proposals/${rejected.body.id}`,
]) {
  const r = await fetch(origin + path, {
    headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  assert.equal(r.status, 200, path);
}
await writeFile(
  "/private/tmp/eventops-t7-browser.json",
  JSON.stringify({
    email: session.user.email,
    eventId: id,
    base,
    head: current.id,
    job: job.body.id,
    cookies: [...one.jar].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    })),
  }),
  { mode: 0o600 },
);
assert.equal(
  sql("select enabled from eventops_private.analysis_budget_lock"),
  "f",
);
assert.equal(sql("select enabled from eventops_private.voice_gate"), "f");
pass(
  "all T7 screens render with persisted synthetic data and both live gates remain disabled",
);
console.log(
  `PASS ${checks} T7 groups, controlled results only, USD 0 provider spend`,
);
