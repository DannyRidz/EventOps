import { endpoint, json, readJson, ApiError } from "@/lib/http";
import { readProposal } from "@/features/plans/data";
import { answerAnalysis } from "@/features/plans/review-data";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; proposal: string }> },
) {
  return endpoint(async () => {
    const { id, proposal } = await context.params;
    const p = await readProposal(id, proposal);
    if (!p.analysis_job_id)
      throw new ApiError(
        422,
        "NO_QUESTIONS",
        "This manual proposal has no analysis questions.",
      );
    return json(
      await answerAnalysis(id, p.analysis_job_id, await readJson(request)),
      201,
    );
  });
}
