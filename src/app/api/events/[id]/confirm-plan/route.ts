import { endpoint, json, readJson } from "@/lib/http";
import { confirmPlan } from "@/features/plans/data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(await confirmPlan((await context.params).id, await readJson(request))),
  );
}
