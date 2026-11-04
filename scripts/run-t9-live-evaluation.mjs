// Collection runner. Default preparation never opens a database or calls a provider.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import {
  campaignPlan,
  inspectJournal,
  sha256,
} from "./lib/t9-campaign-plan.mjs";
import { campaignCall, parseCampaignLedger } from "./lib/t9-allowance.mjs";
import {
  createReceipt,
  fencedWorker,
  responseDiagnostic,
} from "./lib/live-evidence.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.every(
    (a) =>
      ["--prepare", "--rehearse", "--execute"].includes(a) ||
      /^--case=E\d{2}$/.test(a) ||
      /^--repeat=[123]$/.test(a),
  ),
  "Unknown argument",
);
const modes = args.filter((a) =>
  ["--prepare", "--rehearse", "--execute"].includes(a),
);
assert.ok(modes.length <= 1, "Choose one mode");
const mode = modes[0] ?? "--prepare";
assert.equal(new Set(args).size, args.length, "Duplicate arguments");
assert.ok(args.filter((a) => a.startsWith("--case=")).length <= 1);
assert.ok(args.filter((a) => a.startsWith("--repeat=")).length <= 1);
const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8"));
const audio = JSON.parse(
  await readFile("evals/t9/audio/manifest.json", "utf8"),
);
for (const [path, hash] of Object.entries(corpus.source_sha256))
  assert.equal(sha256(await readFile(path)), hash, `Source drift: ${path}`);
const plan = campaignPlan(corpus, audio);
const caseId = args.find((a) => a.startsWith("--case="))?.split("=")[1];
const repeat = Number(
  args.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 0,
);
if (caseId)
  assert.ok(
    corpus.cases.some((c) => c.case_id === caseId),
    "Unknown case",
  );
let slots = plan.slots.filter(
  (s) => (!caseId || s.case_id === caseId) && (!repeat || s.repeat === repeat),
);
const liveFolder = resolve("output/live-analysis-private");
const liveLedger = resolve(liveFolder, "usd1-reservations.jsonl");
const journalInfo = await lstat(liveLedger);
assert.ok(
  journalInfo.isFile() &&
    !journalInfo.isSymbolicLink() &&
    (journalInfo.mode & 0o077) === 0 &&
    journalInfo.size <= 1048576,
);
const journalRaw = await readFile(liveLedger, "utf8");
const allowance = inspectJournal(journalRaw);
const priorJournal = parseCampaignLedger(journalRaw);
const maximum = slots.reduce((n, s) => n + s.maximum_reservation_microusd, 0);
if (mode === "--prepare") {
  console.log(
    JSON.stringify(
      {
        ...plan,
        slots,
        selected_maximum_microusd: maximum,
        allowance,
        can_fit_current_allowance: maximum <= allowance.remaining_microusd,
        execution_prerequisites: [
          "Explicit synthetic live approval and verified provider flags",
          "Sufficient unchanged aggregate journal allowance",
          "Normal SQL budgets and rate limits, never reset to accelerate",
          "Independent semantic and case workflow review",
        ],
        live_provider_calls: 0,
      },
      null,
      2,
    ),
  );
} else {
  const controlled = mode === "--rehearse";
  if (!controlled) {
    assert.equal(
      process.env.EVENTOPS_T9_LIVE_APPROVED,
      "1",
      "Live execution is not authorized by preparation",
    );
    const { liveModelEnabled } =
      await import("../src/features/analysis/provider.ts");
    assert.ok(
      liveModelEnabled(),
      "Private key and explicit verified flags required",
    );
    if (slots.some((s) => s.case_id === "E28")) {
      const { voiceEnabled } =
        await import("../src/features/voice/contracts.ts");
      assert.ok(voiceEnabled(), "Explicit verified voice flags required");
    }
    assert.ok(
      (allowance.limit_microusd === 15000000
        ? Math.min(maximum, 150000)
        : maximum) <= allowance.remaining_microusd,
      "INSUFFICIENT_EXISTING_ALLOWANCE: no requests, no new ledger, no automatic limit increase",
    );
  } else {
    assert.ok(!caseId && !repeat, "Rehearsal has a fixed two-case scope");
    slots = plan.slots.filter(
      (s) => s.repeat === 1 && ["E02", "E28"].includes(s.case_id),
    );
  }
  assert.ok(
    process.env.EVENTOPS_FFMPEG_PATH || !slots.some((s) => s.case_id === "E28"),
    "Installed ffmpeg path required",
  );
  const networkFetch = controlled ? null : globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("UNGUARDED_NETWORK_DISABLED");
  };
  const { databaseLab } = await import("./lib/t9-database.mjs");
  const { seedLiveFixture, restoreLiveFixture } =
    await import("./lib/t9-live-fixture.mjs");
  const { caseWorkflows } = await import("./lib/t9-case-workflows.mjs");
  const { controlledCall } = await import("./lib/t9-controlled-response.mjs");
  const { fixtureId: id } = await import("../src/features/plans/fixtures.ts");
  const { runOne } = await import("../src/features/analysis/worker.ts");
  const { createMetaTransport } =
    await import("../src/features/analysis/provider.ts");
  const { providerContext } =
    await import("../src/features/analysis/privacy.ts");
  const { runVoice, cleanupVoice } =
    await import("../src/features/voice/worker.ts");
  const { createTranscriber } =
    await import("../src/features/voice/provider.ts");
  const { validatePlan } = await import("../src/features/plans/validate.ts");
  const { applyIntents } = await import("../src/features/analysis/tools.ts");
  const attempt = controlled
    ? `rehearsal-${randomUUID()}`
    : `corpus-${caseId ?? "all"}-${repeat || "all"}-${randomUUID()}`;
  const folder = controlled
    ? resolve("output/t9-live-rehearsal-private", attempt)
    : liveFolder;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const report = {
    attempt,
    mode: controlled ? "controlled_rehearsal" : "live_collection",
    corpus_sha256: plan.corpus_sha256,
    started_at: new Date().toISOString(),
    results: [],
    requests: [],
    state: "preflight",
    acceptance: "not_evaluated",
    live_provider_calls: 0,
  };
  const save = await createReceipt(
    resolve(folder, `${attempt}-receipt.json`),
    report,
  );
  const ledger = controlled
    ? resolve(folder, "reservations.jsonl")
    : liveLedger;
  let lab,
    worker,
    roleCreated = false;
  const login = "eventops_t9_collect_" + randomUUID().replaceAll("-", "");
  try {
    const { campaignAnchor } = await import("./lib/t9-campaign-anchor.mjs");
    const anchor = controlled
      ? {}
      : await campaignAnchor(
          liveFolder,
          plan.corpus_sha256,
          [...priorJournal.seen.keys()].some((key) =>
            /^t9-E\d{2}-[123]-call-/.test(key),
          ),
        );
    lab = await databaseLab({
      profileExport: process.env.T9_PROFILE_EXPORT,
      campaignIdentity: controlled ? undefined : plan.corpus_sha256,
      ...anchor,
    });
    const campaignState = controlled ? { slots: {} } : await lab.loadState();
    const requiredRemaining = slots
      .filter(
        (slot) =>
          !campaignState.slots[slot.key] ||
          campaignState.slots[slot.key].phase === "prepared",
      )
      .reduce((n, slot) => n + slot.maximum_reservation_microusd, 0);
    if (!controlled)
      assert.ok(
        requiredRemaining <= allowance.remaining_microusd,
        "INSUFFICIENT_REMAINING_CAMPAIGN_ALLOWANCE",
      );
    const workerUrl = new URL(lab.connectionString),
      password = randomUUID();
    await lab.db.query(
      `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
    );
    roleCreated = true;
    workerUrl.username = login;
    workerUrl.password = password;
    worker = new pg.Client({ connectionString: workerUrl.href });
    await worker.connect();
    await worker.query("set role eventops_worker");
    await worker.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ role: "eventops_worker" }),
    ]);
    for (const slot of slots) {
      const prior = campaignState.slots[slot.key];
      if (!controlled) {
        const { reconcileSlot } = await import("./lib/t9-slot-integrity.mjs");
        const completed = prior
          ? (
              await lab.db.query(
                "select state from public.analysis_jobs where id=$1",
                [prior.fixture.job.id],
              )
            ).rows[0]?.state === "completed"
          : false;
        reconcileSlot(
          slot.key,
          prior,
          [...priorJournal.seen.keys()],
          completed,
        );
      }
      if (prior?.phase === "done") {
        report.results.push(prior.result);
        continue;
      }
      assert.ok(
        prior?.phase !== "workflow_running",
        "Inspect interrupted workflow receipts before resuming",
      );
      const c = corpus.cases.find((c) => c.case_id === slot.case_id);
      const s = prior
        ? restoreLiveFixture(lab, prior.fixture)
        : await seedLiveFixture(lab, c);
      const state = prior ?? {
        fixture: JSON.parse(JSON.stringify(s)),
        phase: "prepared",
      };
      campaignState.slots[slot.key] = state;
      const result = state.result ?? {
        case_id: c.case_id,
        repeat: slot.repeat,
        event_id: s.event,
        base_revision_id: s.baseId,
        job_id: s.job.id,
        semantic_review: null,
        workflow_review: null,
        state: "collecting",
        fixture: { plan: s.base, confirmed_text: s.text, source_id: s.source },
        requests: [],
        observations: [],
        limitations: [
          "HTTP authentication and hosted Storage are not exercised by the isolated SQL fixture",
          "Case workflows are recorded separately; model semantics and physical device observations require independent review",
        ],
      };
      report.results.push(result);
      const saveResult = async () => {
        state.result = result;
        if (!controlled) await lab.saveState(campaignState);
        await save(report);
      };
      await saveResult();
      let requestIndex = result.requests.length;
      const fixtureBytes = new Map();
      const store = {
        read: async (path) => {
          assert.ok(fixtureBytes.has(path));
          return fixtureBytes.get(path);
        },
        remove: async (path) => {
          const deleted = await worker.query(
            "delete from storage.objects where bucket_id='event-audio' and name=$1",
            [path],
          );
          assert.equal(deleted.rowCount, 1);
          fixtureBytes.delete(path);
        },
      };
      const fake = controlledCall(
        c,
        s,
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
          : [],
        c.case_id === "E02" ? [] : ["Controlled rehearsal question."],
      );
      const guarded = async (endpoint, options) => {
        const voice = c.case_id === "E28";
        assert.equal(
          endpoint,
          voice
            ? "https://api.meta.ai/v1/asr/transcribe"
            : "https://api.meta.ai/v1/chat/completions",
        );
        if (voice) {
          const request = JSON.parse(await options.body.get("request").text());
          assert.equal(request.model, "muse-voice-transcribe-1.0");
          assert.equal(request.audioEncoding, "WAV");
        } else {
          const body = JSON.parse(options.body);
          assert.equal(body.model, "muse-spark-1.3");
          assert.equal(body.max_completion_tokens, 4000);
          assert.equal(body.store, false);
          assert.equal(body.tools, undefined);
          assert.ok(Buffer.byteLength(options.body) < 17000);
        }
        const receipt = {
          index: ++requestIndex,
          reserved_microusd: voice ? 18000 : 50000,
        };
        result.requests.push(receipt);
        await saveResult();
        assert.ok(
          requestIndex <= slot.maximum_provider_calls,
          "Per-slot call ceiling",
        );
        return campaignCall(
          {
            path: ledger,
            limitMicrousd: controlled ? 1000000 : allowance.limit_microusd,
            amountMicrousd: receipt.reserved_microusd,
            key: `${slot.key}-call-${requestIndex}`,
          },
          async () => {
            const started = Date.now();
            try {
              let response;
              if (controlled) {
                if (voice)
                  response = Response.json({
                    transcript:
                      "Synthetic controlled transcript requiring organizer review.",
                  });
                else {
                  const body = JSON.parse(options.body),
                    input = JSON.parse(body.messages[1].content);
                  response = Response.json({
                    model: "muse-spark-1.3",
                    choices: [
                      {
                        message: {
                          content: JSON.stringify(
                            await fake.call(
                              body.response_format.json_schema.name,
                              null,
                              body.messages[0].content,
                              input,
                            ),
                          ),
                        },
                        finish_reason: "stop",
                      },
                    ],
                    usage: { prompt_tokens: 100, completion_tokens: 30 },
                  });
                }
              } else {
                report.live_provider_calls++;
                response = await networkFetch(endpoint, options);
              }
              receipt.status = response.status;
              receipt.request_id = response.headers.get("x-request-id");
              Object.assign(receipt, await responseDiagnostic(response));
              return response;
            } catch (e) {
              receipt.transport_error = e.name;
              throw e;
            } finally {
              receipt.latency_ms = Date.now() - started;
              await saveResult();
            }
          },
        )();
      };
      if (state.phase === "prepared" && c.case_id !== "E28") {
        const context = providerContext(s.base, s.text);
        await lab.db.query(
          "update eventops_private.analysis_budget_lock set enabled=true",
        );
        const existingJob = (
          await lab.db.query(
            "select state from public.analysis_jobs where id=$1",
            [s.job.id],
          )
        ).rows[0];
        if (existingJob.state !== "completed") {
          assert.equal(
            requestIndex,
            0,
            "Inspect uncertain provider reservation before retry",
          );
          await s.one("select public.queue_analysis_job($1,$2) value", [
            s.event,
            s.job.id,
          ]);
          assert.equal(
            await runOne(fencedWorker(worker, s.job.id), (usage, deadline) => {
              const call = createMetaTransport({
                key: controlled ? "controlled" : process.env.MODEL_API_KEY,
                usage,
                deadline,
                fetcher: guarded,
              });
              return (name, schema, policy, input) => {
                assert.equal(input.base_revision_id, s.baseId);
                if (name === "EventOpsIntent") {
                  assert.equal(input.text_source_id, s.source);
                  assert.equal(input.confirmed_text, context.text);
                  assert.deepEqual(input.plan, context.plan);
                } else {
                  assert.equal(name, "EventOpsSelection");
                  assert.deepEqual(input.allowed_evidence_refs, [s.source]);
                }
                return call(name, schema, policy, input);
              };
            }),
            true,
            "Expected queued job claim",
          );
        }
        result.worker = (
          await lab.db.query(
            "select state,error_code,result,result_digest from public.analysis_jobs where id=$1",
            [s.job.id],
          )
        ).rows[0];
        result.billing = (
          await lab.db.query(
            "select state,input_tokens,output_tokens,calls,charged_usd from public.model_runs where job_id=$1",
            [s.job.id],
          )
        ).rows;
        const value = result.worker.result;
        result.candidate_checks = (value?.options ?? []).map((o) => ({
          id: o.id,
          issues: validatePlan(applyIntents(s.base, o.requests, s.job.id)),
        }));
        assert.ok(
          result.candidate_checks.every((o) => o.issues.length === 0),
          "Invalid returned candidate",
        );
      } else if (state.phase === "prepared") {
        result.audio ??= [];
        await lab.db.query(
          "update eventops_private.voice_gate set enabled=true",
        );
        for (const file of audio.files) {
          assert.match(file.file, /^[a-z-]+\.(webm|mp4)$/);
          const bytes = await readFile(resolve("evals/t9/audio", file.file));
          assert.equal(bytes.length, file.bytes);
          assert.equal(sha256(bytes), file.sha256);
          const completedAudio = result.audio.find((a) => a.file === file.file);
          if (completedAudio) {
            assert.ok(
              completedAudio.state !== "collecting",
              "Inspect interrupted audio call before retry",
            );
            fixtureBytes.set(completedAudio.object_key, bytes);
            continue;
          }
          const job = await s.one(
            "select public.begin_voice($1,$2,$3,$4,$5) value",
            [s.event, randomUUID(), file.sha256, bytes.length, file.mime],
          );
          await lab.db.query(
            "insert into storage.objects(bucket_id,name) values('event-audio',$1)",
            [job.object_key],
          );
          fixtureBytes.set(job.object_key, bytes);
          const audioRow = {
            file: file.file,
            sha256: file.sha256,
            job_id: job.id,
            object_key: job.object_key,
            state: "collecting",
          };
          result.audio.push(audioRow);
          await saveResult();
          await s.one("select public.queue_voice($1,$2) value", [
            s.event,
            job.id,
          ]);
          assert.equal(
            await runVoice(
              fencedWorker(
                worker,
                job.id,
                "select eventops_worker_api.claim_voice() as job",
              ),
              store,
              createTranscriber(
                controlled ? "controlled" : process.env.MODEL_API_KEY,
                guarded,
              ),
              process.env.EVENTOPS_FFMPEG_PATH,
            ),
            true,
          );
          const row = (
            await lab.db.query(
              "select state,error_code,duration_ms,draft_id from public.voice_jobs where id=$1",
              [job.id],
            )
          ).rows[0];
          const draft = row.draft_id
            ? (
                await lab.db.query(
                  "select raw_text from public.text_update_drafts where id=$1",
                  [row.draft_id],
                )
              ).rows[0]
            : null;
          Object.assign(audioRow, row, { transcript: draft?.raw_text ?? null });
          await saveResult();
        }
        result.observations.push(
          "Collection did not confirm transcripts. Any subsequent correction and explicit confirmation are recorded in the workflow steps.",
        );
      }
      if (c.case_id === "E28" && fixtureBytes.size === 0)
        for (const a of result.audio ?? [])
          fixtureBytes.set(
            a.object_key,
            await readFile(resolve("evals/t9/audio", a.file)),
          );
      state.phase = "collected";
      await saveResult();
      assert.equal(
        await s.head(),
        s.baseId,
        "Official head must remain unchanged",
      );
      result.observations.push("Official head unchanged after collection.");
      state.phase = "workflow_running";
      await saveResult();
      result.workflow = await caseWorkflows({
        lab,
        s,
        c,
        observed: result.worker?.result,
        audioRows: result.audio,
        worker,
        audioStore: store,
        cleanupVoice,
        save: async (workflow) => {
          result.workflow = workflow;
          await saveResult();
        },
      });
      await s.one(
        "select public.change_event_lifecycle($1,1,'archive') value",
        [s.event],
      );
      state.phase = "done";
      result.state = "collected_not_scored";
      await saveResult();
      await lab.db.query(
        "update eventops_private.analysis_budget_lock set enabled=false;update eventops_private.voice_gate set enabled=false",
      );
    }
    report.state = "collected_not_scored";
  } catch (e) {
    report.state = /budget|rate limit|concurrency/i.test(e.message ?? "")
      ? "paced_by_sql_limits"
      : "blocked_or_failed";
    report.error = { code: e.code, message: e.message?.slice(0, 500) };
    process.exitCode = 1;
  } finally {
    const cleanupErrors = [];
    const cleanup = async (label, action) => {
      try {
        await action();
      } catch {
        cleanupErrors.push(label);
      }
    };
    if (lab)
      await cleanup("disable_isolated_gates", () =>
        lab.db.query(
          "update eventops_private.analysis_budget_lock set enabled=false;update eventops_private.voice_gate set enabled=false",
        ),
      );
    await cleanup("close_worker", () => worker?.end());
    if (roleCreated)
      await cleanup("drop_worker_role", () =>
        lab.db.query(`drop role ${login}`),
      );
    await cleanup("close_isolated_database", () => lab?.close());
    report.cleanup_errors = cleanupErrors;
    if (cleanupErrors.length) {
      report.state = "cleanup_failed";
      process.exitCode = 1;
    }
    report.finished_at = new Date().toISOString();
    await save(report);
    console.log(
      JSON.stringify({
        state: report.state,
        receipt: resolve(folder, `${attempt}-receipt.json`),
        live_provider_calls: report.live_provider_calls,
        acceptance: report.acceptance,
      }),
    );
  }
}
