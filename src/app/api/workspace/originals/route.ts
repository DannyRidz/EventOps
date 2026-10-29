import { z } from "zod";
import { endpoint, json, readJson } from "@/lib/http";
import { privacyRpc } from "@/features/privacy/data";
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = z
      .strictObject({ event_id: z.uuid(), artifact_id: z.uuid() })
      .parse(await readJson(request));
    await privacyRpc("delete_csv_original", {
      p_event_id: input.event_id,
      p_artifact_id: input.artifact_id,
    });
    return json({ scheduled: true });
  });
}
