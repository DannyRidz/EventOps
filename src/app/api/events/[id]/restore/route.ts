import { endpoint, json, readJson } from "@/lib/http";
import { restoreRevision } from "@/features/plans/review-data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(
      await restoreRevision((await context.params).id, await readJson(request)),
      201,
    ),
  );
}
