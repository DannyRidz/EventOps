# Scope: EventOps

EventOps helps you keep a small event's schedule, rooms, volunteer assignments, and briefing consistent when plans change. You review evidence and approve each official revision.

**Build approach:** Tracer Bullet (prove one real path through sign in, records, analysis, approval, and briefing, then broaden it).  
**Workflow:** GA (verify the real app, add meaningful tests, request a fresh reviewer before merge, document the actual change, then sync). This is an internal rigor setting, not a claim that anything has shipped.  
**Plan state:** Proposed. All features remain `planned`; no application work has started. Your instruction to proceed without questions is applied as recommended defaults. Explicit plan approval is still required before building.

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Stack and architecture | Foundation | planned |
| 2 | Coding standards and tooling | Foundation | planned |
| 3 | Data and approval model | Foundation | planned |
| 4 | Design system and accessible UI foundation | Foundation | planned |
| 5 | Thin complete operations loop | Slice 1 | planned |
| 6 | Imports and correction | Slice 2 | planned |
| 7 | Voice and transcript review | Slice 3 | planned |
| 8 | Review, resumption and history | Slice 4 | planned |
| 9 | Briefing and exports | Slice 5 | planned |
| 10 | Privacy, retention and recovery | Slice 6 | planned |
| 11 | Release verification and delivery | Release | planned |

## Foundations

### 1. Stack and architecture, planned

Choose the application structure and create the runnable foundation only after you approve the plan.

**Done when:** the approved architecture boots, builds, and supports a real protected request.

- [ ] Ratify the proposed design (spec): `/architect stack and architecture`, proposed [architecture](../specs/0001-eventops/0002-architecture.md).

### 2. Coding standards and tooling, planned

Capture real conventions once an approved scaffold exists. Then add the appropriate enforcement.

**Done when:** actual repository guidance, type checks, formatting, lint and CI describe and check the real project.

- [ ] Capture conventions from the approved scaffold: `/audit`.

### 3. Data and approval model, planned

Keep event ownership, source evidence, revisions and guarded approval consistent.

**Done when:** all official writes use the validated, isolated, version checked transaction with durable receipts.

- [ ] Ratify the proposed design (spec): `/architect data and approval`, proposed [data contract](../specs/0001-eventops/0004-data.md).

### 4. Design system and accessible UI foundation, planned

Set readable schedules, consistent forms, source views and review controls.

**Done when:** shared components follow the proposed visual system and support keyboard, mobile and error states.

- [ ] Ratify the proposed design (spec): `/architect experience`, proposed [experience](../specs/0001-eventops/0003-experience.md).

## Slice 1: Thin complete operations loop

### 5. Thin complete operations loop, planned

Sign in, create an event, manually confirm a small real plan, enter a text update, inspect evidence, approve a valid revision, and read its briefing. This is the walking skeleton, not a separate disposable scaffold.

**Done when:** a real user completes the whole path through actual storage and model calls; invalid or stale candidates cannot commit.

- [ ] Ratify the proposed design (spec): `/architect operations loop`, proposed [AI](../specs/0001-eventops/0005-ai.md) and [data](../specs/0001-eventops/0004-data.md) contracts.

## Slice 2: Imports and correction

### 6. Imports and correction, planned

Add supported file entry, actionable validation, explicit duplicate handling and saved corrections to the already working loop.

**Done when:** schedule, room, roster, availability and optional assignment/dependency CSVs can be reviewed and corrected before one starting plan confirmation; errors never partly change the official plan.

- [ ] Ratify the proposed design (spec): `/architect imports`, proposed [data contract](../specs/0001-eventops/0004-data.md).

## Slice 3: Voice and transcript review

### 7. Voice and transcript review, planned

Add short recordings to the same confirmed text and analysis flow.

**Done when:** supported desktop and mobile recordings transcribe, permit correction and require confirmation; denied permission or service failure offers the complete text path.

- [ ] Ratify the proposed design (spec): `/architect voice updates`, proposed [AI contract](../specs/0001-eventops/0005-ai.md).

## Slice 4: Review, resumption and history

### 8. Review, resumption and history, planned

Broaden the loop with saved unresolved questions, edited alternatives, rejected proposals, history comparisons and reviewed restoration.

**Done when:** you can return to acknowledged work, inspect prior revisions and restore through a new validated proposal without erasing later history.

- [ ] Ratify the proposed design (spec): `/architect revision review`, proposed [experience](../specs/0001-eventops/0003-experience.md) and [data](../specs/0001-eventops/0004-data.md) contracts.

## Slice 5: Briefing and exports

### 9. Briefing and exports, planned

Make the saved revision easy to use at the event.

**Done when:** the approved plan produces a labeled briefing, print view, text download and safe CSV exports with no draft data or invented claims.

- [ ] Ratify the proposed design (spec): `/architect briefing`, proposed [experience](../specs/0001-eventops/0003-experience.md) and [data](../specs/0001-eventops/0004-data.md) contracts.

## Slice 6: Privacy, retention and recovery

### 10. Privacy, retention and recovery, planned

Provide settings, private data export, controlled deletion, background cleanup and tested operational recovery.

**Done when:** retention and deletion actually run, provider processing is disclosed, backups can be restored, and expired or deleted sources are labeled honestly.

- [ ] Ratify the proposed design (spec): `/architect operations`, proposed [operations contract](../specs/0001-eventops/0006-operations.md).

## Release

### 11. Release verification and delivery, planned

Prove the complete journey and prepare a truthful submission and maintainable release.

**Done when:** acceptance, evaluation, browser, isolation, recovery and operational gates have evidence, and authorized delivery uses working accessible links.

- [ ] Ratify the proposed design (spec): `/architect delivery`, proposed [delivery](../specs/0001-eventops/0007-delivery.md) and [verification](../specs/0001-eventops/verify.md) contracts.

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

All statuses describe implementation, not whether a planning document exists. The linked designs are drafted but unratified, so execution boxes remain absent. After approval, `/architect` can capture ratification and expand each feature to build, verify, test, review and document boxes. Atomic tasks and effort ranges remain only in the delivery specification.

Do not begin the first unticked workflow command until the master prompt's explicit approval boundary is met. Scope is tool agnostic; implementing tools are chosen only in the architecture specification.
