import { endpoint, json } from "@/lib/http";
import { listVoice, uploadVoice } from "@/features/voice/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(await uploadVoice((await params).id, request), 202),
  );
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => json(await listVoice((await params).id)));
}
