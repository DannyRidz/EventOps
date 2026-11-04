// Controlled fixture: prove SQL budget/rate history survives close and resume.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { databaseLab } from "./lib/t9-database.mjs";
const { seedLiveFixture } = await import("./lib/t9-live-fixture.mjs");
assert.equal(process.argv.length, 2);
globalThis.fetch = async () => {
  throw new Error("NETWORK_DISABLED");
};
const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8")),
  c = corpus.cases.find((c) => c.case_id === "E02");
const name = "eventops_t9_campaign_test_" + randomUUID().replaceAll("-", "");
const identity = "a".repeat(64);
const options = {
  campaignIdentity: identity,
  campaignTestName: name,
  profileExport: process.env.T9_PROFILE_EXPORT,
};
let lab;
try {
  await assert.rejects(
    () => databaseLab({ ...options, requireExistingCampaign: true }),
    /Retained SQL campaign state is missing/,
  );
  lab = await databaseLab(options);
  await assert.rejects(
    () => databaseLab(options),
    /Campaign already has an operator/,
  );
  const first = await seedLiveFixture(lab, c);
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=true",
  );
  await first.one("select public.queue_analysis_job($1,$2) value", [
    first.event,
    first.job.id,
  ]);
  await lab.db.query(
    "update public.analysis_jobs set state='failed' where id=$1",
    [first.job.id],
  );
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=false",
  );
  await first.one(
    "select public.change_event_lifecycle($1,1,'archive') value",
    [first.event],
  );
  await lab.saveState({
    slots: {
      first: { event: first.event, job: first.job.id, phase: "prepared" },
    },
  });
  await lab.close();
  lab = undefined;
  await assert.rejects(
    () => databaseLab({ ...options, campaignIdentity: "b".repeat(64) }),
    /Retained campaign input changed/,
  );
  lab = await databaseLab(options);
  assert.equal((await lab.loadState()).slots.first.job, first.job.id);
  assert.equal(
    (await lab.db.query("select count(*)::int n from public.model_runs"))
      .rows[0].n,
    1,
  );
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=true",
  );
  for (let i = 1; i < 10; i++) {
    const s = await seedLiveFixture(lab, c);
    await s.one("select public.queue_analysis_job($1,$2) value", [
      s.event,
      s.job.id,
    ]);
    await lab.db.query(
      "update public.analysis_jobs set state='failed' where id=$1",
      [s.job.id],
    );
    await s.one("select public.change_event_lifecycle($1,1,'archive') value", [
      s.event,
    ]);
  }
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=false",
  );
  await lab.close();
  lab = undefined;
  lab = await databaseLab(options);
  const next = await seedLiveFixture(lab, c);
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=true",
  );
  await assert.rejects(
    () =>
      next.one("select public.queue_analysis_job($1,$2) value", [
        next.event,
        next.job.id,
      ]),
    /Analysis budget or rate limit/,
  );
  assert.equal(
    (await lab.db.query("select count(*)::int n from public.model_runs"))
      .rows[0].n,
    10,
  );
  console.log(
    "PASS retained state, operator lock, identity drift denial and ten-per-hour quota survive two restarts; no provider calls",
  );
} finally {
  if (lab) {
    await lab.db.query(
      "update eventops_private.analysis_budget_lock set enabled=false;update eventops_private.voice_gate set enabled=false",
    );
    await lab.close();
  }
  const status = JSON.parse(
    await readFile("/private/tmp/eventops-local-status.json", "utf8"),
  );
  const admin = new pg.Client({
    connectionString: (status.env ?? status).DB_URL,
  });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${name} with (force)`);
  } finally {
    await admin.end();
  }
}
