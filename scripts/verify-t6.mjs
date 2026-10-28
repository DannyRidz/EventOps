// Real local service verification. Only synthetic loopback accounts and records.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
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
const origin = process.env.T6_APP_URL ?? "http://localhost:3001";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T6_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
    process.env.T6_PSQL ?? "psql",
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
  const email = `t6-${label}-${randomUUID()}@example.test`;
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
const { readFileSync, readdirSync, writeFileSync } = await import("node:fs");
const { default: pg } = await import("pg");
const { runVoice, cleanupVoice, audioStore } =
  await import("../src/features/voice/worker.ts");
const { convertRecording } =
  await import("../src/features/voice/conversion.ts");
const { createTranscriber } = await import("../src/features/voice/provider.ts");
const binary = process.env.EVENTOPS_FFMPEG_PATH;
assert.ok(
  binary,
  "Set EVENTOPS_FFMPEG_PATH to an existing local ffmpeg executable.",
);
const fixtures = "/private/tmp/eventops-t6-" + randomUUID();
const { mkdirSync, rmSync } = await import("node:fs");
mkdirSync(fixtures, { mode: 0o700 });
for (const [file, codec] of [
  ["opus.webm", "libopus"],
  ["aac.mp4", "aac"],
])
  execFileSync(binary, [
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    codec,
    fixtures + "/" + file,
  ]);
const original = readFileSync(fixtures + "/opus.webm");
const admin = new pg.Client({ connectionString: env.DB_URL });
await admin.connect();
const login = "eventops_t6_worker_" + randomUUID().replaceAll("-", "");
const password = randomUUID();
const workerUrl = new URL(env.DB_URL);
workerUrl.username = login;
workerUrl.password = password;
await admin.query(
  `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login};`,
);
const worker = new pg.Client({ connectionString: workerUrl.href });
await worker.connect();
await worker.query("set role eventops_worker");
let job;
async function raw(
  client,
  bytes = original,
  key = randomUUID(),
  type = "audio/webm",
) {
  const response = await fetch(origin + `/api/events/${id}/voice`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": type,
      "Idempotency-Key": key,
      Cookie: [...client.jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: bytes,
  });
  return { status: response.status, body: await response.json() };
}
async function ownedRpc(name, args) {
  const result = await rest(session, "rpc/" + name, args);
  assert.equal(result.status, 200, result.body);
  return JSON.parse(result.body);
}
const stateRoot = "/private/tmp/eventops-supabase/stacks";
const localState =
  process.env.T6_LOCAL_STATE_FILE ??
  readdirSync(stateRoot)
    .filter((name) => !name.startsWith("."))
    .map((name) => stateRoot + "/" + name + "/state.json")
    .find((path) => existsSync(path));
const jwtSecret =
  env.JWT_SECRET ??
  JSON.parse(readFileSync(localState, "utf8")).credentials.jwtSecret;
assert.ok(jwtSecret, "Local JWT signing fixture required");
const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const payload =
  enc({ alg: "HS256", typ: "JWT" }) +
  "." +
  enc({
    role: "eventops_worker",
    iss: "supabase",
    exp: Math.floor(Date.now() / 1000) + 600,
  });
const workerToken =
  payload +
  "." +
  createHmac("sha256", jwtSecret).update(payload).digest("base64url");
const store = audioStore(env.API_URL, env.PUBLISHABLE_KEY, workerToken);
const queue = async (
  bytes = original,
  mime = "audio/webm",
  key = randomUUID(),
) => {
  const created = await ownedRpc("begin_voice", {
    p_event_id: id,
    p_key: key,
    p_sha256: createHash("sha256").update(bytes).digest("hex"),
    p_bytes: bytes.length,
    p_mime: mime,
  });
  const uploaded = await fetch(
    env.API_URL + "/storage/v1/object/event-audio/" + created.object_key,
    {
      method: "POST",
      headers: {
        apikey: env.PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": mime,
      },
      body: bytes,
    },
  );
  assert.equal(uploaded.status, 200, await uploaded.text());
  return ownedRpc("queue_voice", { p_event_id: id, p_job_id: created.id });
};
try {
  assert.equal((await raw(one)).status, 503);
  pass("web live transcription remains disabled and text path available");
  await admin.query("update eventops_private.voice_gate set enabled=true");
  const before = readdirSync("/private/tmp")
    .filter((x) => x.startsWith("eventops-audio-"))
    .sort();
  for (const [file, mime] of [
    ["opus.webm", "audio/webm"],
    ["aac.mp4", "audio/mp4"],
  ]) {
    const converted = await convertRecording(
      readFileSync(fixtures + "/" + file),
      mime,
      binary,
    );
    assert.ok(converted.duration >= 1000 && converted.duration < 1100);
  }
  await assert.rejects(() =>
    convertRecording(Buffer.from("disguised"), "audio/webm", binary),
  );
  await assert.rejects(() =>
    convertRecording(
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      "audio/webm",
      binary,
    ),
  );
  execFileSync(binary, [
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc",
    "-t",
    "121",
    "-c:a",
    "libopus",
    fixtures + "/long.webm",
  ]);
  await assert.rejects(() =>
    convertRecording(
      readFileSync(fixtures + "/long.webm"),
      "audio/webm",
      binary,
    ),
  );
  assert.deepEqual(
    readdirSync("/private/tmp")
      .filter((x) => x.startsWith("eventops-audio-"))
      .sort(),
    before,
  );
  pass(
    "real Opus and AAC conversion, decoded duration bound, disguised/malformed rejection and temporary file cleanup",
  );
  job = await queue();
  const replay = await ownedRpc("begin_voice", {
    p_event_id: id,
    p_key: job.create_key,
    p_sha256: job.sha256,
    p_bytes: job.byte_length,
    p_mime: job.mime,
  });
  assert.equal(replay.id, job.id);
  assert.equal(
    (await two.request(`/api/events/${id}/voice/${job.id}`)).status,
    404,
  );
  assert.equal((await guest.request(`/api/events/${id}/voice`)).status, 401);
  const direct = await rest(
    session,
    "voice_jobs",
    { state: "completed" },
    "PATCH",
  );
  assert.ok(direct.status >= 400);
  const forged = await rest(session, "rpc/finish_voice", {
    p_id: job.id,
    p_text: "forged",
  });
  assert.ok(forged.status >= 400);
  await assert.rejects(() => worker.query("select * from public.voice_jobs"));
  pass(
    "immutable upload receipt, owner and anonymous isolation, no browser result writes, worker has no table access",
  );
  const claimed = (
    await worker.query("select eventops_worker_api.claim_voice() job")
  ).rows[0].job;
  assert.equal(claimed.id, job.id);
  assert.equal(
    (await worker.query("select eventops_worker_api.claim_voice() job")).rows[0]
      .job,
    null,
  );
  await admin.query(
    "update public.voice_jobs set lease_until=now()-interval '1 second' where id=$1",
    [job.id],
  );
  const reclaimed = (
    await worker.query("select eventops_worker_api.claim_voice() job")
  ).rows[0].job;
  assert.notEqual(claimed.lease_token, reclaimed.lease_token);
  assert.equal(
    (
      await worker.query(
        "select eventops_worker_api.finish_voice($1,$2,$3,$4,null) accepted",
        [job.id, claimed.lease_token, "late", 1000],
      )
    ).rows[0].accepted,
    false,
  );
  await admin.query(
    "update public.voice_jobs set lease_until=now()-interval '1 second' where id=$1",
    [job.id],
  );
  let providerCalls = 0;
  const controlled = createTranscriber("controlled", async (url, options) => {
    providerCalls++;
    assert.equal(url, "https://api.meta.ai/v1/asr/transcribe");
    const form = options.body;
    assert.deepEqual(JSON.parse(await form.get("request").text()), {
      model: "muse-voice-transcribe-1.0",
      mode: "PUSH_TO_TALK",
      audioEncoding: "WAV",
    });
    assert.equal(form.get("audio").type, "audio/wav");
    return Response.json({ transcript: " Move the workshop to Hall B.\n" });
  });
  assert.equal(await runVoice(worker, store, controlled, binary), true);
  assert.equal(providerCalls, 1);
  let saved = (await one.request(`/api/events/${id}/voice/${job.id}`)).body;
  assert.equal(saved.state, "completed");
  assert.ok(saved.draft_id);
  pass(
    "single lease, restart reclaim, stale worker fencing and controlled provider contract create a transcript draft only",
  );
  const detail = await one.request(`/api/events/${id}/updates`);
  const draft = detail.body.drafts.find((d) => d.id === saved.draft_id);
  assert.equal(draft.raw_text, " Move the workshop to Hall B.\n");
  const corrected = await one.request(
    `/api/events/${id}/updates/${draft.id}`,
    {
      raw_text: draft.raw_text,
      corrected_text: "Move the workshop to Hall A at 10:00.",
      idempotency_key: randomUUID(),
      expected_generation: 1,
    },
    "PUT",
  );
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.generation, 2);
  const stale = await one.request(
    `/api/events/${id}/updates/${draft.id}/analyze`,
    {
      generation: 1,
      base_revision_id: base,
      confirmed_text: draft.raw_text,
      confirmed: true,
    },
  );
  assert.equal(stale.status, 409);
  const confirmed = await one.request(
    `/api/events/${id}/updates/${draft.id}/analyze`,
    {
      generation: 2,
      base_revision_id: base,
      confirmed_text: corrected.body.corrected_text,
      confirmed: true,
    },
  );
  assert.equal(confirmed.status, 202, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.state, "blocked");
  assert.equal(
    sql("select input_kind from public.updates where id=:'u'", {
      u: confirmed.body.update_id,
    }),
    "voice",
  );
  assert.equal(
    sql(
      "select count(*) from public.source_records where field_path='original_transcript' and record_id=:'d'",
      { d: draft.id },
    ),
    "1",
  );
  assert.equal(
    sql(
      "select audio_deleted_at is not null from public.voice_jobs where id=:'id'",
      { id: job.id },
    ),
    "t",
  );
  await cleanupVoice(worker, store);
  assert.equal(
    (await one.request(`/api/events/${id}/voice/${job.id}/audio`)).status,
    410,
  );
  assert.equal(
    sql("select current_revision_id from public.events where id=:'id'", { id }),
    base,
  );
  pass(
    "original transcript, saved correction resumption, stale confirmation rejection, blocked analysis, immediate raw deletion and unchanged official plan",
  );
  job = await queue();
  await runVoice(
    worker,
    store,
    async () => {
      throw new Error("outage");
    },
    binary,
  );
  assert.equal(
    (await one.request(`/api/events/${id}/voice/${job.id}`)).body.state,
    "failed",
  );
  const oldDraft = (
    await one.request(`/api/events/${id}/updates`)
  ).body.drafts.find((d) => d.id === draft.id);
  assert.equal(oldDraft.corrected_text, corrected.body.corrected_text);
  await admin.query(
    "update public.voice_jobs set delete_after=now() where id=$1",
    [job.id],
  );
  await admin.query("update eventops_private.voice_gate set enabled=false");
  await cleanupVoice(worker, store);
  assert.equal(
    sql(
      "select audio_deleted_at is not null from public.voice_jobs where id=:'id'",
      { id: job.id },
    ),
    "t",
  );
  pass(
    "provider failure preserves acknowledged corrected text and cleanup works with the transcription gate off",
  );
  await admin.query("update eventops_private.voice_gate set enabled=true");
  job = await queue();
  await ownedRpc("discard_voice", { p_event_id: id, p_job_id: job.id });
  assert.equal(
    (
      await worker.query(
        "select eventops_worker_api.finish_voice($1,$2,$3,$4,null) accepted",
        [job.id, randomUUID(), "cancelled result", 1000],
      )
    ).rows[0].accepted,
    false,
  );
  await cleanupVoice(worker, store);
  assert.equal(
    sql("select reserved_usd from public.voice_jobs where id=:'id'", {
      id: job.id,
    }),
    "0.018000",
  );
  pass(
    "discard fences late completion and conservative reservations remain charged",
  );
  job = await queue();
  assert.deepEqual(Buffer.from(await store.read(job.object_key)), original);
  await store.remove(job.object_key);
  assert.equal(
    sql(
      "select count(*) from storage.objects where bucket_id='event-audio' and name=:'name'",
      { name: job.object_key },
    ),
    "1",
  );
  const cannotInsert = await fetch(
    env.API_URL + "/storage/v1/object/event-audio/" + job.object_key + "-extra",
    {
      method: "POST",
      headers: {
        apikey: env.PUBLISHABLE_KEY,
        Authorization: "Bearer " + workerToken,
        "Content-Type": "audio/webm",
      },
      body: original,
    },
  );
  assert.ok(cannotInsert.status >= 400);
  await cannotInsert.body?.cancel();
  await worker.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: "eventops_worker" }),
  ]);
  assert.equal(
    (
      await worker.query(
        "select count(*)::int n from storage.objects where bucket_id<>'event-audio'",
      )
    ).rows[0].n,
    0,
  );
  await ownedRpc("discard_voice", { p_event_id: id, p_job_id: job.id });
  await cleanupVoice(worker, store);
  assert.equal(
    sql(
      "select audio_deleted_at is not null from public.voice_jobs where id=:'id'",
      { id: job.id },
    ),
    "t",
  );
  pass(
    "dedicated worker Storage JWT reads registered audio, cannot insert, cannot delete retained audio, cannot read other buckets, and deletes due bytes",
  );
  job = await queue();
  const deletedByOwner = await one.request(
    `/api/events/${id}/voice/${job.id}`,
    undefined,
    "DELETE",
  );
  assert.equal(deletedByOwner.status, 200);
  assert.equal(deletedByOwner.body.audio_deleted, true);
  assert.equal(
    sql(
      "select audio_deleted_at is not null from public.voice_jobs where id=:'id'",
      { id: job.id },
    ),
    "t",
  );
  pass(
    "owner deletion immediately returns a verified receipt without waiting for a worker sweep",
  );
  job = await queue();
  const rollbackClaim = (
    await worker.query("select eventops_worker_api.claim_voice() job")
  ).rows[0].job;
  const draftsBefore = sql(
    "select count(*) from public.text_update_drafts where event_id=:'id'",
    { id },
  );
  const triggerName = "t6_rollback_" + randomUUID().replaceAll("-", "");
  try {
    await admin.query(
      `create function eventops_private.${triggerName}() returns trigger language plpgsql as $$ begin if new.event_id='${id}'::uuid and new.field_path='original_transcript' then raise exception 'synthetic rollback';end if;return new;end $$; create trigger ${triggerName} before insert on public.source_records for each row execute function eventops_private.${triggerName}();`,
    );
    await assert.rejects(
      () =>
        worker.query(
          "select eventops_worker_api.finish_voice($1,$2,$3,1000,null)",
          [job.id, rollbackClaim.lease_token, "Never acknowledged"],
        ),
      /synthetic rollback/,
    );
    assert.equal(
      sql(
        "select count(*) from public.text_update_drafts where event_id=:'id'",
        { id },
      ),
      draftsBefore,
    );
    assert.equal(
      sql("select state from public.voice_jobs where id=:'id'", { id: job.id }),
      "running",
    );
  } finally {
    await admin.query(
      `drop trigger if exists ${triggerName} on public.source_records;drop function if exists eventops_private.${triggerName}();`,
    );
  }
  await ownedRpc("discard_voice", { p_event_id: id, p_job_id: job.id });
  await cleanupVoice(worker, store);
  pass(
    "injected transcript source failure rolls back the draft, source and job completion together",
  );
  // All quota rows below are isolated synthetic fixtures and are removed even on failure.
  const quotaIds = [];
  try {
    const todayCount = Number(
      sql(
        "select count(*) from public.voice_jobs where workspace_id=:'w' and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date",
        { w: job.workspace_id },
      ),
    );
    const quota = await admin.query(
      "insert into public.voice_jobs(workspace_id,event_id,create_key,object_key,sha256,byte_length,mime,state) select $1::uuid,$2::uuid,gen_random_uuid(),$1::uuid::text||'/'||$2::uuid::text||'/'||gen_random_uuid()::text,$3,1,'audio/webm','discarded' from generate_series(1,$4) returning id",
      [job.workspace_id, id, job.sha256, Math.max(0, 20 - todayCount)],
    );
    quotaIds.push(...quota.rows.map((row) => row.id));
    const blocked = await rest(session, "rpc/begin_voice", {
      p_event_id: id,
      p_key: randomUUID(),
      p_sha256: job.sha256,
      p_bytes: 1,
      p_mime: "audio/webm",
    });
    assert.ok(blocked.status >= 400);
    assert.match(blocked.body, /Recording limit/);
    await admin.query(
      "delete from public.voice_jobs where id=any($1::uuid[])",
      [quotaIds],
    );
    quotaIds.length = 0;
    pass(
      "twenty recordings per workspace per UTC day is enforced in the owner transaction",
    );
    const countBefore = Number(sql("select count(*) from public.voice_jobs"));
    const simultaneous = await Promise.all(
      [0, 1].map(() =>
        rest(session, "rpc/begin_voice", {
          p_event_id: id,
          p_key: randomUUID(),
          p_sha256: job.sha256,
          p_bytes: 1,
          p_mime: "audio/webm",
        }),
      ),
    );
    assert.equal(
      simultaneous.filter((result) => result.status === 200).length,
      1,
    );
    assert.equal(
      Number(sql("select count(*) from public.voice_jobs")),
      countBefore + 1,
    );
    const activeJob = JSON.parse(
      simultaneous.find((result) => result.status === 200).body,
    );
    await ownedRpc("discard_voice", { p_event_id: id, p_job_id: activeJob.id });
    await cleanupVoice(worker, store);
    pass("concurrent upload attempts serialize to one active event recording");
    const budget = await admin.query(
      "insert into public.voice_jobs(workspace_id,event_id,create_key,object_key,sha256,byte_length,mime,state,created_at,delete_after,audio_deleted_at) select $1::uuid,$2::uuid,gen_random_uuid(),$1::uuid::text||'/'||$2::uuid::text||'/'||gen_random_uuid()::text,$3,1,'audio/webm','discarded',now()-interval '10 days',now()-interval '9 days',now() from generate_series(1,2800) returning id",
      [job.workspace_id, id, job.sha256],
    );
    quotaIds.push(...budget.rows.map((row) => row.id));
    const budgetBlocked = await rest(session, "rpc/begin_voice", {
      p_event_id: id,
      p_key: randomUUID(),
      p_sha256: job.sha256,
      p_bytes: 1,
      p_mime: "audio/webm",
    });
    assert.ok(budgetBlocked.status >= 400);
    assert.match(budgetBlocked.body, /Recording budget/);
    const analysisBudget = await admin.query(
      "select eventops_private.reserve_analysis(j,j.attempts+1) allowed from public.analysis_jobs j where j.id=$1",
      [confirmed.body.id],
    );
    assert.equal(analysisBudget.rows[0].allowed, false);
    pass(
      "audio and text share the locked USD 50 development allowance and fail closed at exhaustion",
    );
  } finally {
    if (quotaIds.length)
      await admin.query(
        "delete from public.voice_jobs where id=any($1::uuid[])",
        [quotaIds],
      );
  }
  writeFileSync(
    "/private/tmp/eventops-t6-browser.json",
    JSON.stringify({
      id,
      base,
      draft_id: draft.id,
      cookies: [...one.jar].map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      })),
    }),
    { mode: 0o600 },
  );
  console.log(
    `${checks} T6 local verification groups passed; no live provider calls.`,
  );
} finally {
  await admin.query("update eventops_private.voice_gate set enabled=false");
  await worker.end();
  await admin.query(`drop role ${login}`);
  await admin.end();
  rmSync(fixtures, { recursive: true, force: true });
}
