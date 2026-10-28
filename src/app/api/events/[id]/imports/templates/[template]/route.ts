import { endpoint, ApiError } from "@/lib/http";
import { ownedEvent } from "@/features/plans/data";
import { templates, templateCsv } from "@/features/imports/model";
import { collections } from "@/features/plans/schema";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; template: string }> },
) {
  return endpoint(async () => {
    const { id, template } = await context.params;
    await ownedEvent(id);
    const c = collections.find((c) => templates[c].filename === template);
    if (!c) throw new ApiError(404, "NOT_FOUND", "Template not found.");
    return new Response(templateCsv(c), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${templates[c].filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
