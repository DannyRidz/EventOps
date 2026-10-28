import { endpoint, json } from "@/lib/http";
import { listImports, uploadImports } from "@/features/imports/data";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(await listImports((await context.params).id)),
  );
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () =>
    json(await uploadImports((await context.params).id, request), 201),
  );
}
