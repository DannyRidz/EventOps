// Authoring helper for the immutable v1 schema. After release, schema changes need a new version and migration; never rewrite applied history.
import { registerHooks } from "node:module";
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
registerHooks({
  resolve(specifier, context, next) {
    return specifier.startsWith("@/")
      ? next(
          pathToFileURL(resolve("src", specifier.slice(2)) + ".ts").href,
          context,
        )
      : next(specifier, context);
  },
});
const { planSchema } = await import("../src/features/plans/schema.ts");
const schema = JSON.stringify(
  z.toJSONSchema(planSchema, { target: "draft-7" }),
);
const target = fileURLToPath(
  new URL(
    "../supabase/migrations/202610270002_plan_integrity.sql",
    import.meta.url,
  ),
);
const source = await readFile(target, "utf8");
const block = `-- PLAN_SCHEMA_START\ncreate function eventops_private.plan_shape_valid(p jsonb) returns boolean language sql immutable set search_path='' as $body$\n select extensions.jsonb_matches_schema($schema$${schema}$schema$::json,p);\n$body$;\n-- PLAN_SCHEMA_END`;
await writeFile(
  target,
  source.replace(/-- PLAN_SCHEMA_START[\s\S]*?-- PLAN_SCHEMA_END/, block),
);
