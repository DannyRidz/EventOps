// @vitest-environment node
import { describe, it, expect } from "vitest";
// @ts-expect-error Verification helper.
import { reconcileSlot } from "../../../scripts/lib/t9-slot-integrity.mjs";
describe("independent journal and retained slot reconciliation", () => {
  it("rejects missing and restored stale SQL state before another call can be attempted", () => {
    const key = "t9-E02-1",
      keys = [key + "-call-1"];
    expect(() => reconcileSlot(key, undefined, keys)).toThrow();
    expect(() =>
      reconcileSlot(
        key,
        { phase: "prepared", result: { requests: [] } },
        keys,
        false,
      ),
    ).toThrow();
    expect(() =>
      reconcileSlot(
        key,
        { phase: "prepared", result: { requests: [{ index: 1 }] } },
        keys,
        false,
      ),
    ).toThrow();
    expect(() =>
      reconcileSlot(
        key,
        { phase: "prepared", result: { requests: [{ index: 2 }] } },
        keys,
        true,
      ),
    ).toThrow();
  });
  it("permits known SQL completion without a repeat call and rejects changed request evidence", () => {
    const key = "t9-E02-1",
      keys = [key + "-call-1", key + "-call-2"];
    const slot = {
      phase: "collected",
      result: { requests: [{ index: 1 }, { index: 2 }] },
    };
    expect(() => reconcileSlot(key, slot, keys, true)).not.toThrow();
    expect(() =>
      reconcileSlot(
        key,
        { ...slot, result: { requests: [{ index: 1 }] } },
        keys,
        true,
      ),
    ).toThrow();
  });
});
