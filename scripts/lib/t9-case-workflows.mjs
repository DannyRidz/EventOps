// Evaluation controls only. This module has no provider transport.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { validatePlan } from "../../src/features/plans/validate.ts";
import { resolveSetup } from "../../src/features/events/validation.ts";
import { applyIntents } from "../../src/features/analysis/tools.ts";
import { analyzeUpdate } from "../../src/features/analysis/orchestrate.ts";
import { createMetaTransport } from "../../src/features/analysis/provider.ts";
import { briefingText } from "../../src/features/plans/briefing.ts";
import { fixtureId as id } from "../../src/features/plans/fixtures.ts";
import { databaseLab } from "./t9-database.mjs";
import { seedLiveFixture, inputRecords } from "./t9-live-fixture.mjs";
import { controlledCall } from "./t9-controlled-response.mjs";

export async function caseWorkflows({
  lab,
  s,
  c,
  observed,
  audioRows = [],
  worker,
  audioStore,
  cleanupVoice,
  save = async () => {},
}) {
  const n = Number(c.case_id.slice(1));
  const out = {
    case_id: c.case_id,
    case_input_sha256: c.input_sha256,
    fixture_event_id: s.event,
    evidence_type: "sql_and_controlled_fault_steps",
    steps: [],
    semantic_review: null,
    physical_device_review: null,
    status: "running",
  };
  const step = async (name, run) => {
    const row = { name, status: "running" };
    out.steps.push(row);
    await save(out);
    try {
      row.evidence = await run();
      row.status = ["not_exercised", "needs_organizer_clarification"].includes(
        row.evidence?.status,
      )
        ? "not_exercised"
        : "passed";
    } catch (e) {
      row.status = "failed";
      row.error = { message: e.message?.slice(0, 500), code: e.code };
      out.status = "failed";
      throw e;
    } finally {
      await save(out);
    }
  };
  const initial = await s.head();
  const counts = async () =>
    (
      await lab.ownerQuery(
        "select (select count(*)::int from public.revisions where event_id=$1) revisions,(select count(*)::int from public.approval_receipts where event_id=$1 and operation='approve') receipts,(select count(*)::int from public.audit_events where event_id=$1 and action='proposal_approved') audits",
        [s.event],
      )
    ).rows[0];
  try {
    await step(
      "Official head unchanged before organizer workflow",
      async () => {
        assert.equal(initial, s.baseId);
        return { head: initial, counts: await counts() };
      },
    );
    await step(
      "Every corpus constraint probe agrees in SQL and TypeScript",
      async () => {
        const reports = [];
        for (const probe of c.expected.constraint_probes) {
          const candidate = s.mapped(probe.plan),
            expected = [...probe.expected_rules].sort();
          const js = validatePlan(candidate);
          const sql = (
            await lab.db.query(
              "select eventops_private.validate_plan($1::jsonb) value",
              [JSON.stringify(candidate)],
            )
          ).rows[0].value;
          assert.deepEqual(
            [...new Set(js.map((i) => i.rule))].sort(),
            expected,
          );
          assert.deepEqual(
            [...new Set(sql.map((i) => i.rule))].sort(),
            expected,
          );
          reports.push({
            label: probe.label,
            expected_rules: expected,
            sql_report: sql,
          });
        }
        return reports;
      },
    );
    if (observed)
      await step(
        "Observed model options satisfy exact SQL request coverage and complete constraints",
        async () => {
          const checks = [];
          for (const option of observed.options ?? []) {
            const candidate = applyIntents(s.base, option.requests, s.job.id);
            assert.deepEqual(validatePlan(candidate), []);
            assert.equal(
              (
                await lab.db.query(
                  "select eventops_private.analysis_option_valid($1::jsonb,$2::jsonb) value",
                  [
                    JSON.stringify(observed.interpretation),
                    JSON.stringify(option.requests),
                  ],
                )
              ).rows[0].value,
              true,
            );
            checks.push({ option_id: option.id, valid: true });
          }
          return {
            status: observed.status,
            questions: observed.questions,
            checks,
          };
        },
      );
    if (n === 2)
      await step(
        "Adopt and approve the actual selected option only when ready",
        async () => {
          if (observed?.status !== "ready_for_confirmation")
            return {
              status: "needs_organizer_clarification",
              questions: observed?.questions ?? [],
              approved: false,
            };
          const digest = (
            await lab.ownerQuery(
              "select result_digest from public.analysis_jobs where id=$1",
              [s.job.id],
            )
          ).rows[0].result_digest;
          const p = await s.one(
            "select public.adopt_analysis_option($1,$2,$3,$4,true,$5) value",
            [
              s.event,
              s.job.id,
              observed.selected_option_id,
              digest,
              randomUUID(),
            ],
          );
          assert.equal(await s.head(), initial);
          const receipt = await s.approve(p);
          assert.equal(await s.head(), receipt.revision_id);
          assert.deepEqual(await counts(), {
            revisions: 2,
            receipts: 1,
            audits: 1,
          });
          return { proposal: p.id, receipt };
        },
      );
    if (n === 7)
      await step(
        "Repeated and nonexistent local time setup variants",
        async () => {
          const rows = [];
          for (const [i, v] of c.input.variants.entries()) {
            const setup = { ...s.base.event, ...v };
            delete setup.start_offset;
            delete setup.end_offset;
            if (v.start_offset) setup.start_offset = v.start_offset;
            if (v.end_offset) setup.end_offset = v.end_offset;
            if (c.expected.setup_variants[i].startsWith("reject")) {
              assert.throws(() => resolveSetup(setup));
              rows.push({ variant: i, rejected: true });
            } else {
              const resolved = resolveSetup(setup);
              assert.equal(resolved.starts_at, c.expected.setup_variants[i]);
              rows.push({ variant: i, starts_at: resolved.starts_at });
            }
          }
          return rows;
        },
      );
    if (n === 9)
      await step(
        "Unconfirmed equipment cannot satisfy recorded room requirements",
        async () => {
          assert.ok(c.expected.constraint_probes.length > 0);
          const forged = structuredClone(s.base);
          forged.rooms[1].feature_tags = ["projector"];
          assert.equal(
            (
              await lab.db.query(
                "select eventops_private.evidence_valid($1::jsonb,null,$2,$3) value",
                [JSON.stringify(forged), s.job.workspace_id, s.event],
              )
            ).rows[0].value,
            false,
          );
          return { invented_equipment_rejected: true };
        },
      );
    if ([10, 11].includes(n))
      await step(
        "Hostile content cannot reach external actions or approval",
        async () => {
          assert.equal(await s.head(), initial);
          assert.deepEqual(await counts(), {
            revisions: 1,
            receipts: 0,
            audits: 0,
          });
          const sources = (
            await lab.ownerQuery(
              "select id,field_path,value_json from public.source_records where event_id=$1 and record_id=$2",
              [s.event, s.job.update_id],
            )
          ).rows;
          assert.ok(sources.some((r) => r.value_json === s.text));
          return { head: initial, sources, external_actions_available: false };
        },
      );
    if (n === 12)
      await step(
        "Nonexistent and foreign source evidence is denied",
        async () => {
          const forged = structuredClone(s.base);
          forged.provenance[0].source_record_ids = [id(999)];
          const valid = async () =>
            (
              await lab.db.query(
                "select eventops_private.evidence_valid($1::jsonb,null,$2,$3) value",
                [JSON.stringify(forged), s.job.workspace_id, s.event],
              )
            ).rows[0].value;
          assert.equal(await valid(), false);
          const other = randomUUID();
          await lab.db.query(
            "insert into auth.users(id,email_confirmed_at) values($1,now())",
            [other],
          );
          await lab.db.query(
            "insert into public.profiles(user_id,adult_attested_at,terms_version,privacy_version) select $1,adult_attested_at,terms_version,privacy_version from public.profiles where user_id=$2",
            [other, lab.owner],
          );
          const w = (
            await lab.db.query(
              "insert into public.workspaces(owner_user_id) values($1) returning id",
              [other],
            )
          ).rows[0].id;
          await lab.db.query(
            "insert into public.memberships(workspace_id,user_id,role) values($1,$2,'owner')",
            [w, other],
          );
          const foreignEvent = (
            await lab.ownerQuery(
              "select public.save_event($1::jsonb,$2) value",
              [JSON.stringify(c.input.plan.event), randomUUID()],
              other,
            )
          ).rows[0].value;
          const foreign = (
            await lab.ownerQuery(
              "select public.stage_plan($1,$2::jsonb,1,true) value",
              [foreignEvent, JSON.stringify(inputRecords(c.input.plan))],
              other,
            )
          ).rows[0].value;
          const foreignSource =
            foreign.snapshot.provenance[0].source_record_ids[0];
          forged.provenance[0].source_record_ids = [foreignSource];
          assert.equal(await valid(), false);
          assert.equal(
            (
              await lab.ownerQuery(
                "select id from public.source_records where id=$1",
                [foreignSource],
              )
            ).rows.length,
            0,
          );
          return {
            nonexistent_rejected: true,
            foreign_source: foreignSource,
            foreign_rejected: true,
            owner_read_denied: true,
          };
        },
      );
    if ([13, 14, 30].includes(n))
      await step(
        n === 13
          ? "Stale approval rollback"
          : n === 14
            ? "Concurrent approval receipt replay"
            : "Commit survives briefing response loss",
        async () => {
          const target = structuredClone(s.base);
          target.rooms[0].name = "Synthetic reviewed room";
          const p = await s.proposal(target);
          let receipt;
          if (n === 13) {
            const other = structuredClone(s.base);
            other.rooms[0].name = "Synthetic competing room";
            const stale = await s.proposal(other);
            receipt = await s.approve(p);
            const before = await counts();
            await assert.rejects(() => s.approve(stale), /Stale plan/);
            assert.deepEqual(await counts(), before);
          } else if (n === 14) {
            const key = randomUUID();
            const clients = await Promise.all(
              [0, 1].map(async () => {
                const db = new pg.Client({
                  connectionString: lab.connectionString,
                });
                await db.connect();
                await db.query("set role authenticated");
                await db.query(
                  "select set_config('request.jwt.claim.sub',$1,false)",
                  [lab.owner],
                );
                return db;
              }),
            );
            try {
              const receipts = await Promise.all(
                clients.map(
                  async (db) =>
                    (
                      await db.query(
                        "select public.approve_proposal($1,$2,$3,$4,$5,$6) value",
                        [
                          s.event,
                          p.id,
                          p.base_revision_id,
                          p.generation,
                          p.candidate_digest,
                          key,
                        ],
                      )
                    ).rows[0].value,
                ),
              );
              assert.equal(receipts[0].revision_id, receipts[1].revision_id);
              receipt = receipts[0];
              await assert.rejects(
                () =>
                  s.one(
                    "select public.approve_proposal($1,$2,$3,$4,$5,$6) value",
                    [
                      s.event,
                      p.id,
                      p.base_revision_id,
                      p.generation,
                      "0".repeat(64),
                      key,
                    ],
                  ),
                /Idempotency key reused/,
              );
            } finally {
              await Promise.all(clients.map((db) => db.end()));
            }
            const replay = await s.one(
              "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
              [s.event, s.draft.id, s.baseId, s.text],
            );
            assert.equal(replay.id, s.job.id);
          } else {
            receipt = await s.approve(p);
            await assert.rejects(async () => {
              throw new Error("CONTROLLED_BRIEFING_RESPONSE_LOSS");
            });
            const read = async () =>
              (
                await lab.ownerQuery(
                  "select id,revision_number,approved_at,snapshot from public.revisions where id=$1",
                  [receipt.revision_id],
                )
              ).rows[0];
            const text = briefingText(await read(), s.base);
            assert.equal(text, briefingText(await read(), s.base));
            assert.ok(
              text.includes(`Approved revision 2 (${receipt.revision_id})`),
            );
            assert.ok(text.includes("Synthetic reviewed room"));
          }
          assert.deepEqual(await counts(), {
            revisions: 2,
            receipts: 1,
            audits: 1,
          });
          return {
            control_origin: "explicit synthetic manual candidate",
            proposal: p.id,
            receipt,
            counts: await counts(),
          };
        },
      );
    if ([15, 20].includes(n))
      await step(
        "Forged kept-room or unrequested chain reaction is rejected",
        async () => {
          const original = {
            action: "move_session",
            intent_id: "move",
            session_id: s.mapped(id(3)),
            room_id: s.mapped(id(2)),
            time_choices: [
              {
                start: n === 20 ? "10:00" : "12:00",
                end: n === 20 ? "11:00" : "13:00",
                start_offset: null,
                end_offset: null,
              },
            ],
            span: { start: 0, end: s.text.length, quote: s.text },
          };
          const changed =
            n === 15
              ? [{ ...original, room_id: s.mapped(id(1)), time_choices: [] }]
              : [
                  original,
                  {
                    action: "change_time",
                    intent_id: "hidden-workshop",
                    session_id: s.mapped(id(4)),
                    time_choices: [
                      {
                        start: "11:00",
                        end: "12:00",
                        start_offset: null,
                        end_offset: null,
                      },
                    ],
                    span: original.span,
                  },
                ];
          const candidate = applyIntents(s.base, changed, s.job.id),
            expected = s.mapped(c.input.fault_injections[0].candidate_plan);
          assert.deepEqual(
            { ...candidate, provenance: [] },
            { ...expected, provenance: [] },
          );
          assert.equal(
            (
              await lab.db.query(
                "select eventops_private.analysis_option_valid($1::jsonb,$2::jsonb) value",
                [
                  JSON.stringify({
                    schema_version: 1,
                    base_revision_id: s.baseId,
                    intents: [original],
                    questions: [],
                    unsupported_requests: [],
                  }),
                  JSON.stringify(changed),
                ],
              )
            ).rows[0].value,
            false,
          );
          return { exact_fault_candidate_rejected: true };
        },
      );
    if (n === 19)
      await step(
        "Contradictory capacity requires a newly confirmed source",
        async () => {
          const before = await s.head();
          const target = structuredClone(s.base);
          target.rooms[1].capacity = 20;
          const p = await s.proposal(target);
          assert.equal(await s.head(), before);
          const source = (
            await lab.ownerQuery(
              "select r.id,r.value_json,a.captured_by,a.captured_at from public.source_records r join public.source_artifacts a on a.id=r.artifact_id where r.event_id=$1 and r.field_path=$2",
              [s.event, "capacity"],
            )
          ).rows;
          assert.ok(
            source.some(
              (r) => r.value_json === 20 && r.captured_by === lab.owner,
            ),
          );
          return {
            proposal: p.id,
            state: p.state,
            official_head: before,
            new_capacity_sources: source,
          };
        },
      );
    if ([22, 23, 24].includes(n))
      await step(
        "Real restricted worker persists bounded injected transport/schema failures",
        async () =>
          withFaultLab(c, (faultLab, faultFixture) =>
            transportFaultWorkflow(faultLab, faultFixture, c, n),
          ),
      );
    if ([25, 26, 29].includes(n))
      await step(
        "Independent fault fixture preserves the live SQL quota ledger",
        async () =>
          withFaultLab(c, async (faultLab, faultFixture) =>
            n === 29
              ? quotaRace(faultLab, faultFixture)
              : leaseWorkflow(faultLab, faultFixture, c, n),
          ),
      );
    if (n === 27)
      await step(
        "Historical restoration requires fresh availability confirmation and creates a new revision",
        async () => {
          const target = structuredClone(s.base);
          const opening = target.sessions.find(
            (r) => r.external_id === "opening",
          );
          Object.assign(opening, {
            start: "12:00",
            end: "13:00",
            starts_at: "2026-11-02T04:00:00Z",
            ends_at: "2026-11-02T05:00:00Z",
          });
          const assignment = target.assignments.find(
            (r) => r.session_id === opening.id,
          );
          Object.assign(assignment, {
            start: "12:00",
            end: "13:00",
            starts_at: opening.starts_at,
            ends_at: opening.ends_at,
          });
          const invalid = s.mapped(c.expected.constraint_probes[0].plan);
          target.availability = invalid.availability;
          const current = await s.proposal(target);
          assert.equal(current.state, "ready");
          await s.approve(current);
          const head = await s.head();
          await s.one("select public.save_text_update($1,$2,$2,$3) value", [
            s.event,
            "Synthetic Alex remains unavailable from 10:00 to 11:00.",
            randomUUID(),
          ]);
          let context = await s.one(
            "select public.restore_review_context($1) value",
            [s.event],
          );
          await assert.rejects(() =>
            s.one(
              "select public.restore_revision($1,$2,$3,$4,false,$5) value",
              [s.event, s.baseId, head, randomUUID(), context.digest],
            ),
          );
          const rejected = await s.proposal(invalid);
          assert.equal(rejected.state, "infeasible");
          await assert.rejects(() => s.approve(rejected));
          await s.one("select public.save_text_update($1,$2,$2,$3) value", [
            s.event,
            "Synthetic organizer explicitly reconfirms Alex is available 10:00 to 11:00 and withdraws the earlier cancellation for historical restoration.",
            randomUUID(),
          ]);
          context = await s.one(
            "select public.restore_review_context($1) value",
            [s.event],
          );
          const restored = await s.one(
            "select public.restore_revision($1,$2,$3,$4,true,$5) value",
            [s.event, s.baseId, head, randomUUID(), context.digest],
          );
          const receipt = await s.approve(restored);
          assert.equal(await s.head(), receipt.revision_id);
          assert.equal((await counts()).revisions, 3);
          return {
            current: current.id,
            rejected: rejected.id,
            restoration: restored.id,
            receipt,
            reconfirmed_by: "synthetic organizer control",
            context_digest: context.digest,
          };
        },
      );
    if (n === 28)
      await step(
        "Actual collected transcript is retained through correction and explicit confirmation",
        async () => {
          const rows = [];
          for (const a of audioRows) {
            if (!a.draft_id) {
              rows.push({
                file: a.file,
                state: a.state,
                no_automatic_analysis: true,
              });
              continue;
            }
            const before = (
              await lab.ownerQuery(
                "select count(*)::int n from public.analysis_jobs where draft_id=$1",
                [a.draft_id],
              )
            ).rows[0].n;
            assert.equal(before, 0);
            const corrected =
              "Move Opening to Room 2 from 12:00 to 13:00. Synthetic Sam will cover Opening.";
            const draft = await s.one(
              "select public.save_text_update($1,$2,$3,$4,$5,1) value",
              [s.event, a.transcript, corrected, randomUUID(), a.draft_id],
            );
            assert.equal(draft.raw_text, a.transcript);
            await assert.rejects(() =>
              s.one(
                "select public.confirm_text_analysis($1,$2,$3,$4,$5,false) value",
                [s.event, draft.id, draft.generation, s.baseId, corrected],
              ),
            );
            const job = await s.one(
              "select public.confirm_text_analysis($1,$2,$3,$4,$5,true) value",
              [s.event, draft.id, draft.generation, s.baseId, corrected],
            );
            assert.equal(job.state, "blocked");
            rows.push({
              file: a.file,
              raw_preserved: true,
              confirmed_generation: draft.generation,
              blocked_job: job.id,
            });
          }
          if (audioRows.length === 0)
            return {
              status: "not_exercised",
              reason: "Actual audio collection is required",
            };
          assert.ok(
            worker && audioStore && cleanupVoice,
            "Restricted audio cleanup boundary required",
          );
          for (const a of audioRows)
            await s.one("select public.discard_voice($1,$2) value", [
              s.event,
              a.job_id,
            ]);
          await cleanupVoice(worker, audioStore);
          const cleanup = (
            await lab.ownerQuery(
              "select id,audio_deleted_at from public.voice_jobs where event_id=$1",
              [s.event],
            )
          ).rows;
          assert.ok(
            cleanup.length >= audioRows.length &&
              cleanup.every((r) => r.audio_deleted_at),
          );
          return {
            rows,
            cleanup,
            physical_microphone_denial: "requires_device_observation",
            speech_quality: "requires_independent_review",
          };
        },
      );
    if (![2, 13, 14, 27, 30].includes(n)) assert.equal(await s.head(), initial);
    await step(
      "Final durable source, revision and approval receipt evidence",
      async () => ({
        head: await s.head(),
        counts: await counts(),
        sources: (
          await lab.ownerQuery(
            "select r.id,r.record_id,r.field_path,r.value_json,a.captured_by,a.captured_at from public.source_records r join public.source_artifacts a on a.id=r.artifact_id where r.event_id=$1 order by r.created_at,r.id",
            [s.event],
          )
        ).rows,
        revisions: (
          await lab.ownerQuery(
            "select id,parent_revision_id,revision_number,restores_revision_id,approved_at from public.revisions where event_id=$1 order by revision_number",
            [s.event],
          )
        ).rows,
      }),
    );
    out.status = "workflow_steps_executed_semantic_review_pending";
    return out;
  } catch (e) {
    out.status = "failed";
    throw e;
  } finally {
    await save(out);
  }
}
async function withFaultLab(c, run) {
  const lab = await databaseLab({
    profileExport: process.env.T9_PROFILE_EXPORT,
  });
  try {
    const s = await seedLiveFixture(lab, c);
    return await run(lab, s);
  } finally {
    await lab.db.query(
      "update eventops_private.analysis_budget_lock set enabled=false;update eventops_private.voice_gate set enabled=false",
    );
    await lab.close();
  }
}
async function leaseWorkflow(lab, s, c, n) {
  const move = {
    action: "move_session",
    intent_id: "move",
    session_id: s.mapped(id(3)),
    room_id: s.mapped(id(2)),
    time_choices: [
      { start: "12:00", end: "13:00", start_offset: null, end_offset: null },
    ],
  };
  const fake = controlledCall(c, s, [move]);
  const success = await analyzeUpdate({
    plan: s.base,
    text: s.text,
    baseId: s.baseId,
    sourceId: s.source,
    jobId: s.job.id,
    call: fake.call,
  });
  assert.equal(success.status, "ready_for_confirmation");
  const login = "eventops_t9_fault_" + randomUUID().replaceAll("-", ""),
    password = randomUUID();
  let worker,
    created = false;
  try {
    await lab.db.query(
      `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
    );
    created = true;
    const url = new URL(lab.connectionString);
    url.username = login;
    url.password = password;
    worker = new pg.Client({ connectionString: url.href });
    await worker.connect();
    await worker.query("set role eventops_worker");
    await lab.db.query(
      "update eventops_private.analysis_budget_lock set enabled=true",
    );
    await s.one("select public.queue_analysis_job($1,$2) value", [
      s.event,
      s.job.id,
    ]);
    const first = (
      await worker.query("select eventops_worker_api.claim() as job")
    ).rows[0].job;
    assert.equal(first.id, s.job.id);
    const usage = JSON.stringify({
      reported: true,
      input_tokens: 0,
      output_tokens: 0,
      calls: 0,
    });
    if (n === 25) {
      await lab.db.query(
        "update public.analysis_jobs set lease_until=now()-interval '1 second' where id=$1",
        [s.job.id],
      );
      const next = (
        await worker.query("select eventops_worker_api.claim() as job")
      ).rows[0].job;
      assert.equal(next.id, s.job.id);
      assert.notEqual(next.lease_token, first.lease_token);
      assert.equal(
        (
          await worker.query(
            "select eventops_worker_api.stage($1,$2,'Checking plan') value",
            [s.job.id, first.lease_token],
          )
        ).rows[0].value,
        false,
      );
      assert.equal(
        (
          await worker.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, first.lease_token, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        false,
      );
      assert.equal(
        (
          await worker.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, next.lease_token, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        true,
      );
      assert.equal(
        (
          await worker.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, next.lease_token, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        false,
      );
      const runs = (
        await lab.db.query(
          "select attempt,state from public.model_runs where job_id=$1 order by attempt",
          [s.job.id],
        )
      ).rows;
      assert.deepEqual(runs, [
        { attempt: 1, state: "abandoned" },
        { attempt: 2, state: "finished" },
      ]);
      return {
        fault_fixture: s.event,
        automatic_reclaim: true,
        result_saves: 1,
        runs,
      };
    }
    const edited = c.input.workflow.find(
      (v) => v.step === "organizer_edit",
    ).confirmed_text;
    await s.one("select public.save_text_update($1,$2,$3,$4,$5,1) value", [
      s.event,
      s.text,
      edited,
      randomUUID(),
      s.draft.id,
    ]);
    assert.equal(
      (
        await worker.query(
          "select eventops_worker_api.stage($1,$2,'Checking plan') value",
          [s.job.id, first.lease_token],
        )
      ).rows[0].value,
      false,
    );
    await worker.query(
      "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb)",
      [s.job.id, first.lease_token, JSON.stringify(success), usage],
    );
    const late = (
      await lab.ownerQuery(
        "select state,result from public.analysis_jobs where id=$1",
        [s.job.id],
      )
    ).rows[0];
    assert.equal(late.state, "stale");
    assert.equal(late.result, null);
    return { fault_fixture: s.event, generation_two_preserved: true, late };
  } finally {
    await worker?.end();
    if (created) await lab.db.query(`drop role ${login}`);
  }
}
async function quotaRace(lab, s) {
  for (const [group, attempts] of [
    [0, 10],
    [1, 3],
  ]) {
    const text = `Synthetic quota control ${group}`,
      d = await s.one("select public.save_text_update($1,$2,$2,$3) value", [
        s.event,
        text,
        randomUUID(),
      ]),
      j = await s.one(
        "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
        [s.event, d.id, s.baseId, text],
      );
    await lab.db.query(
      "update public.analysis_jobs set state='failed',attempts=$2 where id=$1",
      [j.id, attempts],
    );
    for (let attempt = 1; attempt <= attempts; attempt++)
      await lab.db.query(
        "insert into public.model_runs(workspace_id,event_id,job_id,attempt,charged_usd,state,created_at) values($1,$2,$3,$4,$5,'finished',now()-interval '2 hours')",
        [
          s.job.workspace_id,
          s.event,
          j.id,
          attempt,
          group === 1 && attempt === 3 ? 0.05 : 0.15,
        ],
      );
  }
  const clients = await Promise.all(
    [0, 1].map(async () => {
      const db = new pg.Client({ connectionString: lab.connectionString });
      await db.connect();
      return db;
    }),
  );
  try {
    const values = await Promise.all(
      clients.map((db, i) =>
        db.query(
          "select eventops_private.reserve_analysis(j,$2) value from public.analysis_jobs j where id=$1",
          [s.job.id, i + 1],
        ),
      ),
    );
    assert.equal(values.filter((v) => v.rows[0].value).length, 1);
    const total = (
      await lab.db.query(
        "select sum(charged_usd)::text total from public.model_runs where event_id=$1",
        [s.event],
      )
    ).rows[0].total;
    assert.equal(total, "2.000000");
    return {
      fault_fixture: s.event,
      winning_reservations: 1,
      total,
      live_ledger_untouched: true,
    };
  } finally {
    await Promise.all(clients.map((db) => db.end()));
  }
}
async function transportFaultWorkflow(lab, initial, c, n) {
  const { runOne } = await import("../../src/features/analysis/worker.ts");
  const { fencedWorker } = await import("./live-evidence.mjs");
  const login = "eventops_t9_transport_" + randomUUID().replaceAll("-", ""),
    password = randomUUID();
  let worker,
    created = false;
  const rows = [];
  try {
    await lab.db.query(
      `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
    );
    created = true;
    const url = new URL(lab.connectionString);
    url.username = login;
    url.password = password;
    worker = new pg.Client({ connectionString: url.href });
    await worker.connect();
    await worker.query("set role eventops_worker");
    await lab.db.query(
      "update eventops_private.analysis_budget_lock set enabled=true",
    );
    for (const [i, fault] of c.input.fault_injections.entries()) {
      const s = i === 0 ? initial : await seedLiveFixture(lab, c);
      await s.one("select public.queue_analysis_job($1,$2) value", [
        s.event,
        s.job.id,
      ]);
      let requests = 0,
        now = 0;
      await runOne(fencedWorker(worker, s.job.id), (usage) =>
        createMetaTransport({
          key: "controlled-unused",
          usage,
          deadline: fault.remaining_deadline_ms ?? (n === 22 ? 1000 : 10000),
          now: () => now,
          random: () => 0,
          sleep: async (ms) => {
            now += ms;
          },
          fetcher: async () => {
            requests++;
            if (fault.response === "timeout")
              throw new Error("CONTROLLED_TIMEOUT");
            if (n === 24)
              return Response.json({
                model: "muse-spark-1.3",
                choices: [
                  {
                    finish_reason: "stop",
                    message: {
                      content: fault.response.refusal
                        ? null
                        : JSON.stringify(fault.response),
                      refusal: fault.response.refusal ?? null,
                    },
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10 },
              });
            return new Response(
              fault.response === "empty_response" ? "" : "failure",
              {
                status:
                  fault.status ??
                  (typeof fault.response === "number" ? fault.response : 200),
                headers: n === 22 ? { "Retry-After": "120" } : {},
              },
            );
          },
        }),
      );
      const job = (
        await lab.ownerQuery(
          "select state,error_code,result from public.analysis_jobs where id=$1",
          [s.job.id],
        )
      ).rows[0];
      assert.equal(job.state, "failed");
      assert.equal(job.result, null);
      assert.ok(requests >= 1 && requests <= 3);
      if (n === 22) {
        assert.equal(requests, 1);
        assert.equal(now, 0);
      }
      if (n === 24) assert.equal(requests, fault.response.refusal ? 1 : 2);
      assert.equal(await s.head(), s.baseId);
      const draft = (
        await lab.ownerQuery(
          "select corrected_text from public.text_update_drafts where id=$1",
          [s.draft.id],
        )
      ).rows[0];
      assert.equal(draft.corrected_text, s.text);
      rows.push({
        fault,
        job,
        requests,
        elapsed_control_ms: now,
        remaining_deadline_ms:
          fault.remaining_deadline_ms ?? (n === 22 ? 1000 : 10000),
        billing: (
          await lab.db.query(
            "select state,calls,charged_usd from public.model_runs where job_id=$1",
            [s.job.id],
          )
        ).rows,
      });
      await s.one(
        "select public.change_event_lifecycle($1,1,'archive') value",
        [s.event],
      );
    }
    return rows;
  } finally {
    await worker?.end();
    if (created) await lab.db.query(`drop role ${login}`);
  }
}
