# Guided sample event

Date: 4 November 2026. Enhancement authorized by the user's request to proceed with the recommended sample event, suggested update and workflow checklist. The user delegated routine decisions and requested continuation without questions.

## Summary

Let a signed in organizer load explicitly fictional sample records as a draft, review and confirm the starting plan, then follow Describe, Review, Confirm, Approve and Briefing. Reuse the existing design, owner APIs, quotas and approval boundary. No new integration, migration, account, consent, model call, deployment or publication is introduced.

## Requirements

- AC-1: My events links to a protected sample page with the full fictional setup and records visible. The fixed example date is 4 November 2026, timezone Asia/Brunei, operating 09:00 to 17:00. Two rooms each have capacity 40 and a projector. Opening is 10:00 to 11:00 in Room 1 with Synthetic Alex; Workshop is 10:00 to 11:00 in Room 2 with Synthetic Sam. Both volunteers are available 09:00 to 17:00. Each session requires one usher; attendance is 30 and 10 respectively, buffers zero and dependencies empty.
- AC-2: An explicit review checkbox enables loading. Use the normal POST events and PUT draft APIs with unchanged owner, origin, input, limit and generation controls. Load only a fresh generation 1 empty draft with matching sample setup. Never confirm a revision or overwrite any staged/approved records automatically.
- AC-3: Keep the creation request UUID in tab scoped session storage, never plan content or credentials. Retries and reloads reuse the same immutable creation receipt. Reconcile GET plan before staging. A concurrent stage conflict or ambiguous stage response must open the saved plan for review, not restage it blindly. Storage unavailability prevents creation and offers normal manual setup. Existing sample creation resumes the existing event rather than creating another.
- AC-4: Every event navigation includes a Guide link. The protected guide reads the real event and clearly distinguishes a draft from a confirmed starting plan. Five numbered instructions link to working existing destinations. No fictional completion marks or AI result claims.
- AC-5: Sample suggestions appear only for a creation snapshot matching the canonical sample setup. The suggested text explicitly moves Opening to Room 2 from 12:00 to 13:00, marks Synthetic Alex unavailable 10:00 to 13:00 and replaces Alex with Synthetic Sam as usher. Use sample update fills only an empty new text field on explicit click, never saves, confirms or submits. Existing drafts/text are preserved.
- AC-6: The guide explains clarifications, exact fact confirmation, separate approval, current approved briefing and manual fallback when AI is disabled. Manual instructions name the relevant session, availability and assignment fields. No fixture or model response is presented as live.
- AC-7: Semantic headings, labels, keyboard controls, pending/error messages, mobile reflow and the existing Swiss tokens remain consistent. Existing auth and tenant boundaries remain intact. Meaningful retry, no overwrite, suggestion and guide tests plus real browser verification are required.

## Decision and rationale

Use a customer facing sample module, not the private internal test fixtures. Its raw input references external identifiers; the existing normalizer assigns actual event scoped IDs and captures normal manual evidence. Reuse existing APIs rather than add a sample database function or direct writes. Keep guide navigation universally available, while sample text is gated by the immutable event creation snapshot. Sample recognition changes help content only, never authorization.

The two request creation and staging path can leave a setup draft after interruption. The UI retains the creation UUID and reads the durable draft before staging, preserving any later edits. This is preferable to a new migration for a small onboarding improvement. The fixed sample date is deliberate visible example data, not a claim about the user's current event.

Design source: design.md and src/styles/tokens.css. Use existing state panels, action links and an ordered list. No images, fonts, dependencies or alternative visual system. Implementation skills: frontend-design, develop, test, check.

## Build plan

- [x] Add canonical fictional setup and raw records, safe creation/reconciliation and explicit review entry.
- [x] Add protected guide, owner scoped immutable sample recognition and optional sample text input.
- [x] Add durable behavior tests, browser checks and fresh independent review. Record actual results and remaining access gaps.

## Consequences and follow-up

The guide improves local discoverability. It does not create remote judge access, enable AI, complete T9, certify novice usability or remove legal and publication boundaries. Sample records use the same workspace event limit and privacy lifecycle as other events.
