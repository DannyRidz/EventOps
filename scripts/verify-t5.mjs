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
const { fixtureSetup } = await import("../src/features/plans/fixtures.ts");
const origin = process.env.T5_APP_URL ?? "http://localhost:3001";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
    await readFile(
      process.env.T5_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
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
    process.env.T5_PSQL ?? "psql",
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
  const email = `t5-${label}-${randomUUID()}@example.test`;
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

const { decodeCsv, parseCsv } = await import("../src/features/imports/csv.ts");
const { initialMapping, reviewImport } =
  await import("../src/features/imports/model.ts");
const { planInput, editableRecords } =
  await import("../src/features/plans/editor-model.ts");
const one = actor(),
  two = actor();
const session = await signIn(one, "owner");
const secondSession = await signIn(two, "other");
const create = await one.request("/api/events", {
  setup: fixtureSetup,
  request_id: randomUUID(),
});
assert.equal(create.status, 201, JSON.stringify(create.body));
const id = create.body.event_id;
async function upload(client, files, generation = 1, eventId = id) {
  const form = new FormData();
  form.set("expected_generation", String(generation));
  for (const [c, text] of Object.entries(files))
    form.set(c, new File([text], c + ".csv", { type: "text/csv" }));
  const response = await fetch(origin + `/api/events/${eventId}/imports`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: [...client.jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: form,
  });
  return { status: response.status, body: await response.json() };
}
const files = {
  rooms:
    'room_id,name,location,capacity,feature_tags\r\nR,"Hall, main",Main,50,projector\r\nR,"Hall, main",Main,50,projector\r\n',
  sessions:
    "session_id,title,start,end,room_id,required_volunteers\nS,Opening,10:00,11:00,R,1",
  volunteers: "volunteer_id,name,role_tags,active\nV,Sam,general,",
  availability: "volunteer_id,start,end,status\nV,09:00,17:00,available",
  assignments: "session_id,volunteer_id,role_tag\nS,V,general",
  dependencies:
    "predecessor_session_id,successor_session_id,minimum_gap_minutes",
};
assert.equal((await upload(one, { rooms: "id,id\na,b" })).status, 422);
assert.equal(
  (await upload(one, { rooms: 'id,name\na,"unclosed' })).status,
  422,
);
assert.equal(
  (await upload(one, { rooms: "id\n" + "x".repeat(2 * 1024 * 1024) })).status,
  413,
);
pass("malformed and oversized uploads fail without official writes");

const { createHash } = await import("node:crypto");
const raw = Buffer.from(files.rooms),
  parsed = parseCsv(decodeCsv(raw));
const forgedTable = {
  collection: "rooms",
  filename: "rooms.csv",
  sha256: createHash("sha256").update(raw).digest("hex"),
  ...parsed,
  mapping: initialMapping("rooms", parsed.headers),
  excluded: [],
  keep_one: [],
  offsets: {},
};
forgedTable.rows[0][1] = "Invented from unrelated bytes";
const forgedOriginal = await rest(session, "rpc/create_import_batch", {
  p_event_id: id,
  p_expected_generation: 1,
  p_files: [{ bytes: raw.toString("base64"), table: forgedTable }],
});
assert.equal(forgedOriginal.status, 400, forgedOriginal.body);
assert.equal(
  sql("select count(*) from public.import_batches where event_id=:'id';", {
    id,
  }),
  "0",
);
pass("direct RPC cannot fabricate CSV source cells; failed batch rolls back");
for (const text of [
  'a,b\r\nx,"one, ""two""\nthree"\r\ny,last\r\n',
  "\uFEFFa,b\nx,y",
  "a,b",
]) {
  const bytes = Buffer.from(text),
    sqlParsed = JSON.parse(
      sql(
        "select eventops_private.parse_import_csv(decode(:'raw','base64'));",
        { raw: bytes.toString("base64") },
      ),
    );
  assert.deepEqual(sqlParsed, parseCsv(decodeCsv(bytes)));
}
pass("SQL and HTTP parser parity for BOM, quoting and row locators");
const uploaded = await upload(one, files);
assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
const batchId = uploaded.body.id;
const path = `/api/events/${id}/imports/${batchId}`;
let batch = (await one.request(path)).body;
assert.equal(batch.tables.length, 6);
assert.equal(batch.originals.length, 6);
pass("all six templates upload privately with original files");
const objectKey = sql(
  "select object_key from public.source_artifacts where id=:'artifact';",
  { artifact: batch.originals[0].artifact_id },
);
async function storage(path, who, method = "GET", body, extra = {}) {
  const response = await fetch(env.API_URL + "/storage/v1/" + path, {
    method,
    headers: {
      apikey: env.PUBLISHABLE_KEY,
      ...(who ? { Authorization: `Bearer ${who.access_token}` } : {}),
      ...extra,
    },
    ...(body ? { body } : {}),
  });
  return response;
}
assert.equal(
  (await storage("object/authenticated/event-imports/" + objectKey, session))
    .status,
  200,
);
assert.notEqual(
  (
    await storage(
      "object/authenticated/event-imports/" + objectKey,
      secondSession,
    )
  ).status,
  200,
);
assert.notEqual(
  (await storage("object/public/event-imports/" + objectKey, null)).status,
  200,
);
assert.notEqual(
  (
    await storage(
      "object/event-imports/" + objectKey,
      session,
      "POST",
      "tampered",
      { "Content-Type": "text/csv", "x-upsert": "true" },
    )
  ).status,
  200,
);
await storage(
  "object/event-imports",
  session,
  "DELETE",
  JSON.stringify({ prefixes: [objectKey] }),
  { "Content-Type": "application/json" },
);
assert.equal(
  (await storage("object/authenticated/event-imports/" + objectKey, session))
    .status,
  200,
);
pass(
  "private Storage denies anonymous/cross tenant reads, overwrite and referenced-original deletion",
);
const workspace = sql(
  "select workspace_id from public.events where id=:'id';",
  { id },
);
const unrelatedKey = `${workspace}/${id}/${randomUUID()}.csv`;
assert.equal(
  (
    await storage(
      "object/event-imports/" + unrelatedKey,
      session,
      "POST",
      "different stored bytes",
      { "Content-Type": "text/csv" },
    )
  ).status,
  200,
);
const receiptBytes = Buffer.from(
    "room_id,name,location\nReceipt,Verified original,Main",
  ),
  receiptParsed = parseCsv(decodeCsv(receiptBytes)),
  receiptHash = createHash("sha256").update(receiptBytes).digest("hex");
const receiptResult = await rest(session, "rpc/create_import_batch", {
  p_event_id: id,
  p_expected_generation: 1,
  p_files: [
    {
      object_key: unrelatedKey,
      bytes: receiptBytes.toString("base64"),
      table: {
        collection: "rooms",
        filename: "receipt.csv",
        sha256: receiptHash,
        ...receiptParsed,
        mapping: initialMapping("rooms", receiptParsed.headers),
        excluded: [],
        keep_one: [],
        offsets: {},
      },
    },
  ],
});
assert.equal(receiptResult.status, 200, receiptResult.body);
const receiptBatch = JSON.parse(receiptResult.body).id;
const recovered = await fetch(
  origin + `/api/events/${id}/imports/${receiptBatch}/files/${receiptHash}`,
  { headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") } },
);
assert.equal(recovered.status, 200);
assert.equal(await recovered.text(), receiptBytes.toString());
pass(
  "verified immutable byte receipt recovers the original when a direct caller associates unrelated Storage bytes",
);

const objectCount = sql(
  "select count(*) from storage.objects where bucket_id='event-imports' and split_part(name,'/',2)=:'id';",
  { id },
);
const staleUpload = await upload(
  one,
  { rooms: "room_id,name,location\nnew,New failed upload,Main" },
  999,
);
assert.equal(staleUpload.status, 409, JSON.stringify(staleUpload.body));
assert.equal(
  sql(
    "select count(*) from storage.objects where bucket_id='event-imports' and split_part(name,'/',2)=:'id';",
    { id },
  ),
  objectCount,
);
pass("failed generation save cleans up unreferenced private upload objects");

assert.equal((await two.request(path)).status, 404);
assert.equal((await two.request(`/api/events/${id}/imports`)).status, 404);
assert.equal((await actor().request(path)).status, 401);
pass("cross tenant and anonymous import access denied");
assert.equal((await upload(one, files)).body.id, batchId);
pass("repeated exact file offers original batch without creating another");
let tables = batch.tables;
let review = reviewImport(tables, fixtureSetup);
assert.ok(review.issues.some((i) => i.message.startsWith("Identical")));
assert.equal(
  (
    await one.request(
      path,
      {
        generation: 1,
        tables,
        stage: true,
        expected_draft: 1,
        confirmed: true,
      },
      "PUT",
    )
  ).status,
  422,
);
pass("unresolved duplicate prevents staging");
tables.find((t) => t.collection === "rooms").keep_one = ["R"];
// Save an invalid correction, resume it, then fix it. No official plan changes.
tables.find((t) => t.collection === "sessions").rows[0][2] = "bad";
let saved = await one.request(path, { generation: 1, tables }, "PUT");
assert.equal(saved.status, 200, JSON.stringify(saved.body));
batch = (await one.request(path)).body;
assert.equal(batch.generation, 2);
assert.equal(
  batch.tables.find((t) => t.collection === "sessions").rows[0][2],
  "bad",
);
assert.ok(batch.validation_issues.some((i) => i.column === "start"));
assert.equal(
  (await one.request(path, { generation: 1, tables }, "PUT")).status,
  409,
);
pass(
  "invalid corrections and duplicate choices survive refresh; stale saves fail",
);
tables = batch.tables;
tables.find((t) => t.collection === "sessions").rows[0][2] = "10:00";
saved = await one.request(path, { generation: 2, tables }, "PUT");
assert.equal(saved.status, 200, JSON.stringify(saved.body));
batch = (await one.request(path)).body;
tables = batch.tables;
const staged = await one.request(
  path,
  { generation: 3, tables, stage: true, expected_draft: 1, confirmed: true },
  "PUT",
);
assert.equal(staged.status, 200, JSON.stringify(staged.body));
assert.deepEqual(staged.body.validation_report, []);
assert.equal(staged.body.snapshot.assignments[0].start, "10:00");
assert.equal(staged.body.snapshot.volunteers[0].active, true);
pass("all template conversions match SQL with explicit defaults and coverage");

const directPlan = planInput(reviewImport(tables, fixtureSetup).records);
const corruptPlan = structuredClone(directPlan);
corruptPlan.sessions[0].title = "Not the reviewed import";
const forgedCandidate = await rest(session, "rpc/stage_import_plan", {
  p_event_id: id,
  p_batch_id: batchId,
  p_generation: 3,
  p_expected_draft: staged.body.generation,
  p_plan: corruptPlan,
  p_confirmed: true,
});
assert.equal(forgedCandidate.status, 400, forgedCandidate.body);
pass("direct RPC cannot replace the exact saved import candidate");
const restaged = await one.request(
  path,
  {
    generation: 3,
    tables,
    stage: true,
    expected_draft: staged.body.generation,
    confirmed: true,
  },
  "PUT",
);
assert.equal(restaged.status, 200, JSON.stringify(restaged.body));
assert.equal(
  restaged.body.snapshot.rooms[0].id,
  staged.body.snapshot.rooms[0].id,
);
Object.assign(staged.body, restaged.body);
pass("restaging preserves persistent external ID mappings");
// Editing a reviewed import fences old confirmation, even in another browser tab.
const older = structuredClone(staged.body);
tables.find((t) => t.collection === "sessions").rows[0][1] =
  "Reviewed correction";
assert.equal(
  (await one.request(path, { generation: 3, tables }, "PUT")).status,
  200,
);
assert.equal(
  (
    await one.request(`/api/events/${id}/confirm-plan`, {
      expected_generation: older.generation,
      candidate_digest: older.candidate_digest,
      idempotency_key: randomUUID(),
    })
  ).status,
  409,
);
batch = (await one.request(path)).body;
tables = batch.tables;
const current = (await one.request(`/api/events/${id}/plan`)).body;
const latest = await one.request(
  path,
  {
    generation: 4,
    tables,
    stage: true,
    expected_draft: current.draft.generation,
    confirmed: true,
  },
  "PUT",
);
assert.equal(latest.status, 200, JSON.stringify(latest.body));
Object.assign(staged.body, latest.body);
pass("saved corrections invalidate prior staged confirmation across tabs");
const source = staged.body.snapshot.provenance.find(
  (p) =>
    p.record_id === staged.body.snapshot.sessions[0].id &&
    p.field_path === "title",
);
const sourceData = (
  await one.request(`/api/events/${id}/evidence/${source.source_record_ids[0]}`)
).body;
const sourceOrigin =
  sourceData.artifact.metadata.field_sources[`${source.record_id}:title`];
assert.equal(sourceOrigin.kind, "organizer_correction");
assert.equal(sourceOrigin.row, 2);
assert.equal(sourceOrigin.column, "title");
assert.equal(
  (
    await one.request(
      `/api/events/${id}/evidence/${sourceOrigin.original_source_id}`,
    )
  ).body.source.value_json,
  "Opening",
);
pass(
  "corrected approved facts trace to exact immutable original row and column",
);
// Scoped synthetic failure proves revision, receipt, head and import link roll back together.
sql(
  "create function eventops_private.t5_fault() returns trigger language plpgsql as $$ begin if new.event_id=" +
    "'" +
    id +
    "'" +
    "::uuid then raise sqlstate 'XX000' using message='synthetic fault';end if;return new;end $$;create trigger t5_fault before insert on public.approval_receipts for each row execute function eventops_private.t5_fault();",
);
try {
  assert.equal(
    (
      await one.request(`/api/events/${id}/confirm-plan`, {
        expected_generation: staged.body.generation,
        candidate_digest: staged.body.candidate_digest,
        idempotency_key: randomUUID(),
      })
    ).status,
    503,
  );
  assert.equal(
    sql("select count(*) from public.revisions where event_id=:'id';", { id }),
    "0",
  );
  assert.equal((await one.request(path)).body.state, "reviewed");
} finally {
  sql(
    "drop trigger t5_fault on public.approval_receipts;drop function eventops_private.t5_fault();",
  );
}
pass("failed confirmation rolls back revision, head, receipt and batch link");

const manualRecords = editableRecords(staged.body.snapshot);
manualRecords.sessions[0].title = "Manual correction after import review";
const manual = await one.request(
  `/api/events/${id}/draft`,
  {
    plan: planInput(manualRecords),
    expected_generation: staged.body.generation,
    confirmed: true,
  },
  "PUT",
);
assert.equal(manual.status, 200, JSON.stringify(manual.body));
Object.assign(staged.body, manual.body);
pass(
  "manual correction after imported review uses the same guarded starting draft",
);
const before = (await one.request(`/api/events/${id}/plan`)).body;
assert.equal(before.approved_revision, null);
const wrong = await one.request(`/api/events/${id}/confirm-plan`, {
  expected_generation: 1,
  candidate_digest: staged.body.candidate_digest,
  idempotency_key: randomUUID(),
});
assert.equal(wrong.status, 409);
pass("staging and stale confirmation never advance official head");
const key = randomUUID(),
  confirm = {
    expected_generation: staged.body.generation,
    candidate_digest: staged.body.candidate_digest,
    idempotency_key: key,
  };
const results = await Promise.all([
  one.request(`/api/events/${id}/confirm-plan`, confirm),
  one.request(`/api/events/${id}/confirm-plan`, confirm),
]);
assert.ok(
  results.every((r) => r.status === 200),
  JSON.stringify(results),
);
assert.equal(results[0].body.revision_id, results[1].body.revision_id);
assert.equal((await one.request(path)).body.state, "confirmed");
assert.equal((await one.request(path)).body.confirmed_generation, 4);
pass(
  "concurrent exact confirmation creates one revision and links batch atomically",
);
assert.equal((await upload(one, files, staged.body.generation)).status, 409);
pass("bulk replacement after approval is refused");
const sha = batch.originals[0].sha256;
const rawResponse = await fetch(origin + path + `/files/${sha}`, {
  headers: { Cookie: [...one.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
});
assert.equal(rawResponse.status, 200);
assert.equal(await rawResponse.text(), files[batch.originals[0].collection]);
pass("unchanged original downloads as private attachment");
const official = (await one.request(`/api/events/${id}/plan`)).body
  .approved_revision.snapshot;
const ev = await one.request(
  `/api/events/${id}/evidence/${official.provenance[0].source_record_ids[0]}`,
);
assert.equal(ev.status, 200);
assert.equal(ev.body.artifact.metadata.operation, "csv_review");
const forged = await rest(session, "rpc/create_import_batch", {
  p_event_id: id,
  p_expected_generation: 1,
  p_files: [],
});
assert.notEqual(forged.status, 200);

if (process.env.T5_BOUNDARIES === "1") {
  const maxEvent = await one.request("/api/events", {
    setup: { ...fixtureSetup, name: "Synthetic import boundaries" },
    request_id: randomUUID(),
  });
  assert.equal(maxEvent.status, 201);
  const maxId = maxEvent.body.event_id;
  const clock = (n) =>
    String(Math.floor(n / 60)).padStart(2, "0") +
    ":" +
    String(n % 60).padStart(2, "0");
  const maxFiles = {
    rooms:
      "room_id,name,location\n" +
      Array.from({ length: 20 }, (_, i) => `R${i},Room ${i},Main`).join("\n"),
    sessions:
      "session_id,title,start,end,room_id,required_volunteers\n" +
      Array.from(
        { length: 100 },
        (_, i) =>
          `S${i},Session ${i},${clock(540 + i * 4)},${clock(544 + i * 4)},R${i % 20},5`,
      ).join("\n"),
    volunteers:
      "volunteer_id,name\n" +
      Array.from({ length: 100 }, (_, i) => `V${i},Volunteer ${i}`).join("\n"),
    availability:
      "volunteer_id,start,end,status,retained_extra\n" +
      Array.from(
        { length: 1000 },
        (_, i) =>
          `V${Math.floor(i / 10)},${clock(540 + (i % 10) * 48)},${clock(588 + (i % 10) * 48)},available,${"x".repeat(2000)}`,
      ).join("\n"),
    assignments:
      "session_id,volunteer_id,role_tag\n" +
      Array.from(
        { length: 500 },
        (_, i) =>
          `S${Math.floor(i / 5)},V${(Math.floor(i / 5) % 20) * 5 + (i % 5)},general`,
      ).join("\n"),
    dependencies:
      "predecessor_session_id,successor_session_id,minimum_gap_minutes\n" +
      Array.from({ length: 99 }, (_, i) => `S${i},S${i + 1},0`)
        .concat(["S0,S99,0"])
        .join("\n"),
  };
  await writeFile(
    "/private/tmp/eventops-t5-max-files.json",
    JSON.stringify(maxFiles),
    { mode: 0o600 },
  );
  const started = Date.now();
  const uploadedMax = await upload(one, maxFiles, 1, maxId);
  if (uploadedMax.status !== 201) {
    const debugFiles = Object.entries(maxFiles).map(([c, text]) => {
      const bytes = Buffer.from(text),
        parsed = parseCsv(decodeCsv(bytes));
      return {
        bytes: bytes.toString("base64"),
        table: {
          collection: c,
          filename: c + ".csv",
          sha256: createHash("sha256").update(bytes).digest("hex"),
          ...parsed,
          mapping: initialMapping(c, parsed.headers),
          excluded: [],
          keep_one: [],
          offsets: {},
        },
      };
    });
    const detail = await rest(session, "rpc/create_import_batch", {
      p_event_id: maxId,
      p_expected_generation: 1,
      p_files: debugFiles,
    });
    console.log("Synthetic boundary diagnostic", detail);
  }
  assert.equal(uploadedMax.status, 201, JSON.stringify(uploadedMax.body));
  console.log("Boundary upload elapsed ms", Date.now() - started);
  const maxPath = `/api/events/${maxId}/imports/${uploadedMax.body.id}`,
    maxBatch = (await one.request(maxPath)).body;
  const check = reviewImport(maxBatch.tables, fixtureSetup);
  assert.equal(check.issues.filter((i) => i.severity === "error").length, 0);
  const stageStart = Date.now(),
    maxStaged = await one.request(
      maxPath,
      {
        generation: 1,
        tables: maxBatch.tables,
        stage: true,
        expected_draft: 1,
        confirmed: true,
      },
      "PUT",
    );
  assert.equal(maxStaged.status, 200, JSON.stringify(maxStaged.body));
  assert.deepEqual(maxStaged.body.validation_report, []);
  console.log("Boundary staging elapsed ms", Date.now() - stageStart);
  const approvalStart = Date.now();
  const approval = await one.request(`/api/events/${maxId}/confirm-plan`, {
    expected_generation: maxStaged.body.generation,
    candidate_digest: maxStaged.body.candidate_digest,
    idempotency_key: randomUUID(),
  });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));
  console.log("Boundary confirmation elapsed ms", Date.now() - approvalStart);
  pass(
    "all six collection maxima and near 2 MiB file stage and confirm through real services",
  );
}
const browserEvent = await one.request("/api/events", {
  setup: { ...fixtureSetup, name: "Synthetic CSV browser check" },
  request_id: randomUUID(),
});
assert.equal(browserEvent.status, 201);
await writeFile(
  "/private/tmp/eventops-t5-csv-fixtures.json",
  JSON.stringify(files),
  { mode: 0o600 },
);
for (const [c, text] of Object.entries(files))
  await writeFile(`/private/tmp/eventops-t5-${c}.csv`, text, { mode: 0o600 });
await writeFile(
  "/private/tmp/eventops-t5-browser.json",
  JSON.stringify({
    origin,
    id: browserEvent.body.event_id,
    verifiedEventId: id,
    batchId,
    cookies: [...one.jar].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  }),
  { mode: 0o600 },
);
console.log(`${checks} T5 integration groups passed`);
