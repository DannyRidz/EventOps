// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createMetaTransport, type Usage } from "./provider";

const { createReceipt, responseDiagnostic, fencedWorker } = await import(
  new URL("../../../scripts/lib/live-evidence.mjs", import.meta.url).href
);

describe("live verification evidence boundaries", () => {
  it("fences a versioned worker claim and preserves the declared policy parameter", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("claim(") ? [{ job: { id: "expected-job" } }] : [],
    }));
    await fencedWorker({ query }, "expected-job").query(
      "select eventops_worker_api.claim($1::text) as job",
      ["eventops-text-v2"],
    );
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "begin",
      "select eventops_worker_api.claim($1::text) as job",
      "commit",
    ]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      "select eventops_worker_api.claim($1::text) as job",
      ["eventops-text-v2"],
    );
  });
  it("summarizes transcription without logging its text or inventing usage", async () => {
    const response = Response.json({
      transcript: "Synthetic private transcript",
    });
    const result = await responseDiagnostic(response);
    expect(result.response).toMatchObject({
      response_kind: "transcription",
      content_length: 28,
      usage_reported: false,
    });
    expect(result.response.usage).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(
      "Synthetic private transcript",
    );
    expect(await response.json()).toEqual({
      transcript: "Synthetic private transcript",
    });
  });
  it("keeps unknown content distinct from an empty transcript", async () => {
    expect(
      (await responseDiagnostic(Response.json({}))).response.content_length,
    ).toBeNull();
    expect(
      (await responseDiagnostic(Response.json({ transcript: "" }))).response
        .content_length,
    ).toBe(0);
  });
  it("retains actual usage when a transcription response supplies it", async () => {
    const result = await responseDiagnostic(
      Response.json({
        transcript: "Reviewed text",
        usage: { audio_seconds: 2 },
      }),
    );
    expect(result.response.usage_reported).toBe(true);
    expect(result.response.usage).toEqual({ audio_seconds: 2 });
    expect(result.response.content_length).toBe(13);
  });
  it("rolls back null claims so unrelated stale-job maintenance cannot persist", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(typeof sql).toBe("string");
      return { rows: [{ job: null }] };
    });
    await fencedWorker({ query }, "expected-job").query(
      "select eventops_worker_api.claim() as job",
    );
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "select eventops_worker_api.claim() as job",
      "rollback",
    ]);
  });
  it("rolls back a different job claimed during a queue race", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("claim()") ? [{ job: { id: "other-job" } }] : [],
    }));
    await expect(
      fencedWorker({ query }, "expected-job").query(
        "select eventops_worker_api.claim() as job",
      ),
    ).rejects.toThrow("UNEXPECTED_JOB_CLAIM_ROLLED_BACK");
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "begin",
      "select eventops_worker_api.claim() as job",
      "rollback",
    ]);
  });
  it("commits only the expected claim and leaves normal stage queries unchanged", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("claim()") ? [{ job: { id: "expected-job" } }] : [],
    }));
    const db = fencedWorker({ query }, "expected-job");
    await db.query("select eventops_worker_api.claim() as job");
    await db.query("select eventops_worker_api.stage($1,$2,$3)", [
      "expected-job",
      "lease",
      "Checking plan",
    ]);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "begin",
      "select eventops_worker_api.claim() as job",
      "commit",
      "select eventops_worker_api.stage($1,$2,$3)",
    ]);
  });
  it("preserves the first receipt across replay and mode collisions", async () => {
    const folder = await mkdtemp(join(tmpdir(), "eventops-evidence-"));
    try {
      const path = join(folder, "attempt-receipt.json");
      const save = await createReceipt(path, { kind: "text", live: true });
      for (const value of [
        { kind: "text", live: true },
        { kind: "text", live: false },
        { kind: "voice", live: true },
      ]) {
        await expect(createReceipt(path, value)).rejects.toMatchObject({
          code: "EEXIST",
        });
        expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
          kind: "text",
          live: true,
        });
      }
      await save({ kind: "text", live: true, outcome: "completed" });
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
        kind: "text",
        live: true,
        outcome: "completed",
      });
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(await readdir(folder)).toEqual(["attempt-receipt.json"]);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("refuses a symlink receipt without changing its target", async () => {
    const folder = await mkdtemp(join(tmpdir(), "eventops-evidence-link-"));
    try {
      const target = join(folder, "original.json");
      await writeFile(target, "original");
      const path = join(folder, "attempt-receipt.json");
      await symlink(target, path);
      await expect(createReceipt(path, {})).rejects.toThrow();
      expect(await readFile(target, "utf8")).toBe("original");
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it.each([
    ["malformed", "not json", "INVALID_JSON", "PROVIDER_SHAPE"],
    ["oversized", "x".repeat(128001), "TOO_LARGE", "PROVIDER_TOO_LARGE"],
  ])(
    "keeps %s diagnostics from changing adapter classification or retry count",
    async (_name, body, diagnostic, error) => {
      const fetcher = vi.fn(async () => {
        const response = new Response(body, { status: 200 });
        expect(await responseDiagnostic(response)).toEqual({ diagnostic });
        return response;
      });
      const usage: Usage = {
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        reported: true,
      };
      const call = createMetaTransport({
        key: "synthetic",
        fetcher,
        usage,
        deadline: Date.now() + 5000,
      });
      await expect(
        call("Result", z.strictObject({ ok: z.boolean() }), "Policy", {}),
      ).rejects.toThrow(error);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(usage.reported).toBe(false);
    },
  );
});
