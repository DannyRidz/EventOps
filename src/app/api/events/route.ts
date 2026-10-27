import { endpoint, json, readJson } from "@/lib/http";
import { listEvents, saveEvent } from "@/features/events/data";
export async function GET() {
  return endpoint(async () => json({ events: await listEvents() }));
}
export async function POST(request: Request) {
  return endpoint(async () =>
    json(await saveEvent(await readJson(request)), 201),
  );
}
