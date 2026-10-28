import Link from "next/link";
import { notFound } from "next/navigation";
import { evidence } from "@/features/plans/data";
import { ApiError } from "@/lib/http";
import { EventNav } from "@/features/plans/event-nav";
import { displayValue } from "@/features/plans/comparison";
export default async function Evidence({
  params,
}: {
  params: Promise<{ id: string; source: string }>;
}) {
  const { id, source } = await params;
  let data;
  try {
    data = await evidence(id, source);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Frozen source record</h1>
      <dl className="setup-details">
        <div>
          <dt>Record</dt>
          <dd className="break-text">{data.source.record_id}</dd>
        </div>
        <div>
          <dt>Field</dt>
          <dd>{data.source.field_path}</dd>
        </div>
        <div>
          <dt>Locator</dt>
          <dd className="break-text">{data.source.locator}</dd>
        </div>
        <div>
          <dt>Captured value</dt>
          <dd>{displayValue(data.source.value_json)}</dd>
        </div>
        <div>
          <dt>Captured at</dt>
          <dd>{data.artifact.captured_at}</dd>
        </div>
        <div>
          <dt>Source SHA256</dt>
          <dd className="break-text">{data.source.sha256}</dd>
        </div>
        <div>
          <dt>Captured by</dt>
          <dd className="break-text">{data.artifact.captured_by}</dd>
        </div>
      </dl>
      {data.artifact.metadata.operation === "csv_review" && (
        <section className="stack">
          <h2>CSV source and correction</h2>
          <p>
            <Link
              href={`/events/${id}/imports/${data.artifact.metadata.batch_id}?version=${data.artifact.metadata.generation}`}
            >
              Open the exact saved correction version{" "}
              {data.artifact.metadata.generation}
            </Link>
          </p>
          {(() => {
            const origin =
              data.artifact.metadata.field_sources?.[
                `${data.source.record_id}:${data.source.field_path}`
              ];
            if (!origin) return null;
            return (
              <div className="stack">
                <p>
                  {(
                    {
                      organizer_correction: "Organizer correction",
                      csv_normalization: "Imported CSV value",
                      explicit_default_or_derived:
                        "Reviewed default or derived value",
                      event_setup: "Event setup",
                    } as Record<string, string>
                  )[origin.kind] ?? "Reviewed source"}
                  : {origin.filename ?? "Event setup"}
                  {origin.row ? `, row ${origin.row}` : ""}
                  {origin.column ? `, column ${origin.column}` : ""}
                </p>
                {origin.original_source_id && (
                  <Link
                    href={`/events/${id}/evidence/${origin.original_source_id}`}
                  >
                    Open the immutable original CSV cell
                  </Link>
                )}
                {origin.kind === "organizer_correction" && (
                  <p>
                    Original: {displayValue(origin.original_value)}. Saved
                    correction: {displayValue(origin.corrected_value)}.
                  </p>
                )}
                {origin.default_notice && <p>{origin.default_notice}</p>}
              </div>
            );
          })()}
        </section>
      )}
    </section>
  );
}
