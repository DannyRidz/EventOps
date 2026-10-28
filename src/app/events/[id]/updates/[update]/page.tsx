import { VoiceRecorder } from "@/features/voice/voice-recorder";
import { listVoice } from "@/features/voice/data";
import { voiceEnabled } from "@/features/voice/contracts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOfficialPlan } from "@/features/events/page-data";
import { updateData } from "@/features/updates/data";
import { UpdateForm } from "@/features/updates/update-form";
import { EventNav } from "@/features/plans/event-nav";
import { ApiError } from "@/lib/http";
export default async function Update({
  params,
}: {
  params: Promise<{ id: string; update: string }>;
}) {
  const { id, update } = await params;
  const { approved_revision: revision } = await pageOfficialPlan(id);
  let data;
  try {
    data = await updateData(id, update);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const recordings = await listVoice(id);
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <h1>Review organizer update</h1>
      {revision && (
        <>
          <p>
            {revision.snapshot.event.name} · {revision.snapshot.event.date} ·{" "}
            {revision.snapshot.event.timezone} · Current revision{" "}
            {revision.revision_number}
          </p>
          <VoiceRecorder
            eventId={id}
            enabled={voiceEnabled()}
            jobs={recordings.filter((job) => job.draft_id === update)}
          />
          <UpdateForm
            eventId={id}
            baseId={revision.id}
            initial={data.draft}
            transcript={recordings.some((job) => job.draft_id === update)}
            analysisEnabled={data.enabled}
          />
        </>
      )}
      {data.jobs
        .filter((j) => j.draft_id === update)
        .map((j) => (
          <p key={j.id}>
            Saved analysis request, generation {j.draft_generation}: {j.stage}.{" "}
            <Link href={`/events/${id}/analysis/${j.id}`}>
              Open saved analysis
            </Link>
          </p>
        ))}
    </section>
  );
}
