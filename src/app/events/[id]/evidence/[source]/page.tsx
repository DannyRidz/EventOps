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
          <dd>{data.source.locator}</dd>
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
    </section>
  );
}
