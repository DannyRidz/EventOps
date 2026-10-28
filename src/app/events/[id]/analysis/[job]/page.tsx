import Link from "next/link";
import { notFound } from "next/navigation";
import { readAnalysis } from "@/features/analysis/data";
import { analysisResultSchema } from "@/features/analysis/contracts";
import { applyIntents } from "@/features/analysis/tools";
import { describeRequest } from "@/features/analysis/descriptions";
import { JobControls } from "@/features/analysis/job-controls";
import { officialPlan } from "@/features/plans/data";
import { EventNav } from "@/features/plans/event-nav";
import { PlanRecords } from "@/features/plans/plan-records";
import {
  comparePlans,
  displayValue,
  recordName,
} from "@/features/plans/comparison";
import { ApiError } from "@/lib/http";
export default async function Analysis({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; job: string }>;
  searchParams: Promise<{ option?: string }>;
}) {
  const { id, job: jobId } = await params;
  let data;
  try {
    data = await readAnalysis(id, jobId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { job } = data,
    current = await officialPlan(id),
    base = (await officialPlan(id, job.base_revision_id)).approved_revision;
  if (!base) notFound();
  const stale =
    current.approved_revision?.id !== base.id ||
    data.current_generation !== job.draft_generation;
  const result = job.result ? analysisResultSchema.parse(job.result) : null;
  const query = await searchParams;
  const selected = result?.options.find(
    (o) => o.id === (query.option ?? result.selected_option_id),
  );
  const candidate = selected
    ? applyIntents(base.snapshot, selected.requests, job.id)
    : null;
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Review update analysis</h1>
      <p>
        {base.snapshot.event.name} · {base.snapshot.event.date} ·{" "}
        {base.snapshot.event.timezone} · Based on revision{" "}
        {base.revision_number}
      </p>
      <p role="status">{job.stage}</p>
      <h2>Confirmed organizer text</h2>
      <p className="preserve-text">{data.text}</p>
      <Link href={`/events/${id}/evidence/${data.source_id}`}>
        Open frozen confirmed text
      </Link>
      {stale && (
        <p role="alert">
          The plan or update text has changed. This result cannot create a new
          proposal. Confirm the current saved text against the current plan.
        </p>
      )}
      {job.state === "blocked" && (
        <p>
          Model access has not been enabled. No analysis has run for this
          request.
        </p>
      )}
      {job.state === "failed" && (
        <p>
          Analysis stopped ({job.error_code}). Your text and approved plan are
          preserved.
        </p>
      )}
      {result && (
        <>
          <h2>Interpreted requests</h2>
          <p>
            These are suggestions until you confirm their complete meaning and
            any new facts. Review every request against your original text.
          </p>
          <ol>
            {result.interpretation.intents.map((r) => (
              <li key={r.intent_id}>
                <p>{describeRequest(r, base.snapshot)}</p>
                <blockquote>{r.span.quote}</blockquote>
              </li>
            ))}
          </ol>
          {result.interpretation.unsupported_requests.length > 0 && (
            <section>
              <h2>Unsupported requests</h2>
              <ul>
                {result.interpretation.unsupported_requests.map(
                  (request, i) => (
                    <li key={i}>{request}</li>
                  ),
                )}
              </ul>
            </section>
          )}
          {result.questions.length > 0 && (
            <section className="state-panel">
              <h2>Needs your review</h2>
              <ul>
                {result.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <Link href={`/events/${id}/updates/${job.draft_id}`}>
                Correct or clarify saved text
              </Link>
            </section>
          )}
          <p>
            {result.impacted_records.length} recorded items are in the
            deterministic impact closure. Every candidate is checked against the
            complete plan.
          </p>
          <details>
            <summary>
              Affected records ({result.impacted_records.length})
            </summary>
            <ul>
              {result.impacted_records.map((record) => (
                <li key={record}>
                  {recordName(base.snapshot, record) ??
                    (candidate ? recordName(candidate, record) : null) ??
                    `New record ${record}`}
                </li>
              ))}
            </ul>
          </details>
          {result.options.length > 0 && (
            <>
              <h2>Validated options</h2>
              <ul>
                {result.options.map((o) => (
                  <li key={o.id}>
                    <Link href={`?option=${o.id}`}>Review {o.id}</Link> ·{" "}
                    {o.changed_sessions} sessions changed ·{" "}
                    {o.displacement_minutes} minutes of total displacement
                    {o.id === result.selected_option_id
                      ? " · Recommended among these choices"
                      : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {selected && candidate && (
        <>
          <h2>Selected exact requests</h2>
          <ul>
            {selected.requests.map((r) => (
              <li key={r.intent_id}>{describeRequest(r, base.snapshot)}</li>
            ))}
          </ul>
          <h2>Before, proposed, evidence</h2>
          <div className="comparison-list">
            {comparePlans(base.snapshot, candidate).map((c, i) => (
              <article className="comparison-row" key={i}>
                <h3>
                  {recordName(candidate, c.record_id) ??
                    recordName(base.snapshot, c.record_id) ??
                    c.record_id}{" "}
                  · {c.field}
                </h3>
                <dl>
                  <div>
                    <dt>Before</dt>
                    <dd>{displayValue(c.before)}</dd>
                  </div>
                  <div>
                    <dt>Proposed</dt>
                    <dd>{displayValue(c.after)}</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>
                      <Link href={`/events/${id}/evidence/${data.source_id}`}>
                        Confirmed text, awaiting exact fact confirmation
                      </Link>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <details>
            <summary>Full proposed plan</summary>
            <PlanRecords plan={candidate} />
          </details>
        </>
      )}
      {data.proposal ? (
        <Link
          className="button"
          href={`/events/${id}/proposals/${data.proposal.id}`}
        >
          Open {data.proposal.state} proposal
        </Link>
      ) : (
        !stale && (
          <JobControls
            key={`${job.id}:${selected?.id ?? "none"}`}
            eventId={id}
            jobId={job.id}
            state={job.state}
            enabled={data.enabled}
            optionId={
              result?.status === "ready_for_confirmation"
                ? selected?.id
                : undefined
            }
            digest={job.result_digest ?? undefined}
          />
        )
      )}
      <Link href={`/events/${id}/records`}>Prepare manual changes</Link>
    </section>
  );
}
