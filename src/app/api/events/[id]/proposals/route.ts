import { endpoint, json, readJson } from "@/lib/http";
import { createProposal } from "@/features/plans/data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(
      await createProposal(
        (await context.params).id,
        await readJson(request, 4 * 1024 * 1024),
      ),
      201,
    ),
  );
}
