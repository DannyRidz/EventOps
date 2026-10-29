# T7 review, history and briefing

Implementation detail for the approved experience, data and delivery contracts. Authorized by the user's request to continue T7 with recommendations and no questions, 29 October 2026. The umbrella remains In Progress.

## Decision

Reuse owner scoped PostgreSQL functions, immutable proposal rows, the plan editor, exact text confirmation and deterministic briefing. No new provider, dependency or live gate. Implementation skills: develop, frontend-design and architect from the installed project skills.

Questions from the existing interpreter are bounded strings, not trusted typed field definitions. Save organizer answers as bounded text values keyed to the frozen job question index and result digest. Each submission appends immutable answer evidence and a clarified text draft generation. Returning to that draft requires exact text confirmation before another budgeted analysis. Never treat an answer as an official plan write or silently resolve contradictory statements. Existing validated options remain selectable; clarification also supports requests for different alternatives.

Manual candidate edits produce a new immutable proposal row with parent ID and incremented generation, rechecked against the current head. The old row becomes rejected only within the successful edit transaction. An interpreted proposal cannot be converted silently: the organizer must explicitly withdraw all its interpreted requests before replacing them with exact manual changes. Record that assertion, original proposal link and reason. The original interpretation and evidence remain inspectable. This is the explicit organizer withdrawal allowed by the data contract, not model request satisfaction. Rejection records an optional reason and expected generation.

Restore reads only a same event historical revision. Copy its values into a checked manual proposal against the expected current head, capture fresh organizer evidence and retain `restores_revision_id` in proposal and eventual revision. Require explicit confirmation of the whole difference and reconfirmation of historical availability and cancellations, with all pending confirmed updates visible before submission. A restore does not run AI or move the head. Approval still recomputes candidate, constraints and evidence in its existing transaction. Any later edit of a restore remains tied to its historical origin and requires the same reconfirmation.

## Value sourcing and surfaces

| Value | Source and behavior |
|---|---|
| Actor, event access | Existing verified session, owned event and lock_event |
| Answer question | Frozen completed analysis result and result digest; index within its questions array |
| Clarified text | Current saved corrected text plus labeled question and organizer answer; preserve immutable original |
| Edit generation and parent | Locked prior proposal, expected generation, current head; same event foreign keys |
| Request withdrawal | Explicit organizer checkbox, immutable manual update reason and parent link |
| Restore target | Same event revision ID, no caller supplied historical snapshot |
| Restore confirmation | Explicit organizer assertion about exact historical facts, current difference and outstanding confirmed updates |
| History | Revisions ordered descending, 25 per page, actual actor ID/time/reason/source proposal and restore origin |
| Comparison | Two owned immutable snapshots via comparePlans; historical labels and current revision link |
| Briefing | Selected approved snapshot, predecessor diff, actual persisted validation warnings; no drafts or AI calls |
| CSV | One selected collection, canonical field order, JSON arrays/objects, quoted cells, formula triggers escaped; date/timezone/revision columns on every row |
| Text and print | Revision label, date/timezone, saved timestamp, schedule, assignments, all plan collections and predecessor changes |

Routes extend the approved API: PUT proposal with patch, generation, reason, key and explicit withdrawal/reconfirmation; POST analysis answers with result digest, expected draft generation, question index and text; POST restore with target revision, expected head, key and explicit fact confirmation; GET briefing with approved revision and text/CSV format and collection. Existing proposal answers route delegates only when the proposal has an analysis source. All mutations use bounded JSON, origin checks, owner RPCs, no direct table writes. Reads use private no-store responses. No generic arbitrary JSON editor is exposed.

History provides revision selection, comparison, source links and a restore review screen. Proposal editing reuses labeled plan fields. Saved questions, answers, rejected proposals and edited generations stay discoverable from Updates. Print action uses browser print with navigation/actions hidden, wrapping text, repeated table headers and unclipped rows. Empty, stale, unavailable, saving, replay and error states preserve acknowledged work.

## Requirements and build plan

- AC-14/17/21: append answer evidence, resume clarified draft, choose options and edit/reject without an official write.
- AC-19/22: owner scoped comparison, stale restore rejection, explicit historical fact confirmation and a new revision with both parent and restore references.
- AC-23/31: reproducible approved revision print/text/CSV, date/timezone labels, safe escaping and truthful surfaces.
- AC-02/27: deny other tenants, enforce transaction rollback and generation fences, keyboard and 320 pixel checks.

Build owner functions and additive migration first, then server helpers/routes and UI. Verify real loopback Auth/database/Storage flows, stale/replay/race/rollback, unit output escaping, checks and production build. Keep local verification separate from live model and physical device acceptance.

## Consequences

Free text answers deliberately return to exact text confirmation rather than pretending the current model's strings are a typed question schema. Manual replacement requires explicit withdrawal, which is more deliberate than silently weakening the interpreted request contract. Historical facts become current assertions only through explicit confirmation and fresh evidence. No deployment or live provider use is included.
