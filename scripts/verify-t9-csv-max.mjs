// Repeat the exact supported CSV maxima using an existing synthetic session only.
// No sign-in, code request, attestation, terms action, provider or new credential.
import "./register-app-modules.mjs";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const { fixtureSetup } = await import("../src/features/plans/fixtures.ts");
const { reviewImport } = await import("../src/features/imports/model.ts");
const origin = process.env.T9_APP_URL ?? "http://localhost:3005";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const state = JSON.parse(
  await readFile(
    process.env.T9_SYNTHETIC_STATE ??
      "/private/tmp/eventops-t4-browser-state.json",
    "utf8",
  ),
);
function pass(name) {
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
async function upload(client, files, generation = 1, eventId) {
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

const one = actor();
for (const cookie of state.cookies) {
  assert.equal(cookie.domain, "localhost");
  one.jar.set(cookie.name, cookie.value);
}
const owned = await one.request("/api/events");
assert.equal(
  owned.status,
  200,
  "Existing synthetic session is required; this harness never signs in",
);
async function verifyApprovedCollections(id) {
  const saved = await one.request(`/api/events/${id}/plan`);
  assert.equal(saved.status, 200);
  const revision = saved.body.approved_revision;
  assert.equal(revision.revision_number, 1);
  const counts = [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ].map((key) => revision.snapshot[key].length);
  assert.deepEqual(counts, [20, 100, 100, 1000, 500, 100]);
  console.log("PASS saved approved collection counts", JSON.stringify(counts));
}
if (process.env.T9_MAX_EVENT_ID) {
  assert.match(process.env.T9_MAX_EVENT_ID, /^[0-9a-f-]{36}$/);
  await verifyApprovedCollections(process.env.T9_MAX_EVENT_ID);
  process.exit(0);
}
const reusable = owned.body.events.find(
  (event) =>
    event.status === "draft" &&
    event.generation === 1 &&
    event.snapshot.name === "Synthetic T9 existing session maximum",
);
const maxEvent = reusable
  ? { status: 201, body: { event_id: reusable.event_id } }
  : await one.request("/api/events", {
      setup: { ...fixtureSetup, name: "Synthetic T9 existing session maximum" },
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
await verifyApprovedCollections(maxId);
