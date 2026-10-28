import { endpoint, json, readJson } from "@/lib/http";
import { saveText, updateData } from "@/features/updates/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(
      await saveText((await params).id, await readJson(request, 128000)),
      201,
    ),
  );
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => json(await updateData((await params).id)));
}
