# EventOps judge preparation

Prepared 4 November 2026 from the recorded implementation and verification evidence. You can use these answers as speaking notes, with the limitations stated below.

## Thirty second introduction

EventOps helps small event organizers keep schedules, rooms, volunteers and briefings consistent when plans change. An organizer can describe a change in text or review a draft voice transcript. Meta interprets the request and can ask for missing facts. The organizer checks the evidence and proposed changes before approving an official revision. Database validation checks the full candidate inside the approval transaction.

## Questions and suggested answers

**What problem does it solve?**
One schedule change can create room conflicts, unavailable volunteers and an outdated briefing. EventOps puts the change, its supporting records and the resulting plan in one review workflow.

**Where is Meta used?**
The direct Meta Model API integration uses `muse-spark-1.3` for request interpretation and option selection, and `muse-voice-transcribe-1.0` for draft transcription. Deterministic code constructs candidate options and checks constraints. The model cannot approve an official plan.

**Why combine AI with deterministic checks?**
Natural language can omit an availability interval or imply several changes. AI helps interpret that ambiguity. Explicit evidence, organizer confirmation and transactional validation keep an uncertain interpretation from becoming an official revision automatically.

**What was actually demonstrated with the real API?**
A bounded text run went through clarification, organizer confirmation, candidate review, transactional approval and briefing. Bounded synthetic audio calls also returned real transcripts. The video labels prior completed work and uses actual app captures with synthetic narration. It is an edited walkthrough.

**Is the full live evaluation complete?**
No. Fourteen of ninety campaign slots have been collected, and quality scoring remains pending. One recorded text repeat passed actual candidate adoption and SQL approval. Other responses asked for clarification. Those are retained as actual outcomes, rather than counted as quality passes. See [live batch evidence](../../reviews/2026-11-04-t9-live-batch.md).

**What happens when the model is wrong or unavailable?**
The organizer can correct and confirm the interpretation or transcript. Unsupported or unresolved requests remain visible. Manual changes remain available. A model response alone cannot authorize an official write.

**How do you prevent conflicting approvals?**
The database recomputes the full candidate, evidence values and request coverage in the approval transaction. Expected revision and generation checks protect against stale reviews and races. Immutable receipts support safe replay.

**How are original records preserved?**
CSV originals are private, with immutable byte receipts and hash checks before download. Corrections retain their original cell and generation links. Draft transcripts require review before they become confirmed facts.

**How do you isolate users and protect credentials?**
Account and event writes use owner scoped database functions. Restricted workers use dedicated claim, stage and finish functions. The web application does not receive the private model key or a service role key.

**Can judges use a hosted app?**
The submitted artifacts are the public repository and accessible video. This is a local prototype, and no hosted app was deployed. A deployed URL was not requested by the inspected submission form. The guide also refers to a live product as a judging artifact, so the absence of hosting remains a limitation.

**Is live AI enabled for general use?**
General provider processing remains disabled. Real API verification used explicitly bounded synthetic runs. The approved USD 15 evaluation ceiling is a campaign allowance, not an authorization for unrestricted judge traffic or a provider billing guarantee.

**What testing supports the prototype?**
The latest recorded application check passed 201 automated tests and the production build. Controlled database and worker verification supplement those checks. Automated tests do not establish full real model quality or human accessibility acceptance.

**What remains before production use?**
The remaining live campaign and semantic scoring, audible human screen reader acceptance, the protected physical device matrix, and hosted mail, monitoring, recovery and retention operations remain open. Full T9 release acceptance is incomplete.

**What would you build next?**
Finish those verification gaps first. Then validate the workflow with real organizers and improve the steps where they need help understanding evidence or resolving a change. Any hosted release needs a separate deployment decision and verified operational controls.

**How was it built?**
The project used AI coding assistance with human direction and separate review. The implementation uses TypeScript, Next.js, React and Supabase, with direct Meta model adapters. Preserve accurate contribution and license attribution when discussing the work.

## Useful evidence

You can refer to the [guided sample completion](../../reviews/2026-11-04-guided-sample-completion.md), [independent review](../../reviews/2026-11-04-guided-sample-review.md), [live text workflow](../../reviews/2026-11-03-live-text-workflow.md), and [voice evidence](../../reviews/2026-11-03-live-voice-and-rehearsal.md). No new test run or provider call was made while preparing these notes.
