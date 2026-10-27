import { endpoint, json } from "@/lib/http";
import { officialPlan } from "@/features/plans/data";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(
      await officialPlan(
        (await context.params).id,
        new URL(request.url).searchParams.get("revision") ?? undefined,
      ),
    ),
  );
}
