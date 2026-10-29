import { endpoint, json, readJson } from "@/lib/http";
import { readProposal } from "@/features/plans/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; proposal: string }> },
) {
  return endpoint(async () => {
    const { id, proposal } = await context.params;
    return json(await readProposal(id, proposal));
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; proposal: string }> },
) {
  return endpoint(async () => {
    const { id, proposal } = await context.params;
    return json(
      await (
        await import("@/features/plans/review-data")
      ).editProposal(id, proposal, await readJson(request, 4 * 1024 * 1024)),
      201,
    );
  });
}
