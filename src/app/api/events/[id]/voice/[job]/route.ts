import { endpoint, json, checkOrigin } from "@/lib/http";
import {
  voiceJob,
  discardVoice,
  retryVoiceUpload,
} from "@/features/voice/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    const { id, job } = await params;
    const result = await voiceJob(id, job);
    return json({
      id: result.job.id,
      state: result.job.state,
      draft_id: result.job.draft_id,
    });
  });
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    checkOrigin(request);
    const { id, job } = await params;
    return json(await discardVoice(id, job));
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; job: string }> },
) {
  return endpoint(async () => {
    checkOrigin(request);
    const { id, job } = await params;
    return json(await retryVoiceUpload(id, job), 202);
  });
}
