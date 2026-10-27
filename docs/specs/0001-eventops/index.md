# 0001. EventOps planning package

**Date**: 2026-10-27  
**Status**: Proposed

## Summary

EventOps helps you keep a small event's schedule, rooms, volunteers, and briefing consistent as plans change. You confirm a starting plan, give an update by text or voice, review a practical revision with its evidence, and approve it before it becomes official. The recommended first release serves one organizer per workspace and events held on one local date.

This is a planning deliverable. No application, dependencies, provider resources, or deployment have been created. The plan is ready for your review. Building starts only after your explicit approval.

## Structure

| Document | What it owns |
|---|---|
| [Product brief](0001-product.md) | Audience, value, success measures, product principles |
| [Architecture](0002-architecture.md) | Stack, boundaries, deployment shape, alternatives |
| [Experience and visual system](0003-experience.md) | Complete journey, screen inventory, navigation, wireframes, design tokens |
| [Data and approval contract](0004-data.md) | Entities, imports, constraints, APIs, evidence, permissions, concurrency |
| [AI workflow](0005-ai.md) | Model selection, schemas, deterministic tools, uncertainty, cost controls |
| [Security and operations](0006-operations.md) | Privacy, accessibility, environments, monitoring, backup, recovery |
| [Delivery and submission](0007-delivery.md) | Implementation tasks, estimates, dates, release process, submission checklist |
| [Acceptance and verification](verify.md) | Canonical acceptance criteria, test mapping, AI evaluation cases, release gates |
| [Rationale and evidence](rationale.md) | Workspace inspection, research, decision register, assumptions, unresolved dependencies |
| [Living scope](../../scope/scope.md) | Ordered feature boundary, status, later phases |

Child documents are governed by this umbrella. They have no separate lifecycle status. All recommendations remain proposed until you ratify the plan. Provider documentation establishes published capability, not access by your account or measured application behavior.

## Requirements

The original master prompt and your instruction to proceed without questions are the requirements. [AC-01 through AC-32](verify.md) translate them into observable release criteria. Those IDs are defined once in `verify.md`; other documents refer to them rather than creating competing acceptance lists.

## Decision

Recommend a modular web application, managed authentication and PostgreSQL, private file storage, a small durable job worker, and direct Meta Model API calls. Keep scheduling rules and approval transactions in application and database code. Use a model to interpret intent and explain valid alternatives. It receives no ability to commit an official plan.

**Planning skills actually applied**: installed `scope`, `architect`, and `frontend-design`. The later workflow skills were inventoried and their metadata inspected, but no implementation stage was run. The no questions instruction overrides the skills' interviews and optional confirmation panels. Recommendations are stated here instead of being represented as user confirmed decisions.

## Cross document contracts

1. The scope owns what ships. The data contract owns all event limits, import schemas, official revisions, and approval behavior.
2. An update describes new information. A proposal is a candidate. Only a successful approval transaction creates an official revision.
3. Evidence references resolve to immutable records in the same workspace and event. Model prose cannot establish a fact.
4. No proposal can silently discard an organizer's request, invent available people, or infer capacity from missing data.
5. A manual edit after initial confirmation uses the same proposal, validation, and approval path as an AI assisted edit.
6. The latest approved revision drives the plan and briefing. Drafts, unresolved updates, and historical revisions are labeled explicitly.
7. No application copy refers to the competition or uses unfinished product language. Fictional scenarios belong only to internal fixtures.
8. No external communication, public repository exposure, legal acceptance, paid resource creation, or deployment is authorized by this planning pass.

## Build plan

The ordered, estimated tasks and their acceptance mappings are maintained only in [Delivery](0007-delivery.md). The scope has coarse milestone boxes. The architecture decision itself has no competing scaffold task list.

## Consequences

The narrow release makes a real operations workflow achievable. It gives you fewer moving parts, traceable revisions, and a usable text path when voice or AI is unavailable. It also limits event size, collaboration, supported imports, and optimization breadth. Meeting the deadline remains conditional on prompt approval, service access, and passing release gates.

## Rationale

See [Rationale and evidence](rationale.md) for the alternatives, verified sources, limitations, and decisions that need ratification.

## Follow-up

1. Await explicit plan approval before scaffolding or installing anything.
2. Resolve the external launch dependencies recorded in the decision register through account checks and official evidence, without inventing answers.
3. After an approved scaffold exists, capture actual conventions with `/audit`. Preserve this plan and any later curated repository guidance.
