import { z } from "zod";
import { planInput } from "@/features/plans/editor-model";
import { matchesSampleSetup, sampleRecords, sampleSetup } from "./sample";

type Request = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<unknown>;
const view = z.object({
  approved_revision: z.unknown().nullable(),
  draft: z.object({
    generation: z.number().int().positive(),
    snapshot: z.unknown(),
    plan_snapshot: z.unknown().nullable(),
  }),
});

export function sampleRequestKey(
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const name = "eventops:request:sample-v1";
  const saved = storage.getItem(name);
  if (saved) return z.uuid().parse(saved);
  const key = crypto.randomUUID();
  storage.setItem(name, key);
  return key;
}

export async function loadSample(
  request: Request,
  key: string,
  onCreated: (id: string) => void,
) {
  const created = z.object({ event_id: z.uuid() }).parse(
    await request("/api/events", {
      setup: sampleSetup,
      request_id: z.uuid().parse(key),
    }),
  );
  const id = created.event_id;
  onCreated(id);
  const current = view.parse(
    await request(`/api/events/${id}/plan`, undefined, "GET"),
  );
  if (current.approved_revision || current.draft.plan_snapshot) return id;
  if (
    current.draft.generation !== 1 ||
    !matchesSampleSetup(current.draft.snapshot)
  )
    throw new Error(
      "This sample draft has changed. Open the saved draft to continue without replacing your edits.",
    );
  // Stage once, only against the empty original generation. Any lost response or
  // concurrency conflict is reconciled by GET on the next retry, never overwrite.
  await request(
    `/api/events/${id}/draft`,
    {
      plan: planInput(sampleRecords()),
      expected_generation: 1,
      confirmed: true,
    },
    "PUT",
  );
  return id;
}
