import Link from "next/link";
import { pageOfficialPlan } from "@/features/events/page-data";
import { PlanEvidence } from "@/features/plans/plan-evidence";
import { PlanRecords } from "@/features/plans/plan-records";
import { EventNav } from "@/features/plans/event-nav";
export default async function Briefing({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const { id } = await params;
  const { approved_revision: revision, status } = await pageOfficialPlan(
    id,
    (await searchParams).revision,
  );
  const current =
    status === "historical"
      ? (await pageOfficialPlan(id)).approved_revision
      : revision;
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Event briefing</h1>
      {revision ? (
        <>
          <p className="eyebrow">
            {status === "historical"
              ? "Historical approved revision"
              : "Approved revision"}{" "}
            {revision.revision_number}
          </p>
          {status === "historical" && (
            <p role="status">
              This is a historical briefing. Current approved revision{" "}
              {current?.revision_number}.{" "}
              <Link href={`/events/${id}/briefing`}>
                Open the current briefing
              </Link>
              .
            </p>
          )}
          <h2>{revision.snapshot.event.name}</h2>
          <p>
            Saved{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: revision.snapshot.event.timezone,
            }).format(new Date(revision.approved_at))}{" "}
            ({revision.snapshot.event.timezone}). This briefing uses only this
            approved revision. Pending updates are excluded.
          </p>
          <PlanRecords plan={revision.snapshot} />
          <PlanEvidence plan={revision.snapshot} eventId={id} />
        </>
      ) : (
        <p>
          No approved plan yet.{" "}
          <Link href={`/events/${id}/records`}>
            Enter and confirm the starting plan
          </Link>
          .
        </p>
      )}
    </section>
  );
}
