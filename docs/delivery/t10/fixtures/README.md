# Synthetic rehearsal inputs

These files contain invented internal test records, not customer data. No event
was created, imported or approved while preparing this package. The JSON files
are reference snapshots for checking facts; EventOps does not advertise JSON
plan upload. Use the CSV files through the existing import workflow.

## New disposable event

Use the values in [setup.json](setup.json):

| Field | Value |
|---|---|
| Name | Synthetic EventOps rehearsal |
| Date | 2 November 2026 |
| Timezone | Asia/Brunei |
| Operating hours | 09:00 to 17:00, UTC offset +08:00 |
| Locations | Main hall; Side hall |

Import [rooms.csv](rooms.csv), [schedule.csv](schedule.csv),
[volunteers.csv](volunteers.csv), [availability.csv](availability.csv) and
[assignments.csv](assignments.csv). [dependencies.csv](dependencies.csv) is
optional and has only its header because this scenario has no dependency.
Review exact mappings and source rows, stage the whole starting plan and
separately confirm revision 1. The expected preview has no blocking constraints.

If creating a new event hits the active event quota, inspect and archive only a
disposable rehearsal event you recognize. Do not clear unrelated events, reset
Supabase or overwrite an existing plan to make space. Avoid sign out during a
rehearsal that relies on an already authorized session. If sign in is needed,
the owner handles any personal acknowledgements; the agent does not accept them.

## Baseline, [baseline.json](baseline.json)

| Item | Confirmed synthetic fact |
|---|---|
| Room 1 (`hall`) | Capacity 40, projector, Main hall location |
| Room 2 (`side`) | Capacity 40, projector, Side hall location |
| Opening (`opening`) | Room 1, 10:00 to 11:00, 30 attendees, one usher, projector required |
| Workshop (`workshop`) | Room 2, 10:00 to 11:00, 10 attendees, one usher |
| Synthetic Alex (`alex`) | Active usher, available 09:00 to 17:00, assigned to Opening |
| Synthetic Sam (`sam`) | Active usher, available 09:00 to 17:00, assigned to Workshop |

All buffers are zero. The source fixture derives from E01's small baseline in
the T9 corpus. These synthetic UUIDs are references only; the application creates
its own persistent IDs and actual evidence receipts during import/confirmation.

## Blocked manual candidate, [blocked-candidate.json](blocked-candidate.json)

In the manual editor, change Opening's room to Room 2 while retaining 10:00 to
11:00 and Alex's original assignment. Add an availability interval with external
ID `alex-absence`, volunteer `alex`, status unavailable, 10:00 to 13:00.

Use this exact reason:

> Move Opening to Room 2. Alex cannot cover Opening from 10:00 to 13:00. Review the room conflict and the unavailable assignment before any approval.

The reason describes your manual intent; it is not parsed as an AI request.
Confirm the exact facts and choose Check and review proposal. Expected rules are
`ROOM_OVERLAP` for Opening/Workshop, and `AVAILABILITY` for Alex's assignment.
Approval must remain unavailable and the official head must remain revision 1.

## Corrected manual candidate, [corrected-candidate.json](corrected-candidate.json)

Choose Edit this candidate. Keep the newly recorded absence. Keep Opening in
Room 2, change its session and its assignment interval to 12:00 to 13:00 and
change the Opening assignment's volunteer to `sam`. The old assignment's
external ID can stay `opening-alex`; that is a stable identifier, not an
authoritative statement of its current volunteer. Inspect the volunteer field.
Workshop and its assignment remain unchanged at 10:00 to 11:00.

Use this exact reason:

> I choose Room 2 from 12:00 to 13:00 for Opening and assign Synthetic Sam as its usher. Keep Workshop unchanged. Retain Alex's recorded absence from 10:00 to 13:00.

Confirm the exact changes and choose Check and review proposal. Expected
constraints: none. Inspect the full diff and sources, then choose Review approval
and Approve revision 2. Verify revision 2, briefing and history before calling the
take successful. Do not infer success just because an approval button was clicked.

The JSON snapshots have no stored evidence. They validate the scenario's
constraints but are not approval receipts or proof of a completed browser take.
The [manifest](manifest.json) pins the generated file hashes and expected rule
sets. CSV parsing/import preview and all three snapshots were checked with the
real local pure functions during preparation. No UI import or recording is
claimed from those checks.

## Conditional later text path

Only after live access and evaluation authorization, the same scenario can start
with the exact confirmed update:

> Move Opening to Room 2 at 10:00 to 11:00. Synthetic Alex has cancelled and cannot cover Opening.

A later explicit answer can permit Room 2 at 12:00 to 13:00 and Sam as the
replacement. The actual application must preserve and review those source facts,
not silently substitute the manual reason or reuse a prerecorded model answer.
The current rehearsal does not queue, enable or run this provider path.
