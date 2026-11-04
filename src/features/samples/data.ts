import "server-only";
import { ownedEvent } from "@/features/plans/data";
import { matchesSampleSetup } from "./sample";

export async function isSampleEvent(id: string) {
  const { client } = await ownedEvent(id);
  const { data, error } = await client
    .from("events")
    .select("create_snapshot")
    .eq("id", id)
    .single();
  if (error) throw new Error("SERVICE_UNAVAILABLE");
  return matchesSampleSetup(data?.create_snapshot);
}
