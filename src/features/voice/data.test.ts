// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { ownedEvent, planRpc, upload } = vi.hoisted(() => ({
  ownedEvent: vi.fn(),
  planRpc: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/features/plans/data", () => ({ ownedEvent, planRpc }));
import { POST } from "@/app/api/events/[id]/voice/route";
const id = "11111111-1111-4111-8111-111111111111";
function request(
  bytes: Uint8Array = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  origin = "http://localhost:3000",
) {
  return new Request(`http://localhost:3000/api/events/${id}/voice`, {
    method: "POST",
    headers: {
      origin,
      "Content-Type": "audio/webm",
      "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
    },
    body: Uint8Array.from(bytes),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("recording HTTP boundary", () => {
  function configure(enabled = true) {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("EVENTOPS_VOICE_ENABLED", enabled ? "1" : "0");
    vi.stubEnv("EVENTOPS_META_ACCESS_VERIFIED", "1");
    vi.stubEnv("EVENTOPS_META_BILLING_BOUND_VERIFIED", "1");
    ownedEvent.mockResolvedValue({
      client: { storage: { from: () => ({ upload }) } },
    });
  }
  it("returns unavailable before reading or storing audio when access is off", async () => {
    configure(false);
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(503);
    expect(planRpc).not.toHaveBeenCalled();
  });
  it("rejects wrong origin before upload", async () => {
    configure();
    const response = await POST(request(undefined, "https://foreign.test"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects disguised and over-limit input without a saved job", async () => {
    configure();
    expect(
      (
        await POST(request(Buffer.from("fake")), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await POST(request(Buffer.alloc(10 * 1024 * 1024 + 1)), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(413);
    expect(planRpc).not.toHaveBeenCalled();
  });
  it("creates the byte receipt, privately uploads, then acknowledges a durable queued job", async () => {
    configure();
    planRpc
      .mockResolvedValueOnce({
        id: "job",
        state: "uploading",
        object_key: "owned/path",
      })
      .mockResolvedValueOnce({ id: "job", state: "queued" });
    upload.mockResolvedValue({ error: null });
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id: "job", state: "queued" });
    expect(planRpc.mock.calls[0]?.[0]).toBe("begin_voice");
    expect(planRpc.mock.calls[0]?.[1]).toMatchObject({
      p_bytes: 4,
      p_mime: "audio/webm",
    });
    expect(upload).toHaveBeenCalledWith("owned/path", expect.any(Buffer), {
      contentType: "audio/webm",
      upsert: false,
    });
    expect(planRpc.mock.calls[1]).toEqual([
      "queue_voice",
      { p_event_id: id, p_job_id: "job" },
    ]);
  });
  it("denies unauthenticated access before consuming audio", async () => {
    configure();
    ownedEvent.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });
});
