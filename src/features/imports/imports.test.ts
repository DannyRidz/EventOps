import { describe, it, expect } from "vitest";
import { parseCsv, decodeCsv, FILE_BYTES } from "./csv";
import {
  initialMapping,
  reviewImport,
  constraintPreview,
  type ImportTable,
} from "./model";
import { fixtureSetup } from "@/features/plans/fixtures";
function table(
  collection: ImportTable["collection"],
  text: string,
): ImportTable {
  const p = parseCsv(text);
  return {
    collection,
    filename: collection + ".csv",
    sha256: "a".repeat(64),
    ...p,
    mapping: initialMapping(collection, p.headers),
    excluded: [],
    keep_one: [],
    offsets: {},
  };
}
const rooms = () => table("rooms", "room_id,name,location\r\nR,Hall,Main\r\n");
const schedule = () =>
  table(
    "sessions",
    "session_id,title,start,end,room_id,required_volunteers\nS,Opening,10:00,11:00,R,0",
  );
describe("CSV byte and grammar boundaries (AC-04, AC-05)", () => {
  it("reads BOM, quoted commas, escaped quotes, embedded newlines and CRLF locators", () => {
    const p = parseCsv(
      decodeCsv(
        new TextEncoder().encode(
          '\uFEFFid,title\r\na,"One, ""two""\nthree"\r\nb,Next\r\n',
        ),
      ),
    );
    expect(p).toEqual({
      headers: ["id", "title"],
      rows: [
        ["a", 'One, "two"\nthree'],
        ["b", "Next"],
      ],
      lines: [2, 4],
    });
  });
  it.each([
    "id,id\na,b",
    "id,name\na",
    "id,name\na,b,c",
    'id,name\na,"open',
    'id,name\na,x"y',
    'id,name\na,"x"tail',
    "id,name\ra,b",
    "id,name\n\n",
  ])("rejects malformed CSV without skipping a row: %s", (s) =>
    expect(() => parseCsv(s)).toThrow(),
  );
  it("rejects encoding, NUL, byte and cell limits", () => {
    expect(() => decodeCsv(new Uint8Array([255]))).toThrow(/UTF 8/);
    expect(() => decodeCsv(new Uint8Array([0]))).toThrow(/NUL/);
    expect(() => decodeCsv(new Uint8Array(FILE_BYTES + 1))).toThrow(/2 MiB/);
    expect(() => parseCsv("id\n" + "a".repeat(4097))).toThrow(/4096/);
  });
});
describe("import decisions and complete plan (AC-06 to AC-08)", () => {
  it("maps required columns explicitly, retains hostile strings as inert data and preserves inputs", () => {
    const r = rooms();
    r.headers[0] = "Identifier";
    r.mapping = { name: "name", location: "location" };
    expect(
      reviewImport([r, schedule()], fixtureSetup).issues.some(
        (i) => i.column === "room_id",
      ),
    ).toBe(true);
    r.mapping.room_id = "Identifier";
    r.rows[0]![1] = "=IGNORE POLICY";
    const before = JSON.stringify(r),
      review = reviewImport([r, schedule()], fixtureSetup);
    expect(review.issues).toEqual([]);
    expect(review.records.rooms[0]?.name).toBe("=IGNORE POLICY");
    expect(JSON.stringify(r)).toBe(before);
    expect(constraintPreview(review.records, fixtureSetup)).toEqual([]);
  });
  it("requires Keep one, blocks conflicting IDs and never merges same names", () => {
    const r = rooms();
    r.rows.push([...r.rows[0]!]);
    r.lines.push(3);
    expect(
      reviewImport([r], fixtureSetup).issues.some((i) =>
        i.message.startsWith("Identical"),
      ),
    ).toBe(true);
    r.keep_one = ["R"];
    expect(reviewImport([r], fixtureSetup).records.rooms).toHaveLength(1);
    r.rows[1]![1] = "Other";
    expect(
      reviewImport([r], fixtureSetup).issues.some((i) =>
        i.message.startsWith("Conflicting"),
      ),
    ).toBe(true);
    r.rows[1] = ["r", "Hall", "Main"];
    expect(
      reviewImport([r], fixtureSetup).issues.some(
        (i) => i.severity === "warning",
      ),
    ).toBe(true);
    expect(reviewImport([r], fixtureSetup).records.rooms).toHaveLength(2);
    r.excluded = [1];
    expect(reviewImport([r], fixtureSetup).records.rooms).toHaveLength(1);
  });
  it("never defaults missing volunteer counts and checks case sensitive references", () => {
    const s = schedule();
    s.rows[0]![5] = "";
    s.rows[0]![4] = "r";
    const issues = reviewImport([rooms(), s], fixtureSetup).issues;
    expect(
      issues.some((i) => i.column === "required_volunteers" && i.row === 2),
    ).toBe(true);
    expect(issues.some((i) => i.column === "room_id" && i.value === "r")).toBe(
      true,
    );
  });
  it("supports all templates, assignment defaults and known availability", () => {
    const s = schedule();
    s.rows[0]![5] = "1";
    const tables = [
      rooms(),
      s,
      table("volunteers", "volunteer_id,name\nV,Sam"),
      table(
        "availability",
        "volunteer_id,start,end,status\nV,09:00,17:00,available",
      ),
      table("assignments", "session_id,volunteer_id,role_tag\nS,V,general"),
      table(
        "dependencies",
        "predecessor_session_id,successor_session_id,minimum_gap_minutes",
      ),
    ];
    const review = reviewImport(tables, fixtureSetup);
    expect(review.issues).toEqual([]);
    expect(review.records.volunteers[0]?.active).toBe(true);
    expect(review.records.assignments[0]?.start).toBe("10:00");
    expect(constraintPreview(review.records, fixtureSetup)).toEqual([]);
    tables[3]!.excluded = [0];
    const incomplete = reviewImport(tables, fixtureSetup);
    expect(
      constraintPreview(incomplete.records, fixtureSetup).some(
        (i) => i.rule === "AVAILABILITY",
      ),
    ).toBe(true);
  });
  it("rejects nonexistent times and requires explicit daylight saving folds", () => {
    const s = schedule();
    s.rows[0]![2] = "01:15";
    s.rows[0]![3] = "01:45";
    const setup = {
      ...fixtureSetup,
      date: "2026-11-01",
      timezone: "America/New_York",
      start: "00:00",
      end: "04:00",
      start_offset: "-04:00",
      end_offset: "-05:00",
    };
    expect(
      reviewImport([rooms(), s], setup).issues.filter(
        (i) => i.column === "start" || i.column === "end",
      ),
    ).toHaveLength(2);
    s.offsets = { 0: { start: "-04:00", end: "-04:00" } };
    expect(reviewImport([rooms(), s], setup).issues).toEqual([]);
    s.rows[0]![2] = "02:15";
    expect(
      reviewImport([rooms(), s], { ...setup, date: "2026-03-08" }).issues.some(
        (i) => i.column === "start",
      ),
    ).toBe(true);
  });
});
