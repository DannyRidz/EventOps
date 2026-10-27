// Real local service verification. Only synthetic loopback accounts and records.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
const { fixturePlan, fixtureSetup, fixtureId, parityCases } =
  await import("../src/features/plans/fixtures.ts");
const { validatePlan } = await import("../src/features/plans/validate.ts");
const origin = process.env.T3_APP_URL ?? "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T3_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
    process.env.T3_PSQL ?? "psql",
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
  const email = `t3-${label}-${randomUUID()}@example.test`;
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
const one = actor(),
  two = actor(),
  guest = actor();
const session = await signIn(one, "owner"),
  otherSession = await signIn(two, "other");
pass("two real verified owner sessions");
const created = await one.request("/api/events", {
  setup: fixtureSetup,
  request_id: randomUUID(),
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const id = created.body.event_id;
function inputPlan() {
  const p = fixturePlan();
  const aliases = new Map();
  for (const key of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of p[key]) aliases.set(r.id, r.external_id);
  for (const key of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of p[key]) {
      delete r.id;
      for (const field of [
        "room_id",
        "session_id",
        "volunteer_id",
        "predecessor_session_id",
        "successor_session_id",
      ])
        if (field in r) r[field] = aliases.get(r[field]);
    }
  return p;
}
const stageBody = {
  plan: inputPlan(),
  expected_generation: 1,
  confirmed: true,
};
assert.equal(
  (await guest.request(`/api/events/${id}/draft`, stageBody, "PUT")).status,
  401,
);
assert.equal(
  (await two.request(`/api/events/${id}/draft`, stageBody, "PUT")).status,
  404,
);
let staged = await one.request(`/api/events/${id}/draft`, stageBody, "PUT");
assert.equal(staged.status, 200, JSON.stringify(staged.body));
assert.deepEqual(staged.body.validation_report, []);
assert.equal(staged.body.generation, 2);
assert.notEqual(staged.body.snapshot.rooms[0].id, fixtureId(1));
assert.ok(staged.body.snapshot.provenance.length > 50);
pass(
  "manual staging creates server ids, materialized intervals and immutable field sources",
);
const staleStage = await one.request(
  `/api/events/${id}/draft`,
  stageBody,
  "PUT",
);
assert.equal(staleStage.status, 409);
pass("stale staging cannot overwrite acknowledged work");
const source = staged.body.snapshot.provenance[0].source_record_ids[0];
const evidence = await one.request(`/api/events/${id}/evidence/${source}`);
assert.equal(evidence.status, 200);
assert.ok(evidence.body.source.sha256);
assert.equal(
  (await two.request(`/api/events/${id}/evidence/${source}`)).status,
  404,
);
pass("source resolver returns frozen values only to the same event owner");
const beforeConfirm = await one.request(`/api/events/${id}/plan`);
assert.equal(beforeConfirm.body.status, "draft");
assert.equal(beforeConfirm.body.approved_revision, null);
pass("staging does not advance the official head");
const confirmation = {
  expected_generation: 2,
  candidate_digest: staged.body.candidate_digest,
  idempotency_key: randomUUID(),
};
const firstRace = await Promise.all([
  one.request(`/api/events/${id}/confirm-plan`, confirmation),
  one.request(`/api/events/${id}/confirm-plan`, confirmation),
]);
assert.deepEqual(
  firstRace.map((r) => r.status),
  [200, 200],
  JSON.stringify(firstRace),
);
assert.equal(firstRace[0].body.id, firstRace[1].body.id);
const r1 = firstRace[0].body.revision_id;
pass("double initial confirmation creates one durable receipt and revision");
assert.equal(
  (
    await one.request(`/api/events/${id}/confirm-plan`, {
      ...confirmation,
      candidate_digest: "a".repeat(64),
    })
  ).status,
  409,
);
assert.equal(
  (
    await one.request(`/api/events/${id}/confirm-plan`, {
      ...confirmation,
      idempotency_key: randomUUID(),
    })
  ).status,
  409,
);
pass(
  "changed keys and competing revision-one confirmations fail without writes",
);
const current = await one.request(`/api/events/${id}/plan`);
assert.equal(current.body.status, "approved");
assert.equal(current.body.approved_revision.revision_number, 1);
assert.equal(current.body.approved_revision.id, r1);
const base = current.body.approved_revision.snapshot;
assert.equal(
  (
    await one.request(
      `/api/events/${id}/draft`,
      { setup: fixtureSetup, expected_generation: 2, request_id: randomUUID() },
      "PUT",
    )
  ).status,
  409,
);
pass("approved setup cannot be changed through the old draft write path");
async function propose(
  patch,
  head = r1,
  key = randomUUID(),
  reason = "Explicit synthetic manual edit",
) {
  return one.request(`/api/events/${id}/proposals`, {
    mode: "manual",
    expected_head: head,
    patch,
    confirmed: true,
    reason,
    idempotency_key: key,
  });
}
const alteredRooms = structuredClone(base.rooms);
alteredRooms[1].name = "Side hall revised";
const patch = [{ op: "replace", path: "/rooms", value: alteredRooms }];
const proposalKey = randomUUID();
const [proposalA, replayA] = await Promise.all([
  propose(patch, r1, proposalKey),
  propose(patch, r1, proposalKey),
]);
assert.equal(proposalA.status, 201, JSON.stringify(proposalA.body));
assert.equal(proposalA.body.id, replayA.body.id);
assert.equal(proposalA.body.state, "ready");
assert.deepEqual(proposalA.body.constraint_report, []);
pass(
  "manual proposal retries reuse one immutable candidate and derived request coverage",
);
const otherRooms = structuredClone(base.rooms);
otherRooms[1].name = "Competing hall name";
const proposalB = await propose([
  { op: "replace", path: "/rooms", value: otherRooms },
]);
assert.equal(proposalB.status, 201);
function approval(p, key = randomUUID()) {
  return {
    base_revision_id: p.base_revision_id,
    generation: p.generation,
    candidate_digest: p.candidate_digest,
    idempotency_key: key,
  };
}
const approvalA = approval(proposalA.body),
  approvalB = approval(proposalB.body);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${proposalA.body.id}/approve`,
      { ...approvalA, generation: 2 },
    )
  ).status,
  409,
);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${proposalA.body.id}/approve`,
      { ...approvalA, candidate_digest: "b".repeat(64) },
    )
  ).status,
  409,
);
pass("generation and candidate digest mismatches cannot approve");
const approvals = await Promise.all([
  one.request(
    `/api/events/${id}/proposals/${proposalA.body.id}/approve`,
    approvalA,
  ),
  one.request(
    `/api/events/${id}/proposals/${proposalB.body.id}/approve`,
    approvalB,
  ),
]);
assert.deepEqual(
  approvals.map((r) => r.status).sort(),
  [200, 409],
  JSON.stringify(approvals),
);
const winner =
    approvals[0].status === 200
      ? { proposal: proposalA.body, input: approvalA, result: approvals[0] }
      : { proposal: proposalB.body, input: approvalB, result: approvals[1] },
  loser = approvals[0].status === 200 ? proposalB.body : proposalA.body;
const r2 = winner.result.body.revision_id;
pass("competing approvals serialize to exactly one revision two");
const winnerReplay = await one.request(
  `/api/events/${id}/proposals/${winner.proposal.id}/approve`,
  winner.input,
);
assert.equal(winnerReplay.body.id, winner.result.body.id);
pass("lost acknowledgement replay returns its original approval receipt");
let head = await one.request(`/api/events/${id}/plan`);
assert.equal(head.body.approved_revision.id, r2);
assert.equal(head.body.approved_revision.revision_number, 2);
const nextEvent = {
  ...head.body.approved_revision.snapshot.event,
  date: "2026-11-03",
};
const dateProposal = await propose(
  [{ op: "replace", path: "/event", value: nextEvent }],
  r2,
);
assert.equal(dateProposal.status, 201, JSON.stringify(dateProposal.body));
assert.equal(dateProposal.body.state, "ready");
assert.ok(
  dateProposal.body.canonical_patch.some((op) => op.path === "/sessions"),
);
const dateInput = approval(dateProposal.body);
const dateDouble = await Promise.all([
  one.request(
    `/api/events/${id}/proposals/${dateProposal.body.id}/approve`,
    dateInput,
  ),
  one.request(
    `/api/events/${id}/proposals/${dateProposal.body.id}/approve`,
    dateInput,
  ),
]);
assert.deepEqual(
  dateDouble.map((r) => r.status),
  [200, 200],
);
assert.equal(dateDouble[0].body.id, dateDouble[1].body.id);
const dateApproval = dateDouble[0];
const r3 = dateApproval.body.revision_id;
pass(
  "event date normalization includes every derived changed collection in the committed patch",
);
const lateReplay = await one.request(
  `/api/events/${id}/proposals/${winner.proposal.id}/approve`,
  winner.input,
);
assert.equal(lateReplay.body.revision_id, r2);
assert.equal(
  (await one.request(`/api/events/${id}/confirm-plan`, confirmation)).body
    .revision_id,
  r1,
);
pass("initial and approval receipts replay after later head advancement");
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${winner.proposal.id}/approve`,
      { ...winner.input, candidate_digest: "c".repeat(64) },
    )
  ).status,
  409,
);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${loser.id}/approve`,
      approval(loser),
    )
  ).status,
  409,
);
pass("reused keys with changed content and older-head candidates conflict");
const historical = await one.request(`/api/events/${id}/plan?revision=${r1}`);
assert.equal(historical.body.status, "historical");
assert.equal(
  historical.body.approved_revision.snapshot.event.date,
  "2026-11-02",
);
const history = await one.request(`/api/events/${id}/revisions`);
assert.deepEqual(
  history.body.revisions.map((r) => r.revision_number),
  [3, 2, 1],
);
const paged = await one.request(`/api/events/${id}/revisions?cursor=3`);
assert.deepEqual(
  paged.body.revisions.map((r) => r.revision_number),
  [2, 1],
);
const listed = await one.request("/api/events");
assert.equal(
  listed.body.events.find((event) => event.event_id === id).snapshot.date,
  "2026-11-03",
);
const oldEvidence = await one.request(`/api/events/${id}/evidence/${source}`);
assert.deepEqual(
  oldEvidence.body.source.value_json,
  evidence.body.source.value_json,
);
assert.equal(oldEvidence.body.source.sha256, evidence.body.source.sha256);
pass(
  "current and historical reads, event summaries and original evidence remain accurate",
);
head = await one.request(`/api/events/${id}/plan`);
const latest = head.body.approved_revision.snapshot;
const badRooms = structuredClone(latest.rooms);
badRooms[0].capacity = 1;
const invalidProposal = await propose(
  [{ op: "replace", path: "/rooms", value: badRooms }],
  r3,
);
assert.equal(invalidProposal.body.state, "infeasible");
assert.ok(
  invalidProposal.body.constraint_report.some((i) => i.rule === "CAPACITY"),
);
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${invalidProposal.body.id}/approve`,
      approval(invalidProposal.body),
    )
  ).status,
  422,
);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
  r3,
);
pass(
  "invalid whole-plan constraints block approval and retain the official head",
);
const rejected = await one.request(
  `/api/events/${id}/proposals/${invalidProposal.body.id}/reject`,
  { generation: 1 },
);
assert.equal(rejected.body.state, "rejected");
pass("rejection preserves the official revision");
for (const path of [
  `/api/events/${id}/plan`,
  `/api/events/${id}/plan?revision=${r1}`,
  `/api/events/${id}/proposals/${winner.proposal.id}`,
  `/api/events/${id}/revisions`,
  `/api/events/${id}/evidence/${source}`,
])
  assert.equal((await two.request(path)).status, 404, path);
assert.equal(
  (
    await two.request(
      `/api/events/${id}/proposals/${winner.proposal.id}/approve`,
      winner.input,
    )
  ).status,
  404,
);
pass("all T3 read and approval endpoints deny the other tenant");
for (const table of [
  "source_records",
  "source_artifacts",
  "revisions",
  "updates",
  "proposals",
  "approval_receipts",
  "audit_events",
]) {
  const write = await rest(
    session,
    `${table}?event_id=eq.${id}`,
    { created_at: "2000-01-01T00:00:00Z" },
    "PATCH",
  );
  assert.ok(write.status >= 400, table);
  const other = await rest(
    otherSession,
    `${table}?event_id=eq.${id}`,
    undefined,
    "GET",
  );
  assert.equal(other.status, 200);
  assert.deepEqual(JSON.parse(other.body), []);
}
pass(
  "direct table mutations are denied and all T3 tables enforce row isolation",
);
const privateCall = await rest(session, "rpc/validate_plan", { p: base });
assert.ok(privateCall.status >= 400);
pass(
  "database helper functions are not exposed as write or validation bypasses",
);
function canonical(issues) {
  return issues
    .map((i) => `${i.rule}:${[...i.record_ids].sort().join(",")}`)
    .sort();
}
for (const test of parityCases()) {
  const db = JSON.parse(
    sql("select eventops_private.validate_plan(:'plan'::jsonb);", {
      plan: JSON.stringify(test.plan),
    }),
  );
  assert.deepEqual(
    canonical(db),
    canonical(validatePlan(test.plan)),
    test.name,
  );
}
pass(`${parityCases().length} TypeScript and PostgreSQL parity fixtures agree`);
const wide = fixturePlan();
wide.assignments = [];
wide.volunteers = [];
wide.availability = [];
wide.dependencies = [];
wide.sessions = Array.from({ length: 76 }, (_, n) => ({
  ...wide.sessions[0],
  id: fixtureId(100 + n),
  external_id: `dag-${n}`,
  required_volunteers: 0,
  required_role_tag: null,
}));
for (let d = 0; d < 25; d++) {
  const previous = d * 3,
    left = previous + 1,
    right = previous + 2,
    next = previous + 3;
  for (const [a, b] of [
    [previous, left],
    [previous, right],
    [left, next],
    [right, next],
  ])
    wide.dependencies.push({
      id: fixtureId(1000 + wide.dependencies.length),
      external_id: `edge-${wide.dependencies.length}`,
      predecessor_session_id: wide.sessions[a].id,
      successor_session_id: wide.sessions[b].id,
      minimum_gap_minutes: 0,
    });
}
const began = Date.now();
const wideReport = JSON.parse(
  sql(
    "set statement_timeout='5s'; select eventops_private.validate_plan(:'plan'::jsonb);",
    { plan: JSON.stringify(wide) },
  ).replace(/^SET\n/, ""),
);
assert.ok(!wideReport.some((i) => i.message.includes("cycle")));
assert.ok(Date.now() - began < 6000);
pass("100-edge branching DAG validates with bounded transitive closure");
// Privileged synthetic inserts simulate damaged stored data. Normal roles cannot do this.
const safeRooms = structuredClone(latest.rooms);
safeRooms[1].name = "Evidence and rollback fixture";
const safeProposal = await propose(
  [{ op: "replace", path: "/rooms", value: safeRooms }],
  r3,
);
assert.equal(safeProposal.body.state, "ready");
function forge(mutator) {
  const p = structuredClone(safeProposal.body);
  p.id = randomUUID();
  mutator(p);
  return sql(
    `insert into public.proposals(id,workspace_id,event_id,update_id,base_revision_id,generation,state,candidate_snapshot,canonical_patch,candidate_digest,patch_digest,constraint_report,request_coverage,validator_version,create_key,request_digest)
 select :'proposal'::uuid,workspace_id,event_id,update_id,base_revision_id,1,'ready',:'candidate'::jsonb,:'patch'::jsonb,eventops_private.hash(:'candidate'::jsonb),eventops_private.hash(:'patch'::jsonb),'[]',:'coverage'::jsonb,'plan-v1',gen_random_uuid(),'synthetic-damage-fixture' from public.proposals where id=:'original'::uuid returning jsonb_build_object('id',id,'generation',generation,'base_revision_id',base_revision_id,'candidate_digest',candidate_digest);`,
    {
      proposal: p.id,
      original: safeProposal.body.id,
      candidate: JSON.stringify(p.candidate_snapshot),
      patch: JSON.stringify(p.canonical_patch),
      coverage: JSON.stringify(p.request_coverage),
    },
  ).replace(/\nINSERT 0 1$/, "");
}
for (const kind of [
  "wrong-field source",
  "unknown source",
  "missing provenance",
  "false request coverage",
  "forged valid report",
]) {
  const forged = JSON.parse(
    forge((p) => {
      if (kind === "wrong-field source")
        p.candidate_snapshot.provenance.find(
          (v) => v.record_id === safeRooms[1].id && v.field_path === "name",
        ).source_record_ids = [source];
      if (kind === "unknown source")
        p.candidate_snapshot.provenance.find(
          (v) => v.record_id === safeRooms[1].id && v.field_path === "name",
        ).source_record_ids = [randomUUID()];
      if (kind === "missing provenance") p.candidate_snapshot.provenance = [];
      if (kind === "false request coverage") p.request_coverage = [];
      if (kind === "forged valid report") {
        p.candidate_snapshot.rooms[0].capacity = 1;
        p.canonical_patch[0].value[0].capacity = 1;
      }
    }),
  );
  const result = await rest(session, "rpc/approve_proposal", {
    p_event_id: id,
    p_proposal_id: forged.id,
    p_base_revision_id: r3,
    p_generation: 1,
    p_candidate_digest: forged.candidate_digest,
    p_idempotency_key: randomUUID(),
  });
  assert.equal(result.status, 400, kind + result.body);
  assert.equal(JSON.parse(result.body).code, "22023", kind);
  assert.equal(
    (await one.request(`/api/events/${id}/plan`)).body.approved_revision.id,
    r3,
  );
}
pass(
  "direct approval independently rejects mismatched evidence, fabricated ids, missing provenance, false requests and forged valid reports",
);
const deniedHead = await rest(
  session,
  `events?id=eq.${id}`,
  { current_revision_id: r1 },
  "PATCH",
);
assert.ok(deniedHead.status >= 400);
pass("direct head pointer changes are denied");
const triggerName =
  "t3_inject_receipt_failure_" + randomUUID().replaceAll("-", "");
sql(`create function eventops_private.${triggerName}() returns trigger language plpgsql as $fail$ begin if new.event_id='${id}'::uuid and new.operation='approve' then raise exception 'Injected receipt write failure';end if;return new;end $fail$;
create trigger ${triggerName} before insert on public.approval_receipts for each row execute function eventops_private.${triggerName}();`);
try {
  const failed = await one.request(
    `/api/events/${id}/proposals/${safeProposal.body.id}/approve`,
    approval(safeProposal.body),
  );
  assert.equal(failed.status, 409);
  const state = JSON.parse(
    sql(
      "select jsonb_build_object('head',e.current_revision_id,'state',p.state,'revisions',(select count(*) from public.revisions where event_id=e.id),'receipts',(select count(*) from public.approval_receipts where event_id=e.id),'audits',(select count(*) from public.audit_events where event_id=e.id and revision_id is not null)) from public.events e join public.proposals p on p.event_id=e.id where e.id=:'event'::uuid and p.id=:'proposal'::uuid;",
      { event: id, proposal: safeProposal.body.id },
    ),
  );
  assert.deepEqual(state, {
    head: r3,
    state: "ready",
    revisions: 3,
    receipts: 3,
    audits: 3,
  });
} finally {
  sql(
    `drop trigger ${triggerName} on public.approval_receipts;drop function eventops_private.${triggerName}();`,
  );
}
pass(
  "failure at the final receipt insert rolls back revision, head, proposal and audit changes",
);
const event2 = await one.request("/api/events", {
  setup: fixtureSetup,
  request_id: randomUUID(),
});
assert.equal(event2.status, 201);
const id2 = event2.body.event_id;
const incomplete = inputPlan();
incomplete.assignments.shift();
const badStage = await one.request(
  `/api/events/${id2}/draft`,
  { plan: incomplete, expected_generation: 1, confirmed: true },
  "PUT",
);
assert.equal(badStage.status, 200);
assert.ok(badStage.body.validation_report.some((i) => i.rule === "COVERAGE"));
const badConfirm = await one.request(`/api/events/${id2}/confirm-plan`, {
  expected_generation: 2,
  candidate_digest: badStage.body.candidate_digest,
  idempotency_key: randomUUID(),
});
assert.equal(badConfirm.status, 422);
const setupEdit = await one.request(
  `/api/events/${id2}/draft`,
  {
    setup: { ...fixtureSetup, name: "Synthetic corrected setup" },
    expected_generation: 2,
    request_id: randomUUID(),
  },
  "PUT",
);
assert.equal(setupEdit.status, 200);
const retained = await one.request(`/api/events/${id2}/plan`);
assert.equal(retained.body.draft.candidate_digest, null);
assert.deepEqual(
  retained.body.draft.plan_snapshot.sessions,
  badStage.body.snapshot.sessions,
);
assert.equal(retained.body.draft.generation, 3);
const corrected = structuredClone(badStage.body.snapshot);
corrected.rooms.pop();
corrected.assignments.push(inputPlan().assignments[0]);
const goodStage = await one.request(
  `/api/events/${id2}/draft`,
  { plan: corrected, expected_generation: 3, confirmed: true },
  "PUT",
);
assert.equal(goodStage.status, 200, JSON.stringify(goodStage.body));
assert.deepEqual(goodStage.body.validation_report, []);
const confirm2 = {
  expected_generation: 4,
  candidate_digest: goodStage.body.candidate_digest,
  idempotency_key: randomUUID(),
};
const confirmationRace = await Promise.all([
  one.request(`/api/events/${id2}/confirm-plan`, confirm2),
  one.request(`/api/events/${id2}/confirm-plan`, {
    ...confirm2,
    idempotency_key: randomUUID(),
  }),
]);
assert.deepEqual(confirmationRace.map((r) => r.status).sort(), [200, 409]);
pass(
  "drafts retain records across setup edits, correction and removal keep evidence valid, competing keys create one initial revision",
);
const limitCheck = sql(
  `begin;
select set_config('eventops_test.event',:'event',true);
select set_config('request.jwt.claim.sub',(select owner_user_id::text from public.workspaces w join public.events e on e.workspace_id=w.id where e.id=:'event'::uuid),true);
do $test$
declare e uuid:=current_setting('eventops_test.event')::uuid;limit_head uuid;p jsonb;rooms jsonb;
begin
 insert into public.revisions(workspace_id,event_id,revision_number,snapshot,sha256,approved_by,reason,parent_revision_id) select workspace_id,event_id,500,snapshot,sha256,approved_by,'Synthetic limit fixture',id from public.revisions where event_id=e and revision_number=1 returning id into limit_head;
 update public.events set current_revision_id=limit_head where id=e;
 select jsonb_set(snapshot->'rooms','{0,name}',to_jsonb('Limit fixture'::text)) into rooms from public.revisions where id=limit_head;
 p:=public.create_manual_proposal(e,limit_head,jsonb_build_array(jsonb_build_object('op','replace','path','/rooms','value',rooms)),true,'Synthetic limit test',gen_random_uuid());
 begin perform public.approve_proposal(e,(p->>'id')::uuid,limit_head,1,p->>'candidate_digest',gen_random_uuid());raise exception 'Expected revision limit rejection';exception when sqlstate '22023' then if sqlerrm<>'Revision limit reached' then raise;end if;end;
end $test$;
rollback;`,
  { event: id2 },
);
assert.ok(limitCheck.includes("ROLLBACK"));
pass(
  "revision 501 is rejected under the event lock with no lasting fixture changes",
);
const workspace = sql(
  "select workspace_id from public.events where id=:'event'::uuid;",
  { event: id },
);
try {
  sql("update public.events set status='trashed' where id=:'event'::uuid;", {
    event: id2,
  });
  assert.equal((await one.request(`/api/events/${id2}/plan`)).status, 404);
  assert.deepEqual(
    JSON.parse(
      (await rest(session, `revisions?event_id=eq.${id2}`, undefined, "GET"))
        .body,
    ),
    [],
  );
  sql(
    "update public.workspaces set deletion_requested_at=now() where id=:'workspace'::uuid;",
    { workspace },
  );
  assert.equal((await one.request(`/api/events/${id}/plan`)).status, 404);
  assert.equal(
    (await one.request(`/api/events/${id}/confirm-plan`, confirmation)).status,
    404,
  );
  assert.deepEqual((await one.request("/api/events")).body.events, []);
} finally {
  sql(
    "update public.events set status='active' where id=:'event'::uuid;update public.workspaces set deletion_requested_at=null where id=:'workspace'::uuid;",
    { event: id2, workspace },
  );
}
pass(
  "trash and pending workspace deletion hide records and block even receipt replay",
);

// Verify transaction artifacts agree, independently of response bodies.
const counts = JSON.parse(
  sql(
    "select jsonb_build_object('revisions',(select count(*) from public.revisions where event_id=:'event'::uuid),'receipts',(select count(*) from public.approval_receipts where event_id=:'event'::uuid),'audits',(select count(*) from public.audit_events where event_id=:'event'::uuid and revision_id is not null),'head',(select current_revision_id from public.events where id=:'event'::uuid));",
    { event: id },
  ),
);
assert.equal(counts.revisions, 3);
assert.equal(counts.receipts, 3);
assert.equal(counts.audits, 3);
assert.equal(counts.head, r3);
pass("revision, head, proposal, audit and receipt effects remain atomic");
console.log(`${checks} T3 live checks passed.`);
