// Synthetic loopback release smoke and bounded read load, never a live provider probe.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

const origin = process.env.T9_APP_URL ?? "http://localhost:3005";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const status = JSON.parse(
  await readFile(
    process.env.T9_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
    "utf8",
  ),
);
const config = status.env ?? status;
assert.match(
  config.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
const database = new pg.Client({ connectionString: config.DB_URL });
await database.connect();
async function gatesDisabled() {
  const { rows } = await database.query(
    "select (select enabled from eventops_private.analysis_budget_lock) as analysis, (select enabled from eventops_private.voice_gate) as voice",
  );
  assert.equal(rows[0].analysis, false);
  assert.equal(rows[0].voice, false);
}
try {
  await gatesDisabled();
  for (const [path, expected] of [
    ["/api/health", 200],
    ["/api/ready", 200],
    ["/api/events", 401],
    ["/api/workspace/export", 401],
    ["/internal/foundation", 404],
    ["/internal/recovery", 404],
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, expected, path);
  }
  const fixture = JSON.parse(
    await readFile("/private/tmp/eventops-t4-browser-fixture.json", "utf8"),
  );
  const state = JSON.parse(
    await readFile(
      process.env.T9_SYNTHETIC_STATE ??
        "/private/tmp/eventops-t4-browser-state.json",
      "utf8",
    ),
  );
  const cookie = state.cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const latencies = [];
  const started = performance.now();
  // Five simultaneous readers, twenty requests each, no private bodies logged.
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let index = 0; index < 20; index++) {
        const before = performance.now();
        const response = await fetch(
          `${origin}/api/events/${fixture.id}/plan`,
          {
            headers: { Cookie: cookie },
          },
        );
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
        const body = await response.json();
        assert.ok(body);
        latencies.push(performance.now() - before);
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      requests: latencies.length,
      concurrency: 5,
      elapsed_ms: Math.round(performance.now() - started),
      p50_ms: Math.round(latencies[49]),
      p95_ms: Math.round(latencies[94]),
      max_ms: Math.round(latencies[99]),
      scope: "synthetic loopback approved plan reads only",
    }),
  );
  console.log(
    "PASS release smoke, private read load and disabled database gates",
  );
} finally {
  try {
    await gatesDisabled();
  } finally {
    await database.end();
  }
}
