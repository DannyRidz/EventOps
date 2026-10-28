# T5 CSV imports and correction, local completion

Date: 28 October 2026, Asia/Brunei. Verdict: T5 is implemented and locally verified. This record supersedes earlier planning summaries that describe T5 as unbuilt. It does not complete the release or live Meta acceptance.

## Implemented flow

An owner opens Imports on an unapproved event, downloads any of the six header templates, uploads privately and reviews a staged batch. The parser supports UTF 8 with or without BOM, RFC style quoted fields, commas, escaped quotes, embedded newlines, LF and CRLF. The actual multipart stream, per file bytes, batch bytes, parsed cells, columns and row counts are bounded. Invalid encoding, NUL, malformed quoting or width, duplicate headers and disguised formats fail without an official write.

Required columns can be mapped explicitly. Review shows source line numbers, offending values, reasons and correction actions. Original and corrected cell values remain distinguishable. Mapping choices, corrections, explicit exclusions, Keep one choices and repeated local time offsets save as append only correction versions. Invalid corrections can be acknowledged and resumed. Identical duplicate IDs require a decision, conflicting values block staging, distinct IDs never merge by name, and repeated exact file hashes open the earlier batch without adding files from that request.

All six record types feed the same starting draft as manual entry. Default active status, buffers and assignment intervals are disclosed. Missing volunteer counts never default to zero, missing availability never establishes coverage, and ambiguous clock times require an explicit offset. Review can continue to the manual editor for optional assignments and other corrections. Nothing becomes official until complete schema, constraints and evidence pass the separate generation and digest checked revision 1 transaction. Concurrent confirmation returns one durable receipt. Later bulk replacement is rejected; subsequent changes use reviewed proposals.

## Persistence and source integrity

Originals use the private Supabase Storage `event-imports` bucket. Object policies check owner, workspace, event and lifecycle. There is no authenticated overwrite policy; referenced originals cannot be deleted. Failed saves clean up unreferenced objects in owned draft events.

PostgreSQL independently reparses the submitted original bytes and requires equality with the parsed headers, rows and line locators. It retains a bounded immutable byte verification receipt. That receipt is authoritative recovery for downloads if a Storage copy is missing, deleted in a race, or mismatched by a direct authenticated caller. A stored copy is served only if its digest also matches. Source facts never derive from unchecked Storage bytes.

Immutable original cell records remain separate from organizer assertions about normalized and corrected facts. Field evidence identifies the original row and column, original source record, correction generation, actor and capture time. Evidence pages open both the immutable original cell and the exact saved correction version. Defaults and derived fields are identified. Import lineage follows committed field provenance even when manual coverage or corrections follow import review.

Event and batch locks fence stale saves, changed corrections invalidate an earlier staged candidate, and SQL reconstructs the candidate from saved mappings and decisions. Persistent IDs remain stable when the same external identifiers are restaged. All official effects and the import confirmation link roll back together on failure.

## Verification

- `npm run check`: lint, format, generated route types, strict TypeScript and 110 tests across 19 files pass.
- `npm run build`: production compilation, route generation and standalone packaging pass.
- `node scripts/verify-t3-migrations.mjs`: all 25 application migrations rehearse from an empty temporary database, with the referenced managed Auth and Storage table contracts. The temporary database is dropped without resetting the running project. All 25 migrations are applied locally.
- `T5_BOUNDARIES=1 node scripts/verify-t5.mjs`: 23 integration groups pass through real loopback Auth, captured mail, PostgREST, PostgreSQL and private Storage.
- Existing T3 suite: 30 groups pass, including 22 SQL and TypeScript parity fixtures, damaged evidence, forged requests, races and rollback.
- Existing T4 manual suite: 12 groups pass. Restricted worker suite: 16 groups pass with controlled responses and no live Meta transport.

The T5 suite covers all templates; parser parity; direct RPC source forgery and candidate substitution; owner and anonymous denial; original immutability; private Storage reads, overwrite and delete policies; mismatched object recovery; orphan cleanup; correction resumption and stale versions; duplicate decisions; stable IDs; precise correction evidence; manual correction lineage; concurrent initial approval; rollback; and rejection of later bulk replacement.

The boundary exercise includes 20 rooms, 100 sessions, 100 volunteers, 1,000 availability intervals, 500 assignments and 100 dependencies. Its availability file is 2,026,944 bytes and its batch 2,041,241 bytes. The final measured run uploaded in 1,104 ms, staged in 6,141 ms and confirmed in 1,633 ms. These are local synthetic observations, not hosted latency promises. Boundary tests exposed repeated timezone catalog scans, large original copies in provenance joins and a quadratic evidence coverage join. Additive migrations remove that repeated work while retaining full schema and source checks. Earlier failed attempts made no partial official writes.

Browser verification uploaded all six files, made a keyboard Keep one decision, corrected a title, saved, refreshed and resumed it, inspected full plan review, and deliberately confirmed revision 1 briefing. Desktop and mobile captures are in ignored `output/playwright/t5-*`. The editable correction screen has zero reported axe WCAG A, AA and 2.1 AA violations. Reflow checks at 320 CSS pixels find no horizontal overflow. The approved Swiss visual system and shared controls are retained.

Fresh gpt-6.1-terra review ends at Approve, with no outstanding blocker or major finding. The initial raw byte attribution, exact source tracing and Storage recovery findings were fixed and covered. The reviewer inspected code but did not independently run the reported commands. Author identity is not reliable, so a different model family is not guaranteed. See [review](2026-10-28-t5-review.md).

## Boundaries and handoff

The local native stack now includes private Storage. Setup and restart commands in README and `scripts/local-supabase.mjs` reflect that requirement. No new package or hosted service was added. Original retention and purge must cover both the object and byte receipt in T8; hosted storage configuration and recovery remain release work.

Live AI remains disabled. The web flags are unset and therefore disabled, worker flags are zero, and the private database enablement gate is false after controlled worker verification. No live model call or model spend occurred. The user's USD 150 credit claim and billing support ticket are submitted; applied credits remain unconfirmed. Payment setup, API key provisioning and subsequent live verification remain external blockers. No provider terms were accepted, deployment made, commit created or push performed.

T6 voice and transcript review is the next delivery slice. The thin operations loop remains open for real provider acceptance. The umbrella plan stays In Progress. Earlier delivery and scope prose that points to T2 as next or calls T5 unbuilt is historical planning text; this completion record and the reconciled Imports and correction row provide the current T5 state.
