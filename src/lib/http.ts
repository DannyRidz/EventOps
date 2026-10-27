import { z } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retry?: number,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected)
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Sign in is temporarily unavailable.",
    );
  if (request.headers.get("origin") !== new URL(expected).origin)
    throw new ApiError(403, "ORIGIN_REJECTED", "Please submit from EventOps.");
}
export async function readJson(request: Request, maximumBytes = 16384) {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "JSON_REQUIRED", "Send JSON data.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "INVALID_INPUT", "Provide the form fields.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new ApiError(413, "TOO_LARGE", "The form is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Check the form fields.");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function endpoint(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    const known =
      error instanceof ApiError
        ? error
        : error instanceof z.ZodError
          ? new ApiError(422, "INVALID_INPUT", "Check the highlighted fields.")
          : error instanceof Error && error.message === "UNAUTHENTICATED"
            ? new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.")
            : new ApiError(
                503,
                "SERVICE_UNAVAILABLE",
                "We could not complete this request. Please try again.",
              );
    return json(
      {
        code: known.code,
        message: known.message,
        field_errors:
          error instanceof z.ZodError ? z.flattenError(error).fieldErrors : {},
        request_id: crypto.randomUUID(),
        ...(known.retry ? { retry_after_seconds: known.retry } : {}),
      },
      known.status,
    );
  }
}
