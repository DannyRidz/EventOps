// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("internal verification route access boundary, AC-31", () => {
  it("rejects production access even with the flag enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EVENTOPS_INTERNAL_UI", "1");
    const response = proxy();
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Foundation UI checks");
  });
  it("requires explicit opt in for local checks", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EVENTOPS_INTERNAL_UI", "0");
    expect(proxy().status).toBe(404);
  });
  it("allows explicitly enabled development checks", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EVENTOPS_INTERNAL_UI", "1");
    expect(proxy().headers.get("x-middleware-next")).toBe("1");
  });
});
