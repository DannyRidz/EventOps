# Product brief

## Summary

Your event plan changes while people are already depending on it. EventOps makes the consequences visible and gives you one reviewed, current plan to work from.

## Audience and problem

The primary user is the organizer of a workshop, small conference, or community event. They work quickly, often on a phone, and may have little technical experience. They currently reconcile a spreadsheet, volunteer messages, room information, and a briefing by hand. An apparently small room move or cancellation can leave several of those records inconsistent.

The first release supports adult organizers managing ordinary event logistics. It is not a staff hiring system, emergency dispatch tool, attendee surveillance system, or venue safety certification tool. It does not decide whether a person is suitable for work or infer health, disability, or other sensitive traits. Role tags are explicit logistical capabilities supplied by the organizer.

## Value proposition

“Keep your event plan consistent when things change.”

You provide a schedule and roster, confirm what the application understood, and give a short update. EventOps identifies the affected records, checks explicit constraints, shows missing information, and offers practical revisions. You stay responsible for approving the exact changes. A briefing is generated from the resulting approved records.

This goes beyond summarization: the useful output is a validated revision with changed room, time, assignment, or availability records, a reproducible validation result, and an approval history. The application is organized around an event plan and proposal review, with a text input as one entry point.

## Recommended boundary

The [scope](../../scope/scope.md) is the canonical release boundary. Its core is one complete operational loop for one organizer, one event date, and a bounded schedule. Multiple saved events are useful; multiple simultaneous editors are deferred. No payment is needed to evaluate the product's value. Monetization can be considered after repeated use establishes what organizers value and what it costs to serve them.

Unknown availability and missing room facts are real limitations to display. An organizer can save an incomplete draft, but an official plan and an approvable proposal must satisfy the release's required constraints. There is no “approve anyway” bypass for room collisions or missing mandatory coverage.

## First use and repeat use

The first visit explains what to prepare: event date and timezone, a schedule, room details, volunteer availability, and any assignments. You sign in with an email code, receive a personal workspace automatically, and create an event. You can download CSV templates or enter information manually. Preview and correction happen before the starting plan is confirmed.

Later visits open your events, with the most recent event available in one click. Each event opens on the approved plan and any unresolved updates. An update preserves both the original input and your corrected text. Review can be resumed after interruption. Approval creates a new revision, followed by a briefing ready to print or download.

## Product principles

1. Show the next useful action, without empty charts or decorative counts.
2. Label facts, requests, candidates, and approved decisions distinctly.
3. Name missing information precisely. “What time can this volunteer start?” is useful; “more context needed” is not.
4. Make approvals deliberate and easy to understand. No auto approval, background publication, or external notifications.
5. Keep the current plan available during analysis and service failures.
6. Preserve work through mistakes, refreshes, retries, and interrupted connections.
7. Explain limits honestly and in ordinary language.

## Success criteria

These are proposed targets to verify, not existing performance claims.

| Outcome | Target and measurement |
|---|---|
| First plan | An organizer can confirm a clean 20 session, 15 volunteer fixture in 10 minutes without verbal help |
| Operational update | A text update reaches an understandable proposal in 60 seconds at the 95th percentile under the planned test load, excluding time answering questions |
| Trust | Every proposed changed field and factual rationale resolves to evidence; no unsupported operational fact in the release evaluation set |
| Safety of approval | No invalid plan, stale approval, unauthorized access, or duplicate revision in concurrency and isolation tests |
| Recovery | Refresh or sign in again preserves acknowledged drafts; a previous plan can be restored through a new reviewed revision |
| Accessibility | Core journey passes the specified keyboard, screen reader, contrast, reflow, and automated checks |
| Repeat usefulness | In a small supervised trial, at least 4 of 5 organizers complete the scenario and explain what approval saved |

Trial participants and results do not exist yet. Keep trial evidence internal until it can be reported truthfully with consent. Capture completion events from server state changes without recording input text in analytics. Count first plan confirmations, proposals reviewed, approvals, reversals, and time to completion. Defer a separate analytics dashboard and advertising trackers.

## Consequences

The release optimizes for clear, safe decisions in a small operational setting. It will not coordinate a large festival, find an optimal schedule across thousands of constraints, or automatically contact volunteers. Expanding those boundaries requires fresh scope and design decisions.
