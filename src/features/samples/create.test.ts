import { describe, expect, it, vi } from "vitest";
import { resolveSetup } from "@/features/events/validation";
import { loadSample, sampleRequestKey } from "./create";
import { sampleRecords, sampleSetup } from "./sample";

const id = "12345678-1234-4234-8234-123456789abc";
const key = "12345678-1234-4234-8234-123456789abd";
function initial() {
  return {
    approved_revision: null,
    draft: {
      generation: 1,
      snapshot: resolveSetup(sampleSetup),
      plan_snapshot: null,
    },
  };
}

describe("sample creation uses normal draft boundaries", () => {
  it("stages only an empty original draft and never confirms or invokes AI", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ event_id: id })
      .mockResolvedValueOnce(initial())
      .mockResolvedValueOnce({ generation: 2 });
    const created = vi.fn();
    expect(await loadSample(request, key, created)).toBe(id);
    expect(created).toHaveBeenCalledWith(id);
    expect(request.mock.calls.map((c) => c[0])).toEqual([
      "/api/events",
      `/api/events/${id}/plan`,
      `/api/events/${id}/draft`,
    ]);
    expect(request.mock.calls[2]?.[1]).toMatchObject({
      expected_generation: 1,
      confirmed: true,
    });
    expect(request.mock.calls[2]?.[2]).toBe("PUT");
  });
  it("reconciles a lost stage response without staging twice", async () => {
    let staged = false;
    const request = vi.fn(
      async (path: string, _body?: unknown, method?: string) => {
        if (path === "/api/events") return { event_id: id };
        if (method === "GET")
          return {
            ...initial(),
            draft: {
              ...initial().draft,
              generation: staged ? 2 : 1,
              plan_snapshot: staged ? { preserved: true } : null,
            },
          };
        staged = true;
        throw new Error("Response lost after commit");
      },
    );
    await expect(loadSample(request, key, vi.fn())).rejects.toThrow(
      "Response lost",
    );
    expect(await loadSample(request, key, vi.fn())).toBe(id);
    expect(request.mock.calls.filter((c) => c[2] === "PUT")).toHaveLength(1);
    expect(
      request.mock.calls.filter((c) => c[0] === "/api/events").map((c) => c[1]),
    ).toEqual([
      { setup: sampleSetup, request_id: key },
      { setup: sampleSetup, request_id: key },
    ]);
  });
  it.each(["edited generation", "changed setup", "concurrent stage"])(
    "does not overwrite after %s",
    async (scenario) => {
      const current = initial();
      if (scenario === "edited generation") current.draft.generation = 2;
      if (scenario === "changed setup")
        current.draft.snapshot.name = "My real event";
      const request = vi
        .fn()
        .mockResolvedValueOnce({ event_id: id })
        .mockResolvedValueOnce(current)
        .mockRejectedValueOnce(new Error("Draft changed"));
      await expect(loadSample(request, key, vi.fn())).rejects.toThrow(
        scenario === "concurrent stage" ? "Draft changed" : "has changed",
      );
      expect(request.mock.calls.filter((c) => c[2] === "PUT")).toHaveLength(
        scenario === "concurrent stage" ? 1 : 0,
      );
    },
  );
  it("leaves an approved event untouched", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ event_id: id })
      .mockResolvedValueOnce({ ...initial(), approved_revision: { id: key } });
    expect(await loadSample(request, key, vi.fn())).toBe(id);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("retains one creation UUID across reloads and fails closed without storage", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (name: string) => map.get(name) ?? null,
      setItem: (name: string, value: string) => {
        map.set(name, value);
      },
    };
    const first = sampleRequestKey(storage);
    expect(sampleRequestKey(storage)).toBe(first);
    expect(map.size).toBe(1);
    expect([...map.values()]).toEqual([first]);
    expect(() =>
      sampleRequestKey({
        getItem() {
          throw new Error("Storage denied");
        },
        setItem() {},
      }),
    ).toThrow("Storage denied");
  });
  it("returns independent raw records without fabricated source receipts", () => {
    const one = sampleRecords();
    one.rooms[0]!.capacity = 1;
    expect(sampleRecords().rooms[0]?.capacity).toBe(40);
    expect(sampleRecords()).not.toHaveProperty("provenance");
    expect(sampleRecords().sessions).toHaveLength(2);
  });
});
