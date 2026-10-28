import { createHash } from "node:crypto";
import { endpoint, ApiError } from "@/lib/http";
import { ownedEvent } from "@/features/plans/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; batch: string; hash: string }> },
) {
  return endpoint(async () => {
    const { id, batch, hash } = await context.params;
    const { client } = await ownedEvent(id);
    if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9-]{36}$/.test(batch))
      throw new ApiError(404, "NOT_FOUND", "File not found.");
    const { data, error } = await client
      .from("import_files")
      .select("artifact_id,original_bytes")
      .eq("event_id", id)
      .eq("batch_id", batch)
      .eq("sha256", hash)
      .maybeSingle();
    if (error) throw new Error("SERVICE_UNAVAILABLE");
    if (!data) throw new ApiError(404, "NOT_FOUND", "File not found.");
    // The byte-bound database receipt is authoritative even if a Storage object
    // is missing or an authenticated direct caller associated unrelated bytes.
    let bytes = Buffer.from(data.original_bytes.slice(2), "hex");
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error("SERVICE_UNAVAILABLE");
    const artifact = await client
      .from("source_artifacts")
      .select("object_key")
      .eq("event_id", id)
      .eq("id", data.artifact_id)
      .single();
    if (!artifact.error && artifact.data.object_key) {
      const original = await client.storage
        .from("event-imports")
        .download(artifact.data.object_key);
      if (!original.error && original.data) {
        const stored = Buffer.from(await original.data.arrayBuffer());
        if (createHash("sha256").update(stored).digest("hex") === hash)
          bytes = stored;
      }
    }
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=original.csv",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
