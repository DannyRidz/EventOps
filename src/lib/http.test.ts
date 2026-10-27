// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoint, readJson } from "./http";
afterEach(() => vi.unstubAllEnvs());
const request = (
  body: string,
  origin = "http://localhost:3000",
  type = "application/json",
) =>
  new Request("http://localhost:3000/api/events", {
    method: "POST",
    headers: { origin, "Content-Type": type },
    body,
  });
describe("mutation boundary, AC-02", () => {
  it("accepts the configured origin and JSON", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(await readJson(request('{"name":"A"}'))).toEqual({ name: "A" });
  });
  it("denies foreign origins and malformed or excessive bodies with redacted envelopes", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    for (const [input, status] of [
      [request("{}", "https://other.test"), 403],
      [request("invalid"), 400],
      [request("x".repeat(16385)), 413],
      [request("{}", undefined, "text/plain"), 415],
    ] as const) {
      const response = await endpoint(async () => {
        await readJson(input);
        return Response.json({});
      });
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.request_id).toBeTruthy();
      expect(body.field_errors).toEqual({});
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
});
