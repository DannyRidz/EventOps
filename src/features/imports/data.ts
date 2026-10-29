import "server-only";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, checkOrigin } from "@/lib/http";
import { ownedEvent, planRpc } from "@/features/plans/data";
import { decodeCsv, parseCsv, BATCH_BYTES } from "./csv";
import {
  templates,
  initialMapping,
  tablesSchema,
  reviewImport,
  constraintDiagnostics,
} from "./model";
import { collections } from "@/features/plans/schema";
import { planInput } from "@/features/plans/editor-model";
export async function importBatch(id: string, batch: string) {
  const { client } = await ownedEvent(id);
  if (!z.uuid().safeParse(batch).success)
    throw new ApiError(404, "NOT_FOUND", "Import not found.");
  const result = await client
    .from("import_batches")
    .select("*")
    .eq("event_id", id)
    .eq("id", batch)
    .maybeSingle();
  if (result.error) throw new Error("SERVICE_UNAVAILABLE");
  if (!result.data) throw new ApiError(404, "NOT_FOUND", "Import not found.");
  const files = await client
    .from("import_files")
    .select("artifact_id,collection,filename,sha256,original_table")
    .eq("event_id", id)
    .eq("batch_id", batch);
  if (files.error) throw new Error("SERVICE_UNAVAILABLE");
  const status = await client.rpc("csv_original_status");
  if (status.error) throw new Error("SERVICE_UNAVAILABLE");
  return {
    ...result.data,
    originals: files.data.map((file) => ({
      ...file,
      available:
        (status.data as { artifact_id: string; available: boolean }[]).find(
          (s) => s.artifact_id === file.artifact_id,
        )?.available ?? false,
    })),
  };
}
export async function listImports(id: string) {
  const { client } = await ownedEvent(id);
  const result = await client
    .from("import_batches")
    .select("id,generation,state,created_at,saved_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (result.error) throw new Error("SERVICE_UNAVAILABLE");
  return result.data;
}
export async function uploadImports(id: string, request: Request) {
  const { event, client } = await ownedEvent(id);
  checkOrigin(request);
  if (event.current_revision_id)
    throw new ApiError(
      409,
      "INITIAL_IMPORT_ONLY",
      "This plan is already approved. Use a manual proposal for corrections.",
    );
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new ApiError(
      415,
      "CSV_REQUIRED",
      "Upload CSV files using the template fields.",
    );
  // Bound the actual streamed body before invoking the multipart parser.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(422, "NO_FILES", "Choose CSV files.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > BATCH_BYTES + 65536) {
      await reader.cancel();
      throw new ApiError(413, "TOO_LARGE", "A batch cannot exceed 10 MiB.");
    }
    chunks.push(value);
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new ApiError(422, "INVALID_MULTIPART", "Choose the CSV files again.");
  }
  const generation = z.coerce
    .number()
    .int()
    .positive()
    .parse(form.get("expected_generation"));
  const files = [];
  let bytesTotal = 0;
  for (const [key, value] of form.entries()) {
    if (key === "expected_generation") continue;
    if (
      !collections.includes(key as (typeof collections)[number]) ||
      !(value instanceof File)
    )
      throw new ApiError(415, "CSV_REQUIRED", "Use one CSV file per template.");
    const c = key as (typeof collections)[number];
    if (
      !/\.csv$/i.test(value.name) ||
      ![
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "text/plain",
        "",
      ].includes(value.type)
    )
      throw new ApiError(
        415,
        "CSV_REQUIRED",
        "Export a UTF 8 .csv file. Spreadsheet and document formats are not supported.",
      );
    if (value.size > 2 * 1024 * 1024)
      throw new ApiError(
        413,
        "TOO_LARGE",
        `${templates[c].filename} exceeds 2 MiB.`,
      );
    bytesTotal += value.size;
    if (bytesTotal > BATCH_BYTES)
      throw new ApiError(413, "TOO_LARGE", "A batch cannot exceed 10 MiB.");
    const bytes = new Uint8Array(await value.arrayBuffer());
    try {
      const parsed = parseCsv(decodeCsv(bytes));
      files.push({
        bytes: Buffer.from(bytes).toString("base64"),
        table: {
          collection: c,
          filename: value.name.slice(0, 240),
          sha256: createHash("sha256").update(bytes).digest("hex"),
          ...parsed,
          mapping: initialMapping(c, parsed.headers),
          excluded: [],
          keep_one: [],
          offsets: {},
        },
      });
    } catch (e) {
      throw new ApiError(
        422,
        "INVALID_CSV",
        `${value.name}: ${e instanceof Error ? e.message : "Correct the CSV file."}`,
      );
    }
  }
  if (!files.length)
    throw new ApiError(
      422,
      "NO_FILES",
      "Choose at least one nonempty CSV file.",
    );
  tablesSchema.parse(files.map((f) => f.table));
  const prior = await client
    .from("import_files")
    .select("batch_id")
    .eq("event_id", id)
    .in(
      "sha256",
      files.map((f) => f.table.sha256),
    )
    .limit(1);
  if (prior.error) throw new Error("SERVICE_UNAVAILABLE");
  if (prior.data?.[0])
    return { id: prior.data[0].batch_id, repeated_file: true };
  const uploaded: string[] = [];
  let retained = false;
  try {
    const stored = [];
    for (const file of files) {
      const object_key = `${event.workspace_id}/${id}/${crypto.randomUUID()}.csv`;
      const result = await client.storage
        .from("event-imports")
        .upload(object_key, Buffer.from(file.bytes, "base64"), {
          contentType: "text/csv",
          upsert: false,
        });
      if (result.error)
        throw new ApiError(
          503,
          "UPLOAD_UNAVAILABLE",
          "Could not store the private original. Your selected files can be retried.",
        );
      uploaded.push(object_key);
      stored.push({ ...file, object_key });
    }
    const result = await planRpc("create_import_batch", {
      p_event_id: id,
      p_expected_generation: generation,
      p_files: stored,
    });
    retained = !result.repeated_file;
    return result;
  } finally {
    if (!retained && uploaded.length)
      await client.storage.from("event-imports").remove(uploaded);
  }
}
export async function updateImport(
  id: string,
  batchId: string,
  input: unknown,
) {
  const batch = await importBatch(id, batchId),
    { client } = await ownedEvent(id);
  const value = z
    .strictObject({
      generation: z.number().int().positive(),
      tables: tablesSchema,
      stage: z.boolean().default(false),
      expected_draft: z.number().int().positive().optional(),
      confirmed: z.boolean().optional(),
    })
    .parse(input);
  const { data: draft, error } = await client
    .from("plan_drafts")
    .select("snapshot,generation")
    .eq("event_id", id)
    .single();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  if (value.stage) {
    if (
      !isDeepStrictEqual(value.tables, batch.tables) ||
      value.generation !== batch.generation
    )
      throw new ApiError(
        409,
        "IMPORT_CHANGED",
        "Save your corrections and reload before reviewing the plan.",
      );
    if (value.confirmed !== true || !value.expected_draft)
      throw new ApiError(
        422,
        "CONFIRM_REQUIRED",
        "Confirm the reviewed facts and replacement of the starting draft.",
      );
    const review = reviewImport(value.tables, draft.snapshot);
    if (review.issues.some((i) => i.severity === "error"))
      throw new ApiError(
        422,
        "IMPORT_ERRORS",
        "Resolve the field errors and duplicate decisions first.",
      );
    return planRpc("stage_import_plan", {
      p_event_id: id,
      p_batch_id: batchId,
      p_generation: value.generation,
      p_expected_draft: value.expected_draft,
      p_plan: planInput(review.records),
      p_confirmed: true,
    });
  }
  const review = reviewImport(value.tables, draft.snapshot);
  const constraints = review.issues.some((i) => i.severity === "error")
    ? []
    : constraintDiagnostics(value.tables, review.records, draft.snapshot);
  return planRpc("save_import_batch", {
    p_event_id: id,
    p_batch_id: batchId,
    p_generation: value.generation,
    p_tables: value.tables,
    p_issues: [...review.issues, ...constraints],
  });
}
