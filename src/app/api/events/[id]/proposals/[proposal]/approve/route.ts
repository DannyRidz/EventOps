import { endpoint, json, readJson } from "@/lib/http";
import { approveProposal } from "@/features/plans/data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; proposal: string }> },
) {
  return endpoint(async () => {
    const { id, proposal } = await context.params;
    return json(await approveProposal(id, proposal, await readJson(request)));
  });
}
