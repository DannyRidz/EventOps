# T9 local accessibility continuation, 3 November 2026

## Verdict

Full T9 remains blocked. This continuation closes another concrete keyboard failure and adds protected screen reflow, native zoom, import correction, rejection and private export evidence. It does not supply the full 90 real evaluation runs, human screen reader acceptance, physical device matrix or hosted operational proof. No completion box is ticked.

Preserved the initially clean working tree and all saved records. Read root and relevant feature guidance, living scope, approved verification and delivery contracts, T8 completion, review and runbook, and the current T9 browser record. Used the check skill for runtime proof and debug for the reproduced focus failure. No sign in, legal acceptance, provider request, payment change, paid provisioning, deployment, commit or push occurred.

## Browser evidence

Chrome on macOS, local production app at `http://localhost:3000`, using the user's existing authenticated session. The prior [browser record](2026-11-03-t9-browser-verification.md) owns the connected live text approval path and briefing export observations. This run exercised the following actual routes. Event A is `156e37c8-aa0d-49ac-9eeb-f1ecf45817b5`; event B is `b8201fe5-4b8d-480a-9e3b-a19ccc6727f7`.

Each row below had viewport width equal to document width at **320, 360, 390, 768 and 1280 CSS pixels**, with height 800. There were **65 measurements, zero horizontal overflow failures**. This is a reflow measurement, not a full usability or WCAG certification. Screenshots were inspected in the browser tool for narrow updates, stale analysis and expanded correction context; no standalone screenshot file was saved.

| Surface | Route below localhost:3000 | Additional observed state |
|---|---|---|
| Update list | `/events/A/updates` | Saved generation, answers, real analysis results and approved/rejected proposal links remain accessible |
| Text review | `/events/A/updates/40581e17-e896-45fb-96fd-22ecf2b07b2d` | Saved generation 2 and explicit confirmation remain distinct |
| Stale unresolved analysis | `/events/A/analysis/6da53a20-948a-4d23-82d1-9cc7edac4070` | Current plan/text changed warning, preserved organizer answer, no new proposal allowed; expanded affected records |
| Manual editor | `/events/A/records` | All record types and explicit confirmation present |
| Infeasible proposal | `/events/A/proposals/b3d2ce9d-4782-4e69-8ee6-41dbb75c47ff` | Two capacity failures, before/proposed evidence, full candidate and disabled Review approval |
| Workspace | `/events` | Existing approved event retained |
| Setup errors | `/events/new` | Overlong name field error and reversed hours alert; typed values preserved |
| Long title draft | `/events/B/plan` | Honest no approved plan state and readable wrapped title |
| Import correction | `/events/B/imports/ed6a648a-97d1-46d0-bef4-c57437a0fe24` | Exact duplicate/reference errors and expanded editable rows |
| Privacy | `/events/settings` | Long title, deadlines, original file status and cancellation controls |
| Approved plan | `/events/A/plan` | Revision 2 unchanged, Opening Room 2 at 12:00 to 13:00 |
| History comparison | `/events/A/history?compare=0eaaf036-259b-45f3-a3c4-08a9798bb368&revision=f42539bd-198a-4321-a187-d76fb7acaf22` | Historical revision 1 to 2 differences and frozen evidence links |
| Approved proposal | `/events/A/proposals/c0c6d868-6a68-4531-a798-cc805d8d5de8` | Saved revision 2 receipt, approved status and field evidence |

Native Chrome controls confirmed **Zoom: 200%**. All rows except the transient new setup form were measured after their actual headings became visible: viewport/document widths **735/735 CSS pixels** on all 12 screens. Expanded import correction fields also stayed within 735 pixels. An initial batch caught the application's loading heading, so those initial measurements were discarded and repeated against loaded content. The earlier briefing record supplies its separate native zoom observation. These checks do not cover every combination of open control, screen and browser. Restored native zoom to 100% and reset viewport overrides.

The comparison navigation briefly timed out in the browser control tool. A fresh observation showed the correct loaded historical comparison; the successful measurements above followed that observation. This is recorded as an automation delay, not a product failure or a pass inferred from the timeout. Captured browser error/warning logs at the end returned an empty list.

## Negative and recovery paths actually exercised

Changed Room 2 capacity from 40 to 1 in the manual editor of event A, supplied a synthetic reason and explicitly confirmed the facts. The saved manual proposal above was **infeasible**, with CAPACITY failures for both affected sessions. Review approval stayed disabled. Rejected it using the keyboard with reason “Synthetic T9 negative test: Room 2 capacity 1 cannot cover either session.” The update list then offered Review rejected proposal. Event A still showed approved revision 2 and its original room capacity in the approved export; the rejected candidate was not approved.

Created event B solely for setup and import testing. The first name exceeded 120 characters and was rejected with an associated field error. After shortening it, reversed operating hours (17:00 to 09:00) produced the alert “End time must be after start time on the same date.” Values remained filled. Corrected hours to 09:00 to 17:00 and saved a draft with explicit Asia/Brunei and 4 November 2026. Its long name is “Synthetic T9 accessibility and import validation with a long event title for narrow screens and browser zoom”. No initial plan was confirmed for this event.

Uploaded six synthetic CSV files based on the T10 fixtures, with one deliberately conflicting room ID and one missing room reference. The review reported `rooms.csv`, row 4, `room_id` and `schedule.csv`, row 2, `room_id`, with exact values and corrective instructions. Explicitly excluded duplicate row 4 and changed the schedule reference from `missing-room` to `hall`. Saved import version 2, refreshed, and observed the excluded checkbox true, room reference `hall` and “No official plan changes.” Initial plan confirmation remained a separate action and was not taken.

Downloaded the unchanged schedule original through the authenticated page. Its SHA256 and the uploaded fixture SHA256 both equal `1d421c781dc2f62f7b72b5e0c117cc94d4faf3acf94b3c8a7b3438cfde2c18e1`. Thus saving corrections did not overwrite the original bytes. Fixtures remain in `/private/tmp/eventops-t9-import-errors/`; the downloaded original is `/Users/asmasalleh/Downloads/original.csv`.

Downloaded `/api/workspace/export` using the actual authenticated Download workspace ZIP link. `/Users/asmasalleh/Downloads/eventops-workspace.zip` has 26 members, no CRC failure, no absolute or parent traversal path, 12 original files and zero manifest omissions. All 25 file SHA256 values in `manifest.json` match their downloaded members. The ZIP remains private and is not added to source control.

## Reproduced failure and repair

Before the fix, keyboard opening Move to trash and choosing Keep event removed the focused button, leaving focus on BODY. Opening Request account deletion had the same root cause: the focused trigger was unmounted without a focus destination. These are inline confirmations, not modal dialogs.

The minimal repair in `src/features/privacy/settings-form.tsx` records each confirmation trigger, focuses its explanatory paragraph when opened, and restores the correct event or account trigger when the confirmation closes. It does not change lifecycle requests, authorization, confirmation requirements or SQL behavior. Two parameterized regression cases initially failed, then passed with the repair. They cover prompt focus, Tab to confirmation, Tab to cancellation, Enter to cancel, restored trigger focus and **zero fetch calls**.

After rebuilding and restarting the local production app, the actual browser observed both sequences:

1. Move to trash, Enter: explanatory paragraph focused; Tab: Confirm move to trash; Tab: Keep event; Enter: Move to trash focused and confirmation absent.
2. Request account deletion, Enter: explanatory paragraph focused; Tab: Confirm account deletion; Tab: Keep account; Enter: Request account deletion focused and confirmation absent.

Neither final deletion/trash action was submitted. No account or original bytes were deleted. The original approved event remains active. The independent reviewer ran all five privacy control tests and approved the change with no findings; see the [privacy follow up](2026-11-03-t9-independent-review.md).

## Fresh validation and cleanup

`npm run check` exited 0: lint, formatting, generated route types, strict typecheck and **169 tests in 27 files**. `npm run build` exited 0, including standalone packaging. The focused privacy suite passed five tests. `git diff --check` passed. The rebuilt production server remains on port 3000 for the user, with model, voice, access and billing verification flags explicitly 0. No provider key was placed in the web process.

A final read only local SQL query returned analysis gate false, voice gate false, zero temporary browser worker roles and zero queued/running analysis jobs. The existing aggregate live journal remains **USD 0.768 reserved**, **USD 0.232 available**. This continuation made **zero live provider calls** and did not reset/refund reservations. Browser was returned to the approved event's briefing.

## Acceptance and remaining work

AC-03, AC-06, AC-08, AC-17, AC-23, AC-26, AC-27 and AC-28 have the additional scoped runtime observations above. Full conformance is not claimed for any criterion whose broader checks remain open. No missing screen or unapplied migration was established by this run. G3 improves but remains open; G4 and G5 remain open. Scope delivery stays in progress.

The remaining barriers cannot be replaced by more copies of these local checks:

- Full 30 cases times three real selected model runs, actual usage and independent semantic scoring. The controlled corpus runner has no live mode. A corpus live runner and sufficient expressly authorized aggregate allowance are still required; the remaining USD 0.232 cannot fund the approved full campaign under conservative reservations. Successful smoke calls already resolve the old blanket provider access blocker.
- Human VoiceOver acceptance and actual supported mobile/Safari device coverage. Prior VoiceOver attempts could not observe reliable spoken/caption output, so they remain attempts rather than passes. This continuation does not claim a human review, new Safari sign in or physical mobile tests.
- Hosted backup/object restore, independent deletion history reconciliation, monitoring and alert delivery, host rollback, operator notices and geographic controls. The [T8 runbook](2026-10-29-t8-runbook.md) retains these requirements. Deployment and paid provisioning remain outside authorization.

T10's local preparation may use the truthful synthetic demo evidence, but no T9 completion, deployment, publication, video or submission is certified here.
