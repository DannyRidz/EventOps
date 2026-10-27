# T3 plan integrity

This backend slice implements the approved data contract. The user authorized T3 and recommendations without questions. T4 supplies the manual record editor and review screens. No model or provider access is needed here.

## Concrete interfaces and sources

PUT `/api/events/:id/draft` keeps the T2 setup input and additionally accepts `{plan, expected_generation, confirmed:true}`. A plan supplies rooms, sessions, volunteers, availability, assignments and dependencies. New records use external_id and omit id. References may use existing UUIDs or new external_id aliases within their collection. PostgreSQL generates and returns stable UUIDs. Existing UUIDs must have appeared in the event's prior draft or base revision. Event metadata comes from the saved setup, never an actor supplied workspace. Intervals use local start/end, optional explicit fold offsets and normalized UTC instants. Assignments without interval fields inherit and materialize their session interval. The draft generation is shared with setup editing. Changing setup preserves acknowledged plan records, clears the confirmation digest and requires restaging against the new setup before confirmation. Staging records manual source assertions but does not approve a plan.

POST `/api/events/:id/confirm-plan` accepts `{expected_generation,candidate_digest,idempotency_key}`. It requires the exact staged digest and a null approved head. It creates revision 1, one audit event and one immutable receipt atomically. Source assertions for the entire starting plan resolve to immutable manual records.

POST `/api/events/:id/proposals` accepts `{mode:"manual",expected_head,patch,confirmed:true,reason,idempotency_key}`. A patch is a bounded array of `{op:"replace",path,value}` replacing one or more complete named record arrays or event metadata. Only `/event`, `/rooms`, `/sessions`, `/volunteers`, `/availability`, `/assignments` and `/dependencies` are allowed. No duplicate paths. The database normalizes new identifiers, computes the field difference by stable record id, captures the exact asserted values as immutable sources, stores a canonical normalized patch and candidate, and derives manual request coverage from those explicit changes. A source removal records JSON null. Unchanged provenance is inherited. The caller cannot supply readiness, evidence ids, validation or request statuses. This is the manual path only; AI request interpretation is T4.

GET `/api/events/:id/proposals/:proposal` reads the immutable generation. POST its `/approve` accepts `{base_revision_id,generation,candidate_digest,idempotency_key}`. Editing later creates another immutable candidate generation and invalidates prior review; T4 wires that interaction. T3 creates generation 1 candidates only. POST its `/reject` rejects a still open candidate without changing the head.

GET `/api/events/:id/plan?revision=UUID` returns the approved current or explicitly historical snapshot, plus saved draft separately. GET `/api/events/:id/revisions?cursor=N` returns at most 25 descending revisions. GET `/api/events/:id/evidence/:source` returns the same event frozen source and artifact metadata. All paths require verified owner identity; inaccessible references return 404. Private JSON is no-store. Plan mutations allow at most 4 MiB JSON to accommodate the published record limits. Other T2 forms retain 16 KiB.

## Database invariants

Use composite workspace/event foreign keys throughout, owner read policies, restricted writes, immutable sources, proposal payloads, revisions, audit and receipts. Use fixed search paths and revoke helper execution from public roles. Approval locks workspace, event and proposal in stable order, checks deletion/lifecycle before receipt replay, then checks head, generation, digest, evidence values, request coverage and deterministic constraints. Recompute the candidate from the immutable base plus allowlisted normalized patch. The receipt digest binds every approval input except its key; identical replay returns the original receipt after later revisions, changed reuse conflicts. No external work occurs in the transaction. The 500 revision limit is enforced under the event lock.

Source artifacts contain the confirmed manual input digest and capture identity/time. Each source record stores a locator and frozen value. Provenance includes the record and field, source record ids and manual or inherited derivation. A source id alone is insufficient: its value must match the proposed value, or the inherited immutable base value. Manual request coverage is a server derived list of the exact asserted field changes, all satisfied only by those values. Generic client validation flags have no authority.

Supabase pg_jsonschema enforces the JSON Schema generated from the Zod contract at the database boundary. This avoids divergent field and null handling. Both validators use the named catalog SHAPE, LIMITS, REFERENCES, TIME, ROOM_OVERLAP, VOLUNTEER_OVERLAP, AVAILABILITY, ROLE, COVERAGE, CAPACITY, FEATURES and DEPENDENCY. Half open intervals include room buffers, assignments use their materialized intervals, unavailable overrides available, inactive people cannot serve, unknown capacity cannot satisfy attendance, dependency cycles block. Full snapshot validation applies even outside directly edited records. Parity fixtures compare rule and record ids, not prose.

## Scope and verification

T3 includes schema, normalization, source resolution, typed validation, protected APIs, real database parity/negative tests and atomic approval races. It does not claim the T4 manual editor, AI jobs, questions or briefing UI is built. Existing event pages must show the real approved state once an API confirmation succeeds. Live tests use synthetic local Supabase accounts, email and data. Hosted readiness remains separate. Full release ACs remain shared with later slices.

## Reference

[Supabase pg_jsonschema](https://supabase.com/docs/guides/database/extensions/pg_jsonschema) documents the database JSON shape check. Local extension availability was verified before use.
