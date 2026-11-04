// Offline SQL workflow rehearsal. No transport credential, provider or sign-in.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { databaseLab } from "./lib/t9-database.mjs";
const { seedLiveFixture } = await import("./lib/t9-live-fixture.mjs");
const { caseWorkflows } = await import("./lib/t9-case-workflows.mjs");
const { controlledCall } = await import("./lib/t9-controlled-response.mjs");
import { campaignPlan } from "./lib/t9-campaign-plan.mjs";
import { createReceipt } from "./lib/live-evidence.mjs";
const { analyzeUpdate } =
  await import("../src/features/analysis/orchestrate.ts");
const { fixtureId: id } = await import("../src/features/plans/fixtures.ts");
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === "--transport-faults"),
  "Only offline workflow options accepted",
);
globalThis.fetch = async () => {
  throw new Error("NETWORK_DISABLED_IN_WORKFLOW_REHEARSAL");
};
const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8"));
const audio = JSON.parse(
  await readFile("evals/t9/audio/manifest.json", "utf8"),
);
campaignPlan(corpus, audio);
await mkdir("output/t9-workflow-private", { recursive: true, mode: 0o700 });
const folder = await mkdtemp(resolve("output/t9-workflow-private/run-"));
const report = {
  mode: "controlled_sql_workflows",
  results: [],
  live_provider_calls: 0,
  acceptance: "not_evaluated",
  state: "running",
};
const save = await createReceipt(resolve(folder, "receipt.json"), report);
let lab;
try {
  lab = await databaseLab({ profileExport: process.env.T9_PROFILE_EXPORT });
  for (const c of corpus.cases.filter(
    (c) =>
      process.argv[2] !== "--transport-faults" ||
      ["E22", "E23", "E24"].includes(c.case_id),
  )) {
    const s = await seedLiveFixture(lab, c);
    const intents =
      c.case_id === "E02"
        ? [
            {
              action: "move_session",
              intent_id: "move",
              session_id: s.mapped(id(3)),
              room_id: s.mapped(id(2)),
              time_choices: [
                {
                  start: "12:00",
                  end: "13:00",
                  start_offset: null,
                  end_offset: null,
                },
              ],
            },
            {
              action: "change_assignment",
              intent_id: "replace",
              session_id: s.mapped(id(3)),
              from_volunteer_id: s.mapped(id(5)),
              to_volunteer_id: s.mapped(id(6)),
              find_replacement: false,
              role_tag: "usher",
            },
          ]
        : [];
    const fake = controlledCall(
      c,
      s,
      intents,
      intents.length ? [] : ["Synthetic controlled question."],
    );
    const observed = await analyzeUpdate({
      plan: s.base,
      text: s.text,
      baseId: s.baseId,
      sourceId: s.source,
      jobId: s.job.id,
      call: fake.call,
    });
    if (c.case_id === "E02") {
      const token = randomUUID();
      await lab.db.query(
        "update public.analysis_jobs set state='running',lease_token=$2,lease_until=now()+interval '120 seconds',attempts=1 where id=$1",
        [s.job.id, token],
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [
              s.job.id,
              token,
              JSON.stringify(observed),
              JSON.stringify({
                reported: true,
                input_tokens: 0,
                output_tokens: 0,
                calls: fake.count,
              }),
            ],
          )
        ).rows[0].value,
        true,
      );
    }
    const row = { case_id: c.case_id, mode: "controlled", state: "running" };
    report.results.push(row);
    row.workflow = await caseWorkflows({
      lab,
      s,
      c,
      observed,
      save: async (workflow) => {
        row.workflow = workflow;
        await save(report);
      },
    });
    row.state = row.workflow.steps.some(
      (step) => step.status === "not_exercised",
    )
      ? "additional_collection_required"
      : "controlled_steps_passed";
    console.log(
      row.state === "controlled_steps_passed" ? "PASS" : "GAP",
      c.case_id,
      row.workflow.steps.length,
      "controlled workflow steps",
    );
    await save(report);
    await s.one("select public.change_event_lifecycle($1,1,'archive') value", [
      s.event,
    ]);
  }
  report.state = report.results.some(
    (row) => row.state !== "controlled_steps_passed",
  )
    ? "controlled_steps_with_gaps"
    : "controlled_steps_passed";
} catch (e) {
  report.state = "failed";
  report.error = { message: e.message, code: e.code };
  process.exitCode = 1;
} finally {
  await lab?.close();
  await save(report);
  console.log(
    JSON.stringify({
      state: report.state,
      receipt: resolve(folder, "receipt.json"),
      cases: report.results.length,
      live_provider_calls: 0,
      acceptance: "not_evaluated",
    }),
  );
}
