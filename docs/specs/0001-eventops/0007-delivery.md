# Delivery, release process, and submission

## Summary

Build one real text based operations loop first, then add import and voice breadth. Reserve the last two days for verification, recovery, recording and submission. Plan approval was received on 27 October 2026. T1 is implemented and locally verified, with evidence in [T1 foundation](0008-foundation.md). T2 accounts and event setup are built and locally verified, with evidence in [T2 review](../../reviews/2026-10-27-t2-accounts-events.md). Hosted mail, operator notices and Meta account access remain open. T3 plan integrity is built and locally verified, with evidence in [T3 review](../../reviews/2026-10-27-t3-plan-integrity.md). T4 and later work remain unbuilt; the original effort ranges below are planning estimates, not completed work claims.

## Ordered implementation plan

Estimates are productive solo developer hours with engineering assistance, not elapsed waiting time. They include focused verification of each task. They assume familiarity with TypeScript and a small scope. Account approvals, domain ownership, legal review and provider outages are separate dependencies.

| Task | Work and milestone | Depends on | Hours | Acceptance mapping |
|---|---|---|---|---|
| T1 | After approval, scaffold only the required runtime; capture actual conventions with audit; add CI and visual primitives with empty/error/focus states | Plan approval | 4 to 6 | AC-27, AC-28, AC-31 |
| T2 | Real email code sign in, one workspace, tenant policies, event draft/setup and authenticated plan read; verify account model access with synthetic calls only after user accepts provider terms | T1; provider accounts, SMTP | 3 to 4 | AC-01, AC-02, AC-03, AC-29 |
| T3 | Schema migrations, immutable sources/snapshots, constraint rules, database approval function, source resolution, idempotency and race tests | T2 | 6 to 8 | AC-02 to AC-04, AC-07, AC-08, AC-11 to AC-14, AC-16, AC-18 to AC-20, AC-25 |
| T4 | Thin whole loop: manual starting plan, confirmed text update, durable job, Meta interpretation, deterministic tools, evidence comparison, explicit approval and basic deterministic briefing | T3 | 4 to 6 | AC-07, AC-09, AC-11 to AC-18, AC-21, AC-23 to AC-25, AC-27, AC-29 |
| T5 | CSV templates/parser, private upload, staged preview, correction/resumption, duplicates and exact initial confirmation | T4 | 4 to 6 | AC-04 to AC-08, AC-27 |
| T6 | Browser recording, bounded conversion, transcription, review and correction, text fallback, raw audio cleanup | T4; speech access | 3 to 4 | AC-05, AC-10, AC-24, AC-27 |
| T7 | Finish question/alternative editing and resumption, updates list, revision comparison, safe restoration, complete print/text/CSV briefing surfaces and truthful copy | T4; T5 for import history | 4 to 6 | AC-08, AC-14, AC-15, AC-17, AC-19, AC-21 to AC-23, AC-27, AC-31 |
| T8 | Retention, privacy export/deletion, archive/trash recovery, quotas, redacted monitoring, backup/restore and migration rehearsal | T3, T6, T7; approved hosting/backup budget | 4 to 6 | AC-02, AC-24, AC-26, AC-29, AC-30 |
| T9 | Full browser journey, keyboard/screen reader/mobile/print checks, 90 model evaluation runs, load and failure injection, fresh independent review and fixes | T5 to T8 | 6 to 8 | AC-02, AC-20, AC-25, AC-27 to AC-31; regression of all prior ACs |
| T10 | Only when authorized: final deployment, public repository review/publication, clean setup instructions, three minute video and submission preparation; user handles terms and final submission unless explicitly delegated | G0 to G5; publication authorization | 3 to 4 | AC-32 |

Implementation T1 to T9 totals **38 to 54 hours**. T10 adds **3 to 4 hours**. Reserve **8 hours contingency**, giving **49 to 66 productive hours**. An inexperienced stack, unavailable mail domain, failed evaluation, or failed restore can exceed this range. A production public launch is conditional on gates, not the calendar.

The atomic plan lives here. Do not build every table and page fully before proving T4. T3 creates the minimum schema and constraints needed for the real loop; later tasks add tables and policies as their paths become usable. The complete target schema is in the data contract, with additive migrations as needed.

## Local delivery schedule

All dates below are Asia/Brunei. This recommended schedule assumes approval on 27 October and roughly six to eight focused hours per day. If approval happens later, recompute remaining hours against the fixed deadline; do not silently shrink release gates.

| Date | Focus and exit condition | Contingency decision |
|---|---|---|
| Tue 27 Oct | T1 and start T2; scaffold approved, sign in works, provider access checked | If access fails, preserve planning and build permitted deterministic paths after approval; do not claim live AI works |
| Wed 28 Oct | Finish T2, most T3; isolated data, draft plan, guarded revision transaction | Prioritize integrity before visual breadth |
| Thu 29 Oct | Finish T3/T4; real text update to approved revision and briefing | This is the essential integration milestone; failure consumes optional polish time immediately |
| Fri 30 Oct | T5; clean imports, actionable correction, repeat file handling | Keep CSV only; no document extraction expansion |
| Sat 31 Oct | T6 and start T7; actual mobile/desktop recording and text fallback | If voice cannot pass, do not advertise it; revise the first release scope explicitly rather than fake it |
| Sun 1 Nov | Finish T7; history, reversal, full briefing and responsive review | No invitations, integrations or charts |
| Mon 2 Nov | T8; real cleanup, privacy pages, monitoring, recovery rehearsal | Public launch blocked if restore or deletion fails |
| Tue 3 Nov | T9; evaluations, browsers, accessibility, concurrent approvals; freeze features | Record a backup video of actual working behavior after gates pass; fix only defects |
| Wed 4 Nov | T10, recheck gates and official requirements; aim to submit by 8:00 PM Brunei | Keep remaining evening and overnight as buffer, not planned feature development |
| Thu 5 Nov | Verify receipt well before 10:00 AM Brunei cutoff | No reliance on grace periods or deadline extensions |

The eight hour contingency is distributed across the last days and unused earlier estimates, not an additional workday after the cutoff. If the full release cannot pass, keep the core release truthful, limit exposure, and report incomplete capabilities plainly in submission materials. Do not weaken authorization, approval integrity, evidence requirements, or handling of unknown facts to fit time.

## Verified deadline and timezone calculation

The official participant guide gives a building period of **27 October through 4 November 2026** and submissions due **4 November at 9:00 PM Eastern**. The public listing starts the overall event on 26 October; it is not the same statement as the guide's build period. Follow the guide's new work boundary. [Participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details), [event listing](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon).

Python's actual `zoneinfo` database was used in this planning pass:

```text
2026-10-27 21:00 America/New_York, EDT, UTC minus 4
  = 2026-10-28 09:00 Asia/Brunei
2026-11-04 21:00 America/New_York, EST, UTC minus 5
  = 2026-11-05 10:00 Asia/Brunei
```

The US clock change occurs between those dates. The conversion for the deadline is **5 November 2026, 10:00 AM Brunei**, or **02:00 UTC**. The internal submission target of **4 November, 8:00 PM Brunei** gives fourteen hours of buffer. Recheck current official dates before submission; no grace period is assumed.

## Skill sequence after approval

| Stage | Appropriate skill and responsibility |
|---|---|
| Before code | `/scope` keeps the release boundary; `/architect` ratifies and updates these decisions; `frontend-design` carries the visual system |
| After runnable scaffold | `/audit` inspects the actual project and seeds AGENTS.md; defer it now because only planning docs exist |
| Each vertical slice | `/develop` builds from the governing specification; it must route genuinely new load bearing decisions back to architect |
| Prove behavior | `/check verify` uses the real application against the ACs and produces review evidence |
| Meaningful automated coverage | `/test` adds unit, integration and browser tests suited to the real changes, reusing the strategy in verify.md |
| Defect investigation | `/debug` reproduces and fixes the root cause, with a regression test through test |
| Before merging | `/check review` uses a fresh independent reviewer who did not author the change; record findings and their resolution |
| Human release prose | `/document` derives PR text, changelog or release notes from real code and results |
| Durable handoff | `/sync` surgically updates real repository guidance and scope after completed changes |

None of those implementation/release skills ran in this assignment. The installed skill metadata was inspected so this sequence reflects actual responsibilities. A separate model critique of this planning package is recommended before building but was not run or represented as completed; your no questions instruction was honored. The package receives a local consistency review before handoff.

## Submission checklist

Internal only. Do not put competition language into application titles, metadata, onboarding, emails, exports or errors.

- [ ] Verify participant eligibility, acceptance and required personal legal acknowledgements. The agent has not accepted any terms.
- [ ] Choose the recommended **Indie Developer** track and **Build for Your World** statement, subject to your actual eligibility and final submission choice.
- [ ] List every contributor accurately. Solo is permitted; the guide caps teams at four. The live submission form has track and team member controls.
- [ ] Identify work built during the official event period. Preserve real commit evidence and licenses. Do not imply preexisting work was created during the period.
- [ ] Explain that Spark understands operational updates and selects/explains feasible revisions, while Voice Transcribe produces reviewed text. Include actual model IDs, limitations and genuine usage feedback.
- [ ] Check project content against the official guide's rules and anti project examples; EventOps should demonstrate operational planning and approved changes, not basic RAG or image analysis.
- [ ] Review the repository and complete Git history for secrets, private roster data, provider artifacts, user identifiers and restricted assets. Add setup instructions, environment variable names without values, licenses, test commands and a clear architecture explanation.
- [ ] Obtain authorization before making the repository public. Verify anonymous access after authorized publication.
- [ ] Obtain authorization before provisioning paid hosting, connecting new accounts, accepting terms, or deploying. Verify real sign in and provider access at the final URL.
- [ ] Prepare a **three minute video** showing actual implemented features and the requested conflicting room/cancellation workflow, questions, evidence, approved revision, briefing and history. Use internal fictional data deliberately and keep all real personal data out of recording.
- [ ] Verify repository and video links from a signed out browser; verify the project is accessible under the permitted review access model. Do not remove application authorization to provide access.
- [ ] Complete accurate project description, Meta product use, why the models matter, and feedback fields. The optional social link is omitted unless separately authorized. Do not post to social media or Discord automatically.
- [ ] Submit one project per team through the official portal only when authorized. Do not check the marketing permission box or submit in this planning pass.
- [ ] Save the submission confirmation, final URLs, commit hash, video checksum and time before the deadline. Reopen the receipt to verify success rather than assuming a button click worked.

The official guide confirms public code, accessible repository/video links and a three minute video. The current submission form also names a public GitHub repository and a three minute video and collects track and team members. [Official submission](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). This verifies the practical selection mechanism; the earlier reported CV statement itself was not independently located.

## Three minute recording outline

| Time | Actual product behavior to show |
|---|---|
| 0:00 to 0:20 | Organizer problem, current approved plan and input sources |
| 0:20 to 0:50 | Give a cancellation and room move update by supported voice or text; confirm the text |
| 0:50 to 1:30 | Room collision, missing facts, actual record evidence and organizer answers |
| 1:30 to 2:10 | Feasible alternative, exact diff, deterministic checks, deliberate approval |
| 2:10 to 2:40 | New official revision, briefing and history/restore boundary |
| 2:40 to 3:00 | Meta's meaningful role, engineering boundaries and truthful limitations |

Use normal product language within the application. Any explanation of the event, technical contribution or development limitations belongs in submission narration and engineering materials.

## Consequences

The deadline makes the scope intentionally narrow. Quality must be demonstrated rather than claimed. The major dependencies that cannot be settled by recommendations alone are actual provider access, operator identity/privacy obligations, budget authorization, and your approval to build and publish. They remain visible in the decision register without requiring an interview during planning.
