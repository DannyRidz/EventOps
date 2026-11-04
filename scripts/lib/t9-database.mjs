// Isolated SQL fixture lab. Never signs in, accepts terms, or changes the running project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

export async function databaseLab({
  profileExport = "/private/tmp/eventops-t8-export.zip",
  campaignIdentity,
  campaignTestName,
  requireExistingCampaign = false,
} = {}) {
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
  if (campaignIdentity !== undefined)
    assert.match(campaignIdentity, /^[a-f0-9]{64}$/);
  const retained = campaignIdentity !== undefined;
  if (campaignTestName !== undefined) {
    assert.ok(retained);
    assert.match(campaignTestName, /^eventops_t9_campaign_test_[a-f0-9]{32}$/);
  }
  const name = retained
    ? (campaignTestName ?? "eventops_t9_campaign_v1")
    : "eventops_t9_eval_" + randomUUID().replaceAll("-", "");
  let db,
    owner,
    created = false;
  const gates = async () => {
    const { rows } = await admin.query(
      "select (select enabled from eventops_private.analysis_budget_lock) a,(select enabled from eventops_private.voice_gate) v",
    );
    assert.equal(rows[0].a, false);
    assert.equal(rows[0].v, false);
  };
  try {
    await gates();
    const exists =
      (await admin.query("select 1 from pg_database where datname=$1", [name]))
        .rows.length > 0;
    if (requireExistingCampaign)
      assert.ok(
        retained && exists,
        "Retained SQL campaign state is missing; operator inspection required",
      );
    if (!exists) {
      await admin.query(`create database ${name} template template0`);
      created = true;
    }
    const connectionString = env.DB_URL.replace(/\/postgres$/, "/" + name);
    db = new pg.Client({ connectionString });
    await db.connect();
    if (retained)
      assert.equal(
        (await db.query("select pg_try_advisory_lock(190044601) locked"))
          .rows[0].locked,
        true,
        "Campaign already has an operator",
      );
    const migrations = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const migrationBodies = await Promise.all(
      migrations.map((f) => readFile("supabase/migrations/" + f, "utf8")),
    );
    const migrationHash = createHash("sha256")
      .update(JSON.stringify(migrationBodies))
      .digest("hex");
    if (!exists) {
      await db.query(
        "create schema auth;create schema extensions;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;",
      );
      for (const file of migrations)
        await db.query(
          "begin;" +
            (await readFile("supabase/migrations/" + file, "utf8")) +
            "commit;",
        );
      const exported = JSON.parse(
        execFileSync("unzip", ["-p", profileExport, "workspace.json"], {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        }),
      );
      // Existing synthetic identity snapshot, not a new legal attestation or login mechanism.
      owner = exported.profile.user_id;
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
      if (retained) {
        await db.query(
          "create table eventops_private.t9_campaign_state(identity text primary key, owner_id uuid not null, migration_hash text not null, state jsonb not null)",
        );
        await db.query(
          "insert into eventops_private.t9_campaign_state values($1,$2,$3,$4::jsonb)",
          [
            campaignIdentity,
            owner,
            migrationHash,
            JSON.stringify({ slots: {}, started_at: new Date().toISOString() }),
          ],
        );
      }
    } else {
      assert.ok(retained, "Unexpected existing temporary database");
      const metadata = (
        await db.query(
          "select identity,owner_id,migration_hash from eventops_private.t9_campaign_state",
        )
      ).rows;
      assert.equal(metadata.length, 1);
      assert.equal(
        metadata[0].identity,
        campaignIdentity,
        "Retained campaign input changed; preserve its quota history",
      );
      assert.equal(
        metadata[0].migration_hash,
        migrationHash,
        "Migration drift in retained campaign",
      );
      owner = metadata[0].owner_id;
      const flags = (
        await db.query(
          "select (select enabled from eventops_private.analysis_budget_lock) a,(select enabled from eventops_private.voice_gate) v",
        )
      ).rows[0];
      assert.deepEqual(
        flags,
        { a: false, v: false },
        "Inspect interrupted gates before resuming",
      );
    }
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
      retained,
      async loadState() {
        assert.ok(retained);
        return (
          await db.query(
            "select state from eventops_private.t9_campaign_state where identity=$1",
            [campaignIdentity],
          )
        ).rows[0].state;
      },
      async saveState(state) {
        assert.ok(retained);
        await db.query(
          "update eventops_private.t9_campaign_state set state=$1::jsonb where identity=$2",
          [JSON.stringify(state), campaignIdentity],
        );
      },
      async close() {
        await db.end();
        try {
          if (!retained)
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
      if (!retained || created)
        await admin.query(`drop database if exists ${name} with (force)`);
    } finally {
      await admin.end();
    }
    throw e;
  }
}
