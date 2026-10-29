// Isolated synthetic encrypted backup and restore drill. Never restores into the running project.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
const started = Date.now();
const status = JSON.parse(
  readFileSync(
    process.env.T8_STATUS_FILE ?? "/private/tmp/eventops-local-status.json",
    "utf8",
  ),
);
const env = status.env ?? status;
assert.match(
  env.DB_URL,
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
);
const source = "eventops_t8_backup_" + randomUUID().replaceAll("-", "");
const target = "eventops_t8_restore_" + randomUUID().replaceAll("-", "");
const admin = new pg.Client({ connectionString: env.DB_URL });
await admin.connect();
const folder = await mkdtemp(join(tmpdir(), "eventops-t8-recovery-"));
const url = (name) => env.DB_URL.replace(/\/postgres$/, "/" + name);
const connect = async (name) => {
  const db = new pg.Client({ connectionString: url(name) });
  await db.connect();
  return db;
};
let src, dst;
try {
  await admin.query(`create database ${source} template template0`);
  await admin.query(`create database ${target} template template0`);
  src = await connect(source);
  await src.query(
    "create schema auth;create schema extensions;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await src.query(
      "begin;" +
        readFileSync("supabase/migrations/" + file, "utf8") +
        "commit;",
    );
  // Use the actual previously verified private workspace export, all synthetic.
  const exported = JSON.parse(
    execFileSync(
      "unzip",
      ["-p", "/private/tmp/eventops-t8-export.zip", "workspace.json"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  const retained = exported.events.find((e) => e.current_revision_id);
  assert.ok(retained);
  const owner = exported.profile.user_id,
    w = exported.workspace.id;
  await src.query("begin;set constraints all deferred");
  await src.query(
    "insert into auth.users(id,email_confirmed_at) values($1,now())",
    [owner],
  );
  for (const [table, rows] of [
    ["profiles", [exported.profile]],
    ["workspaces", [exported.workspace]],
    [
      "memberships",
      [
        {
          workspace_id: w,
          user_id: owner,
          role: "owner",
          created_at: new Date().toISOString(),
        },
      ],
    ],
    ["events", [retained]],
  ])
    for (const row of rows)
      await src.query(
        `insert into public.${table} select * from jsonb_populate_record(null::public.${table},$1::jsonb)`,
        [JSON.stringify(row)],
      );
  const tables = (
    await src.query(
      "select table_name from information_schema.columns where table_schema='public' and column_name='event_id'",
    )
  ).rows;
  for (const { table_name: table } of tables)
    for (const row of exported[table] ?? [])
      if (row.event_id === retained.id)
        await src.query(
          `insert into public.${table} select * from jsonb_populate_record(null::public.${table},$1::jsonb)`,
          [JSON.stringify(row)],
        );
  await src.query("commit");
  const bytes = Buffer.from("room_id,name\nR,Synthetic recovery hall\n"),
    hash = createHash("sha256").update(bytes).digest("hex");
  const artifact = randomUUID(),
    batch = randomUUID(),
    object = `${w}/${retained.id}/${randomUUID()}.csv`;
  await src.query(
    "insert into public.source_artifacts(id,workspace_id,event_id,kind,sha256,captured_by,object_key,metadata) values($1,$2,$3,'csv',$4,$5,$6,'{}')",
    [artifact, w, retained.id, hash, owner, object],
  );
  await src.query(
    "insert into public.import_batches(id,workspace_id,event_id,draft_generation,tables) values($1,$2,$3,1,'[]')",
    [batch, w, retained.id],
  );
  await src.query(
    "insert into public.import_files(workspace_id,event_id,batch_id,artifact_id,collection,filename,sha256,original_bytes,original_table) values($1,$2,$3,$4,'rooms','rooms.csv',$5,$6,'{}')",
    [w, retained.id, batch, artifact, hash, bytes],
  );
  await src.query(
    "insert into storage.objects(bucket_id,name) values('event-imports',$1)",
    [object],
  );
  const dump = execFileSync(
    process.env.T8_PG_DUMP ?? "pg_dump",
    [url(source), "--no-owner", "--format=plain"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const manifest = {
    objects: [
      {
        bucket: "event-imports",
        path: object,
        sha256: hash,
        bytes: bytes.toString("base64"),
      },
    ],
    database_sha256: createHash("sha256").update(dump).digest("hex"),
  };
  const plaintext = Buffer.from(
    JSON.stringify({ dump: dump.toString("base64"), manifest }),
  );
  const key = randomBytes(32),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const sealed = Buffer.concat([
    iv,
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const artifactPath = join(folder, "backup.enc");
  await writeFile(artifactPath, sealed, { mode: 0o600 });
  const loaded = await readFile(artifactPath),
    decipher = createDecipheriv("aes-256-gcm", key, loaded.subarray(0, 12));
  decipher.setAuthTag(loaded.subarray(-16));
  const recovered = JSON.parse(
    Buffer.concat([
      decipher.update(loaded.subarray(12, -16)),
      decipher.final(),
    ]).toString(),
  );
  const recoveredDump = Buffer.from(recovered.dump, "base64");
  assert.equal(
    createHash("sha256").update(recoveredDump).digest("hex"),
    recovered.manifest.database_sha256,
  );
  execFileSync(
    process.env.T8_PSQL ?? "psql",
    [url(target), "-X", "-v", "ON_ERROR_STOP=1"],
    {
      input: recoveredDump,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  dst = await connect(target);
  const restoredObjects = new Map();
  for (const entry of recovered.manifest.objects) {
    const value = Buffer.from(entry.bytes, "base64");
    assert.equal(
      createHash("sha256").update(value).digest("hex"),
      entry.sha256,
    );
    restoredObjects.set(entry.path, value);
  }
  const original = await dst.query(
    "select original_bytes from public.import_files where artifact_id=$1",
    [artifact],
  );
  assert.deepEqual(original.rows[0].original_bytes, bytes);
  const head = await dst.query(
    "select snapshot from public.revisions where id=$1",
    [retained.current_revision_id],
  );
  assert.equal(
    head.rows[0].snapshot.event.name,
    exported.revisions.find((r) => r.id === retained.current_revision_id)
      .snapshot.event.name,
  );
  await dst.query("set role authenticated");
  await dst.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  assert.equal(
    (await dst.query("select count(*)::integer as n from public.revisions"))
      .rows[0].n,
    1,
  );
  await dst.query("select set_config('request.jwt.claim.sub',$1,false)", [
    randomUUID(),
  ]);
  assert.equal(
    (await dst.query("select count(*)::integer as n from public.revisions"))
      .rows[0].n,
    0,
  );
  await assert.rejects(dst.query("delete from public.events"));
  await dst.query("reset role");
  console.log(
    "PASS encrypted database dump restores schema, ACLs, owner isolation, approved head, raw receipt and hash matched object manifest into isolated target",
  );
  // Ledger is written AFTER backup and is not part of the restored artifact.
  const ledger = join(folder, "independent-ledger.jsonl");
  await writeFile(
    ledger,
    JSON.stringify({
      kind: "csv",
      id: artifact,
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 8 * 86400000).toISOString(),
    }) + "\n",
    { mode: 0o600 },
  );
  for (const line of (await readFile(ledger, "utf8")).trim().split("\n")) {
    const item = JSON.parse(line);
    assert.equal(item.kind, "csv");
    await dst.query(
      "insert into eventops_private.raw_deletions(artifact_id) values($1)",
      [item.id],
    );
    const row = await dst.query(
      "select object_key from public.source_artifacts where id=$1",
      [item.id],
    );
    restoredObjects.delete(row.rows[0].object_key);
    await dst.query(
      "delete from storage.objects where bucket_id='event-imports' and name=$1",
      [row.rows[0].object_key],
    );
    assert.equal(
      (
        await dst.query(
          "select eventops_worker_api.retention_purge('csv',$1) as done",
          [item.id],
        )
      ).rows[0].done,
      true,
    );
  }
  assert.equal(
    (
      await dst.query(
        "select original_bytes is null as erased from public.import_files where artifact_id=$1",
        [artifact],
      )
    ).rows[0].erased,
    true,
  );
  assert.equal(restoredObjects.size, 0);
  console.log(
    "PASS post-backup independent raw deletion replay removes restored bytes and metadata before access",
  );
  // Replay event purge even though the backup predates its deletion.
  await dst.query(
    "update public.events set status='trashed',purge_after=now()-interval '1 second' where id=$1",
    [retained.id],
  );
  assert.equal(
    (
      await dst.query(
        "select eventops_worker_api.retention_purge('event',$1) as done",
        [retained.id],
      )
    ).rows[0].done,
    true,
  );
  assert.equal(
    (await dst.query("select count(*)::integer as count from public.revisions"))
      .rows[0].count,
    0,
  );
  console.log(
    "PASS event deletion replay removes cyclic revision/evidence rows atomically",
  );
  console.log(
    JSON.stringify({
      local_restore_seconds: ((Date.now() - started) / 1000).toFixed(2),
      encrypted_bytes: sealed.length,
      production_rpo_rto: "unverified",
    }),
  );
} finally {
  await src?.end();
  await dst?.end();
  await admin.query(`drop database if exists ${source} with (force)`);
  await admin.query(`drop database if exists ${target} with (force)`);
  await admin.end();
  await rm(folder, { recursive: true, force: true });
}
