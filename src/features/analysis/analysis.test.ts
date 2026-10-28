import { describe, it, expect, vi } from "vitest";
import { fixturePlan, fixtureId } from "@/features/plans/fixtures";
import {
  applyIntents,
  findAlternatives,
  validateInterpretation,
  getImpactedRecords,
  generatedId,
} from "./tools";
import { providerContext } from "./privacy";
import { analyzeUpdate } from "./orchestrate";
import {
  createMetaTransport,
  MODEL_ID,
  liveModelEnabled,
  modelJsonSchema,
  type Usage,
} from "./provider";
import { z } from "zod";
import {
  interpretationSchema,
  type Intent,
  type Interpretation,
} from "./contracts";
const plan = fixturePlan(),
  baseId = fixtureId(900),
  seed = fixtureId(901),
  sourceId = fixtureId(902);
const text = "Move opening to 12:00 to 13:00.";
const change: Intent = {
  intent_id: "time",
  action: "change_time",
  session_id: plan.sessions[0]!.id,
  time_choices: [
    { start: "12:00", end: "13:00", start_offset: null, end_offset: null },
  ],
  span: { start: 0, end: text.length, quote: text },
};
const envelope = (intents: Intent[] = [change]): Interpretation => ({
  schema_version: 1,
  base_revision_id: baseId,
  intents,
  questions: [],
  unsupported_requests: [],
});
describe("deterministic request tools", () => {
  it("moves session and assignment together without changing other sessions", () => {
    const p = applyIntents(plan, [change], seed);
    expect(p.sessions[0]?.start).toBe("12:00");
    expect(p.assignments[0]?.start).toBe("12:00");
    expect(p.sessions[1]).toEqual(plan.sessions[1]);
    expect(plan.sessions[0]?.start).toBe("10:00");
  });
  it("blocks options with dependency or room conflicts outside the edited item", () => {
    const r = findAlternatives(plan, envelope(), seed);
    expect(r.options).toHaveLength(0);
    expect(r.issues.some((i) => i.rule === "DEPENDENCY")).toBe(true);
    expect(r.questions.length).toBeGreaterThan(0);
  });
  it("validates only explicitly permitted time choices and existing roster replacements", () => {
    const p = fixturePlan();
    p.dependencies = [];
    const r = findAlternatives(p, envelope(), seed);
    expect(r.options[0]?.requests[0]).toEqual(change);
    expect(r.options).toHaveLength(1);
  });
  it("rejects invented IDs, fabricated text spans, duplicate request IDs and implicit time flexibility", () => {
    expect(() =>
      validateInterpretation(
        envelope([{ ...change, session_id: fixtureId(999) }]),
        plan,
        text,
        baseId,
      ),
    ).toThrow("UNKNOWN_RECORD");
    expect(() =>
      validateInterpretation(
        envelope([{ ...change, span: { ...change.span, quote: "invented" } }]),
        plan,
        text,
        baseId,
      ),
    ).toThrow("INVALID_TEXT_EVIDENCE");
    expect(() =>
      validateInterpretation(envelope([change, change]), plan, text, baseId),
    ).toThrow("DUPLICATE_REQUEST");
    expect(() =>
      validateInterpretation(
        envelope([
          {
            ...change,
            time_choices: [{ ...change.time_choices[0]!, start: "14:00" }],
          },
        ]),
        plan,
        text,
        baseId,
      ),
    ).toThrow("UNCONFIRMED_TIME_FLEXIBILITY");
  });
  it("does not guess identity from a duplicate display name", () => {
    const p = fixturePlan();
    p.volunteers[1]!.display_name = p.volunteers[0]!.display_name;
    const t = "Synthetic Alex unavailable 10:00 to 11:00";
    const r: Intent = {
      action: "record_availability",
      intent_id: "availability",
      volunteer_id: p.volunteers[0]!.id,
      status: "unavailable",
      interval: {
        start: "10:00",
        end: "11:00",
        start_offset: null,
        end_offset: null,
      },
      span: { start: 0, end: t.length, quote: t },
    };
    expect(() => validateInterpretation(envelope([r]), p, t, baseId)).toThrow(
      "AMBIGUOUS_RECORD",
    );
  });
  it("finds full impact closure including dependencies and shared room assignments", () => {
    const ids = getImpactedRecords(plan, [change]);
    for (const row of [
      ...plan.sessions,
      ...plan.assignments,
      ...plan.dependencies,
    ])
      expect(ids).toContain(row.id);
    expect(ids).toContain(plan.rooms[0]!.id);
    expect(ids).toContain(plan.volunteers[0]!.id);
    expect(ids).not.toContain(plan.volunteers[1]!.id);
  });
  it("server generated IDs are stable valid UUIDs", () => {
    expect(z.uuid().parse(generatedId(seed, "availability", "a"))).toBe(
      generatedId(seed, "availability", "a"),
    );
  });
  it("masks volunteer names and restores exact Unicode source spans", () => {
    const t = "😀 Synthetic Alex unavailable 10:00 to 11:00";
    const context = providerContext(plan, t);
    expect(context.text).not.toContain("Synthetic Alex");
    expect(context.plan.volunteers[0]?.display_name).toBe("Volunteer 1");
    const quote = context.text;
    const restored = context.restore(
      envelope([
        {
          action: "record_availability",
          intent_id: "a",
          volunteer_id: plan.volunteers[0]!.id,
          status: "unavailable",
          interval: {
            start: "10:00",
            end: "11:00",
            start_offset: null,
            end_offset: null,
          },
          span: { start: 0, end: quote.length, quote },
        },
      ]),
    );
    expect(restored.intents[0]?.span).toEqual({
      start: 0,
      end: Array.from(t).length,
      quote: t,
    });
    expect(() =>
      validateInterpretation(restored, plan, t, baseId),
    ).not.toThrow();
  });
});
const modelEnvelope = (p = plan) => {
  const masked = providerContext(p, text).text;
  return {
    ...envelope(),
    intents: [
      { ...change, span: { start: 0, end: masked.length, quote: masked } },
    ],
  };
};
describe("bounded orchestration", () => {
  it("selects only a valid option and verifies complete evidence backed request coverage", async () => {
    const p = fixturePlan();
    p.dependencies = [];
    const call = vi
      .fn()
      .mockResolvedValueOnce(modelEnvelope(p))
      .mockResolvedValueOnce({
        base_revision_id: baseId,
        selected_option_id: "option-1",
        dispositions: [
          { intent_id: "time", status: "satisfied", evidence_refs: [sourceId] },
        ],
      });
    const r = await analyzeUpdate({
      plan: p,
      text,
      baseId,
      sourceId,
      jobId: seed,
      call,
    });
    expect(r.status).toBe("ready_for_confirmation");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("stops after questions rather than generating a purported solution", async () => {
    const call = vi.fn().mockResolvedValue({
      ...modelEnvelope(),
      questions: ["May the session move later?"],
    });
    const r = await analyzeUpdate({
      plan,
      text,
      baseId,
      sourceId,
      jobId: seed,
      call,
    });
    expect(r.status).toBe("unresolved");
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("repairs once, then fails closed when option or citations are fabricated", async () => {
    const p = fixturePlan();
    p.dependencies = [];
    const call = vi
      .fn()
      .mockResolvedValueOnce(modelEnvelope(p))
      .mockResolvedValue({
        base_revision_id: baseId,
        selected_option_id: "invented",
        dispositions: [
          {
            intent_id: "time",
            status: "satisfied",
            evidence_refs: [fixtureId(999)],
          },
        ],
      });
    const r = await analyzeUpdate({
      plan: p,
      text,
      baseId,
      sourceId,
      jobId: seed,
      call,
    });
    expect(r.status).toBe("unresolved");
    expect(r.options).toEqual([]);
    expect(call).toHaveBeenCalledTimes(3);
  });
});
const usage = (): Usage => ({
  calls: 0,
  input_tokens: 0,
  output_tokens: 0,
  reported: true,
});
const response = (content: unknown) =>
  Response.json({
    model: MODEL_ID,
    choices: [
      {
        finish_reason: "stop",
        message: { content: JSON.stringify(content), refusal: null },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });
describe("Meta HTTP boundary", () => {
  it("uses only the fixed Standard model endpoint and strict schema, never tools or provider state", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true }));
    const u = usage();
    const call = createMetaTransport({
      key: "synthetic-test-key",
      usage: u,
      deadline: Date.now() + 90000,
      fetcher,
    });
    await call("Result", z.strictObject({ ok: z.boolean() }), "Policy", {
      text: "untrusted",
    });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.meta.ai/v1/chat/completions");
    const body = JSON.parse(options.body);
    expect(body.model).toBe(MODEL_ID);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.max_completion_tokens).toBe(4000);
    expect(body.store).toBe(false);
    expect(body).not.toHaveProperty("tools");
    expect(u).toEqual({
      calls: 1,
      input_tokens: 100,
      output_tokens: 20,
      reported: true,
    });
  });
  it("does not retry provider access errors and keeps a conservative charge", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("denied", { status: 403 }));
    const u = usage();
    const call = createMetaTransport({
      key: "test",
      usage: u,
      deadline: Date.now() + 90000,
      fetcher,
    });
    await expect(
      call("R", z.strictObject({ ok: z.boolean() }), "Policy", {}),
    ).rejects.toThrow("PROVIDER_ACCESS");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(u.reported).toBe(false);
  });
  it("honors Retry-After inside the global call budget and charges unknown attempts", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("throttle", {
          status: 429,
          headers: { "Retry-After": "2" },
        }),
      )
      .mockResolvedValue(response({ ok: true }));
    const sleep = vi.fn(async () => {}),
      u = usage();
    await createMetaTransport({
      key: "test",
      usage: u,
      deadline: Date.now() + 90000,
      fetcher,
      sleep,
    })("R", z.strictObject({ ok: z.boolean() }), "Policy", {});
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(u.calls).toBe(2);
    expect(u.reported).toBe(false);
  });
  it("cannot retry a 429 beyond deadline and rejects oversized context before network I/O", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("throttle", {
        status: 429,
        headers: { "Retry-After": "999" },
      }),
    );
    await expect(
      createMetaTransport({
        key: "test",
        usage: usage(),
        deadline: Date.now() + 90000,
        fetcher,
      })("R", z.strictObject({ ok: z.boolean() }), "Policy", {}),
    ).rejects.toThrow("PROVIDER_RATE_LIMIT");
    const noCall = vi.fn();
    await expect(
      createMetaTransport({
        key: "test",
        usage: usage(),
        deadline: Date.now() + 90000,
        fetcher: noCall,
      })("R", z.strictObject({ ok: z.boolean() }), "Policy", {
        text: "a".repeat(16001),
      }),
    ).rejects.toThrow("CONTEXT_TOO_LARGE");
    expect(noCall).not.toHaveBeenCalled();
  });
  it("requires all explicit live access gates and a key", () => {
    expect(liveModelEnabled({ MODEL_API_KEY: "exists" })).toBe(false);
    expect(
      liveModelEnabled({
        EVENTOPS_MODEL_ENABLED: "1",
        EVENTOPS_META_ACCESS_VERIFIED: "1",
        EVENTOPS_META_BILLING_BOUND_VERIFIED: "1",
        MODEL_API_KEY: "test",
      }),
    ).toBe(true);
  });
});
describe("analysis failure regressions", () => {
  it("returns questions for conflicting time, room and cancellation requests before calling selection", async () => {
    const p = fixturePlan();
    p.dependencies = [];
    const conflicting = {
      ...change,
      intent_id: "second-time",
      time_choices: [
        { ...change.time_choices[0]!, start: "13:00", end: "14:00" },
      ],
    };
    const data = envelope([change, conflicting]);
    const result = findAlternatives(p, data, seed);
    expect(result.options).toEqual([]);
    expect(result.questions.join(" ")).toMatch(/More than one request/);
    const cancelled = {
      action: "cancel_session" as const,
      intent_id: "cancel",
      session_id: change.session_id,
      span: change.span,
    };
    expect(
      findAlternatives(p, envelope([change, cancelled]), seed).questions.join(
        " ",
      ),
    ).toMatch(/both cancelled and changed/);
  });
  it("masks case variants, partial names, external aliases, and contacts in all provider free text", () => {
    const p = fixturePlan();
    p.event.name = "Alex gathering";
    p.rooms[0]!.name = "alex room";
    const context = providerContext(
      p,
      "alex says SAM and ALEX. alex@example.test +673 1234567",
    );
    expect(context.text).not.toMatch(/alex|sam|example.test|673/i);
    expect(JSON.stringify(context.plan)).not.toMatch(/alex|sam/i);
    expect(context.text).toContain("Contact omitted");
  });
  it("retains unknown usage after wrong-model, missing-body and oversized responses", async () => {
    for (const r of [
      Response.json({
        model: "other",
        choices: [{ finish_reason: "stop", message: { content: "{}" } }],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
      new Response(null),
      new Response("x".repeat(128001)),
    ]) {
      const u = usage();
      const call = createMetaTransport({
        key: "test",
        usage: u,
        deadline: Date.now() + 90000,
        fetcher: vi.fn().mockResolvedValue(r),
      });
      await expect(
        call("R", z.strictObject({ ok: z.boolean() }), "Policy", {}),
      ).rejects.toThrow();
      expect(u.reported).toBe(false);
      expect(u.calls).toBe(1);
    }
  });
  it("bounds a stalled response body and preserves its unknown cost", async () => {
    const u = usage();
    const r = new Response(new ReadableStream({ start() {} }));
    const call = createMetaTransport({
      key: "test",
      usage: u,
      deadline: Date.now() + 100,
      fetcher: vi.fn().mockResolvedValue(r),
    });
    await expect(
      call("R", z.strictObject({ ok: z.boolean() }), "Policy", {}),
    ).rejects.toThrow("ANALYSIS_LIMIT");
    expect(u.reported).toBe(false);
  });
});
describe("internal room and cancellation scenario", () => {
  function scenario() {
    const p = fixturePlan();
    p.dependencies = [];
    p.sessions[1] = {
      ...p.sessions[1]!,
      room_id: p.rooms[1]!.id,
      start: "10:00",
      end: "11:00",
      starts_at: p.sessions[0]!.starts_at,
      ends_at: p.sessions[0]!.ends_at,
    };
    p.assignments[1] = {
      ...p.assignments[1]!,
      volunteer_id: p.volunteers[1]!.id,
      start: "10:00",
      end: "11:00",
      starts_at: p.sessions[0]!.starts_at,
      ends_at: p.sessions[0]!.ends_at,
    };
    p.rooms[1]!.capacity = 40;
    p.rooms[1]!.feature_tags = ["projector"];
    return p;
  }
  const quote =
    "Move opening to room side, allow 11:15 to 12:15. Alex unavailable 10:00 to 12:15; find a replacement.";
  const span = { start: 0, end: quote.length, quote };
  function requests(
    p: ReturnType<typeof fixturePlan>,
    later: boolean,
  ): Intent[] {
    return [
      {
        action: "move_session",
        intent_id: "room",
        session_id: p.sessions[0]!.id,
        room_id: p.rooms[1]!.id,
        time_choices: later
          ? [
              {
                start: "11:15",
                end: "12:15",
                start_offset: null,
                end_offset: null,
              },
            ]
          : [],
        span,
      },
      {
        action: "record_availability",
        intent_id: "cancel",
        volunteer_id: p.volunteers[0]!.id,
        status: "unavailable",
        interval: {
          start: "10:00",
          end: "12:15",
          start_offset: null,
          end_offset: null,
        },
        span,
      },
      {
        action: "change_assignment",
        intent_id: "replacement",
        session_id: p.sessions[0]!.id,
        from_volunteer_id: p.volunteers[0]!.id,
        to_volunteer_id: null,
        find_replacement: true,
        role_tag: "usher",
        span,
      },
    ];
  }
  it("cannot satisfy the occupied-room request by leaving the session in its original room", () => {
    const p = scenario();
    const r = findAlternatives(p, envelope(requests(p, false)), seed);
    expect(r.options).toEqual([]);
    expect(r.issues.some((i) => i.rule === "ROOM_OVERLAP")).toBe(true);
    expect(r.questions.length).toBeGreaterThan(0);
  });
  it("finds only the explicitly permitted later time and proven replacement", () => {
    const p = scenario();
    const r = findAlternatives(p, envelope(requests(p, true)), seed);
    expect(r.options).toHaveLength(1);
    const candidate = applyIntents(p, r.options[0]!.requests, seed);
    expect(candidate.sessions[0]?.room_id).toBe(p.rooms[1]?.id);
    expect(candidate.sessions[0]?.start).toBe("11:15");
    expect(
      candidate.assignments.find((a) => a.session_id === p.sessions[0]?.id)
        ?.volunteer_id,
    ).toBe(p.volunteers[1]?.id);
  });
  it("keeps the request unresolved when replacement availability or room features are missing", () => {
    for (const missing of ["availability", "projector"]) {
      const p = scenario();
      if (missing === "availability")
        p.availability = p.availability.filter(
          (a) => a.volunteer_id !== p.volunteers[1]?.id,
        );
      else p.rooms[1]!.feature_tags = [];
      expect(
        findAlternatives(p, envelope(requests(p, true)), seed).options,
      ).toEqual([]);
    }
  });
});

it("provider schemas use only the supported strict subset", () => {
  const schema = modelJsonSchema(interpretationSchema);
  expect(JSON.stringify(schema)).not.toContain('"oneOf"');
  expect(schema.type).toBe("object");
});
it("preserves elapsed assignment buffers when moving through a repeated local clock time", async () => {
  const { analysisFoldPlan } = await import("./fixtures");
  const p = analysisFoldPlan();
  const r: Intent = {
    ...change,
    session_id: p.sessions[0]!.id,
    time_choices: [
      {
        start: "01:30",
        end: "02:00",
        start_offset: "-05:00",
        end_offset: "-05:00",
      },
    ],
  };
  const candidate = applyIntents(p, [r], seed);
  expect(candidate.sessions[0]?.start_offset).toBe("-05:00");
  expect(candidate.assignments[0]?.start).toBe("01:30");
  expect(candidate.assignments[0]?.start_offset).toBe("-04:00");
  expect(candidate.assignments[0]?.end_offset).toBe("-05:00");
  expect(
    Date.parse(candidate.assignments[0]!.ends_at) -
      Date.parse(candidate.assignments[0]!.starts_at),
  ).toBe(
    Date.parse(p.assignments[0]!.ends_at) -
      Date.parse(p.assignments[0]!.starts_at),
  );
});
