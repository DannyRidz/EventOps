import Link from "next/link";
import { pageOfficialPlan } from "@/features/events/page-data";
import { EventNav } from "@/features/plans/event-nav";
import { listImports } from "@/features/imports/data";
import { ImportUpload } from "@/features/imports/import-form";
export default async function Imports({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await pageOfficialPlan(id);
  const batches = await listImports(id);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <p className="eyebrow">Starting plan</p>
      <h1>Import and review CSV files</h1>
      <p>
        Upload privately, map columns and correct records. Review the entire
        plan before it becomes revision 1.
      </p>
      {plan.approved_revision ? (
        <div className="state-panel">
          <h2>Starting plan already confirmed</h2>
          <p>
            Bulk replacement is limited to initial setup.{" "}
            <Link href={`/events/${id}/records`}>
              Propose manual corrections
            </Link>{" "}
            to the approved plan.
          </p>
        </div>
      ) : (
        <ImportUpload eventId={id} generation={plan.draft.generation} />
      )}
      <section className="stack">
        <h2>Saved imports</h2>
        {batches.length ? (
          <ul className="event-list">
            {batches.map((b) => (
              <li key={b.id}>
                <div>
                  <h3>
                    <Link href={`/events/${id}/imports/${b.id}`}>
                      Import saved{" "}
                      {new Date(b.created_at).toLocaleString("en-GB", {
                        timeZone: plan.draft.snapshot.timezone,
                      })}
                    </Link>
                  </h3>
                  <p>
                    Version {b.generation} · {b.state} ·{" "}
                    {plan.draft.snapshot.timezone}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No saved imports. You can also{" "}
            <Link href={`/events/${id}/records`}>enter records manually</Link>.
          </p>
        )}
        <p>The latest ten imports are shown.</p>
      </section>
    </section>
  );
}
