import { describe, expect, it } from "vitest";
import { resolveSetup } from "./validation";
const setup = {
  name: "Community gathering",
  date: "2026-11-01",
  timezone: "Asia/Brunei",
  start: "09:00",
  end: "17:00",
  locations: ["Main hall"],
};
describe("event setup and clock boundaries, AC-03", () => {
  it("resolves explicit local values to UTC", () => {
    expect(resolveSetup(setup).starts_at).toBe("2026-11-01T01:00:00Z");
  });
  it("rejects overnight hours", () => {
    expect(() => resolveSetup({ ...setup, end: "08:00" })).toThrow(
      /after start/,
    );
  });
  it("rejects nonexistent dates and timezone names", () => {
    expect(() => resolveSetup({ ...setup, date: "2026-02-30" })).toThrow();
    expect(() => resolveSetup({ ...setup, timezone: "made/up" })).toThrow();
  });
  it("rejects duplicate location labels", () => {
    expect(() =>
      resolveSetup({ ...setup, locations: ["Hall", "hall"] }),
    ).toThrow(/different label/);
  });
  it("rejects missing spring clock times", () => {
    expect(() =>
      resolveSetup({
        ...setup,
        date: "2026-03-08",
        timezone: "America/New_York",
        start: "02:30",
      }),
    ).toThrow(/Missing clock/);
  });
  it("requires a matching offset for repeated autumn clock times", () => {
    const folded = { ...setup, timezone: "America/New_York", start: "01:30" };
    expect(() => resolveSetup(folded)).toThrow(/repeats/);
    expect(resolveSetup({ ...folded, start_offset: "-04:00" }).starts_at).toBe(
      "2026-11-01T05:30:00Z",
    );
    expect(resolveSetup({ ...folded, start_offset: "-05:00" }).starts_at).toBe(
      "2026-11-01T06:30:00Z",
    );
    expect(() => resolveSetup({ ...folded, start_offset: "+08:00" })).toThrow();
  });
});
it("rejects reversed UTC order during the repeated hour", () => {
  expect(() =>
    resolveSetup({
      ...setup,
      timezone: "America/New_York",
      start: "01:15",
      end: "01:30",
      start_offset: "-05:00",
      end_offset: "-04:00",
    }),
  ).toThrow();
});
