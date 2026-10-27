import { z } from "zod";
import { authenticatedClient } from "@/lib/supabase/server";
import { ApiError, endpoint, json, readJson } from "@/lib/http";
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = z
      .object({ attested: z.literal(true) })
      .parse(await readJson(request));
    const { data, error } = await (
      await authenticatedClient()
    ).rpc("bootstrap_workspace", { p_attested: input.attested });
    if (error)
      throw new ApiError(
        503,
        "WORKSPACE_UNAVAILABLE",
        "Could not open your workspace. Please try again.",
      );
    return json({ workspace_id: data });
  });
}
