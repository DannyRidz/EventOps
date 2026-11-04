// Synthetic SQL fixture, not an HTTP authentication mechanism.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  editableRecords,
  planInput,
  manualPatch,
} from "../../src/features/plans/editor-model.ts";
export function inputRecords(p) {
  const aliases = new Map();
  for (const c of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of p[c]) aliases.set(r.id, r.external_id);
  const records = editableRecords(p);
  for (const rows of Object.values(records))
    for (const row of rows) {
      delete row.id;
      for (const k of [
        "room_id",
        "session_id",
        "volunteer_id",
        "predecessor_session_id",
        "successor_session_id",
      ])
        if (k in row) row[k] = aliases.get(row[k]);
    }
  return planInput(records);
}
export async function seedLiveFixture(lab, c) {
  const one = async (sql, values) =>
    (await lab.ownerQuery(sql, values)).rows[0].value;
  const event = await one(
    "select public.save_event($1::jsonb,$2::uuid) value",
    [JSON.stringify(c.input.plan.event), randomUUID()],
  );
  const stage = await one(
    "select public.stage_plan($1,$2::jsonb,1,true) value",
    [event, JSON.stringify(inputRecords(c.input.plan))],
  );
  assert.deepEqual(stage.validation_report, []);
  const receipt = await one("select public.confirm_plan($1,$2,$3,$4) value", [
    event,
    stage.generation,
    stage.candidate_digest,
    randomUUID(),
  ]);
  const map = new Map();
  for (const key of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ])
    for (const r of c.input.plan[key])
      map.set(
        r.id,
        stage.snapshot[key].find((v) => v.external_id === r.external_id).id,
      );
  const base = stage.snapshot;
  assert.ok(base.provenance.length > 0);
  const text =
    c.input.confirmed_text ??
    "Synthetic audio text fallback requires confirmation.";
  const draft = await one("select public.save_text_update($1,$2,$2,$3) value", [
    event,
    text,
    randomUUID(),
  ]);
  const job = await one(
    "select public.confirm_text_analysis($1,$2,1,$3,$4,true) value",
    [event, draft.id, receipt.revision_id, text],
  );
  assert.equal(job.state, "blocked");
  const source = (
    await lab.db.query(
      "select id from public.source_records where event_id=$1 and record_id=$2 and field_path='confirmed_text'",
      [event, job.update_id],
    )
  ).rows[0].id;
  return restoreLiveFixture(lab, {
    event,
    base,
    baseId: receipt.revision_id,
    mapEntries: [...map],
    source,
    draft,
    job,
    text,
  });
}
export function restoreLiveFixture(lab, payload) {
  const { event } = payload;
  const map = new Map(payload.mapEntries);
  const mapped = (value) =>
    JSON.parse(JSON.stringify(value), (_, v) =>
      typeof v === "string" ? (map.get(v) ?? v) : v,
    );
  const one = async (sql, values) =>
    (await lab.ownerQuery(sql, values)).rows[0].value;
  const head = async () =>
    (
      await lab.ownerQuery(
        "select current_revision_id from public.events where id=$1",
        [event],
      )
    ).rows[0].current_revision_id;
  const proposal = async (target) => {
    const currentHead = await head();
    const currentBase = (
      await lab.ownerQuery(
        "select snapshot from public.revisions where id=$1",
        [currentHead],
      )
    ).rows[0].snapshot;
    const records = editableRecords(target);
    for (const [collection, rows] of Object.entries(records))
      for (const row of rows)
        if (!currentBase[collection].some((r) => r.id === row.id))
          delete row.id;
    return one(
      "select public.create_manual_proposal($1,$2,$3::jsonb,true,$4,$5) value",
      [
        event,
        currentHead,
        JSON.stringify(manualPatch(currentBase, records)),
        "Synthetic T9 exact candidate review",
        randomUUID(),
      ],
    );
  };
  const approve = (p, key = randomUUID()) =>
    one("select public.approve_proposal($1,$2,$3,$4,$5,$6) value", [
      event,
      p.id,
      p.base_revision_id,
      p.generation,
      p.candidate_digest,
      key,
    ]);
  return { ...payload, mapped, one, head, proposal, approve };
}
