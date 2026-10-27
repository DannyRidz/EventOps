// Real local services only. Never points at a hosted account or sends external mail.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const origin = process.env.T2_APP_URL ?? "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const local = JSON.parse(
  await readFile(
    process.env.T2_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
    "utf8",
  ),
);
const env = local.env ?? local;
assert.match(env.API_URL, /^http:\/\/127\.0\.0\.1:\d+$/);
const checks = [];
function pass(name) {
  checks.push(name);
  console.log("PASS", name);
}
function actor() {
  const jar = new Map();
  return {
    jar,
    async request(path, body, method = body ? "POST" : "GET") {
      const result = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const cookie of result.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const split = pair.indexOf("=");
        jar.set(pair.slice(0, split), pair.slice(split + 1));
        assert.match(cookie, /HttpOnly/i);
      }
      assert.match(result.headers.get("cache-control") ?? "", /no-store/);
      return { status: result.status, body: await result.json() };
    },
  };
}
async function mailCode(email) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const messages = await (
      await fetch(env.MAILPIT_URL + "/api/v1/messages")
    ).json();
    const message = messages.messages.find((m) =>
      m.To.some((to) => to.Address === email),
    );
    if (message) {
      const detail = await (
        await fetch(env.MAILPIT_URL + "/api/v1/message/" + message.ID)
      ).json();
      const code = detail.Text.match(/code is (\d{6})/);
      assert.ok(code, "Actual delivered mail must contain a six digit code");
      return code[1];
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("No local email delivered");
}
async function signIn(client, label) {
  const email = `t2-${label}-${randomUUID()}@example.test`;
  assert.equal(
    (await client.request("/api/auth/code", { email, attested: true })).status,
    200,
  );
  const code = await mailCode(email);
  const rate = await client.request("/api/auth/code", {
    email,
    attested: true,
  });
  assert.equal(rate.status, 429);
  const invalid = await client.request("/api/auth/verify", {
    email,
    code: "000000",
    attested: true,
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    (await client.request("/api/auth/verify", { email, code, attested: true }))
      .status,
    200,
  );
  assert.equal(
    (await client.request("/api/auth/verify", { email, code, attested: true }))
      .status,
    400,
  );
  return email;
}
const one = actor(),
  two = actor(),
  guest = actor();
assert.equal((await guest.request("/api/events")).status, 401);
pass("unauthenticated private API denied");
await signIn(one, "owner-a");
await signIn(two, "owner-b");
pass(
  "two real email code sign ins, wrong code and code reuse rejected, HttpOnly cookies",
);
pass("server enforces resend cooldown before verification");
const [workspaceA, workspaceB] = await Promise.all([
  one.request("/api/workspace/bootstrap", { attested: true }),
  one.request("/api/workspace/bootstrap", { attested: true }),
]);
assert.equal(workspaceA.body.workspace_id, workspaceB.body.workspace_id);
pass("concurrent workspace bootstrap is idempotent");
const setup = {
  name: "Synthetic operations day",
  date: "2026-11-02",
  timezone: "Asia/Brunei",
  start: "09:00",
  end: "17:00",
  locations: ["Main hall", "Workshop room"],
};
const create = { setup, request_id: randomUUID() };
const [created, replayed] = await Promise.all([
  one.request("/api/events", create),
  one.request("/api/events", create),
]);
assert.equal(created.status, 201);
assert.equal(created.body.event_id, replayed.body.event_id);
const id = created.body.event_id;
pass("concurrent event create is idempotent");
let read = await one.request(`/api/events/${id}/plan`);
assert.equal(read.status, 200);
assert.equal(read.body.approved_revision, null);
assert.equal(read.body.draft.snapshot.name, setup.name);
assert.equal(read.body.draft.generation, 1);
pass("authenticated persisted setup read is explicitly a draft");
assert.equal((await two.request(`/api/events/${id}/plan`)).status, 404);
assert.equal(
  (
    await two.request(
      `/api/events/${id}/draft`,
      { ...create, expected_generation: 1 },
      "PUT",
    )
  ).status,
  404,
);
assert.equal((await two.request("/api/events")).body.events.length, 0);
pass("second owner cannot list, read or alter first owner's event");
const changed = {
  ...create,
  setup: { ...setup, name: "Revised synthetic day" },
  expected_generation: 1,
};
const race = await Promise.all([
  one.request(`/api/events/${id}/draft`, changed, "PUT"),
  one.request(`/api/events/${id}/draft`, changed, "PUT"),
]);
assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
assert.equal(
  (await one.request(`/api/events/${id}/plan`)).body.draft.generation,
  2,
);
pass("concurrent edits preserve one winner and reject stale generation");
assert.equal((await one.request("/api/events", create)).body.event_id, id);
pass("original create receipt survives later draft edits");
const rawCookie = [...one.jar]
  .filter(([key]) => /auth-token(?:\.\d+)?$/.test(key))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, value]) => decodeURIComponent(value))
  .join("");
const session = JSON.parse(
  Buffer.from(rawCookie.slice(7), "base64url").toString(),
);
async function rest(path, body, method = "POST", token = session.access_token) {
  const r = await fetch(env.API_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: env.PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.text() };
}
const snapshot = read.body.draft.snapshot;
for (const key of [
  "name",
  "date",
  "timezone",
  "start",
  "end",
  "starts_at",
  "ends_at",
  "locations",
  "start_offset",
  "end_offset",
]) {
  const bad = await rest("rpc/save_event", {
    p_snapshot: { ...snapshot, [key]: null },
    p_request_id: randomUUID(),
  });
  assert.ok(bad.status >= 400, `${key} null rejected`);
}
pass("direct authenticated RPC rejects null snapshot fields");
for (const change of [
  { start_offset: {} },
  { start_offset: "-04:00" },
  { start_offset: undefined },
]) {
  const bad = await rest("rpc/save_event", {
    p_snapshot: { ...snapshot, ...change },
    p_request_id: randomUUID(),
  });
  assert.ok(bad.status >= 400);
}
pass("database rejects missing, malformed and mismatched UTC offsets");
const direct = await rest("events", {
  workspace_id: workspaceA.body.workspace_id,
  name: "forged",
  request_id: randomUUID(),
});
assert.ok(direct.status >= 400);
pass("direct table writes denied");
const rawOther = [...two.jar]
  .filter(([key]) => /auth-token(?:\.\d+)?$/.test(key))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, value]) => decodeURIComponent(value))
  .join("");
const otherSession = JSON.parse(
  Buffer.from(rawOther.slice(7), "base64url").toString(),
);
const rls = await rest(
  `plan_drafts?event_id=eq.${id}`,
  undefined,
  "GET",
  otherSession.access_token,
);
assert.equal(rls.status, 200);
assert.deepEqual(JSON.parse(rls.body), []);
pass("database row policy hides cross-owner records independently of app");
const badInterval = await one.request("/api/events", {
  request_id: randomUUID(),
  setup: {
    ...setup,
    date: "2026-11-01",
    timezone: "America/New_York",
    start: "01:15",
    end: "01:30",
    start_offset: "-05:00",
    end_offset: "-04:00",
  },
});
assert.equal(badInterval.status, 422);
pass("reversed UTC interval returns actionable validation error");
const quota = await Promise.all(
  Array.from({ length: 11 }, (_, index) =>
    one.request("/api/events", {
      setup: { ...setup, name: `Synthetic quota ${index}` },
      request_id: randomUUID(),
    }),
  ),
);
assert.equal(quota.filter((r) => r.status === 201).length, 9);
assert.equal(quota.filter((r) => r.status === 409).length, 2);
pass("concurrent creates cannot exceed ten event quota");
const signUp = await fetch(env.API_URL + "/auth/v1/signup", {
  method: "POST",
  headers: { apikey: env.PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: `t2-unverified-${randomUUID()}@example.test`,
    password: randomUUID() + "!",
  }),
});
const unsigned = await signUp.json();
assert.ok(!unsigned.access_token);
pass("direct password signup cannot create a verified session");
const csrf = await fetch(origin + "/api/events", {
  method: "POST",
  headers: {
    Origin: "https://foreign.test",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(create),
});
assert.equal(csrf.status, 403);
pass("foreign mutation origin denied");
assert.equal((await one.request("/api/auth/sign-out", {})).status, 200);
assert.equal((await one.request("/api/events")).status, 401);
pass("sign out removes browser access");
const expiryActor = actor(),
  expiryEmail = `t2-expiry-${randomUUID()}@example.test`;
assert.equal(
  (
    await expiryActor.request("/api/auth/code", {
      email: expiryEmail,
      attested: true,
    })
  ).status,
  200,
);
const expiryCode = await mailCode(expiryEmail);
assert.match(
  env.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
// Only this synthetic user's sent timestamp moves; the verifier remains real GoTrue.
execFileSync(
  process.env.T2_PSQL ?? "psql",
  [env.DB_URL, "-v", "ON_ERROR_STOP=1", "--set", `email=${expiryEmail}`],
  {
    input:
      "update auth.users set confirmation_sent_at=now()-interval '11 minutes' where email=:'email';",
    stdio: ["pipe", "ignore", "pipe"],
  },
);
assert.equal(
  (
    await expiryActor.request("/api/auth/verify", {
      email: expiryEmail,
      code: expiryCode,
      attested: true,
    })
  ).status,
  400,
);
pass("actual Auth verifier rejects an expired delivered code");
console.log(`${checks.length} live service checks passed.`);
