# Review, main, 2026-11-04

**Reviewed by**: separate AI review agent (implementation by an AI coding assistant)
**Scope**: 17 source and test files, uncommitted
**Verdict**: Approve

## Summary
The change adds a clearly fictional sample draft, an event workflow guide and explicitly requested sample text insertion. It reuses the owner-scoped creation and staging APIs, preserves immutable creation receipts and fences staging against the original draft generation. No correctness, authorization or approval-boundary defect was identified in the reviewed change. An initial component-coverage gap was resolved during review with focused StartSample tests.

## Strengths
- Creation retries retain a tab-scoped UUID and reconcile the durable plan before staging. Existing approved or staged records are preserved, while changed empty drafts and concurrent generation conflicts fail without overwriting records.
- Sample records contain raw external identifiers rather than fabricated normalized IDs or provenance; the existing owner staging function supplies real event-scoped records and evidence. The review checkbox authorizes staging only, with starting-plan confirmation remaining a separate existing action.
- Sample help is selected from the immutable creation snapshot through an authenticated, owner-scoped read. Suggestions fill only an empty new field on an explicit click and neither save nor confirm text.
- Guide instructions accurately separate text, interpretation/fact confirmation, proposal review and official approval. The manual fallback names the relevant sample records and preserves available intervals when recording unavailability. The loaded-plan review link and its focusable target share the same visibility guard.

## Test coverage
The reviewed tests cover successful staging, lost stage-response reconciliation, unchanged creation UUIDs, edited generations and setup, concurrent staging failure, existing approval, storage refusal, pending/review gates, saved-draft recovery, navigation without restaging, guide states and preservation of typed/saved text. The main thread reports 21 targeted tests passing across five suites. The newly added StartSample component tests exercise the actual UI boundary rather than only the loadSample helper.

Review traced the unchanged creation receipt, owner/RLS and generation contracts, and compared guide instructions with the existing records, analysis and proposal screens. The main thread separately reports real-browser loading through normal APIs without automatic starting-plan approval and anonymous redirects to sign-in for both new routes. Full repository checks and the remaining browser verification are tracked separately; this code review did not run live providers, sign in, accept terms or certify hosted readiness.
