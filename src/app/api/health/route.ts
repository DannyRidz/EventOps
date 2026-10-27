export const dynamic = "force-dynamic";
/** Process liveness only. Database and provider readiness are separate later checks. */
export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
