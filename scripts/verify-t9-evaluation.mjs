// Controlled local verification. No live mode, no model credentials, no auth flow.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import pg from "pg";
import { z } from "zod";
import { databaseLab } from "./lib/t9-database.mjs";
import { campaignCall } from "./lib/t9-allowance.mjs";

assert.equal(process.argv.length, 2, "No live/provider arguments accepted");
globalThis.fetch = async () => {
  throw new Error("NETWORK_DISABLED_IN_CONTROLLED_RUNNER");
};
const { analyzeUpdate } =
  await import("../src/features/analysis/orchestrate.ts");
const { createMetaTransport } =
  await import("../src/features/analysis/provider.ts");
const { validatePlan } = await import("../src/features/plans/validate.ts");
const { applyIntents, validateInterpretation } =
  await import("../src/features/analysis/tools.ts");
const { fixtureId: id } = await import("../src/features/plans/fixtures.ts");
const { editableRecords, planInput, manualPatch } =
  await import("../src/features/plans/editor-model.ts");
const { resolveSetup } = await import("../src/features/events/validation.ts");
const { briefingText } = await import("../src/features/plans/briefing.ts");
const { convertRecording } =
  await import("../src/features/voice/conversion.ts");
const { createTranscriber } = await import("../src/features/voice/provider.ts");
assert.ok(
  process.env.EVENTOPS_FFMPEG_PATH,
  "Set the installed local ffmpeg path for audio verification",
);
const corpus = JSON.parse(await readFile("evals/t9/corpus.json", "utf8"));
const audio = JSON.parse(
  await readFile("evals/t9/audio/manifest.json", "utf8"),
);
const sha = (value) => createHash("sha256").update(value).digest("hex");
for (const [path, hash] of Object.entries(corpus.source_sha256))
  assert.equal(sha(await readFile(path)), hash);
const temp = await mkdtemp(join(tmpdir(), "eventops-t9-eval-"));
const campaignPath =
  process.env.T9_CAMPAIGN_LEDGER ??
  resolve("output/t9-campaign-private/reservations.jsonl");
await mkdir(dirname(campaignPath), { recursive: true, mode: 0o700 });
const hold = (key, call) =>
  campaignCall(
    {
      path: campaignPath,
      limitMicrousd: 13_500_000,
      amountMicrousd: 150000,
      key,
    },
    call,
  );
const results = [];
let lab;
function inputRecords(p) {
  const aliases = new Map();
  for (const c of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of p[c]) aliases.set(r.id, r.external_id);
  const records = editableRecords(p);
  for (const rows of Object.values(records))
    for (const row of rows) {
      delete row.id;
      for (const k of [
        "room_id",
        "session_id",
        "volunteer_id",
        "predecessor_session_id",
        "successor_session_id",
      ])
        if (k in row) row[k] = aliases.get(row[k]);
    }
  return planInput(records);
}
async function seed(c) {
  const one = async (sql, values) =>
    (await lab.ownerQuery(sql, values)).rows[0].value;
  const event = await one(
    "select public.save_event($1::jsonb,$2::uuid) value",
    [JSON.stringify(c.input.plan.event), randomUUID()],
  );
  const stage = await one(
    "select public.stage_plan($1,$2::jsonb,1,true) value",
    [event, JSON.stringify(inputRecords(c.input.plan))],
  );
  assert.deepEqual(stage.validation_report, []);
  const receipt = await one("select public.confirm_plan($1,$2,$3,$4) value", [
    event,
    stage.generation,
    stage.candidate_digest,
    randomUUID(),
  ]);
  const map = new Map();
  for (const key of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of c.input.plan[key])
      map.set(
        r.id,
        stage.snapshot[key].find((v) => v.external_id === r.external_id).id,
      );
  const mapped = (value) =>
    JSON.parse(JSON.stringify(value), (_, v) =>
      typeof v === "string" ? (map.get(v) ?? v) : v,
    );
  const base = stage.snapshot;
  assert.ok(base.provenance.length > 0);
  const text =
    c.input.confirmed_text ??
    "Synthetic audio text fallback requires confirmation.";
  const draft = await one("select public.save_text_update($1,$2,$2,$3) value", [
    event,
    text,
    randomUUID(),
  ]);
  const job = await one(
    "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
    [event, draft.id, receipt.revision_id, text],
  );
  assert.equal(job.state, "blocked");
  const source = (
    await lab.db.query(
      "select id from public.source_records where event_id=$1 and record_id=$2 and field_path='confirmed_text'",
      [event, job.update_id],
    )
  ).rows[0].id;
  const head = async () =>
    (
      await lab.ownerQuery(
        "select current_revision_id from public.events where id=$1",
        [event],
      )
    ).rows[0].current_revision_id;
  const proposal = async (target) => {
    const records = editableRecords(target);
    for (const [collection, rows] of Object.entries(records))
      for (const row of rows)
        if (!base[collection].some((r) => r.id === row.id)) delete row.id;
    return one(
      "select public.create_manual_proposal($1,$2,$3::jsonb,true,$4,$5) value",
      [
        event,
        await head(),
        JSON.stringify(manualPatch(base, records)),
        "Synthetic T9 exact candidate review",
        randomUUID(),
      ],
    );
  };
  const approve = (p, key = randomUUID()) =>
    one("select public.approve_proposal($1,$2,$3,$4,$5,$6) value", [
      event,
      p.id,
      p.base_revision_id,
      p.generation,
      p.candidate_digest,
      key,
    ]);
  return {
    event,
    base,
    baseId: receipt.revision_id,
    mapped,
    one,
    head,
    proposal,
    approve,
    source,
    draft,
    job,
    text,
  };
}
function controlledCall(
  c,
  s,
  intents,
  questions = [],
  unsupported = [],
  badSelection = false,
) {
  let count = 0;
  return {
    get count() {
      return count;
    },
    call: async (name, _schema, policy, input) => {
      count++;
      assert.ok(policy.length > 0);
      assert.ok(!JSON.stringify(input).includes('"constraint_probes"'));
      if (name === "EventOpsIntent") {
        assert.ok(!JSON.stringify(input).includes("Synthetic Alex"));
        return {
          schema_version: 1,
          base_revision_id: s.baseId,
          intents: intents.map((r) => ({
            ...r,
            span: {
              start: 0,
              end: input.confirmed_text.length,
              quote: input.confirmed_text,
            },
          })),
          questions,
          unsupported_requests: unsupported,
        };
      }
      assert.equal(name, "EventOpsSelection");
      return {
        base_revision_id: s.baseId,
        selected_option_id: badSelection ? "not-supplied" : input.options[0].id,
        dispositions: input.options[0].requests.map((r) => ({
          intent_id: r.intent_id,
          status: "satisfied",
          evidence_refs: [badSelection ? id(999) : s.source],
        })),
      };
    },
  };
}
async function exercise(c, repeat) {
  const n = Number(c.case_id.slice(1));
  const started = performance.now();
  const s = await seed(c);
  const checks = [
    "normal SQL source capture, exact text confirmation and blocked job",
  ];
  let controlledCalls = 0;
  for (const p of c.expected.constraint_probes) {
    const plan = s.mapped(p.plan);
    const expected = [...p.expected_rules].sort();
    const js = [...new Set(validatePlan(plan).map((i) => i.rule))].sort();
    const sql = (
      await lab.db.query(
        "select eventops_private.validate_plan($1::jsonb) value",
        [JSON.stringify(plan)],
      )
    ).rows[0].value;
    assert.deepEqual(js, expected);
    assert.deepEqual([...new Set(sql.map((i) => i.rule))].sort(), expected);
    checks.push("SQL and TypeScript constraint oracle: " + p.label);
  }
  const move = (start = "12:00", end = "13:00", room = id(2)) => ({
    action: "move_session",
    intent_id: "move",
    session_id: s.mapped(id(3)),
    room_id: s.mapped(room),
    time_choices: [{ start, end, start_offset: null, end_offset: null }],
  });
  const replace = (to = id(6)) => ({
    action: "change_assignment",
    intent_id: "replace",
    session_id: s.mapped(id(3)),
    from_volunteer_id: s.mapped(id(5)),
    to_volunteer_id: to ? s.mapped(to) : null,
    find_replacement: false,
    role_tag: "usher",
  });
  let intents = [],
    questions = [],
    unsupported = [],
    badSelection = false,
    shouldReady = false;
  if ([1, 21].includes(n)) {
    intents = [move("10:00", "11:00")];
    if (n === 1) intents.push(replace(null));
  }
  if ([2, 3, 4].includes(n)) {
    intents = [move(), replace(n === 4 ? id(13) : id(6))];
    shouldReady = n === 2;
  }
  if ([5, 9].includes(n)) intents = [move()];
  if (n === 6)
    questions = ["Is the intended date 2 or 3 November in Asia/Brunei?"];
  if (n === 7) {
    for (const [i, v] of c.input.variants.entries()) {
      const setup = { ...s.base.event, ...v };
      delete setup.start_offset;
      delete setup.end_offset;
      if (v.start_offset) setup.start_offset = v.start_offset;
      if (v.end_offset) setup.end_offset = v.end_offset;
      if (c.expected.setup_variants[i].startsWith("reject"))
        assert.throws(() => resolveSetup(setup));
      else
        assert.equal(
          resolveSetup(setup).starts_at,
          c.expected.setup_variants[i],
        );
    }
    checks.push("four repeated/nonexistent local time variants");
  }
  if (n === 8) {
    const raw = {
      schema_version: 1,
      base_revision_id: s.baseId,
      intents: [
        { ...replace(), span: { start: 0, end: s.text.length, quote: s.text } },
      ],
      questions: [],
      unsupported_requests: [],
    };
    assert.throws(
      () => validateInterpretation(raw, s.base, s.text, s.baseId),
      /AMBIGUOUS_RECORD/,
    );
    questions = ["Select the exact cancelling volunteer record."];
  }
  if (n === 10)
    unsupported = [
      "Cannot approve, read another workspace, run commands or send messages.",
    ];
  if (n === 11) {
    intents = [move()];
    unsupported = [
      "Automatic approval and external roster transmission are unsupported.",
    ];
  }
  if ([12, 15, 20].includes(n)) {
    intents = [
      move(n === 20 ? "10:00" : "12:00", n === 20 ? "11:00" : "13:00"),
    ];
    badSelection = true;
  }
  if (n === 16) intents = [move("11:00", "12:00")];
  if (n === 17)
    questions = [
      "Who can cover the 09:45 setup interval with proven availability?",
    ];
  if (n === 18) intents = [move("10:30", "11:30", id(1))];
  if (n === 19)
    questions = [
      "Which confirmed Room 2 capacity, 20 or 40, is authoritative?",
    ];
  if (n <= 21 && n !== 7) {
    const fake = controlledCall(
      c,
      s,
      intents,
      questions,
      unsupported,
      badSelection,
    );
    const result = await hold(`${c.case_id}-${repeat}-analysis`, () =>
      analyzeUpdate({
        plan: s.base,
        text: s.text,
        baseId: s.baseId,
        sourceId: s.source,
        jobId: s.job.id,
        call: (...args) => fake.call(...args),
      }),
    )();
    // One conservative hold covers the bounded controlled analysis, not one hold reused for a second provider call.
    controlledCalls = fake.count;
    assert.equal(
      result.status,
      shouldReady ? "ready_for_confirmation" : "unresolved",
    );
    if (shouldReady) {
      const selected = result.options.find(
        (o) => o.id === result.selected_option_id,
      );
      const candidate = applyIntents(s.base, selected.requests, s.job.id);
      assert.deepEqual(validatePlan(candidate), []);
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
              JSON.stringify(result),
              JSON.stringify({
                reported: false,
                calls: fake.count,
                input_tokens: 0,
                output_tokens: 0,
              }),
            ],
          )
        ).rows[0].value,
        true,
      );
      const saved = (
        await lab.ownerQuery(
          "select result_digest from public.analysis_jobs where id=$1",
          [s.job.id],
        )
      ).rows[0];
      const proposal = await s.one(
        "select public.adopt_analysis_option($1,$2,$3,$4,true,$5) value",
        [
          s.event,
          s.job.id,
          result.selected_option_id,
          saved.result_digest,
          randomUUID(),
        ],
      );
      assert.equal(await s.head(), s.baseId);
      await s.approve(proposal);
      assert.notEqual(await s.head(), s.baseId);
      checks.push(
        "controlled result saved by real worker finish, separately adopted and transactionally approved",
      );
    }
    checks.push(
      "real orchestrator with controlled interpretation/selection, no network",
    );
  }
  if ([22, 23, 24].includes(n)) {
    for (const [variant, fault] of c.input.fault_injections.entries()) {
      let requests = 0,
        now = 0;
      const usage = {
        input_tokens: 0,
        output_tokens: 0,
        reported: true,
        calls: 0,
      };
      const transport = createMetaTransport({
        key: "synthetic-unused",
        usage,
        deadline: n === 22 ? 1000 : 10000,
        now: () => now,
        random: () => 0,
        sleep: async (ms) => {
          now += ms;
        },
        fetcher: async () => {
          requests++;
          if (fault.response === "timeout")
            throw new Error("controlled network timeout");
          if (n === 24)
            return new Response(
              JSON.stringify({
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
              }),
            );
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
      });
      const call = hold(`${c.case_id}-${repeat}-fault-${variant}`, transport);
      if (n === 24 && !fault.response.refusal) {
        const out = await call(
          "Test",
          z.object({ schema_version: z.literal(1) }),
          "policy",
          {},
        );
        assert.equal(
          z.object({ schema_version: z.literal(1) }).safeParse(out).success,
          false,
        );
      } else
        await assert.rejects(() =>
          call("Test", z.object({ value: z.string() }), "policy", {}),
        );
      assert.ok(requests >= 1 && requests <= 3);
      if (n === 22) {
        assert.equal(requests, 1);
        assert.equal(now, 0);
      }
    }
    checks.push("real transport bounded controlled fault variants");
  }
  if ([13, 14, 30].includes(n)) {
    const target = structuredClone(s.base);
    target.rooms[0].name = "Synthetic reviewed room";
    const p = await s.proposal(target);
    if (n === 13) {
      const other = structuredClone(s.base);
      other.rooms[0].name = "Synthetic competing room";
      const stale = await s.proposal(other);
      await s.approve(p);
      await assert.rejects(() => s.approve(stale), /Stale plan/);
      checks.push("real stale approval transaction rejects with no revision");
    } else if (n === 14) {
      const key = randomUUID();
      const clients = await Promise.all(
        [0, 1].map(async () => {
          const db = new pg.Client({ connectionString: lab.connectionString });
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
        await assert.rejects(
          () =>
            s.one("select public.approve_proposal($1,$2,$3,$4,$5,$6) value", [
              s.event,
              p.id,
              p.base_revision_id,
              p.generation,
              "0".repeat(64),
              key,
            ]),
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
      checks.push(
        "two real concurrent transactions return one receipt; changed replay rejected",
      );
    } else {
      const receipt = await s.approve(p);
      assert.throws(() => {
        throw new Error("controlled briefing response loss after commit");
      });
      const revision = (
        await lab.ownerQuery(
          "select id,revision_number,approved_at,snapshot from public.revisions where id=$1",
          [receipt.revision_id],
        )
      ).rows[0];
      const first = briefingText(revision, s.base);
      const reloaded = (
        await lab.ownerQuery(
          "select id,revision_number,approved_at,snapshot from public.revisions where id=$1",
          [receipt.revision_id],
        )
      ).rows[0];
      assert.equal(first, briefingText(reloaded, s.base));
      assert.ok(first.includes(`Approved revision 2 (${receipt.revision_id})`));
      assert.ok(first.includes(`Event date: ${s.base.event.date}`));
      assert.ok(first.includes(`Timezone: ${s.base.event.timezone}`));
      assert.ok(first.includes("Synthetic reviewed room"));
      assert.ok(first.includes("Pending updates are excluded."));
      assert.equal(await s.head(), receipt.revision_id);
      checks.push(
        "actual commit survives controlled response loss, deterministic briefing retry",
      );
    }
    const count = (
      await lab.ownerQuery(
        "select count(*)::int n from public.revisions where event_id=$1",
        [s.event],
      )
    ).rows[0].n;
    assert.equal(count, 2);
    const official = (
      await lab.ownerQuery(
        "select (select count(*)::int from public.approval_receipts where event_id=$1 and operation='approve') receipts,(select count(*)::int from public.audit_events where event_id=$1 and action='proposal_approved') audits",
        [s.event],
      )
    ).rows[0];
    assert.deepEqual(official, { receipts: 1, audits: 1 });
  } else if (n !== 2) assert.equal(await s.head(), s.baseId);
  if ([15, 20].includes(n)) {
    const span = { start: 0, end: s.text.length, quote: s.text };
    const original = {
      ...move(n === 20 ? "10:00" : "12:00", n === 20 ? "11:00" : "13:00"),
      span,
    };
    const envelope = {
      schema_version: 1,
      base_revision_id: s.baseId,
      intents: [original],
      questions: [],
      unsupported_requests: [],
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
              span,
            },
          ];
    const actual = applyIntents(s.base, changed, s.job.id);
    const fault = s.mapped(c.input.fault_injections[0].candidate_plan);
    assert.deepEqual(
      { ...actual, provenance: [] },
      { ...fault, provenance: [] },
    );
    assert.equal(
      (
        await lab.db.query(
          "select eventops_private.analysis_option_valid($1::jsonb,$2::jsonb) value",
          [JSON.stringify(envelope), JSON.stringify(changed)],
        )
      ).rows[0].value,
      false,
    );
    checks.push(
      "exact corpus fault candidate rejected by SQL interpreted request coverage",
    );
  }
  if (n === 12) {
    const forged = structuredClone(s.base);
    forged.provenance[0].source_record_ids = [id(999)];
    assert.equal(
      (
        await lab.db.query(
          "select eventops_private.evidence_valid($1::jsonb,null,$2,$3) value",
          [JSON.stringify(forged), s.job.workspace_id, s.event],
        )
      ).rows[0].value,
      false,
    );
    const other = randomUUID();
    await lab.db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now());",
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
    const foreignSource = foreign.snapshot.provenance[0].source_record_ids[0];
    forged.provenance[0].source_record_ids = [foreignSource];
    assert.equal(
      (
        await lab.db.query(
          "select eventops_private.evidence_valid($1::jsonb,null,$2,$3) value",
          [JSON.stringify(forged), s.job.workspace_id, s.event],
        )
      ).rows[0].value,
      false,
    );
    assert.equal(
      (
        await lab.ownerQuery(
          "select id from public.source_records where id=$1",
          [foreignSource],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await lab.ownerQuery(
          "select id from public.events where id=$1",
          [s.event],
          randomUUID(),
        )
      ).rows.length,
      0,
    );
    checks.push(
      "actual SQL rejects nonexistent and existing foreign workspace evidence; RLS denies foreign source and event",
    );
  }
  if ([25, 26].includes(n)) {
    const fake = controlledCall(c, s, [move()]);
    const success = await hold(`${c.case_id}-${repeat}-success`, () =>
      analyzeUpdate({
        plan: s.base,
        text: s.text,
        baseId: s.baseId,
        sourceId: s.source,
        jobId: s.job.id,
        call: (...args) => fake.call(...args),
      }),
    )();
    assert.equal(success.status, "ready_for_confirmation");
    const token = randomUUID();
    // Test-only running lease fixture in the isolated database, gates never enabled.
    await lab.db.query(
      "update public.analysis_jobs set state='running',lease_token=$2,lease_until=now()+interval '120 seconds',attempts=1 where id=$1",
      [s.job.id, token],
    );
    if (n === 25) {
      await lab.db.query(
        "update public.analysis_jobs set lease_until=now()-interval '1 second' where id=$1",
        [s.job.id],
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.stage($1,$2,'Checking plan') value",
            [s.job.id, token],
          )
        ).rows[0].value,
        false,
      );
      const newToken = randomUUID();
      await lab.db.query(
        "update public.analysis_jobs set lease_token=$2,lease_until=now()+interval '120 seconds' where id=$1",
        [s.job.id, newToken],
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.stage($1,$2,'Checking plan') value",
            [s.job.id, token],
          )
        ).rows[0].value,
        false,
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.stage($1,$2,'Checking plan') value",
            [s.job.id, newToken],
          )
        ).rows[0].value,
        true,
      );
      const usage = JSON.stringify({
        reported: false,
        input_tokens: 0,
        output_tokens: 0,
        calls: fake.count,
      });
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, token, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        false,
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, newToken, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        true,
      );
      assert.equal(
        (
          await lab.db.query(
            "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb) value",
            [s.job.id, newToken, JSON.stringify(success), usage],
          )
        ).rows[0].value,
        false,
      );
      checks.push(
        "expired lease and old token denied, controlled new token accepted; automatic reclaim stays gated",
      );
    } else {
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
          await lab.db.query(
            "select eventops_worker_api.stage($1,$2,'Checking plan') value",
            [s.job.id, token],
          )
        ).rows[0].value,
        false,
      );
      const usage = {
        reported: false,
        input_tokens: 0,
        output_tokens: 0,
        calls: 0,
      };
      await lab.db.query(
        "select eventops_worker_api.finish($1,$2,$3::jsonb,null,$4::jsonb)",
        [s.job.id, token, JSON.stringify(success), JSON.stringify(usage)],
      );
      const late = (
        await lab.ownerQuery(
          "select state,result from public.analysis_jobs where id=$1",
          [s.job.id],
        )
      ).rows[0];
      assert.equal(late.state, "stale");
      assert.equal(late.result, null);
      const current = (
        await lab.ownerQuery(
          "select corrected_text,generation from public.text_update_drafts where id=$1",
          [s.draft.id],
        )
      ).rows[0];
      assert.equal(current.corrected_text, edited);
      assert.equal(current.generation, 2);
      checks.push("real worker finish cannot replace edited generation");
    }
  }
  if (n === 27) {
    const context = await s.one(
      "select public.restore_review_context($1) value",
      [s.event],
    );
    assert.ok(
      context.context.drafts.some((d) => d.text.includes("Restore revision")),
    );
    const probe = s.mapped(c.expected.constraint_probes[0].plan);
    const p = await s.proposal(probe);
    assert.equal(p.state, "infeasible");
    await assert.rejects(() => s.approve(p));
    checks.push(
      "historical assignment with later absence cannot pass actual approval",
    );
  }
  if (n === 28) {
    for (const file of audio.files)
      assert.equal(
        sha(await readFile("evals/t9/audio/" + file.file)),
        file.sha256,
      );
    const original = "Synthetic Alex will cover Opening.";
    const corrected = "Synthetic Sam will cover Opening.";
    const voiceDraft = await s.one(
      "select public.save_text_update($1,$2,$3,$4) value",
      [s.event, original, corrected, randomUUID()],
    );
    assert.equal(voiceDraft.raw_text, original);
    assert.equal(voiceDraft.corrected_text, corrected);
    await assert.rejects(() =>
      s.one("select public.confirm_text_analysis($1,$2,1,$3,$4,false) value", [
        s.event,
        voiceDraft.id,
        s.baseId,
        corrected,
      ]),
    );
    assert.equal(
      (
        await lab.ownerQuery(
          "select count(*)::int n from public.analysis_jobs where draft_id=$1",
          [voiceDraft.id],
        )
      ).rows[0].n,
      0,
    );
    await campaignCall(
      {
        path: campaignPath,
        limitMicrousd: 13_500_000,
        amountMicrousd: 18000,
        key: `E28-${repeat}-voice`,
      },
      async () => {
        for (const kind of ["silence", "noise", "speech"]) {
          const file = audio.files.find((v) => v.kind === kind);
          const { wav } = await convertRecording(
            await readFile("evals/t9/audio/" + file.file),
            file.mime,
            process.env.EVENTOPS_FFMPEG_PATH,
          );
          const transcribe = createTranscriber(
            "synthetic-unused",
            async (_url, request) => {
              assert.equal(
                JSON.parse(await request.body.get("request").text()).model,
                "muse-voice-transcribe-1.0",
              );
              assert.ok(request.body.get("audio").size > 0);
              return new Response(
                JSON.stringify({
                  transcript: kind === "speech" ? original : " ",
                }),
              );
            },
          );
          if (kind === "speech") assert.equal(await transcribe(wav), original);
          else await assert.rejects(() => transcribe(wav));
        }
      },
    )();
    checks.push(
      "real codec/transcription adapter with controlled silence/noise/name responses; immutable original, correction, and no job before confirmation",
    );
  }
  if (n === 29) {
    const allowance = join(temp, `E29-${repeat}.jsonl`);
    const { reserveCampaign } = await import("./lib/t9-allowance.mjs");
    const settled = await Promise.allSettled(
      ["a", "b"].map((key) =>
        reserveCampaign({
          path: allowance,
          limitMicrousd: 150000,
          amountMicrousd: 150000,
          key,
        }),
      ),
    );
    assert.equal(settled.filter((v) => v.status === "fulfilled").length, 1);
    for (const [group, attempts] of [
      [0, 10],
      [1, 3],
    ]) {
      const historicalText = `Synthetic past budget fixture ${group}`;
      const d = await s.one(
        "select public.save_text_update($1,$2,$2,$3) value",
        [s.event, historicalText, randomUUID()],
      );
      const j = await s.one(
        "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
        [s.event, d.id, s.baseId, historicalText],
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
    const contenders = await Promise.all(
      [0, 1].map(async () => {
        const db = new pg.Client({ connectionString: lab.connectionString });
        await db.connect();
        return db;
      }),
    );
    try {
      const values = await Promise.all(
        contenders.map((db, i) =>
          db.query(
            "select eventops_private.reserve_analysis(j,$2) value from public.analysis_jobs j where id=$1",
            [s.job.id, i + 1],
          ),
        ),
      );
      assert.equal(values.filter((v) => v.rows[0].value).length, 1);
      assert.equal(
        (
          await lab.db.query(
            "select sum(charged_usd)::text total from public.model_runs where event_id=$1",
            [s.event],
          )
        ).rows[0].total,
        "2.000000",
      );
    } finally {
      await Promise.all(contenders.map((db) => db.end()));
    }
    await lab.db.query("delete from public.model_runs where event_id=$1", [
      s.event,
    ]);
    checks.push(
      "durable campaign race and real PostgreSQL shared allowance race both prevent overspend",
    );
  }
  await s.one("select public.change_event_lifecycle($1,1,'archive') value", [
    s.event,
  ]);
  const gates = (
    await lab.db.query(
      "select (select enabled from eventops_private.analysis_budget_lock) a,(select enabled from eventops_private.voice_gate) v",
    )
  ).rows[0];
  assert.equal(gates.a, false);
  assert.equal(gates.v, false);
  return {
    case_id: c.case_id,
    repeat,
    status: "local_checks_passed",
    checks,
    controlled_calls: controlledCalls,
    live_provider_calls: 0,
    latency_ms: Math.round(performance.now() - started),
  };
}
try {
  lab = await databaseLab();
  for (const c of corpus.cases)
    for (let repeat = 1; repeat <= 3; repeat++) {
      const result = await exercise(c, repeat);
      results.push(result);
      console.log(
        "PASS",
        c.case_id,
        repeat,
        result.checks.length,
        "local checks",
      );
    }
  await mkdir("output", { recursive: true });
  const report = {
    mode: "controlled_local",
    migrations: lab.migrations,
    local_cases: 30,
    local_repeats: results.length,
    live_runs_executed: 0,
    provider_spend_usd: 0,
    live_ai_enabled: false,
    source_sha256: Object.fromEntries(
      await Promise.all(
        [
          "evals/t9/corpus.json",
          "evals/t9/audio/manifest.json",
          "scripts/verify-t9-evaluation.mjs",
          "scripts/lib/t9-database.mjs",
          "scripts/lib/t9-allowance.mjs",
        ].map(async (path) => [path, sha(await readFile(path))]),
      ),
    ),
    limitations: [
      "Controlled responses do not measure model quality.",
      "E25 uses an isolated controlled replacement lease; automatic reclaim remains gated.",
      "E28 does not establish physical microphone permissions or actual transcription quality.",
      "This SQL lab does not exercise HTTP auth or hosted Storage.",
    ],
    campaign_reservations:
      "Durable conservative test reservations, not billed usage or spending authority",
    results,
  };
  await writeFile(
    "output/t9-local-evaluation-2026-10-30.json",
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      local_repeats_passed: results.length,
      live_runs: 0,
      migrations: lab.migrations,
    }),
  );
} finally {
  if (lab) await lab.close();
  await rm(temp, { recursive: true, force: true });
}
