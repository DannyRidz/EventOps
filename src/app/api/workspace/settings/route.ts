import { endpoint, json, readJson } from "@/lib/http";
import { settings, changeSettings } from "@/features/privacy/data";
export async function GET() {
  return endpoint(async () => json(await settings()));
}
export async function POST(request: Request) {
  return endpoint(async () =>
    json(await changeSettings(await readJson(request))),
  );
}
