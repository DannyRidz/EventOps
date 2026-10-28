import { endpoint } from "@/lib/http";
import { playVoice } from "@/features/voice/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    const { id, job } = await params;
    return playVoice(id, job);
  });
}
