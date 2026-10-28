import { endpoint, json, readJson } from "@/lib/http";
import { queueAnalysis } from "@/features/analysis/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    await readJson(request);
    const { id, job } = await params;
    return json(await queueAnalysis(id, job), 202);
  });
}
