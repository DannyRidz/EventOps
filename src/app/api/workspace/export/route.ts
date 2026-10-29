import { endpoint } from "@/lib/http";
import { workspaceZip } from "@/features/privacy/export";
export async function GET() {
  return endpoint(
    async () =>
      new Response(new Uint8Array(await workspaceZip()), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=eventops-workspace.zip",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
  );
}
