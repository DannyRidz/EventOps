# T9 browser followup, 29 October 2026

Reporting timezone: Asia/Brunei. This records local synthetic browser observations only.

## Result

Later results in the [final continuation record](2026-10-29-t9-followup.md) supersede the pending local recording, empty state, print, sign out and public zoom observations at the end of this earlier browser pass.

The real production application on loopback port 3005 now has additional browser evidence for setup failure recovery, saved draft reload, CSV diagnostics, explicit duplicate decisions, saved correction resumption, whole plan review and separate revision 1 approval. This is not full release acceptance. Provider calls, deployment, physical devices, native Safari and screen reader verification were not performed.

## Authentication finding and boundary

The initial synthetic email code browser flow requested a locally captured code and showed a disabled resend countdown. An invalid code returned HTTP 400 and the visible invalid or expired code error. The subsequent correct code returned HTTP 200 but the browser stayed on sign in, reusing the earlier unauthenticated protected route navigation. This was a real browser navigation defect, not an absent session: nonsecret cookie metadata showed the session cookie existed, and a full protected load eventually opened the workspace. The main agent owns the fix and its tests.

The attempt to repeat the complete sign in flow on the rebuilt application was rejected by automatic approval review because the script checked the local attestation/terms checkbox, conflicting with the user's instruction not to accept terms. The rejection explicitly forbade an indirect workaround. No retry or bypass of that rejected flow was performed. Browser revalidation of the sign in fix therefore remains blocked. Existing synthetic sessions were used only for unaffected event and import checks.

Evidence: `/private/tmp/eventops-t9-more-auth.log`, `auth-retry.log`, `requests.log` and `session-diagnostic.log`, each with the same `eventops-t9-more-` prefix. The request ledger shows code request 200, invalid verification 400, correct verification 200 and the missing successful protected navigation. The session diagnostic logs cookie names and flags, never values. No externally delivered mail or provider agreement was used.

## Setup and CSV journey

Ran the Playwright CLI in dedicated session `t9-more` against the real production app, using existing synthetic authentication. The scratch scripts are `/private/tmp/eventops-t9-more-setup.js` and `eventops-t9-more-correct.js`. No test authentication bypass or application mock route was introduced. A browser route abort was used only for one deliberate setup network failure, then removed before retry.

| Step | Actual observation | Evidence |
|---|---|---|
| Save setup while request fails | Visible `Failed to fetch` error and Reload saved data link. Entered name remains `Synthetic T9 browser journey` | `setup-final.log` |
| Retry setup save | Real server save succeeds; reloading the event preserves its name and setup | `setup-final.log` |
| Upload duplicate rooms and invalid schedule reference | Error names `rooms.csv`, row 3, `room_id`, and requires Keep one or correction/exclusion. Schedule error names `sessions.csv`, row 2, `room_id`, value BAD | `setup-final.log`, `output/playwright/t9-more-import-errors.png` |
| Explicit duplicate decision | Keep one is deliberately selected. No automatic merge is used | `correct.log` command |
| Correct reference and save | BAD becomes R1; saved import version 2 is observed | `correct.log` command |
| Refresh acknowledged corrections | Saved import version 2 remains; R1 is read back and no Keep one decision remains pending | `correct.log` command |
| Stage whole plan | Organizer confirms mappings, rows, duplicate decisions and defaults, then moves to starting plan review | `correct.log` command |
| Separate starting plan approval | Organizer confirms revision 1. The app opens the approved briefing, with one unique room R1, session S1 in Main hall, and no invented volunteers | `import-final.log`, `output/playwright/t9-more-import-approved.png` |

All logs in the table are under `/private/tmp/eventops-t9-more-`. The created synthetic event is `dd06863a-8cee-403f-85a8-943d78d29694`.

The correction script initially expected approval to navigate to `/plan`; the application correctly navigated to `/briefing`. That final URL expectation timed out after all correction and approval steps had executed. A separate explicit check then observed heading Event briefing, Approved revision 1 and the saved imported records. This is a harness expectation correction, not a product failure. Earlier scratch locators also failed because they excluded the visible Required suffix; they were corrected without application changes.

## Outstanding observations

The dedicated browser was closed to free memory for the main agent's isolated CSV maximum test. The host was under severe memory and disk pressure. Only this verification browser was closed; unrelated browsers and applications were left alone.

The 200 percent content reflow check, local synthetic MediaRecorder capture and denial, empty event list capture, full print pagination and final sign out navigation remain pending in this followup. The earlier T9 record retains its already completed axe, five viewport widths, blocked conflict and keyboard approval observations. Native Safari, physical mobile and microphone behavior, VoiceOver/NVDA and true browser zoom remain unverified. No pass is inferred from source inspection or from planned scratch steps that were not reached.
