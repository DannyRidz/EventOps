import { pageOfficialPlan } from "@/features/events/page-data";
import { EventNav } from "@/features/plans/event-nav";
import { importBatch } from "@/features/imports/data";
import { ImportCorrection } from "@/features/imports/import-form";
import { ownedEvent } from "@/features/plans/data";
import { z } from "zod";
import { tablesSchema } from "@/features/imports/model";
export default async function ImportReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; batch: string }>;
  searchParams: Promise<{ repeated?: string; version?: string }>;
}) {
  const { id, batch } = await params;
  const plan = await pageOfficialPlan(id);
  const data = await importBatch(id, batch);
  const query = await searchParams;
  const repeated = query.repeated;
  let selected = data.tables;
  let generation = data.generation;
  if (query.version) {
    generation = z.coerce.number().int().positive().parse(query.version);
    const { client } = await ownedEvent(id);
    const version = await client
      .from("import_versions")
      .select("tables")
      .eq("event_id", id)
      .eq("batch_id", batch)
      .eq("generation", generation)
      .single();
    if (version.error) throw new Error("SERVICE_UNAVAILABLE");
    selected = version.data.tables;
  }
  return (
    <section className="workspace-page stack">
      <EventNav id={id} />
      <p className="eyebrow">
        Import · Version {generation}
        {query.version ? " · Saved correction receipt" : ""}
      </p>
      <h1>Correct and review records</h1>
      {repeated && (
        <p role="status">
          This exact file was imported before. Its prior batch is shown. No
          files from the new upload were added.
        </p>
      )}
      <ImportCorrection
        key={`${data.id}:${data.generation}`}
        eventId={id}
        batchId={data.id}
        generation={generation}
        draftGeneration={plan.draft.generation}
        initial={tablesSchema.parse(selected)}
        originals={data.originals}
        setup={plan.draft.snapshot}
        locked={!!plan.approved_revision || !!query.version}
      />
    </section>
  );
}
