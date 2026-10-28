import Link from "next/link";
import { pageOfficialPlan } from "@/features/events/page-data";
import { updateData } from "@/features/updates/data";
import { UpdateForm } from "@/features/updates/update-form";
import { EventNav } from "@/features/plans/event-nav";
export default async function Updates({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { approved_revision: revision } = await pageOfficialPlan(id);
  const data = await updateData(id);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Updates and proposals</h1>
      {revision ? (
        <>
          <p>
            {revision.snapshot.event.name} · {revision.snapshot.event.date} ·{" "}
            {revision.snapshot.event.timezone} · Approved revision{" "}
            {revision.revision_number}
          </p>
          <UpdateForm
            eventId={id}
            baseId={revision.id}
            analysisEnabled={data.enabled}
          />
        </>
      ) : (
        <p>
          <Link href={`/events/${id}/records`}>Confirm a starting plan</Link>{" "}
          before adding updates.
        </p>
      )}
      <section>
        <h2>Saved text updates</h2>
        {data.drafts.length ? (
          <ul className="event-list">
            {data.drafts.map((d) => (
              <li key={d.id}>
                <div>
                  <p className="preserve-text">{d.corrected_text}</p>
                  <p>Saved generation {d.generation}</p>
                  <Link href={`/events/${id}/updates/${d.id}`}>
                    Review saved text
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No text updates saved.</p>
        )}
      </section>
      <section>
        <h2>Analysis requests</h2>
        {data.jobs.length ? (
          <ul>
            {data.jobs.map((j) => (
              <li key={j.id}>
                {j.stage}.{j.state === "blocked" ? " No analysis has run." : ""}{" "}
                <Link href={`/events/${id}/analysis/${j.id}`}>Open update</Link>{" "}
                · Job <span className="break-text">{j.id}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No analysis requests.</p>
        )}
      </section>
      <section>
        <h2>Manual proposals</h2>
        {data.proposals.length ? (
          <ul>
            {data.proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/events/${id}/proposals/${p.id}`}>
                  Review {p.state} proposal
                </Link>{" "}
                · {p.created_at}
              </li>
            ))}
          </ul>
        ) : (
          <p>No manual proposals.</p>
        )}
      </section>
      <p>Showing up to 100 of each saved item, newest first.</p>
    </section>
  );
}
