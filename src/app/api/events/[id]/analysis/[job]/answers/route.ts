import { endpoint, json, readJson } from "@/lib/http";
import { answerAnalysis } from "@/features/plans/review-data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    const { id, job } = await context.params;
    return json(await answerAnalysis(id, job, await readJson(request)), 201);
  });
}
