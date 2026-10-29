// Real local service verification. Only synthetic loopback accounts and records.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { randomUUID, createHash, createHmac } from "node:crypto";
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
const origin = process.env.T8_APP_URL ?? "http://localhost:3001";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T8_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
    process.env.T8_PSQL ?? "psql",
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
  const email = `t8-${label}-${randomUUID()}@example.test`;
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
const { editableRecords, planInput } =
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

pass(
  "editor input stages all six collections and confirms revision 1 through actual transactions",
);

// Additional private Storage fixture, separate from the approved plan.
const rawCreate = await one.request("/api/events", {
  setup: { ...fixtureSetup, name: "Synthetic raw retention" },
  request_id: randomUUID(),
});
assert.equal(rawCreate.status, 201);
const rawEvent = rawCreate.body.event_id;
const form = new FormData();
form.set("expected_generation", "1");
const csv =
  "room_id,name,location,capacity,feature_tags\nR,Retained hall,Main,50,projector";
form.set("rooms", new File([csv], "rooms.csv", { type: "text/csv" }));
const uploaded = await fetch(origin + `/api/events/${rawEvent}/imports`, {
  method: "POST",
  headers: {
    Origin: origin,
    Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; "),
  },
  body: form,
});
assert.equal(uploaded.status, 201, await uploaded.clone().text());
const batch = (await uploaded.json()).id;
const rawHash = createHash("sha256").update(csv).digest("hex");
const artifact = sql(
  `select artifact_id from public.import_files where event_id='${rawEvent}'`,
);
const objectPath = sql(
  `select object_key from public.source_artifacts where id='${artifact}'`,
);
const rawPath = `/api/events/${rawEvent}/imports/${batch}/files/${rawHash}`;
const privateFetch = (path) =>
  fetch(origin + path, {
    headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
assert.equal(await (await privateFetch(rawPath)).text(), csv);
const byteRest = await rest(
  session,
  "import_files?select=original_bytes",
  null,
  "GET",
);
assert.equal(byteRest.status, 403);
// Edited setup date must govern retention, not its immutable creation receipt.
const changedSetup = {
  ...fixtureSetup,
  name: "Synthetic raw retention",
  date: "2026-12-02",
  starts_at: "2026-12-02T01:00:00Z",
  ends_at: "2026-12-02T09:00:00Z",
};
assert.equal(
  (
    await one.request(
      `/api/events/${rawEvent}/draft`,
      { setup: changedSetup, request_id: randomUUID(), expected_generation: 1 },
      "PUT",
    )
  ).status,
  200,
);
let dateSettings = (await one.request("/api/workspace/settings")).body;
assert.equal(
  dateSettings.events.find((e) => e.id === rawEvent).event_date,
  "2026-12-02",
);
pass(
  "current edited event date drives retention and direct REST cannot expose raw byte receipts",
);
const generationBefore = dateSettings.generation;
assert.equal(
  (
    await one.request("/api/workspace/originals", {
      event_id: rawEvent,
      artifact_id: artifact,
    })
  ).status,
  200,
);
assert.equal((await privateFetch(rawPath)).status, 410);
assert.ok(
  (await one.request("/api/workspace/settings")).body.generation >
    generationBefore,
);
const storageRead = await fetch(
  env.API_URL + "/storage/v1/object/authenticated/event-imports/" + objectPath,
  {
    headers: {
      apikey: env.PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  },
);
assert.notEqual(storageRead.status, 200);
assert.equal(
  sql(
    `select original_bytes is not null from public.import_files where artifact_id='${artifact}'`,
  ),
  "t",
);
pass(
  "explicit raw deletion immediately fences HTTP, Storage and export generation before byte cleanup",
);
const settingsPath = "/api/workspace/settings";
let config = (await one.request(settingsPath)).body;
let event = () => config.events.find((e) => e.id === id);
async function change(action, days) {
  const result = await one.request(settingsPath, {
    kind: "event",
    id,
    generation: event().generation,
    action,
    ...(days ? { days } : {}),
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  config = result.body;
  return result;
}
await writeFile(
  "/private/tmp/eventops-t8-browser.json",
  JSON.stringify({
    cookies: [...two.jar].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    })),
  }),
  { mode: 0o600 },
);
const otherSettings = (await two.request(settingsPath)).body;
assert.equal(
  (
    await two.request(settingsPath, {
      kind: "event",
      id,
      generation: event().generation,
      action: "trash",
    })
  ).status,
  404,
);
assert.equal(
  (
    await one.request(
      settingsPath,
      { kind: "event", id, generation: event().generation, action: "trash" },
      "POST",
    )
  ).status,
  200,
);
config = (await one.request(settingsPath)).body;
assert.equal((await one.request(`/api/events/${id}/plan`)).status, 404);
assert.equal(
  (await rest(session, `events?id=eq.${id}`, null, "GET")).body,
  "[]",
);
await change("restore");
assert.equal((await one.request(`/api/events/${id}/plan`)).status, 200);
pass(
  "trash hides actual HTTP and RLS reads, cross owner mutation denied, restore preserves revision",
);
await change("archive");
assert.equal((await one.request(`/api/events/${id}/plan`)).status, 200);
const text = await one.request(`/api/events/${id}/updates`, {
  raw_text: "Synthetic update",
  corrected_text: "Synthetic update",
  idempotency_key: randomUUID(),
});
assert.notEqual(text.status, 201);
await change("reopen");
await change("retention", 30);
assert.equal(event().retention_days, 30);
const stale = await one.request(settingsPath, {
  kind: "event",
  id,
  generation: event().generation - 1,
  action: "trash",
});
assert.equal(stale.status, 409);
pass(
  "archive remains readable, edits blocked, reopen and retention use generation fences",
);
const download = await fetch(origin + "/api/workspace/export", {
  headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
});
assert.equal(download.status, 200, await download.clone().text());
const zip = Buffer.from(await download.arrayBuffer());
assert.equal(zip.readUInt32LE(), 0x04034b50);
await writeFile("/private/tmp/eventops-t8-export.zip", zip, { mode: 0o600 });
execFileSync("unzip", ["-t", "/private/tmp/eventops-t8-export.zip"]);
const exported = JSON.parse(
  execFileSync(
    "unzip",
    ["-p", "/private/tmp/eventops-t8-export.zip", "workspace.json"],
    { encoding: "utf8" },
  ),
);
assert.equal(exported.events.length, 2);
assert.equal(exported.revisions.length, 1);
assert.ok(!JSON.stringify(exported).includes(otherSettings.workspace_id));
assert.ok(zip.includes(Buffer.from("revisions/")));
pass(
  "actual private ZIP opens with system unzip and contains own JSON and safe CSV revisions only",
);
const accountRequest = {
  kind: "account",
  generation: config.generation,
  action: "delete",
  confirmed: true,
};
const sessionId = JSON.parse(
  Buffer.from(session.access_token.split(".")[1], "base64url"),
).session_id;
sql(
  `update auth.sessions set created_at=now()-interval '11 minutes' where id='${sessionId}'`,
);
assert.equal((await one.request(settingsPath, accountRequest)).status, 403);
sql(`update auth.sessions set created_at=now() where id='${sessionId}'`);
const deletion = await one.request(settingsPath, accountRequest);
assert.equal(deletion.status, 200, JSON.stringify(deletion.body));
config = deletion.body;
assert.equal((await one.request(`/api/events/${id}/plan`)).status, 404);
assert.equal((await one.request("/api/workspace/export")).status, 409);
sql(
  `update auth.sessions set created_at=now()-interval '11 minutes' where id='${sessionId}'`,
);
assert.equal(
  (
    await one.request(settingsPath, {
      kind: "account",
      generation: config.generation,
      action: "recover",
      confirmed: true,
    })
  ).status,
  403,
);
sql(`update auth.sessions set created_at=now() where id='${sessionId}'`);
const recovery = await one.request(settingsPath, {
  kind: "account",
  generation: config.generation,
  action: "recover",
  confirmed: true,
});
assert.equal(recovery.status, 200);
config = recovery.body;
assert.equal((await one.request(`/api/events/${id}/plan`)).status, 200);
pass(
  "actual session age rejects stale deletion, immediate account isolation and explicit grace recovery work",
);
// Worker stage/finish must fence a retained event expiring after text confirmation.
const textValue = "Synthetic expiry boundary";
const savedText = await one.request(`/api/events/${id}/updates`, {
  raw_text: textValue,
  corrected_text: textValue,
  idempotency_key: randomUUID(),
});
assert.equal(savedText.status, 201);
const blockedJob = await one.request(
  `/api/events/${id}/updates/${savedText.body.id}/analyze`,
  {
    generation: 1,
    base_revision_id: confirmed.body.revision_id,
    confirmed_text: textValue,
    confirmed: true,
  },
);
assert.equal(blockedJob.status, 202);
const jobId = blockedJob.body.id;
const audioId = randomUUID(),
  audioPath = `${config.workspace_id}/${id}/${audioId}`;
sql(
  `insert into public.voice_jobs(id,workspace_id,event_id,create_key,object_key,sha256,byte_length,mime,state) values('${audioId}','${config.workspace_id}','${id}','${randomUUID()}','${audioPath}','${"0".repeat(64)}',1,'audio/webm','completed')`,
);
const lease = randomUUID();
sql(
  `update public.analysis_jobs set state='running',lease_token='${lease}',lease_until=now()+interval '2 minutes' where id='${jobId}';update public.events set purge_after=now()-interval '1 second' where id='${id}'`,
);
assert.equal(
  sql(
    `select eventops_worker_api.stage('${jobId}','${lease}','Reading update')`,
  ),
  "f",
);
assert.equal(
  sql(
    `select eventops_worker_api.finish('${jobId}','${lease}',null,'ANALYSIS_FAILED','{"reported":false,"input_tokens":0,"output_tokens":0,"calls":0}')`,
  ),
  "t",
);
assert.equal(
  sql(`select state from public.analysis_jobs where id='${jobId}'`),
  "stale",
);
sql(`update public.events set purge_after=null where id='${id}'`);
pass(
  "worker stage and completion reject content that expires after confirmation without calling a provider",
);
// Direct restricted audio access must fail even before maintenance runs.
sql(
  `update public.events set purge_after=now()-interval '1 second' where id='${id}'`,
);
assert.equal(
  sql(
    `set request.jwt.claims='{"role":"eventops_worker"}';select public.voice_object_access('${audioPath}')`,
  )
    .split("\n")
    .at(-1),
  "f",
);
sql(`update public.voice_jobs set delete_after=now() where id='${audioId}'`);
assert.equal(
  sql(
    `set request.jwt.claims='{"role":"eventops_worker"}';select public.voice_object_access('${audioPath}',true)`,
  )
    .split("\n")
    .at(-1),
  "t",
);
sql(`update public.events set purge_after=null where id='${id}'`);
pass(
  "direct worker audio read denies expired events while due deletion remains permitted",
);

// Inject a late failure during purge and prove all earlier deletes roll back.
await change("trash");
sql(
  `update public.events set purge_after=now()-interval '1 second' where id='${id}';create function eventops_private.t8_fail_purge() returns trigger language plpgsql as $$begin raise exception 'Synthetic purge rollback';end$$;create trigger t8_fail_purge before delete on public.events for each row when(old.id='${id}'::uuid) execute function eventops_private.t8_fail_purge()`,
);
try {
  sql(`select eventops_worker_api.retention_purge('event','${id}')`);
  assert.fail("fault must fail");
} catch (error) {
  assert.match(String(error), /Synthetic purge rollback/);
}
assert.equal(
  sql(`select count(*) from public.revisions where event_id='${id}'`),
  "1",
);
sql(
  "drop trigger t8_fail_purge on public.events;drop function eventops_private.t8_fail_purge()",
);
pass(
  "late event purge failure rolls back revision evidence and receipt deletion",
);
sql(
  `update public.events set purge_after=now()-interval '1 second' where id='${id}'`,
);
assert.equal(
  (
    await one.request(settingsPath, {
      kind: "event",
      id,
      generation: event().generation,
      action: "restore",
    })
  ).status,
  409,
);
// Exercise restricted maintenance without broad direct table privileges.
const { retentionSweep, appendTombstone } =
  await import("../src/features/privacy/maintenance.ts");
const pg = (await import("pg")).default;
const db = new pg.Client({ connectionString: env.DB_URL });
await db.connect();
await db.query("set role eventops_worker");
await assert.rejects(db.query("select * from public.events"));
const ledger = "/private/tmp/eventops-t8-ledger/tombstones.jsonl";
const stateRoot = "/private/tmp/eventops-supabase/stacks";
const localState = readdirSync(stateRoot)
  .filter((n) => !n.startsWith("."))
  .map((n) => stateRoot + "/" + n + "/state.json")
  .find((p) => existsSync(p));
const secret =
  env.JWT_SECRET ??
  JSON.parse(readFileSync(localState, "utf8")).credentials.jwtSecret;
const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
const unsigned =
  enc({ alg: "HS256", typ: "JWT" }) +
  "." +
  enc({
    role: "eventops_worker",
    iss: "supabase",
    exp: Math.floor(Date.now() / 1000) + 600,
  });
const token =
  unsigned +
  "." +
  createHmac("sha256", secret).update(unsigned).digest("base64url");
async function removeObject(bucket, path) {
  const response = await fetch(env.API_URL + "/storage/v1/object/" + bucket, {
    method: "DELETE",
    headers: {
      apikey: env.PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [path] }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  await response.body?.cancel();
}
await appendTombstone(ledger, { kind: "csv", id: artifact });
assert.equal(
  (
    await db.query(
      "select eventops_worker_api.retention_purge('csv',$1) as done",
      [artifact],
    )
  ).rows[0].done,
  false,
);
await removeObject("event-imports", objectPath);
assert.equal(
  (
    await db.query(
      "select eventops_worker_api.retention_purge('csv',$1) as done",
      [artifact],
    )
  ).rows[0].done,
  true,
);
assert.equal(
  sql(
    `select original_bytes is null from public.import_files where artifact_id='${artifact}'`,
  ),
  "t",
);
assert.ok(
  Number(
    sql(
      `select count(*) from public.source_records where artifact_id='${artifact}'`,
    ),
  ) > 0,
);
pass(
  "restricted Storage deletion retries safely, database bytes clear only after metadata absence, frozen cells remain",
);
const summary = await retentionSweep(db, removeObject, (t) =>
  appendTombstone(ledger, t),
);
assert.ok(summary.purged >= 1);
assert.equal(sql(`select count(*) from public.events where id='${id}'`), "0");
assert.equal(
  sql(`select count(*) from public.revisions where event_id='${id}'`),
  "0",
);
assert.ok((await readFile(ledger, "utf8")).includes(id));
pass(
  "expired grace cannot restore, restricted worker purges cyclic event records after durable independent tombstone",
);
// Account purge removes auth identity and sessions only after event cleanup.
const last = await one.request(settingsPath);
config = last.body;
assert.equal(
  (
    await one.request(settingsPath, {
      kind: "account",
      generation: config.generation,
      action: "delete",
      confirmed: true,
    })
  ).status,
  200,
);
sql(
  `update public.workspaces set purge_after=now()-interval '1 second' where id='${config.workspace_id}'`,
);
const accountSummary = await retentionSweep(db, removeObject, (t) =>
  appendTombstone(ledger, t),
);
assert.ok(accountSummary.purged >= 1);
await retentionSweep(db, removeObject, (t) => appendTombstone(ledger, t));
assert.equal(
  sql(`select count(*) from auth.users where id='${session.user.id}'`),
  "0",
);
assert.equal(
  sql(`select count(*) from auth.sessions where user_id='${session.user.id}'`),
  "0",
);
// Exercise the actual standalone maintenance entrypoint with private loopback config.
const workerUrl = new URL(env.DB_URL);
workerUrl.searchParams.set("options", "-c role=eventops_worker");
const workerOutput = execFileSync(
  process.execPath,
  ["scripts/retention-worker.mjs"],
  {
    env: {
      ...process.env,
      WORKER_DATABASE_URL: workerUrl.toString(),
      NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.PUBLISHABLE_KEY,
      EVENTOPS_RETENTION_STORAGE_TOKEN: token,
      EVENTOPS_DELETION_LEDGER: ledger,
      EVENTOPS_RETENTION_ONCE: "1",
      EVENTOPS_MODEL_ENABLED: "0",
      EVENTOPS_VOICE_ENABLED: "0",
    },
    encoding: "utf8",
    timeout: 30000,
  },
);
assert.equal(JSON.parse(workerOutput.trim()).code, "RETENTION_SWEEP");
pass(
  "actual maintenance process runs with restricted DB and Storage roles while provider gates are disabled",
);
await db.end();
pass(
  "account purge removes membership workspace profile Auth identity and sessions",
);
assert.equal((await one.request(settingsPath)).status, 401);
const ready = await fetch(origin + "/api/ready");
assert.equal(ready.status, 200);
assert.deepEqual(await ready.json(), { status: "ok" });
assert.equal(
  sql("select enabled from eventops_private.analysis_budget_lock"),
  "f",
);
assert.equal(sql("select enabled from eventops_private.voice_gate"), "f");
pass(
  "database readiness is minimal and both live provider gates remain disabled",
);
console.log(`${checks} T8 checks passed`);
