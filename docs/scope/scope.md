# Scope: EventOps

EventOps helps you keep a small event's schedule, rooms, volunteer assignments, and briefing consistent when plans change. You review evidence and approve each official revision.

**Build approach:** Tracer Bullet (prove one real path through sign in, records, analysis, approval, and briefing, then broaden it).  
**Workflow:** GA (verify the real app, add meaningful tests, request a fresh reviewer before merge, document the actual change, then sync). This is an internal rigor setting, not a claim that anything has shipped.  
**Plan state:** Approved on 27 October 2026. T1, the runnable foundation and shared UI, is implemented and locally verified. T2 accounts and event setup are also implemented and locally verified, with hosted mail and Meta access still open. T3 plan integrity is also built and locally verified. T4 implementation is complete locally, including the gated interpreter, deterministic options, restricted worker and cost controls, verified with controlled provider responses. Live Meta and hosted-service verification remain blocked. [T4 evidence](../reviews/2026-10-28-t4-worker-completion.md). This does not mark the complete operations loop or full release acceptance criteria complete. Continue without questions using the approved recommendations.

## At a glance

29 October provider readiness update: signed in billing confirms USD 150 active free credits and a product improvement notice. Payment remains required, Create API key is disabled and no private model key is available. Synthetic live verification is blocked with USD 0 spend; controlled worker and manual flows pass again. Live gates remain disabled and T7 has not started. [Readiness evidence](../reviews/2026-10-29-live-ai-readiness.md).

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Stack and architecture | Foundation | done |
| 2 | Coding standards and tooling | Foundation | done |
| 3 | Data and approval model | Foundation | done |
| 4 | Design system and accessible UI foundation | Foundation | in-progress |
| 5 | Thin complete operations loop | Slice 1 | in-progress |
| 6 | Imports and correction | Slice 2 | done |
| 7 | Voice and transcript review | Slice 3 | in-progress |
| 8 | Review, resumption and history | Slice 4 | done |
| 9 | Briefing and exports | Slice 5 | done |
| 10 | Privacy, retention and recovery | Slice 6 | planned |
| 11 | Release verification and delivery | Release | planned |

## Foundations

### 1. Stack and architecture, done

The application structure is approved and its runnable foundation is built. T2 now proves a real protected request through Supabase Auth and PostgreSQL.

**Done when:** the approved architecture boots, builds, and supports a real protected request.

- [x] Ratify the design (spec): approved [architecture](../specs/0001-eventops/0002-architecture.md).
- [x] Build and verify the T1 scaffold and standalone production runtime.
- [x] Verify a real protected request in T2, including owner isolation and anonymous denial.

Code in `src/app/`, `next.config.ts`, and `scripts/`. [T1 evidence](../specs/0001-eventops/0008-foundation.md).

### 2. Coding standards and tooling, done

Capture real conventions once an approved scaffold exists. Then add the appropriate enforcement.

**Done when:** actual repository guidance, type checks, formatting, lint and CI describe and check the real project.

- [x] Capture conventions from the approved scaffold: `/audit`.
- [x] Build tooling and CI configuration.
- [x] Verify local clean install, lint, format, types, tests and production build.
- [x] Complete fresh review before merge, final verdict Approve with no outstanding findings.
- [x] Document the actual changes in `CHANGELOG.md` and synchronize repository guidance.

Code in `AGENTS.md`, `package.json`, test configuration and `.github/workflows/ci.yml`. GitHub execution is not claimed before pushing.

### 3. Data and approval model, done

Keep event ownership, source evidence, revisions and guarded approval consistent.

**Done when:** all official writes use the validated, isolated, version checked transaction with durable receipts.

- [x] Ratify the design (spec): `/architect data and approval`, approved [data contract](../specs/0001-eventops/0004-data.md).
- [x] Build and locally verify T3 immutable sources, complete candidate constraints, restricted approval functions, evidence, receipts, races and rollback. [T3 evidence](../reviews/2026-10-27-t3-plan-integrity.md).

### 4. Design system and accessible UI foundation, in-progress

Set readable schedules, consistent forms, source views and review controls.

**Done when:** shared components follow the proposed visual system and support keyboard, mobile and error states.

- [x] Ratify the design (spec): approved [experience](../specs/0001-eventops/0003-experience.md).
- [x] Build T1 tokens, page shell, form controls and shared empty/loading/error states.
- [x] Verify T1 desktop/mobile, focus, described errors, keyboard recovery and automated accessibility.
- [ ] Extend and verify the design across the event and proposal screens in later slices.

Code in `src/components/ui/`, `src/styles/tokens.css`, and `design.md`.

## Slice 1: Thin complete operations loop

### 5. Thin complete operations loop, in-progress

Sign in, create an event, manually confirm a small real plan, enter a text update, inspect evidence, approve a valid revision, and read its briefing. This is the walking skeleton, not a separate disposable scaffold.

**Done when:** a real user completes the whole path through actual storage and model calls; invalid or stale candidates cannot commit.

- [x] Ratify the design (spec): `/architect operations loop`, approved [AI](../specs/0001-eventops/0005-ai.md) and [data](../specs/0001-eventops/0004-data.md) contracts.
- [ ] Build it: `/develop operations loop`. T2 account and event setup portion is built and locally verified. T3 integrity is built and locally verified. T4 is implemented and locally verified, including model request contracts, deterministic options, a restricted leased worker, budgets, interpretation confirmation, guarded approval and briefing. Controlled provider responses prove the local path; the actual model-call acceptance criterion remains open because provider terms, authorized access and live probes remain external gates. [T4 evidence](../reviews/2026-10-28-t4-worker-completion.md). [T2 evidence](../reviews/2026-10-27-t2-accounts-events.md).

## Slice 2: Imports and correction

### 6. Imports and correction, done

Add supported file entry, actionable validation, explicit duplicate handling and saved corrections to the already working loop.

**Done when:** schedule, room, roster, availability and optional assignment/dependency CSVs can be reviewed and corrected before one starting plan confirmation; errors never partly change the official plan.

- [x] Ratify the design (spec): `/architect imports`, approved [data contract](../specs/0001-eventops/0004-data.md).
- [x] Build it: `/develop imports`. CSV templates, private uploads, saved mapping/corrections, duplicate decisions, immutable sources and exact starting plan confirmation are built and locally verified. [T5 evidence](../reviews/2026-10-28-t5-imports-completion.md). Code in `src/features/imports/`, the import routes, additive migrations and `scripts/verify-t5.mjs`.

## Slice 3: Voice and transcript review

### 7. Voice and transcript review, in-progress

Add short recordings to the same confirmed text and analysis flow.

**Done when:** supported desktop and mobile recordings transcribe, permit correction and require confirmation; denied permission or service failure offers the complete text path.

- [x] Ratify the design (spec): `/architect voice updates`, approved [AI contract](../specs/0001-eventops/0005-ai.md).
- [x] Build it: `/develop voice updates`. Recording, private audio jobs, bounded conversion, controlled transcription, immutable originals, saved corrections, explicit confirmation, text fallback and raw audio cleanup are implemented and locally verified. [T6 evidence](../reviews/2026-10-28-t6-voice-completion.md). Code in `src/features/voice/`, the voice routes, additive migrations and `scripts/verify-t6.mjs`. Native Safari and physical desktop/mobile recording, hosted worker isolation and actual provider acceptance remain open, so the feature stays in progress. Live AI remains disabled.

## Slice 4: Review, resumption and history

### 8. Review, resumption and history, done

Broaden the loop with saved unresolved questions, edited alternatives, rejected proposals, history comparisons and reviewed restoration.

**Done when:** you can return to acknowledged work, inspect prior revisions and restore through a new validated proposal without erasing later history.

- [x] Ratify the design (spec): `/architect revision review`, approved [experience](../specs/0001-eventops/0003-experience.md) and [data](../specs/0001-eventops/0004-data.md) contracts.
- [x] Build it: `/develop revision review`. T7 answers, immutable candidate edits, rejection reasons, history comparison and context fenced restoration are built and locally verified. [Completion evidence](../reviews/2026-10-29-t7-completion.md). Code in `src/features/plans/`, `src/features/analysis/answer-form.tsx`, history/review routes and additive T7 migrations.

## Slice 5: Briefing and exports

### 9. Briefing and exports, done

Make the saved revision easy to use at the event.

**Done when:** the approved plan produces a labeled briefing, print view, text download and safe CSV exports with no draft data or invented claims.

- [x] Ratify the design (spec): `/architect briefing`, approved [experience](../specs/0001-eventops/0003-experience.md) and [data](../specs/0001-eventops/0004-data.md) contracts.
- [x] Build it: `/develop briefing`. Approved revision print, text and six safe CSV outputs are built and locally verified. [Completion evidence](../reviews/2026-10-29-t7-completion.md). Code in `src/features/plans/briefing.ts`, the briefing page/API and print styles.

## Slice 6: Privacy, retention and recovery

### 10. Privacy, retention and recovery, planned

Provide settings, private data export, controlled deletion, background cleanup and tested operational recovery.

**Done when:** retention and deletion actually run, provider processing is disclosed, backups can be restored, and expired or deleted sources are labeled honestly.

- [x] Ratify the design (spec): `/architect operations`, approved [operations contract](../specs/0001-eventops/0006-operations.md).
- [ ] Build it: `/develop operations`.

## Release

### 11. Release verification and delivery, planned

Prove the complete journey and prepare a truthful submission and maintainable release.

**Done when:** acceptance, evaluation, browser, isolation, recovery and operational gates have evidence, and authorized delivery uses working accessible links.

- [x] Ratify the design (spec): `/architect delivery`, approved [delivery](../specs/0001-eventops/0007-delivery.md) and [verification](../specs/0001-eventops/verify.md) contracts.
- [ ] Build it: `/develop delivery`.

## Explicit release boundary

Include private account access, one owner workspace, multiple saved events on one local date each, manual and CSV setup, short voice and text updates, deterministic logistics checks, evidence backed proposals, deliberate approvals, immutable revision history, briefing and export, privacy settings, deletion and operational support. English UI is the supported release language. Timezones are explicit. Other spoken languages are not advertised until evaluated.

Support and monitoring are operational capabilities, not an admin analytics dashboard. Email is used for access and account notices only. A printed or downloaded briefing is shared by the organizer outside the application.

## Deferred

| Capability | Recommendation and reason | Revisit when |
|---|---|---|
| Collaboration, invitations, editor/viewer roles | Defer the membership UI and concurrent collaboration; one accountable approver is sufficient initially | Multiple organizers need direct access to the same event |
| Notifications | Defer volunteer emails, push and SMS; avoid communicating unapproved changes | Delivery, recipient permissions and notification semantics can be designed together |
| Calendar integrations | Defer Google/Microsoft sync and ICS import; external changes add reconciliation and permissions | Reliable official plan is proven and calendar demand is measured |
| Messaging integrations | Defer Slack, WhatsApp and Discord tools; no automatic external effects | Organizers demonstrate a real channel workflow and explicitly authorize connections |
| Billing | No payment requirement; defer plans, subscriptions and metering UI | Repeat use and serving costs support a clear business model |
| Advanced analytics | Defer charts, optimization metrics and data warehouse | Repeated real events provide enough information to answer a useful question |
| Broader formats | Defer XLSX, PDF, DOCX, scans and free form schedule extraction | CSV correction flow is stable and extraction quality can be evaluated |
| Multi day and large events | Defer recurrence, overnight scheduling and large constraint optimization | A verified use case exceeds the explicit limits |
| Native mobile and offline writes | Defer apps, background sync and offline editing | Responsive web behavior is proven insufficient |
| Automatic actions | No automatic approval, room booking, volunteer outreach or calendar mutation | Separate authorization and recovery specifications exist |

Later phase 2 should prioritize invitations and viewer access, then a carefully designed briefing share link. Phase 3 can evaluate integrations, broader imports and paid plans against evidence of use. No later phase is promised in the customer experience.

## Legend and next step

All statuses describe implementation. The plan and linked designs were ratified on 27 October 2026. T1 verification applies only to its built surfaces. The broader foundation features stay in progress where later work remains. Atomic tasks and effort ranges remain in the delivery specification; T1 evidence is in its child specification.

The plan approval boundary has been met. The next delivery milestone is T2, real sign in, private workspace and event setup. External legal acceptance, paid provisioning, publication and deployment still require their existing authorization boundaries. Scope is tool agnostic; implementing tools are chosen only in the architecture specification.
