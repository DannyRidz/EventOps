import { endpoint, json } from "@/lib/http";
import { evidence } from "@/features/plans/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; source: string }> },
) {
  return endpoint(async () => {
    const { id, source } = await context.params;
    return json(await evidence(id, source));
  });
}
