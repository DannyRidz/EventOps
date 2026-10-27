import { endpoint, json, readJson } from "@/lib/http";
import { stagePlan } from "@/features/plans/data";
import { saveEvent } from "@/features/events/data";
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const body = await readJson(request, 4 * 1024 * 1024),
      id = (await context.params).id;
    return json(
      body && typeof body === "object" && "plan" in body
        ? await stagePlan(id, body)
        : await saveEvent(body, id),
    );
  });
}
