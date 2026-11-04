// Controlled isolated SQL checks. No sign-in, provider access or quota reset.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { databaseLab } from "./lib/t9-database.mjs";
const { seedLiveFixture } = await import("./lib/t9-live-fixture.mjs");
const { PROMPT_VERSION } =
  await import("../src/features/analysis/contracts.ts");
const { runOne } = await import("../src/features/analysis/worker.ts");
assert.equal(process.argv.length, 2, "No live or extra modes supported");
globalThis.fetch = async () => {
  throw new Error("NETWORK_DISABLED_IN_PROMPT_REHEARSAL");
};
const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8"));
const lab = await databaseLab({ profileExport: process.env.T9_PROFILE_EXPORT });
const worker = async (sql, values = []) => {
  await lab.db.query("begin");
  try {
    await lab.db.query("set local role eventops_worker");
    const result = await lab.db.query(sql, values);
    await lab.db.query("commit");
    return result;
  } catch (e) {
    await lab.db.query("rollback");
    throw e;
  }
};
const queued = async (caseId = "E02") => {
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=false",
  );
  const fixture = await seedLiveFixture(
    lab,
    corpus.cases.find((c) => c.case_id === caseId),
  );
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=true",
  );
  await lab.ownerQuery("select public.queue_analysis_job($1,$2)", [
    fixture.event,
    fixture.job.id,
  ]);
  return fixture;
};
const finish = (job) =>
  worker("select eventops_worker_api.finish($1,$2,null,$3,$4::jsonb)", [
    job.id,
    job.lease_token,
    "CONTROLLED_NO_PROVIDER",
    JSON.stringify({
      reported: true,
      calls: 0,
      input_tokens: 0,
      output_tokens: 0,
    }),
  ]);
try {
  assert.equal(
    (
      await lab.db.query(
        "select has_function_privilege('authenticated','eventops_worker_api.claim(text)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  const old = await queued();
  const legacy = (await worker("select eventops_worker_api.claim() job"))
    .rows[0].job;
  assert.equal(legacy.id, old.job.id);
  await finish(legacy);
  const historical = (
    await lab.db.query("select * from public.model_runs where job_id=$1", [
      old.job.id,
    ])
  ).rows;
  assert.equal(historical[0].prompt_version, "eventops-text-v1");
  const current = await queued();
  await assert.rejects(
    () =>
      worker("select eventops_worker_api.claim($1::text) job", ["unsupported"]),
    /Unsupported analysis prompt version/,
  );
  assert.equal(
    (
      await lab.db.query("select state from public.analysis_jobs where id=$1", [
        current.job.id,
      ])
    ).rows[0].state,
    "queued",
  );
  await lab.db.query(
    "update public.model_runs set state='abandoned' where job_id=$1",
    [current.job.id],
  );
  await assert.rejects(
    () =>
      worker("select eventops_worker_api.claim($1::text) job", [
        PROMPT_VERSION,
      ]),
    /Missing claimed model reservation/,
  );
  assert.equal(
    (
      await lab.db.query("select state from public.analysis_jobs where id=$1", [
        current.job.id,
      ])
    ).rows[0].state,
    "queued",
  );
  await lab.db.query(
    "update public.model_runs set state='reserved' where job_id=$1",
    [current.job.id],
  );
  const claimed = (
    await worker("select eventops_worker_api.claim($1::text) job", [
      PROMPT_VERSION,
    ])
  ).rows[0].job;
  assert.equal(claimed.id, current.job.id);
  await finish(claimed);
  assert.equal(
    (
      await lab.db.query(
        "select prompt_version from public.model_runs where job_id=$1",
        [current.job.id],
      )
    ).rows[0].prompt_version,
    PROMPT_VERSION,
  );
  assert.deepEqual(
    (
      await lab.db.query("select * from public.model_runs where job_id=$1", [
        old.job.id,
      ])
    ).rows,
    historical,
  );
  const collision = await queued("E01");
  await lab.db.query("set role eventops_worker");
  try {
    assert.equal(
      await runOne(lab.db, (usage) => async (name, _schema, _policy, input) => {
        assert.equal(name, "EventOpsIntent");
        assert.equal(input.prompt_version, PROMPT_VERSION);
        usage.calls++;
        return {
          schema_version: 1,
          base_revision_id: collision.baseId,
          intents: [
            {
              action: "move_session",
              intent_id: "move",
              session_id: collision.base.sessions[0].id,
              room_id: collision.base.rooms[1].id,
              time_choices: [
                {
                  start: "10:00",
                  end: "11:00",
                  start_offset: null,
                  end_offset: null,
                },
              ],
              span: {
                start: 0,
                end: input.confirmed_text.length,
                quote: input.confirmed_text,
              },
            },
          ],
          questions: ["Which replacement should cover the session?"],
          unsupported_requests: [],
        };
      }),
      true,
    );
  } finally {
    await lab.db.query("reset role");
  }
  const persisted = (
    await lab.db.query(
      "select state,result from public.analysis_jobs where id=$1",
      [collision.job.id],
    )
  ).rows[0];
  assert.equal(persisted.state, "completed");
  assert.equal(persisted.result.status, "unresolved");
  assert.deepEqual(persisted.result.options, []);
  assert.ok(
    persisted.result.questions.some(
      (q) => q.includes("Workshop") && q.includes("overlap"),
    ),
  );
  assert.ok(
    persisted.result.questions.includes(
      "Which replacement should cover the session?",
    ),
  );
  assert.equal(
    (
      await lab.db.query(
        "select prompt_version from public.model_runs where job_id=$1",
        [collision.job.id],
      )
    ).rows[0].prompt_version,
    PROMPT_VERSION,
  );
  assert.equal(
    (
      await lab.db.query(
        "select current_revision_id from public.events where id=$1",
        [collision.event],
      )
    ).rows[0].current_revision_id,
    collision.baseId,
  );
  console.log(
    "PASS legacy and versioned claims, rejected version/reservation rollback, restricted access, unchanged historical rows and restricted worker persistence of conflict plus clarification; provider calls 0",
  );
} finally {
  await lab.db.query(
    "update eventops_private.analysis_budget_lock set enabled=false;update eventops_private.voice_gate set enabled=false",
  );
  await lab.close();
}
