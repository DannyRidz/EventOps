import { endpoint, json } from "@/lib/http";
import { revisions } from "@/features/plans/data";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(
      await revisions(
        (await context.params).id,
        new URL(request.url).searchParams.get("cursor") ?? undefined,
      ),
    ),
  );
}
