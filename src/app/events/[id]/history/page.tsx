import Link from "next/link";
import { revisions } from "@/features/plans/data";
import { pageOfficialPlan } from "@/features/events/page-data";
import { EventNav } from "@/features/plans/event-nav";
import { PlanRecords } from "@/features/plans/plan-records";
import {
  comparePlans,
  displayValue,
  recordName,
} from "@/features/plans/comparison";
import { RestoreAction } from "@/features/plans/restore-action";
import { restoreContext } from "@/features/plans/review-data";
export default async function History({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    cursor?: string;
    revision?: string;
    compare?: string;
    restore?: string;
  }>;
}) {
  const { id } = await params,
    q = await searchParams;
  const current = (await pageOfficialPlan(id)).approved_revision;
  const rows = await revisions(id, q.cursor);
  const selected = q.revision
    ? (await pageOfficialPlan(id, q.revision)).approved_revision
    : current;
  const other = q.compare
    ? (await pageOfficialPlan(id, q.compare)).approved_revision
    : current;
  const restore = q.restore
    ? (await pageOfficialPlan(id, q.restore)).approved_revision
    : null;
  const target = restore ?? selected;
  const base = restore ? current : other;
  const changes =
    target && base ? comparePlans(base.snapshot, target.snapshot) : [];
  const context = restore ? await restoreContext(id) : null;
  const choices = [
    ...new Map(
      [
        ...rows.revisions,
        ...[current, selected, other].filter(
          (r): r is NonNullable<typeof r> => !!r,
        ),
      ].map((r) => [r.id, r]),
    ).values(),
  ];
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Revision history</h1>
      {current ? (
        <p>
          Current approved revision {current.revision_number} ·{" "}
          {current.snapshot.event.name} · {current.snapshot.event.date} ·{" "}
          {current.snapshot.event.timezone}
        </p>
      ) : (
        <p>No approved revisions yet.</p>
      )}
      <ul className="event-list">
        {rows.revisions.map((r) => (
          <li key={r.id}>
            <div>
              <h2>Revision {r.revision_number}</h2>
              <p>
                {r.approved_at} · {r.reason}
              </p>
              <p className="break-text">Approved by the event organizer</p>
              {r.restores_revision_id && (
                <p>
                  Restores{" "}
                  <Link href={`?revision=${r.restores_revision_id}`}>
                    historical revision
                  </Link>
                </p>
              )}
              <div className="actions">
                <Link href={`?revision=${r.id}`}>
                  View revision {r.revision_number}
                </Link>
                <Link href={`/events/${id}/briefing?revision=${r.id}`}>
                  Briefing
                </Link>
                {r.proposal_id && (
                  <Link href={`/events/${id}/proposals/${r.proposal_id}`}>
                    Source proposal
                  </Link>
                )}
                {current && r.id !== current.id && (
                  <Link href={`?restore=${r.id}`}>Review restoration</Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.next_cursor && (
        <Link href={`?cursor=${rows.next_cursor}`}>Older revisions</Link>
      )}
      {target && (
        <>
          <h2>
            {restore
              ? "Review historical restoration"
              : "Historical comparison"}{" "}
            · revision {target.revision_number}
          </h2>
          <p>
            This view does not change the current plan. Comparing{" "}
            {base?.revision_number} before to {target.revision_number} after.
          </p>
          {!restore && (
            <form method="get" className="form-columns">
              <label className="field">
                Before revision
                <select name="compare" defaultValue={other?.id}>
                  {choices.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.revision_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                After revision
                <select name="revision" defaultValue={target.id}>
                  {choices.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.revision_number}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit">
                Compare revisions
              </button>
            </form>
          )}
          {changes.length ? (
            <div className="comparison-list">
              {changes.map((c, i) => (
                <article className="comparison-row" key={i}>
                  <h3>
                    {recordName(target.snapshot, c.record_id) ??
                      (base ? recordName(base.snapshot, c.record_id) : null) ??
                      c.record_id}{" "}
                    · {c.field}
                  </h3>
                  <dl>
                    <div>
                      <dt>Before</dt>
                      <dd>{displayValue(c.before)}</dd>
                    </div>
                    <div>
                      <dt>After</dt>
                      <dd>{displayValue(c.after)}</dd>
                    </div>
                    <div>
                      <dt>Historical evidence</dt>
                      <dd>
                        {c.sources.map((s) => (
                          <p key={s}>
                            <Link href={`/events/${id}/evidence/${s}`}>
                              Open frozen source
                            </Link>
                          </p>
                        ))}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p>No field differences.</p>
          )}
          <details>
            <summary>Full selected approved revision</summary>
            <PlanRecords plan={target.snapshot} />
          </details>
          {restore && current && restore.id !== current.id && (
            <>
              <section className="state-panel">
                <h2>Outstanding confirmed updates</h2>
                <p>
                  Review these statements before reconfirming historical facts.
                  A newer statement may contradict restored availability or
                  sessions.
                </p>
                {context?.context.jobs.map((j) => (
                  <article key={j.id}>
                    <p className="preserve-text">{j.text}</p>
                    <Link href={`/events/${id}/analysis/${j.id}`}>
                      Review {j.state} update
                    </Link>
                  </article>
                ))}
                <h3>Pending manual proposals</h3>
                {context?.context.manual_proposals.map((p) => (
                  <article key={p.id}>
                    <p className="preserve-text">{p.text}</p>
                    <Link href={`/events/${id}/proposals/${p.id}`}>
                      Review pending manual candidate generation {p.generation}
                    </Link>
                  </article>
                ))}
                <h3>Saved text drafts</h3>
                {context?.context.drafts.map((d) => (
                  <article key={d.id}>
                    <p className="preserve-text">{d.text}</p>
                    <Link href={`/events/${id}/updates/${d.id}`}>
                      Review saved generation {d.generation}
                    </Link>
                  </article>
                ))}
                <Link href={`/events/${id}/updates`}>
                  Review all updates and saved drafts
                </Link>
              </section>
              {changes.length > 0 && (
                <RestoreAction
                  eventId={id}
                  target={restore.id}
                  head={current.id}
                  contextDigest={context!.digest}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
