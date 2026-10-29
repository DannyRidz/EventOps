import "server-only";
import { createHash } from "node:crypto";
import { authenticatedClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
import { briefingCsv, type BriefingRevision } from "@/features/plans/briefing";
import { collections } from "@/features/plans/schema";
import { privacyRpc, settings } from "./data";
import { privateZip, type ZipFile } from "./zip";
const active = new Set<string>();
export async function workspaceZip() {
  const before = await settings();
  if (before.deletion_requested_at)
    throw new ApiError(
      409,
      "ACCOUNT_DELETING",
      "Cancel account deletion before exporting.",
    );
  if (active.has(before.workspace_id))
    throw new ApiError(
      429,
      "EXPORT_BUSY",
      "A workspace export is already running.",
    );
  active.add(before.workspace_id);
  try {
    const client = await authenticatedClient();
    const records = await privacyRpc("workspace_export");
    const files: ZipFile[] = [
      {
        name: "workspace.json",
        bytes: Buffer.from(JSON.stringify(records, null, 2)),
      },
    ];
    const omissions: { id: string; reason: string }[] = [];
    let size = files[0]!.bytes.length;
    const append = (name: string, bytes: Uint8Array) => {
      size += bytes.length;
      if (size > 63 * 1024 * 1024)
        throw new ApiError(
          413,
          "EXPORT_LIMIT",
          "Workspace export exceeds the 64 MiB download limit.",
        );
      files.push({ name, bytes });
    };
    for (const revision of records.revisions as BriefingRevision[])
      for (const collection of collections)
        append(
          `revisions/${revision.id}/${collection}.csv`,
          Buffer.from(briefingCsv(revision, collection)),
        );
    for (const artifact of records.source_artifacts as {
      id: string;
      kind: string;
      sha256: string;
      object_key: string | null;
      event_id: string;
    }[]) {
      if (!artifact.object_key || !["csv", "audio"].includes(artifact.kind))
        continue;
      const bucket = artifact.kind === "csv" ? "event-imports" : "event-audio";
      const result = await client.storage
        .from(bucket)
        .download(artifact.object_key);
      if (result.error || !result.data) {
        // Expired originals are expected. An unexpected Storage outage fails the export.
        const event = before.events.find((e) => e.id === artifact.event_id);
        const csv =
          artifact.kind === "csv"
            ? await client.rpc("csv_original_available", { p_id: artifact.id })
            : null;
        const voice =
          artifact.kind === "audio"
            ? (
                records.voice_jobs as {
                  object_key: string;
                  delete_after: string;
                  audio_deleted_at: string | null;
                }[]
              ).find((j) => j.object_key === artifact.object_key)
            : null;
        if (
          event?.status === "trashed" ||
          csv?.data === false ||
          (voice &&
            (voice.audio_deleted_at ||
              Date.parse(voice.delete_after) <= Date.now()))
        ) {
          omissions.push({
            id: artifact.id,
            reason:
              event?.status === "trashed"
                ? "Event in trash, raw download disabled"
                : "Original expired or deleted",
          });
          continue;
        }
        throw new Error("EXPORT_STORAGE_UNAVAILABLE");
      }
      const bytes = Buffer.from(await result.data.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
        throw new Error("EXPORT_INTEGRITY");
      append(
        `originals/${artifact.id}.${artifact.kind === "csv" ? "csv" : "audio"}`,
        bytes,
      );
    }
    // Include recordings without a transcript artifact too.
    for (const job of records.voice_jobs as {
      id: string;
      object_key: string;
      sha256: string;
      audio_deleted_at: string | null;
      delete_after: string;
      event_id: string;
    }[]) {
      if (
        (records.source_artifacts as { object_key: string }[]).some(
          (a) => a.object_key === job.object_key,
        )
      )
        continue;
      if (job.audio_deleted_at || Date.parse(job.delete_after) <= Date.now()) {
        omissions.push({
          id: job.id,
          reason: "Original recording deleted or expired",
        });
        continue;
      }
      const result = await client.storage
        .from("event-audio")
        .download(job.object_key);
      if (result.error || !result.data) {
        if (
          before.events.find((e) => e.id === job.event_id)?.status === "trashed"
        ) {
          omissions.push({
            id: job.id,
            reason: "Event in trash, raw download disabled",
          });
          continue;
        }
        throw new Error("EXPORT_STORAGE_UNAVAILABLE");
      }
      const bytes = Buffer.from(await result.data.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== job.sha256)
        throw new Error("EXPORT_INTEGRITY");
      append(`originals/${job.id}.audio`, bytes);
    }
    append(
      "manifest.json",
      Buffer.from(
        JSON.stringify(
          {
            created_at: new Date().toISOString(),
            omissions,
            files: files.map((f) => ({
              name: f.name,
              sha256: createHash("sha256").update(f.bytes).digest("hex"),
            })),
          },
          null,
          2,
        ),
      ),
    );
    const after = await settings();
    if (
      after.generation !== before.generation ||
      after.deletion_requested_at ||
      after.events.some((e) => Date.parse(e.purge_after) <= Date.now())
    )
      throw new ApiError(
        409,
        "EXPORT_CHANGED",
        "Workspace privacy settings changed. Retry the export.",
      );
    return privateZip(files);
  } finally {
    active.delete(before.workspace_id);
  }
}
