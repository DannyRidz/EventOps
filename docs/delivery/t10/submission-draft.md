# Submission copy, current truthful draft

Status: review draft dated 31 October 2026. Do not submit unchanged if the actual
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

This is a local prototype verified with synthetic records. The Meta interpretation
and transcription adapters are implemented and tested with controlled responses,
but live Meta access remains disabled pending resolution of an account payment
restriction. No real model quality result or production readiness is claimed.

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

Current status: **adapters tested with controlled responses; zero live evaluation
runs; live gates disabled**. The current manual rehearsal demonstrates the
deterministic and approval path. It must not be labeled a live Meta demo.

## Engineering and validation

TypeScript strict, Next.js App Router, React and Supabase Auth/PostgreSQL/Storage.
Separate restricted worker processes handle analysis, conversion/transcription
and retention. Database functions scope owner writes and recompute approval.
Private source receipts, generation checks and immutable revisions preserve the
record of what was confirmed.

The latest recorded repository check passed 158 tests in 26 files. The T9
controlled runner applied 42 migrations and passed the implemented checks for
30 scenarios, three repeats each, in isolated temporary databases. Those 90 local
repeats are not the required 90 real model runs. Codec conversion, controlled
provider failures, actual SQL approval races and durable test budget reservations
have evidence. Results, boundaries and source hashes are linked from the
[T9 execution record](../../reviews/2026-10-30-t9-local-execution.md).

## Genuine provider feedback

Payment method setup returned a payment system error and prevented API key
creation during the observed readiness checks, despite confirmed hackathon
credits. Support requested device/card metadata and an error screenshot, then
escalated the issue. This blocked real interpretation/transcription evaluation.
We cannot yet give measured feedback about model accuracy, speed, billing or
production reliability. No private support correspondence, card metadata or
account identifiers should appear in the public submission or video.

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
