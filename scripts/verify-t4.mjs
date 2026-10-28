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
const origin = process.env.T4_APP_URL ?? "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T4_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
    process.env.T4_PSQL ?? "psql",
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
  const email = `t4-${label}-${randomUUID()}@example.test`;
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
  two = actor(),
  guest = actor();
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
const updateBody = {
  raw_text: "Move the workshop, please.",
  corrected_text: "Move the workshop, please.",
  idempotency_key: randomUUID(),
};
const saved = await one.request(`/api/events/${id}/updates`, updateBody);
assert.equal(saved.status, 201, JSON.stringify(saved.body));
const draftId = saved.body.id;
const replay = await one.request(`/api/events/${id}/updates`, updateBody);
assert.equal(replay.body.id, draftId);
const otherText = await one.request(`/api/events/${id}/updates`, {
  ...updateBody,
  corrected_text: "Different",
});
assert.equal(otherText.status, 409);
pass(
  "durable text creation replays one identity and rejects changed key content",
);
const editedBody = {
  ...updateBody,
  corrected_text: "Move the workshop to 12:00 to 13:00.",
  expected_generation: 1,
};
const edited = await one.request(
  `/api/events/${id}/updates/${draftId}`,
  editedBody,
  "PUT",
);
assert.equal(edited.status, 200);
assert.equal(edited.body.raw_text, updateBody.raw_text);
assert.equal(edited.body.generation, 2);
const editRetry = await one.request(
  `/api/events/${id}/updates/${draftId}`,
  editedBody,
  "PUT",
);
assert.equal(editRetry.body.generation, 2);
const stale = await one.request(
  `/api/events/${id}/updates/${draftId}`,
  { ...editedBody, corrected_text: "Lost stale edit" },
  "PUT",
);
assert.equal(stale.status, 409);
const rewritten = await one.request(
  `/api/events/${id}/updates/${draftId}`,
  { ...editedBody, expected_generation: 2, raw_text: "Forged original" },
  "PUT",
);
assert.equal(rewritten.status, 409);
pass(
  "corrections preserve original text, replay lost saves and reject stale/rewritten originals",
);
const originalCreateReplay = await one.request(
  `/api/events/${id}/updates`,
  updateBody,
);
assert.equal(originalCreateReplay.status, 201);
assert.equal(originalCreateReplay.body.generation, 1);
assert.equal(
  originalCreateReplay.body.corrected_text,
  updateBody.corrected_text,
);
const currentDraft = await one.request(`/api/events/${id}/updates/${draftId}`);
assert.equal(currentDraft.body.draft.generation, 2);
pass("creation receipt stays immutable after the mutable draft advances");

const analysis = {
  generation: 2,
  base_revision_id: base,
  confirmed_text: edited.body.corrected_text,
  confirmed: true,
};
assert.equal(
  (
    await one.request(`/api/events/${id}/updates/${draftId}/analyze`, {
      ...analysis,
      confirmed: false,
    })
  ).status,
  422,
);
assert.equal(
  (
    await one.request(`/api/events/${id}/updates/${draftId}/analyze`, {
      ...analysis,
      confirmed_text: "Forged text",
    })
  ).status,
  409,
);

assert.match(id, /^[0-9a-f-]{36}$/);
sql(
  `create function public.t4_job_failure() returns trigger language plpgsql as $$ begin if new.event_id='${id}'::uuid then raise exception 'Injected final job failure';end if;return new;end $$; create trigger t4_job_failure after insert on public.analysis_jobs for each row execute function public.t4_job_failure();`,
);
try {
  const failed = await one.request(
    `/api/events/${id}/updates/${draftId}/analyze`,
    analysis,
  );
  assert.ok(failed.status >= 400);
  assert.equal(
    sql(
      `select count(*) from public.updates where event_id='${id}' and input_kind='text';`,
    ),
    "0",
  );
  assert.equal(
    sql(
      `select count(*) from public.source_artifacts where event_id='${id}' and metadata->>'kind'='confirmed_text';`,
    ),
    "0",
  );
} finally {
  sql(
    "drop trigger t4_job_failure on public.analysis_jobs;drop function public.t4_job_failure();",
  );
}
pass(
  "injected last job insertion failure rolls back confirmed update and frozen evidence",
);
const nullText = await rest(session, "rpc/confirm_text_analysis", {
  p_event_id: id,
  p_draft_id: draftId,
  p_generation: 2,
  p_base_revision_id: base,
  p_confirmed_text: null,
  p_confirmed: true,
});
assert.ok(nullText.status >= 400);
const jobs = await Promise.all([
  one.request(`/api/events/${id}/updates/${draftId}/analyze`, analysis),
  one.request(`/api/events/${id}/updates/${draftId}/analyze`, analysis),
]);
assert.equal(jobs[0].status, 202, JSON.stringify(jobs[0].body));
assert.equal(jobs[0].body.id, jobs[1].body.id);
assert.equal(jobs[0].body.state, "blocked");
assert.equal(jobs[0].body.error_code, "META_ACCESS_NOT_VERIFIED");
const job = jobs[0].body;
const stored = await rest(
  session,
  `updates?id=eq.${job.update_id}&select=raw_text,confirmed_text`,
  null,
  "GET",
);
assert.equal(stored.status, 200);
assert.equal(
  JSON.parse(stored.body)[0].confirmed_text,
  analysis.confirmed_text,
);
const sources = await rest(
  session,
  `source_records?record_id=eq.${job.update_id}&select=id,value_json`,
  null,
  "GET",
);
assert.equal(JSON.parse(sources.body)[0].value_json, analysis.confirmed_text);
pass(
  "explicit exact-text confirmation atomically freezes update and source with one durable blocked job under race",
);
for (const path of [
  `/api/events/${id}/updates`,
  `/api/events/${id}/updates/${draftId}`,
]) {
  assert.equal((await two.request(path)).status, 404);
  assert.equal((await guest.request(path)).status, 401);
}
assert.equal(
  (await two.request(`/api/events/${id}/updates/${draftId}/analyze`, analysis))
    .status,
  404,
);
for (const table of ["text_update_drafts", "analysis_jobs"]) {
  assert.ok((await rest(session, table, { event_id: id })).status >= 400);
  assert.ok(
    (
      await rest(
        session,
        `${table}?event_id=eq.${id}`,
        { state: "ready" },
        "PATCH",
      )
    ).status >= 400,
  );
}
pass(
  "new reads and writes deny other owners, anonymous users and direct table mutations",
);
const before = await one.request(`/api/events/${id}/plan`);
const current = before.body.approved_revision.snapshot;
const rows = editableRecords(current);
rows.sessions[1] = { ...rows.sessions[1], start: "12:00", end: "13:00" };
rows.assignments[1] = { ...rows.assignments[1], start: "12:00", end: "13:00" };
const proposal = await one.request(`/api/events/${id}/proposals`, {
  mode: "manual",
  expected_head: base,
  patch: manualPatch(current, rows),
  confirmed: true,
  reason: "Confirm the workshop and assigned volunteer move to noon.",
  idempotency_key: randomUUID(),
});
assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
assert.equal(proposal.body.state, "ready");
const approve = {
  base_revision_id: base,
  generation: proposal.body.generation,
  candidate_digest: proposal.body.candidate_digest,
  idempotency_key: randomUUID(),
};
const receipt = await one.request(
  `/api/events/${id}/proposals/${proposal.body.id}/approve`,
  approve,
);
assert.equal(receipt.status, 200, JSON.stringify(receipt.body));
const after = await one.request(`/api/events/${id}/plan`);
assert.equal(after.body.approved_revision.revision_number, 2);
assert.equal(after.body.approved_revision.snapshot.sessions[1].start, "12:00");
assert.equal(
  (
    await one.request(
      `/api/events/${id}/proposals/${proposal.body.id}/approve`,
      approve,
    )
  ).body.revision_id,
  receipt.body.revision_id,
);
pass(
  "actual editor patch, comparison candidate, explicit approval and lost-response receipt replay create revision 2",
);
for (const path of [
  "briefing",
  "updates",
  "records",
  `proposals/${proposal.body.id}`,
]) {
  const response = await fetch(`${origin}/events/${id}/${path}`, {
    headers: {
      Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; "),
      Connection: "close",
    },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(!html.includes("Workspace temporarily unavailable"));
  if (path === "briefing") {
    assert.match(html, /Approved revision/);
    assert.match(html, /12:00/);
  }
}
pass(
  "all new protected pages render, briefing reads revision 2 and excludes pending update text",
);
const historyResponse = await fetch(
  `${origin}/events/${id}/briefing?revision=${base}`,
  {
    headers: {
      Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; "),
      Connection: "close",
    },
  },
);
assert.equal(historyResponse.status, 200);
const historyHtml = await historyResponse.text();
assert.match(historyHtml, /Historical approved revision/);
assert.match(historyHtml, /Current approved revision/);
const approvedResponse = await fetch(
  `${origin}/events/${id}/proposals/${proposal.body.id}`,
  {
    headers: {
      Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; "),
      Connection: "close",
    },
  },
);
assert.match(
  await approvedResponse.text(),
  /Open this saved revision briefing/,
);
pass(
  "approved proposal recovers its saved revision after reload and older briefings are explicitly historical",
);

const amended = await one.request(
  `/api/events/${id}/updates/${draftId}`,
  { ...editedBody, expected_generation: 2, corrected_text: "Another request" },
  "PUT",
);
assert.equal(amended.status, 200);
assert.equal(
  (
    await one.request(`/api/events/${id}/updates/${draftId}/analyze`, {
      ...analysis,
      generation: amended.body.generation,
      confirmed_text: amended.body.corrected_text,
    })
  ).status,
  409,
);
const historicalJob = await one.request(
  `/api/events/${id}/updates/${draftId}/analyze`,
  analysis,
);
assert.equal(historicalJob.body.id, job.id);
pass(
  "new analysis against stale head fails while prior exact acknowledgement stays resumable",
);
await writeFile(
  "/private/tmp/eventops-t4-browser-state.json",
  JSON.stringify({
    cookies: [...one.jar].map(([name, value]) => ({
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
  "/private/tmp/eventops-t4-browser-fixture.json",
  JSON.stringify({
    id,
    proposal: proposal.body.id,
    source: JSON.parse(sources.body)[0].id,
  }),
  { mode: 0o600 },
);
console.log(
  `PASS ${checks} T4 local service groups; provider interpretation and worker execution remain blocked`,
);
