// DDL rehearsal in a temporary local database. Never resets the running project.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const local = JSON.parse(
  readFileSync(
    process.env.T3_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
    "utf8",
  ),
);
const env = local.env ?? local;
assert.match(
  env.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
const database = "eventops_t3_rehearsal_" + randomUUID().replaceAll("-", "");
const run = (url, sql) =>
  execFileSync(
    process.env.T3_PSQL ?? "psql",
    [url, "-X", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: sql, encoding: "utf8", timeout: 30000 },
  );
run(env.DB_URL, `create database ${database} template template0;`);
try {
  const url = env.DB_URL.replace(/\/postgres$/, "/" + database);
  // Managed Auth is external to our migrations. Supply only its referenced schema contract.
  run(
    url,
    "create schema auth; create schema extensions; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  );
  // Supabase Storage is managed externally too. Supply its referenced table contract.
  run(
    url,
    "create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now()); alter table storage.objects enable row level security;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    run(
      url,
      "begin;" +
        readFileSync("supabase/migrations/" + file, "utf8") +
        "commit;",
    );
  const count = Number(
    run(
      url,
      "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';",
    ).trim(),
  );
  assert.ok(count >= 12);
  console.log(
    "PASS all application migrations apply from empty schema using the referenced managed Auth contract",
  );
} finally {
  run(env.DB_URL, `drop database ${database} with (force);`);
}
