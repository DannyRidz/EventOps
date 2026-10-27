import { endpoint, json, readJson } from "@/lib/http";
import { saveEvent } from "@/features/events/data";
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(await saveEvent(await readJson(request), (await context.params).id)),
  );
}
