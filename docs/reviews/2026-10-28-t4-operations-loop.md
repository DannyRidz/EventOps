# T4 local operations loop

This is the initial manual implementation record. The remaining interpreter, worker and cost controls were subsequently implemented and locally verified in the [T4 completion record](2026-10-28-t4-worker-completion.md). Live Meta verification remains blocked.

Date: 28 October 2026, Asia/Brunei. Verdict: the manual operations loop and confirmed text persistence are built and locally verified. **T4 remains partial. The Meta interpretation and executing worker path are not built or verified.** This is not a release approval.

## Delivered boundary

The organizer can enter all six plan record types in forms, link new records by their external identifiers, save for whole plan checks, review the complete starting schedule and constraints, inspect frozen field evidence, and explicitly confirm revision 1. PostgreSQL remains responsible for identifiers, normalization, evidence capture and approval. Blank attendance and capacity remain unknown. Buffer defaults and active status are disclosed. An approved plan can only change through a manual candidate, evidence comparison and a separate approval confirmation.

Proposal review shows the immutable base and proposed field values, actual same event frozen sources, constraint failures and stale head status. Removed records link to their frozen removal evidence. Invalid or stale candidates cannot enable approval. Rejection leaves the official plan unchanged. Preparing another manual candidate starts from the current head; editing proposal generations, questions and alternatives remain later work. Approval retries keep only operation UUIDs in tab scoped session storage, never plan content or update text. The database receipt and resulting revision are authoritative. Reloading an approved proposal shows its actual saved revision and a direct briefing link. If tab storage is disabled, current approved data and the saved proposal remain recoverable from the server.

Text updates acknowledge drafts before confirmation, preserve original text separately from corrections, reject stale edits and require the exact saved generation, text and base revision to be confirmed. A new immutable update, frozen text source and durable blocked analysis job are written together. Repeated confirmation and identical text against the same base reuse acknowledged work. The blocked state explicitly says that no analysis has run. A reload resumes saved text and job state. No provider receives the text.

The second additive migration preserves an immutable creation request digest and response separately from mutable text drafts. An identical create request returns its original generation 1 receipt even after generation 2 is saved. Legacy drafts created before that migration have no recoverable original correction; they retain conservative replay behavior rather than inventing a creation receipt. All records created by the final harness exercise the new receipt path.

Briefings render deterministically from an approved revision, include the date, timezone, offsets, room facts, coverage, assignments, availability and dependencies, and exclude pending text. A selected older revision is explicitly historical, identifies the current revision, and links to it. Frozen field sources can be inspected. Text, print and CSV exports remain T7.

## Verification evidence

- `npm run check`: lint, formatting, generated route types, strict TypeScript and 67 tests across 16 files pass.
- `npm run build`: production compilation, route generation and standalone packaging pass.
- `node scripts/verify-t3-migrations.mjs`: all four application migrations apply from an empty temporary local database; the rehearsal database is dropped afterward without resetting the running project.
- `T4_APP_URL=http://localhost:3001 node scripts/verify-t4.mjs`: 12 live groups pass against the final production application, real local Auth, captured mail, PostgREST and PostgreSQL.
- `T3_APP_URL=http://localhost:3001 node scripts/verify-t3.mjs`: all 30 existing integrity, evidence, approval race and rollback checks pass.
- `T2_APP_URL=http://localhost:3001 node scripts/verify-t2.mjs`: all 19 existing account and setup checks pass.

T4 live checks cover all six collections through the same editor transformation used by the UI, confirmation, durable text creation and correction, lost save responses, immutable creation replay after edits, original text protection, explicit exact confirmation, duplicate concurrent confirmations, frozen text evidence, owner and anonymous boundaries, direct table write denial, stale heads, proposal approval and replay, protected pages, saved revision recovery and historical briefing labels. A temporary trigger injects a failure after job insertion. The confirmed update and new text artifact both remain absent afterward, proving transaction rollback; the trigger and function are removed in a finally block. Direct RPC null text is rejected. The harness only accepts loopback services and synthetic fixtures.

Private logs are in `/private/tmp/eventops-t4-check.log`, `/private/tmp/eventops-t4-build.log`, `/private/tmp/eventops-t4-live.log`, `/private/tmp/eventops-t4-migrations.log`, `/private/tmp/eventops-t4-t2-regression.log` and `/private/tmp/eventops-t4-t3-regression.log`. Browser session files are private temporary files and are not committed.

## Browser evidence

Playwright drove the production app with a synthetic owner session. From the empty editor it added a linked room and session, saved, reviewed checks, explicitly confirmed revision 1 and reached the briefing. A second journey edited a real approved record, opened its frozen source, performed both approval steps and reached revision 3. The text journey saved, explicitly confirmed and reloaded a blocked job without losing corrected text. Another candidate exercised keyboard review and back, then rejection.

The update and proposal screens passed axe WCAG A, AA and 2.1 AA scans with zero violations at 390 by 844 and no horizontal overflow. Desktop and mobile captures are in ignored `output/playwright/t4/`. These checks supplement the existing foundation evidence; they do not claim every release screen, browser, assistive technology, zoom or print flow has passed.

## Fresh review

A fresh gpt-6.1-terra reviewer inspected the UI, API and database changes without authoring them. Findings addressed missing session feature requirements in initial review, tab reload recovery after lost approval responses, creation receipt comparison against a mutable draft, historical briefing labels and stale warnings on already approved proposals. The final review reported no remaining blocking or major findings. The author model could not be reliably identified, so a different model family is not guaranteed. The reviewer did not independently execute the commands above.

## Acceptance and blockers

AC 07 has the local manual form, full checks and initial confirmation path. AC 09 is locally verified for acknowledged text, distinguishable original/corrected values and exact explicit confirmation. AC 16 to 20 have the manual evidence, approval, stale and retry path. AC 21 covers acknowledged drafts and blocked job resumption only. AC 23 covers the deterministic selected revision briefing only. AC 27 and 28 cover the tested local surfaces only. Shared release criteria remain open.

The full T4 model loop is **not complete**. There is no enabled Meta adapter, interpreter, candidate option orchestration, model explanation validator, executing worker, lease reclamation, provider retry policy or model cost reservation ledger. The durable job table intentionally only accepts the blocked state; setting a credential does not enable execution. No fake result or provider call is substituted for these missing capabilities. AC 11 to 15 for model interpretation/request coverage, and model/worker portions of AC 21, 24, 25 and 29 remain unverified. Arbitrary organizer text is not represented as satisfied by manual field changes.

Before implementing and enabling provider execution, the user must handle required provider terms and confirm permitted account access. Credentials, Standard model availability, billing bounds, privacy/retention settings and synthetic account probes remain unverified. Access alone will not close T4: the missing bounded interpreter, deterministic tools, worker, reservation controls and live end to end/evaluation checks still need implementation and verification. Later T7 questions, alternatives, generation editing, complete history and exports remain separate.

Hosted Supabase, mail domain and SMTP delivery, operator identity and complete legal notices, recovery and release gates remain open. No hosted resources were provisioned, no deployment or publication occurred, no provider terms were accepted, and no model spend occurred. Git commits and pushes remain with the user. The older delivery summary predates this local T4 record; its statement that all T4 work is unbuilt is superseded by this explicit partial boundary, not by a claim that T4 is complete.
