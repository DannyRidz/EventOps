# Guided sample completion and verification

Date: 4 November 2026, Asia/Brunei. Local feature verdict: verified. Full T9 and remote judge access remain incomplete.

## Implemented behavior

My events now links to a protected sample page. It shows the complete fictional workshop setup, rooms, schedule, volunteer roles, availability and assignments before loading. The review checkbox authorizes only loading a private draft through the existing event and staging APIs. The starting plan still needs separate explicit confirmation through the normal editor.

The creation request UUID is retained in tab scoped session storage. Retrying reads the durable event before staging and resumes existing staged or approved records. Changed empty drafts, concurrent edits and unavailable storage fail without blind replacement. No new database function, migration, direct table write, authentication bypass or provider integration was introduced.

Every event has a Guide link. The guide shows actual starting plan state and five numbered instructions: Describe, Review, Confirm, Approve and Briefing. It explains missing facts and clarification, full interpretation/fact confirmation, separate transactional approval, approved exports and manual fallback. These are instructions, not fictional completion indicators.

Sample suggestions appear only when the immutable owner scoped creation snapshot matches the canonical sample setup. Use sample update inserts explicit room, time, unavailability and replacement details into an empty new field only. It does not save, confirm, send or approve the update. Typed and saved text cannot be replaced by that control. The loaded starting plan has a keyboard accessible link that moves focus directly to its existing review section.

Governing [specification](../specs/0001-eventops/0014-guided-sample.md). Independent [review](2026-11-04-guided-sample-review.md): **Approve**, zero open findings.

## Actual checks

- Pinned Node 24 `npm run check`: **201 tests passed across 35 files**, plus lint, formatting, generated route types and strict type checking. Two preparation issues, formatting in the new creation helper and an unsupported Testing Library test option, were fixed before this final passing run.
- Targeted interaction and retry checks: **21 tests passed across five suites**. They include review gating, zero requests when session storage is denied, pending controls, partial failure recovery, existing approved/staged records, response loss, generation conflicts, suggestion insertion without transmission, preservation of text, guide states and the existing editor.
- `npm run build`: passed with both new routes included. The normal production server was restarted at `http://localhost:3000`, bound to 127.0.0.1. Local readiness returns 200 and `status: ok`. The temporary port 3006 preview was stopped afterward.
- Both new protected routes return **307 to sign-in** without an authenticated session, on both preview and production. No new sign-in, personal attestation or terms acceptance was performed.
- Actual Chrome loading through the existing authenticated account created exactly one sample event, `61f7edb5-7851-4233-a2ff-e1f8d65d6733`, as a staged generation 2 draft. The guide initially stated that no starting plan was approved.
- The Review loaded starting plan anchor moved focus to `starting-plan-review`. The saved plan showed no blocking constraints. Explicit normal confirmation created revision 1 and its approved briefing, with the expected Opening/Workshop assignments.
- Use sample update filled an empty field and showed Text has not been saved. Only a separate Save update text action created saved generation 1. Its analysis confirmation remained unchecked. The original and saved text remained visible afterward.
- Returning to the sample entry in the same preview tab and loading again resumed **the same event ID**. Final read only database inspection confirmed one sample event, one revision, **96 source records**, one text draft, **zero analysis jobs** and no added source records or revisions from the retry. The earlier synthetic browser event still has its two revisions.
- The earlier normal event has no Use sample update button. The sample helper does not treat it as fictional sample creation.
- At a 360 by 800 browser viewport, sample entry, guide and sample Updates each had document scroll width **360**, with no horizontal page overflow. The sample and guide were also visually inspected. The temporary viewport override was reset.
- Final running-project database gates are both **false**. No provider request or new evaluation reservation was made. Main production flags were explicitly kept disabled on restart; the model key remains outside web configuration.

Private evidence: `output/guided-sample-private/service-receipt.json`, `service-final.json`, `sample-mobile.png`, `guide-mobile.png`, and `guide-desktop.png`. Command logs are in `/private/tmp/eventops-guided-demo-{check,build,production}.log`.

## Remaining limits

This verifies the implemented local guidance, not a first time human usability study. It does not certify audible VoiceOver, physical mobile devices, full model quality, production operations or remote judge access. AI remains disabled outside separately authorized tests. No public hosting, paid resource, legal acceptance, external message, commit or push occurred. New source changes are local and are not present in the public repository until the owner publishes them.

The existing video remains an earlier actual workflow demonstration and does not show these newly added controls. Its claims were not silently changed. The standing no deployment and no Git publication boundaries remain in force.

## Durable context reconciliation

The new sample area has its own AGENTS.md guidance. Root AGENTS.md gains one context link, with curated paragraphs preserved. The living scope records this local enhancement without marking the overall release complete. No existing spec decision was superseded.
