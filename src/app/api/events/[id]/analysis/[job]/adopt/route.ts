import { endpoint, json, readJson } from "@/lib/http";
import { adoptAnalysis } from "@/features/analysis/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    const { id, job } = await params;
    return json(await adoptAnalysis(id, job, await readJson(request)), 201);
  });
}
