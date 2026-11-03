# T9 authenticated browser verification, 3 November 2026

## Result and boundary

The synthetic authenticated text path now works through event setup, six CSV imports, initial approval, a real Meta clarification, organizer answer, real Meta proposal, explicit fact confirmation, keyboard approval, history, briefing, text export and six CSV exports. This closes the previously blocked browser sign-in continuation for this session. It is **not full T9 release acceptance**. The full 90-case real evaluation, complete human/device accessibility matrix and hosted operational gates remain open. T10 deployment/publication/submission has not started.

Read root guidance, living scope, approved delivery/verification contracts and prior T8/T9 evidence before continuing. All data below is synthetic. The user performed personal sign-in, attestation and terms actions. No deployment, paid provisioning, payment change, commit or push was performed.

## Local access repair

Local Auth delivers to Mailpit at `http://localhost:54324`, not Gmail. The native local Auth launcher had reverted to its default confirmation-link template, which omitted the six-digit code required by the application. Reapplied the existing documented setup with `scripts/local-supabase.mjs`, `SUPABASE_HOME=/private/tmp/eventops-supabase` and `LOCAL_TEMPLATE_ORIGIN=http://localhost:3000`. Both confirmation and magic-link templates then pointed to the application's `public/auth-code.html`. The user received a new code and completed verification. When the user reported the workspace still would not open, inspection showed the authenticated `/events` empty state already open. No bypass or agent acceptance of terms was used.

## Browser path actually exercised

Production build served on `http://localhost:3000`, Chrome on macOS. Created **Synthetic T9 browser verification**, event `156e37c8-aa0d-49ac-9eeb-f1ecf45817b5`, date 4 November 2026, Asia/Brunei, 09:00–17:00, Main hall and Side hall. Imported the six T10 CSV fixtures through the actual file chooser and mapping/review flow. Import `a984c5c4-e595-48d6-a950-b8e6242335d2` contained 2 rooms, 2 sessions, 2 volunteers, 2 availability rows, 2 assignments and 0 dependencies. Reviewed the included rows and confirmed the valid baseline as revision 1 (`0eaaf036-259b-45f3-a3c4-08a9798bb368`).

Saved and confirmed the exact text: “Move Opening to Room 2 from 12:00 to 13:00. Synthetic Alex cannot cover Opening; assign Synthetic Sam as the usher instead.” The first real analysis completed safely as unresolved, asking for Alex's exact unavailable interval. The official head stayed unchanged. Used the visible answer form to state Alex is unavailable 10:00–13:00 and Sam should usher Opening 12:00–13:00, then reviewed and confirmed the appended text generation. The second real analysis returned a ready option covering all three requests.

Reviewed before/proposed values and evidence, explicitly confirmed interpretation and new facts, then opened proposal `c0c6d868-6a68-4531-a798-cc805d8d5de8`. Approved it using the keyboard after the focus repair below. Revision 2 is `f42539bd-198a-4321-a187-d76fb7acaf22`, approved at `2026-11-03T11:51:10.359224+00:00`. Opening is in Room 2 from 12:00–13:00 with Sam; Workshop remains 10:00–11:00 with Sam. Alex's new 10:00–13:00 unavailable interval is retained alongside original availability.

History displayed both revisions and correctly labeled the 1→2 comparison historical. Restoration review showed the old candidate, newer draft/update context and explicit reconfirmation requirement; creation stayed disabled with the checkbox unset. Did not reconfirm the contradictory historical availability or create a restoration. The frozen source inspector opened the approved Opening `end` value of `13:00`, captured time, locator and source SHA256.

## Live evidence and cost controls

Only the two designated synthetic browser jobs were processed. `scripts/verify-browser-analysis.mjs` uses the normal restricted worker/provider adapter, a transaction fence that commits only the expected job claim, bounded context assertions and the existing USD 1 aggregate journal. It does not sign in, confirm organizer facts or approve a plan.

| Attempt | Job | Actual provider result |
|---|---|---|
| browser-live-01 | `6da53a20-948a-4d23-82d1-9cc7edac4070` | One HTTP 200 call, 14,161 ms, 3,870 input / 1,962 output tokens; completed unresolved, no option. Runner exit 1 records its unmet ready-option expectation, not an API denial. |
| browser-live-02 | `eefad011-00bc-4069-9cad-b2fda10e4bbd` | Two HTTP 200 calls, 18,464 and 4,739 ms; 4,747 aggregate input / 3,414 output tokens; ready for organizer confirmation. |

Request IDs respectively: `f3a9a9b9-0d4c-44de-82ca-2afef811473d`, `d66f41db-918f-4213-9758-ffddcd84139d`, `eb1e6537-5883-4517-9870-a27425ff798b`. SQL-recorded estimated costs were USD 0.013176 and USD 0.020443; conservative reservations remain USD 0.05 per call. Private attempt receipts are under `output/live-analysis-private/`; no secret is included here. The aggregate journal retains **USD 0.768**, leaving **USD 0.232** under the authorized ceiling. No reservation was refunded or allowance reset.

After execution, the production web application was restarted with live flags off. A final read-only local SQL check returned analysis gate false, voice gate false, zero temporary `eventops_browser_worker_*` roles and zero queued/running analysis jobs. No general live worker remains running. Live access was enabled only temporarily for the authorized probes.

## Export, print and responsive observations

Downloaded and read `eventops-revision-2.txt` and all six `eventops-revision-2-<collection>.csv` files through the authenticated browser. CSV row counts are rooms 2, sessions 2, volunteers 2, availability 3, assignments 2 and dependencies 0. Export metadata identifies approved revision 2; the Opening room/time and Sam assignment match the briefing. Chrome's multiple-file download prompt initially stalled the batch; allowing the localhost synthetic export batch resolved it. The initial automation timeout is not counted as a product failure or successful download.

The Print briefing button opened native Chrome print preview with two pages. Saved the output, copied it into `output/pdf/t9-browser-revision-2.pdf`, rendered both pages using macOS PDFKit (Poppler unavailable) and visually inspected them: readable, no clipped text or overlapping records, correct revision and approved schedule, no navigation/export controls. The save panel treated an absolute path entered in its name field as a literal filename; the initial copy remains at `/Users/asmasalleh/repos/NurturePath-AI/output/pdf/:private:tmp:eventops-t9-browser-revision-2.pdf`. No other file there was changed.

Briefing viewport checks at widths 320, 360, 390, 768 and 1280 pixels had document width equal to viewport width. The 320-pixel screenshot showed readable wrapped navigation and controls. Overrides were reset. Native Chrome zoom was then set to 200% (confirmed by the browser's zoom UI): the briefing had viewport/document widths of 735/735 CSS pixels, with readable wrapped text and no horizontal overflow. Restored 100%, confirmed by the browser UI. These observations do not certify actual mobile hardware, Safari or the full protected workflow at every width or zoom level.

## Failures fixed and regression evidence

The approval review initially dropped focus to BODY when its trigger disappeared. Review now focuses its confirmation heading; Back returns focus to Review approval. Browser verification proved Review→heading, Tab→Approve and Back→Review. Added a behavioral regression; the shared Button type accepts the existing React ref convention.

Independent review also found receipt overwrite risk, diagnostic response parsing changing failure behavior, stale manual-demo narration and a synthetic worker claim race. Fixed exclusive attempt receipts and atomic saves, bounded best-effort diagnostics, current narration and transaction rollback for unexpected **and null** claims. Seven focused evidence tests cover receipt collisions/symlinks, malformed/oversized responses and claim outcomes. See the [independent review](2026-11-03-t9-independent-review.md), including its final approval-focus follow-up: **Approve**, no open findings.

Fresh `npm run check` passed lint, formatting, generated route types, strict typing and **167 tests in 27 files**. Fresh `npm run build` passed, including standalone packaging. Independent targeted suites passed; `git diff --check` passed. Existing local load, maximum CSV, recovery and controlled corpus results remain historical evidence in the [T9 follow-up](2026-10-29-t9-followup.md), not freshly rerun results from this browser session.

## Remaining acceptance gaps and next step

- The approved full 90-case real provider evaluation and human scoring remain unexecuted. Three browser calls and earlier bounded text/voice smoke evidence do not establish corpus quality. The remaining USD 0.232 cannot fund the full campaign at its conservative reservation policy; do not bypass the aggregate ceiling.
- Complete human VoiceOver acceptance, actual supported mobile/device behavior, Safari and full protected-flow zoom/device matrix still require their own observations. DOM/keyboard/reflow checks are narrower evidence.
- Hosted schedules, independent deletion reconciliation, actual provider-object recovery, monitoring/rollback, geography and operator notices remain unverified. Local evidence cannot establish these; deployment/provisioning stays outside current authorization.
- T10 preparation exists under `docs/delivery/t10/`. The authenticated path now provides a truthful local demo, but full T9 acceptance, recording, accessible public links and authorized publication/submission are still required before claiming delivery complete.

Recommended order: complete remaining zero-cost protected-flow accessibility/device checks, obtain actual human accessibility acceptance, then run the full evaluated campaign only within an expressly sufficient allowance and complete authorized hosted operational gates. Preserve the current synthetic event for review and rehearsal.
