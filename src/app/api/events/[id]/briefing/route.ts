import { z } from "zod";
import { endpoint, ApiError } from "@/lib/http";
import { officialPlan } from "@/features/plans/data";
import { collections } from "@/features/plans/schema";
import { briefingCsv, briefingText } from "@/features/plans/briefing";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { id } = await context.params;
    const params = new URL(request.url).searchParams;
    const format = z
      .enum(["text", "csv"])
      .parse(params.get("format") ?? "text");
    const selected = params.get("revision") ?? undefined;
    const { approved_revision: r } = await officialPlan(id, selected);
    if (!r)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "No approved revision is available.",
      );
    let body: string;
    if (format === "csv")
      body = briefingCsv(
        r,
        z.enum(collections).parse(params.get("collection") ?? "sessions"),
      );
    else {
      const parent = r.parent_revision_id
        ? (await officialPlan(id, r.parent_revision_id)).approved_revision
            ?.snapshot
        : undefined;
      body = briefingText(r, parent);
    }
    return new Response(body, {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="eventops-revision-${r.revision_number}${format === "csv" ? "-" + (params.get("collection") ?? "sessions") : ""}.${format === "csv" ? "csv" : "txt"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
