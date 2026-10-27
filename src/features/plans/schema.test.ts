// @vitest-environment node
import { readFileSync } from "node:fs";
import { z } from "zod";
import { expect, it } from "vitest";
import { planSchema } from "./schema";
it("keeps database JSON shape identical to the TypeScript contract", () => {
  const sql = readFileSync(
    "supabase/migrations/202610270002_plan_integrity.sql",
    "utf8",
  );
  const embedded = sql.match(/\$schema\$([\s\S]*?)\$schema\$/)?.[1];
  expect(embedded).toBeTruthy();
  expect(JSON.parse(embedded!)).toEqual(
    z.toJSONSchema(planSchema, { target: "draft-7" }),
  );
});
