import { endpoint, json } from "@/lib/http";
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
