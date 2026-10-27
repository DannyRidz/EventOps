import { endpoint, json } from "@/lib/http";
import { readPlan } from "@/features/events/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json({
      status: "draft",
      approved_revision: null,
      draft: await readPlan((await context.params).id),
    }),
  );
}
