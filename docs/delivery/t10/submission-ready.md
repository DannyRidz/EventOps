# EventOps submission copy

Prepared 4 November 2026 from the authenticated submission form and actual implementation evidence. This is prepared copy, not a submission receipt.

## Team Name

EventOps

## Team Members

The form currently lists Daniel Mohamad (DannyRidz). No additional human contributor has been verified in this preparation. Confirm the list before submission. AI coding assistance is disclosed below, not entered as a human team member.

## Track and problem statement

Recommended: Indie Developer Track, Build for Your World. The recommendation does not attest personal eligibility.

## Project Description

EventOps helps small event organizers keep schedules, rooms and volunteer assignments consistent when plans change.

A room move or cancellation can affect several records at once. EventOps turns a confirmed organizer update into explicit requests with Meta Muse Spark, asks for missing facts, and constructs options checked against the whole plan. The organizer reviews the interpretation, exact new facts, before/after changes and frozen source evidence before approving a new official revision.

Deterministic checks cover room occupancy and buffers, capacity, equipment, volunteer roles, availability and dependencies. Approval recomputes the complete candidate, evidence and request coverage inside a PostgreSQL transaction. The model has no approval or official write tool. Saved generations, immutable revisions and approval receipts protect against stale or repeated requests.

Organizers can enter records or import six supported CSV collections, correct imports, review sources, inspect history, propose restoration and produce approved briefings with text, CSV and print outputs. A guided fictional sample loads a private draft, explains each workflow step and offers a suggested update without replacing existing text. Starting-plan confirmation and later change approval remain separate. Muse Voice Transcribe produces an editable transcript that requires organizer confirmation.

Built during 27 October to 4 November 2026 with TypeScript, Next.js, React and Supabase Auth, PostgreSQL and private Storage. AI coding assistance supported implementation, debugging, tests and documentation; third party dependencies retain their own licenses.

This submission is a working local prototype demonstrated with synthetic records and an earlier completed live Meta workflow. Automated checks pass 201 tests and the production build passes. Fourteen of 90 real evaluation slots are collected, with quality review pending. Full accessibility, physical device and hosted operational checks remain incomplete. General live processing remains disabled outside authorized bounded tests. We do not claim production readiness or a completed 90-run evaluation.

## Public GitHub Repository

https://github.com/DannyRidz/EventOps

Verified public through an unauthenticated GitHub request on 4 November. Public main now matches local source commit `f0f5460b9f15f479ae78f6043906eedf00c0f226`, including the guided sample feature. This was observed through an unauthenticated read; the assistant did not commit or push. Further draft edits in this final review remain local.

## 3-Minute Demo Video

https://drive.google.com/file/d/1uRFZMs3qVcsGUfl1h9QGJ6daKRtYy5dJ/view

The actual video is approximately 2 minutes 55 seconds. It is edited from actual local app captures, uses labeled synthetic narration, and walks through a previously completed real Meta run. It does not portray screenshot transitions as a newly executed model request or approval. The user explicitly approved anyone with the link as Viewer for this video. Connector permission readback confirms reader access without discovery, and an unauthenticated download matches the local MP4 byte for byte.

## Describe your use of Meta products to build the submitted project

EventOps directly uses the Meta Model API with pinned `muse-spark-1.3` for logistics update interpretation and selection among deterministic validated options, and `muse-voice-transcribe-1.0` for draft transcription. These are real integrated adapters, not mocked services in the submitted application.

Separate restricted workers claim durable jobs, use bounded requests and save results. Confirmed event text and the relevant synthetic plan pass through the normal context packer. Model output must be interpreted and confirmed by the organizer before proposal creation. Deterministic validation and transactional approval remain authoritative.

Actual bounded live tests passed text clarification, organizer confirmation, proposal adoption, approval and briefing, plus transcription, correction and cleanup. The broader real evaluation has started but remains incomplete. Controlled failure tests are recorded separately and are not counted as live quality scores. We did not substitute another model provider or use Muse Code as the coding assistant; development assistance came from an AI coding assistant.

## Why are Meta's models important to your solution?

Event updates arrive as natural language or speech, while a reliable plan needs exact records, times and assignments. Muse Spark helps bridge that gap by interpreting the organizer's language and surfacing missing facts before the organizer chooses a plan. Muse Voice Transcribe offers another input route when typing is inconvenient.

The model supports understanding and comparison. It does not decide which unverified facts become official. That division combines flexible language input with explicit evidence, deterministic constraints and organizer control.

## Provide feedback from your experience using partner technologies

We integrated directly with Meta Model API rather than an inference partner. Account and billing setup delayed initial testing. Early text requests exposed timeout and reasoning token budget issues; a bounded 35 second request and explicit minimal reasoning produced usable responses within our 4,000 token output limit.

A synthetic voice clip lost important words, while a clearer clip preserved the operational details with a duplicated word. That reinforced the need for transcript review and correction. Some live text evaluation repeats ask for clarification even on our intended feasible case, so the broader quality evaluation remains open. These are observations from small synthetic tests, not a representative benchmark or a comparison with other model providers.

## Personal survey and consent fields

The form also asks about future use, overall opinion, recommendation ratings, biggest obstacle, model comparison, selection priorities, switching barriers and production blockers. These are personal survey answers, not engineering facts. The user explicitly delegated the two required opinion answers during final review. Recommendations selected: **Somewhat likely** for future Meta Model API use and **Somewhat favorable** for overall opinion. The factual obstacle selected is account setup. The project did not use another model provider for the logistics task, so the matching no-other-model-use option was selected. Optional recommendation scores and other personal preferences remain blank.

The marketing permission checkbox remains unchecked. It grants Meta and Cerebral Valley permission to use, publish, share and promote submitted materials. The owner must review and accept it personally under the standing no-terms instruction. The user has now requested final submission. The two required survey answers have been selected as delegated by the user. The standing no-terms instruction leaves consent unchecked. Final entry is handed to the user under the browser confirmation policy for prize based transactions. Submit was not clicked and no submission receipt is claimed.
