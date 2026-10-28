import { endpoint, json, readJson } from "@/lib/http";
import { importBatch, updateImport } from "@/features/imports/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; batch: string }> },
) {
  return endpoint(async () => {
    const { id, batch } = await context.params;
    return json(await importBatch(id, batch));
  });
}
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; batch: string }> },
) {
  return endpoint(async () => {
    const { id, batch } = await context.params;
    return json(
      await updateImport(id, batch, await readJson(request, 12 * 1024 * 1024)),
    );
  });
}
