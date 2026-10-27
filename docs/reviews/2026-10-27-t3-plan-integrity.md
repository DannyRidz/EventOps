# T3 plan integrity

Date: 27 October 2026. Verdict: backend locally verified, fresh code review approved. This is not a full release approval.

## Delivered boundary

The T3 migration is applied to real local Supabase PostgreSQL and recorded in migration history. It adds immutable source artifacts and field records, manual updates and proposal generations, revisions, approval receipts and audit events. Composite foreign keys and owner row policies enforce event and workspace scope. Direct mutations are denied. T2 setup remains a separate acknowledged draft, with stable draft identity and timestamps. Setup changes preserve staged records, invalidate the confirmation digest, and require staging again.

Plan staging normalizes server generated record identifiers, local times, UTC offsets and assignment intervals. It captures actual manual field values as immutable evidence. A shared generated JSON Schema is enforced by Zod and pg_jsonschema. Independent TypeScript and SQL rules check operating hours, buffers, room collisions, capacity, features, active and qualified volunteers, known availability, coverage and acyclic dependencies. Unavailable intervals override available ones. No model is involved.

The initial confirmation and proposal approval functions lock the workspace and event, check lifecycle and identity, resolve idempotency receipts, verify head/generation/digest, recompute the candidate from the trusted base and canonical patch, check evidence values and request coverage, and atomically write revision, head, proposal status, audit and receipt. Receipt replay remains valid after a newer revision. The 500 revision limit is enforced under the lock.

Authenticated APIs stage/confirm, create/read/approve/reject manual candidates, read current or historical plans, page revision history and resolve frozen evidence. Existing event pages show a real approved state when present, and approved summaries use revision metadata.

## Verification evidence

- `npm run check`: lint, formatting and strict generated route types pass, 54 tests across 11 files pass.
- `npm run build`: production compilation, type checking, page generation and standalone packaging pass.
- `npm audit --audit-level=moderate`: zero vulnerabilities.
- `node scripts/verify-t3-migrations.mjs`: all application migrations apply from an empty temporary database with only the referenced managed Auth schema contract supplied. The temporary database is dropped afterward. No running project data is reset.
- `node scripts/verify-t3.mjs`: 30 live checks pass against real Auth, Mailpit, PostgREST and PostgreSQL through the production application. They include 22 exact TypeScript/PostgreSQL rule and record id parity fixtures.
- `node scripts/verify-t2.mjs`: all 19 existing live account and setup checks pass against the T3 build.

The T3 live checks cover real owner sessions, server issued ids, persisted sources, draft resumption and stale generation rejection; same key double confirmation, competing confirmation keys, same key double approval, competing approvals, changed key content, stale heads, invalid digests and replay after later revisions; current/historical labels, cursor reads and approved event summaries; constraints, rejection, every new endpoint and table's tenant boundary; and a branching 100-edge acyclic graph without exponential path enumeration.

Administrative local test fixtures deliberately damage candidates with a real wrong-field source, unknown evidence id, missing provenance, false request coverage and a forged valid report. The actual approval function rejects each. Normal authenticated roles cannot insert those fixtures. A test trigger injects a failure at the last receipt insertion, proving all preceding revision, pointer, proposal and audit writes roll back. The trigger is removed in a finally block. A rolled back fixture proves revision 501 is denied. Trash and pending deletion fixtures prove reads, writes and receipt replays fail closed, then restore the test flags.

Private logs are held in `/private/tmp/eventops-t3-live.log`, `/private/tmp/eventops-t3-check.log`, `/private/tmp/eventops-t3-build.log` and `/private/tmp/eventops-t3-t2-regression.log`. Repeatable harnesses and parity fixtures are checked into source. Captured sessions and mail are not committed.

## Browser evidence

Production email code sign in opens the synthetic owner's event list. The list shows the approved date from revision 3, and the plan page displays the current approved revision, actual schedule, rooms, volunteers and assignment count. Desktop and 390 by 844 mobile screenshots are retained in ignored `output/playwright/t3/`. Browser verification also exercises the expired code error and resend recovery. Axe WCAG A/AA and 2.1 AA scan reports zero violations; the mobile view has no horizontal overflow.

## Fresh review and corrections

A fresh gpt-6-astra review found incomplete canonical patches after date normalization and unbounded dependency path enumeration. It hit a usage limit before completing its review. A fresh gpt-6.1-terra review then found differing duplicate-assignment identifiers and duplicate-location validation. All four findings were corrected and covered by regression or parity fixtures. The latter reviewer returned **Approve** and reconfirmed the retained-draft and approved-summary changes. Reviewers did not author application code or independently run the verification commands. The author model was not reliably identifiable, so a different model family is not guaranteed.

Live tests also exposed SQL operator precedence and a query-variable ambiguity before staging could save. Both were fixed. A shared fixture object was corrected so parity scenarios are independent; an explicit isolation test guards that. Node's local verification harness closes its HTTP connections so long database checks cannot leave it reusing an expired idle connection. The final production runs passed after those fixes.

## Acceptance boundary and remaining work

AC 02 covers the new APIs, functions and tables. AC 03 and 04 cover normalized event/interval fields and record limits. AC 07 covers the backend for all six record types and checked initial confirmation. AC 08 covers frozen facts and approved snapshots. AC 11 to 14 cover deterministic checks across the full candidate. AC 16 covers each changed field resolving to the actual same event frozen value. AC 18 to 20 cover the guarded transaction, stale review and retry/race behavior. AC 25 includes the late transaction failure test. Shared criteria remain open for later screens, AI analysis, imports, jobs, restoration, exports and release verification.

The T4 manual editor, proposal review interaction, text update jobs, model interpretation and briefing are not built by T3. T3 creates immutable generation 1 manual candidates; editing and answer generation flows remain later work. Manual request coverage represents the exact typed edits submitted and confirmed, not interpretation of free text reasons. Hosted mail, complete operator legal notices, Meta credentials/terms, deployment and full release gates remain open. No provider terms, paid resource, deployment or publication were performed.
