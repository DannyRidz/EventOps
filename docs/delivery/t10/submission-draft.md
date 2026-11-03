# Submission copy, current truthful draft

Status: review draft updated 3 November 2026. Do not submit unchanged if the actual
implementation, provider access or final form requirements change.

## Project name

EventOps

## Short description

Keep a small event's schedule, rooms and volunteer assignments consistent through
evidence review and deliberate approval of every official change.

## Project description

An event update can affect more than one record. Moving a session may collide
with another room booking, break a dependency or leave a volunteer assignment
outside recorded availability. EventOps keeps those relationships in one saved
plan and checks a complete candidate before an organizer approves a new revision.

Organizers can enter records manually or import supported CSV files, inspect
errors and sources, and confirm a starting plan. Later manual edits produce a
separate candidate with a before/after comparison and frozen field evidence.
Room occupancy, buffers, capacity, equipment, volunteer roles, availability and
dependencies are checked deterministically. Approval recomputes the candidate,
source evidence and request coverage inside a database transaction. Replayed or
stale approvals cannot silently create another official change.

The approved revision supplies its briefing and safe text/CSV/print outputs.
History remains available, and restoration creates a new reviewed proposal.
Private exports, retention settings and archive/trash controls are implemented
locally. Public production operations and the full accessibility/device matrix
are still unverified.

This is a local prototype verified with synthetic records. Bounded live Meta tests
passed the text worker, organizer confirmation, transactional approval and briefing
path. A live synthetic voice test also passed transcription, correction, original
transcript preservation, text confirmation and cleanup. These limited smoke tests
do not establish broad model quality or production readiness. Background live
processing remains disabled outside explicitly authorized tests.

## Meta product use and why it matters

Selected integration targets are Standard `muse-spark-1.3` for interpreting
confirmed logistics updates and selecting from deterministic validated options,
and `muse-voice-transcribe-1.0` for producing text that the organizer must review
and confirm. These model IDs are pinned in the repository. Catalog presence does
not establish this account's entitlement.

The intended value is to turn an organizer's operational update into explicit
requests, identify missing facts and help compare feasible alternatives. The
model has no approval, messaging, shell or external write tool. Model output
requires organizer confirmation; deterministic constraints and transactional
approval remain the authority.

Current status: **live text and synthetic speech smoke tests passed; the full 90
run evaluation remains unexecuted; general live gates remain disabled**. The
current manual rehearsal demonstrates the deterministic and approval path. Only
a recording that actually uses the provider may be labeled a live Meta demo.

## Engineering and validation

TypeScript strict, Next.js App Router, React and Supabase Auth/PostgreSQL/Storage.
Separate restricted worker processes handle analysis, conversion/transcription
and retention. Database functions scope owner writes and recompute approval.
Private source receipts, generation checks and immutable revisions preserve the
record of what was confirmed.

The 3 November repository check passed 159 tests in 26 files. The T9
controlled runner applied 42 migrations and passed the implemented checks for
30 scenarios, three repeats each, in isolated temporary databases. Those 90 local
repeats are not the required 90 real model runs. Codec conversion, controlled
provider failures, actual SQL approval races and durable test budget reservations
have evidence. Results, boundaries and source hashes are linked from the
[T9 execution record](../../reviews/2026-10-30-t9-local-execution.md).

## Genuine provider feedback

Initial account setup delayed testing, but live requests later succeeded despite
a remaining dashboard warning. The first text responses exceeded our ten second
header timeout. Allowing the existing 35 second request bound exposed a further
output budget issue: default reasoning consumed the 4,000 token cap. Explicit
minimal reasoning then produced valid confirmed options within that cap.

A legacy synthetic Albert voice clip lost important words. A clearer Samantha
clip preserved the room, times and volunteer, with a duplicated word. Organizer
transcript review and correction therefore remain essential. These observations
come from small synthetic smoke tests, not a representative quality benchmark.
No private support correspondence, payment metadata or account identifiers should
appear in the public submission or video.

## Track, theme and contributions

Recommended track: Indie Developer. Recommended theme: Build for Your World.
These are recommendations from the approved plan, not an eligibility finding
or a selection already made in the portal.

Owner completion fields before submission:

| Field | Current value |
|---|---|
| Participant and every team member | Owner to verify names, acceptance and contributions |
| Contributions and AI assistance disclosure | Owner to verify actual authorship and describe coding assistance accurately |
| Work during official build period | Git history is available for review; full provenance statement not yet finalized |
| Public repository URL | Not authorized or verified by this package |
| Accessible project URL/access model | Not deployed or verified by this package |
| Video URL | No video recorded or uploaded in this pass |
| Optional social link | Omit unless separately authorized |
| License and third party attribution | Full repository/history and license review still pending |

Do not turn an empty field into a fabricated link or outcome. Recheck the current
form before adapting this copy. If live access is restored later, replace the
status paragraph only after evidence exists; retain any remaining limitations.
