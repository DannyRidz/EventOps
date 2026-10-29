import { expect, it } from "vitest";
import { fixturePlan } from "./fixtures";
import { briefingCsv, briefingText, csvCell } from "./briefing";
const revision = () => ({
  id: "selected-approved-id",
  revision_number: 7,
  approved_at: "2026-10-29T00:00:00Z",
  snapshot: fixturePlan(),
});
it.each([
  "=SUM(A1:A2)",
  "+cmd",
  "-42",
  "@lookup",
  "\tformula",
  "\rformula",
  "  =SUM(A1)",
])("escapes CSV formula trigger %s", (v) => {
  expect(csvCell(v)).toBe("\"'" + v + '"');
});
it("quotes embedded commas, newlines and quotes without executing markup", () => {
  expect(csvCell('A,"B"\nC')).toBe('"A,""B""\nC"');
});
it("labels every CSV row with selected revision, event date and timezone", () => {
  const r = revision();
  r.snapshot.sessions[0]!.title = "=unsafe";
  const csv = briefingCsv(r, "sessions");
  expect(csv).toContain('"event_timezone","approved_revision","revision_id"');
  expect(csv).toContain('"Asia/Brunei","7","selected-approved-id"');
  expect(csv).toContain('"\'=unsafe"');
  expect(csv).toContain('"2026-11-02"');
});
it("exports a stable schema header even for an empty approved collection", () => {
  const r = revision();
  r.snapshot.assignments = [];
  expect(briefingCsv(r, "assignments")).toContain(
    '"volunteer_id","session_id"',
  );
  expect(briefingCsv(r, "assignments").split("\r\n")).toHaveLength(2);
});
it("reproduces selected approved values and predecessor changes without AI", () => {
  const r = revision(),
    parent = fixturePlan();
  r.snapshot.sessions[0]!.title = "Approved title";
  const text = briefingText(r, parent);
  expect(text).toContain("Approved revision 7");
  expect(text).toContain("Timezone: Asia/Brunei");
  expect(text).toContain("Event date: 2026-11-02");
  expect(text).toContain("-> Approved title");
  expect(text).toContain("Pending updates are excluded");
  expect(text).toContain("ASSIGNMENTS");
});
