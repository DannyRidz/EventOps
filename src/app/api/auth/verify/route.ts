import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { ApiError, endpoint, json, readJson } from "@/lib/http";
const inputSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
  attested: z.literal(true),
});
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = inputSchema.parse(await readJson(request));
    const client = await serverClient();
    const { error } = await client.auth.verifyOtp({
      email: input.email,
      token: input.code,
      type: "email",
    });
    if (error)
      throw new ApiError(
        error.status === 429 ? 429 : 400,
        "INVALID_CODE",
        error.status === 429
          ? "Too many attempts. Please wait and try again."
          : "This code is invalid or expired. Request a new code.",
        error.status === 429 ? 60 : undefined,
      );
    const bootstrap = await client.rpc("bootstrap_workspace", {
      p_attested: true,
    });
    if (bootstrap.error) return json({ workspace_pending: true });
    return json({ redirect: "/events" });
  });
}
