import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { ApiError, endpoint, json, readJson } from "@/lib/http";
const authInput = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  attested: z.literal(true),
});
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = authInput.parse(await readJson(request));
    const client = await serverClient();
    const { error } = await client.auth.signInWithOtp({
      email: input.email,
      options: { shouldCreateUser: true },
    });
    if (error)
      throw new ApiError(
        error.status === 429 ? 429 : 503,
        "CODE_NOT_SENT",
        error.status === 429
          ? "Please wait before requesting another code."
          : "We could not send a code. Please try again.",
        error.status === 429 ? 60 : undefined,
      );
    return json({
      message: "Check your email for a sign in code.",
      retry_after_seconds: 60,
    });
  });
}
