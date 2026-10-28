import { endpoint, json } from "@/lib/http";
import { readAnalysis } from "@/features/analysis/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    const { id, job } = await params;
    return json(await readAnalysis(id, job));
  });
}
