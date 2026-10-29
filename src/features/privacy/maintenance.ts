import { open, mkdir, chmod } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import pg from "pg";
import { z } from "zod";
const targetSchema = z.strictObject({
  kind: z.enum(["event", "account", "csv", "audio"]),
  id: z.uuid(),
});
const objectSchema = z.strictObject({
  bucket: z.enum(["event-imports", "event-audio"]),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-zA-Z0-9_.-]+$/),
});
export type DeletionTarget = z.infer<typeof targetSchema>;
export async function appendTombstone(path: string, target: DeletionTarget) {
  if (!isAbsolute(path)) throw new Error("LEDGER_PATH_REQUIRED");
  const value = targetSchema.parse(target);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // Fail on symlinks and use a durable append before deleting any retained rows.
  const { constants } = await import("node:fs");
  const file = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_APPEND |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.chmod(0o600);
    const deleted_at = new Date(),
      expires_at = new Date(deleted_at.getTime() + 8 * 86400000);
    await file.writeFile(
      JSON.stringify({
        ...value,
        deleted_at: deleted_at.toISOString(),
        expires_at: expires_at.toISOString(),
      }) + "\n",
    );
    await file.sync();
  } finally {
    await file.close();
  }
  const directory = await open(dirname(path), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
export async function retentionSweep(
  db: Pick<pg.Client, "query">,
  remove: (bucket: string, path: string) => Promise<void>,
  record: (target: DeletionTarget) => Promise<void>,
) {
  const result = await db.query(
    "select eventops_worker_api.retention_sweep() as work",
  );
  const work = z
    .object({
      objects: z.array(objectSchema).max(100),
      targets: z.array(targetSchema).max(100),
    })
    .parse(result.rows[0].work);
  let deleted = 0,
    failed = 0,
    purged = 0;
  // If any tombstone fails, do not delete bytes or rows from this sweep.
  for (const target of work.targets) await record(target);
  for (const object of work.objects) {
    try {
      await remove(object.bucket, object.path);
      deleted++;
    } catch {
      failed++;
    }
  }
  for (const target of work.targets) {
    try {
      const done = await db.query(
        "select eventops_worker_api.retention_purge($1,$2) as done",
        [target.kind, target.id],
      );
      if (done.rows[0].done) purged++;
    } catch {
      failed++;
    }
  }
  return { code: "RETENTION_SWEEP", deleted, failed, purged };
}
export async function startMaintenance(env: NodeJS.ProcessEnv = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL,
    key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    token = env.EVENTOPS_RETENTION_STORAGE_TOKEN,
    connection = env.WORKER_DATABASE_URL,
    ledger = env.EVENTOPS_DELETION_LEDGER;
  if (!url || !key || !token || !connection || !ledger || !isAbsolute(ledger))
    throw new Error("RETENTION_CONFIGURATION");
  const base = new URL(url);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("RETENTION_CONFIGURATION");
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
  );
  if (payload.role !== "eventops_worker")
    throw new Error("RETENTION_CONFIGURATION");
  const db = new pg.Client({ connectionString: connection });
  await db.connect();
  const role = await db.query("select current_user as role");
  if (role.rows[0].role !== "eventops_worker") {
    await db.end();
    throw new Error("RETENTION_CONFIGURATION");
  }
  // Ledger is outside the database and backup target. Operator supplies independent durable storage.
  await mkdir(dirname(ledger), { recursive: true, mode: 0o700 });
  await chmod(dirname(ledger), 0o700);
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    while (!stopped) {
      try {
        const summary = await retentionSweep(
          db,
          async (bucket, path) => {
            const response = await fetch(
              new URL("/storage/v1/object/" + bucket, base),
              {
                method: "DELETE",
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ prefixes: [path] }),
                signal: AbortSignal.timeout(10000),
                redirect: "error",
              },
            );
            if (!response.ok) throw new Error("STORAGE_DELETE");
            await response.body?.cancel();
          },
          (target) => appendTombstone(ledger, target),
        );
        console.log(JSON.stringify(summary));
      } catch {
        console.error(JSON.stringify({ code: "RETENTION_SWEEP_FAILED" }));
      }
      if (env.EVENTOPS_RETENTION_ONCE === "1") break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    await db.end();
  }
}
