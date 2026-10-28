import { endpoint, json, readJson } from "@/lib/http";
import { confirmText } from "@/features/updates/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; update: string }> },
) {
  return endpoint(async () => {
    const { id, update } = await params;
    return json(
      await confirmText(id, update, await readJson(request, 128000)),
      202,
    );
  });
}
