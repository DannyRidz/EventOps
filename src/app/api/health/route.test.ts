// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GET } from "./route";
describe("process liveness", () => {
  it("returns uncached process health without claiming external service readiness", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
