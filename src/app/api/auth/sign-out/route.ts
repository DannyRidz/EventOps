import { serverClient } from "@/lib/supabase/server";
import { ApiError, endpoint, json, readJson } from "@/lib/http";
export async function POST(request: Request) {
  return endpoint(async () => {
    await readJson(request);
    const { error } = await (
      await serverClient()
    ).auth.signOut({ scope: "local" });
    if (error)
      throw new ApiError(
        503,
        "SIGN_OUT_FAILED",
        "Could not sign out. Please try again.",
      );
    return json({ redirect: "/sign-in" });
  });
}
