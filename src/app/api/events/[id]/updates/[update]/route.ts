import { endpoint, json, readJson } from "@/lib/http";
import { saveText, updateData } from "@/features/updates/data";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; update: string }> },
) {
  return endpoint(async () => {
    const { id, update } = await params;
    return json(await saveText(id, await readJson(request, 128000), update));
  });
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; update: string }> },
) {
  return endpoint(async () => {
    const { id, update } = await params;
    return json(await updateData(id, update));
  });
}
