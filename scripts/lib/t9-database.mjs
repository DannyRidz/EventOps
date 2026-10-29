// Isolated SQL fixture lab. Never signs in, accepts terms, or changes the running project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

export async function databaseLab() {
  const status = JSON.parse(
    await readFile("/private/tmp/eventops-local-status.json", "utf8"),
  );
  const env = status.env ?? status;
  assert.match(
    env.DB_URL,
    /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
  );
  const admin = new pg.Client({ connectionString: env.DB_URL });
  await admin.connect();
  const name = "eventops_t9_eval_" + randomUUID().replaceAll("-", "");
  let db;
  const gates = async () => {
    const { rows } = await admin.query(
      "select (select enabled from eventops_private.analysis_budget_lock) a,(select enabled from eventops_private.voice_gate) v",
    );
    assert.equal(rows[0].a, false);
    assert.equal(rows[0].v, false);
  };
  try {
    await gates();
    await admin.query(`create database ${name} template template0`);
    const connectionString = env.DB_URL.replace(/\/postgres$/, "/" + name);
    db = new pg.Client({ connectionString });
    await db.connect();
    await db.query(
      "create schema auth;create schema extensions;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;",
    );
    const migrations = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrations)
      await db.query(
        "begin;" +
          (await readFile("supabase/migrations/" + file, "utf8")) +
          "commit;",
      );
    const exported = JSON.parse(
      execFileSync(
        "unzip",
        ["-p", "/private/tmp/eventops-t8-export.zip", "workspace.json"],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      ),
    );
    // Existing synthetic identity snapshot, not a new legal attestation or login mechanism.
    const owner = exported.profile.user_id;
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [owner],
    );
    for (const [table, value] of [
      ["profiles", exported.profile],
      ["workspaces", exported.workspace],
      [
        "memberships",
        {
          workspace_id: exported.workspace.id,
          user_id: owner,
          role: "owner",
          created_at: "2026-10-29T00:00:00Z",
        },
      ],
    ])
      await db.query(
        `insert into public.${table} select * from jsonb_populate_record(null::public.${table},$1::jsonb)`,
        [JSON.stringify(value)],
      );
    const ownerQuery = async (sql, values = [], actor = owner) => {
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          actor,
        ]);
        const r = await db.query(sql, values);
        await db.query("commit");
        return r;
      } catch (e) {
        await db.query("rollback");
        throw e;
      }
    };
    return {
      db,
      ownerQuery,
      migrations: migrations.length,
      connectionString,
      owner,
      async close() {
        await db.end();
        try {
          await admin.query(`drop database ${name} with (force)`);
          await gates();
        } finally {
          await admin.end();
        }
      },
    };
  } catch (e) {
    if (db) await db.end();
    try {
      await admin.query(`drop database if exists ${name} with (force)`);
    } finally {
      await admin.end();
    }
    throw e;
  }
}
