# T9 release verification, 29 October 2026

Date and reporting timezone: Asia/Brunei.

## Verdict

Followup: [local failure resolution and final results](2026-10-29-t9-followup.md) supersede the initial maximum CSV failure below. The original run remains as historical evidence. Full T9 and public release remain incomplete.

Release verification is incomplete. Public release remains blocked. The local regression pass exercises real Auth, PostgreSQL, private Storage and the production application with synthetic records and controlled provider responses. The maximum CSV collection case fails with a database statement timeout. No live AI evaluation was run, and no production readiness claim follows from the passing local checks.

The working tree was clean at entry. Existing local records and services were preserved. No reset, terms acceptance, payment details, paid provisioning, deployment, publication, commit or push occurred. Provider spend is USD 0. All web provider flags were explicitly disabled; both database provider gates were checked disabled at the end of the smoke harness. Controlled worker suites temporarily enable only their synthetic test prerequisites and restore them.

## Actual command evidence

Private command logs are in `/private/tmp/eventops-t9-*.log`. They are local evidence, not portable public artifacts. Browser captures and sanitized results are in ignored `output/playwright/`. No cookies, captured codes, status credentials or private response bodies are included in this report.

| Check | Actual result | Local evidence |
|---|---|---|
| `nvm use`, `npm run check` | Node 24.15.0, lint, formatting, route types, strict types, 26 files and 156 tests pass, including final rerun | `check.log`, `final-check.log` |
| `npm run build` | Production build and standalone packaging pass | `build.log` |
| `node scripts/verify-t3-migrations.mjs` | All 40 migrations apply in an isolated temporary database, including final rehearsal | `migrations.log`, `final-migrations.log` |
| `T2_APP_URL=http://localhost:3005 node scripts/verify-t2.mjs` | 19 real local service checks pass | `t2.log` |
| `T3_APP_URL=http://localhost:3005 node scripts/verify-t3.mjs` | Integrity, concurrent approval, replay, isolation, rollback and 22 SQL/TypeScript parity fixtures pass | `t3.log` |
| `T4_APP_URL=http://localhost:3005 node scripts/verify-t4.mjs` | 12 manual editor, text, evidence, approval and briefing groups pass | `t4.log` |
| `T4_WORKER_APP_URL=http://localhost:3005 node scripts/verify-t4-worker.mjs` | 16 controlled worker groups pass, including lease, budget and stale result boundaries | `t4-worker.log` |
| `T5_APP_URL=http://localhost:3005 T5_BOUNDARIES=1 node scripts/verify-t5.mjs` | Ordinary import, correction, isolation and rollback groups pass. Maximum staging fails HTTP 503, database statement timeout | `t5.log`, `t5-retry.log`, `t5-fixed.log` |
| `T7_APP_URL=http://localhost:3005 node scripts/verify-t7.mjs` | First run times out during interpreted option adoption. Serial retry passes all 15 groups | `t7.log`, `t7-retry.log` |
| `T8_APP_URL=http://localhost:3005 node scripts/verify-t8.mjs` | 16 privacy, export, cleanup, expiry, Auth purge and rollback groups pass | `t8.log` |
| `T6_APP_URL=http://localhost:3005 EVENTOPS_FFMPEG_PATH=/Applications/Stremio.app/Contents/MacOS/ffmpeg node scripts/verify-t6.mjs` | Final run passes 15 groups with real Opus/AAC conversion and controlled transcription | `t6.log`, `t6-fixed.log`, `t6-final.log` |
| Matching PostgreSQL 17 `T8_PG_DUMP=... node scripts/verify-t8-recovery.mjs` | Encrypted isolated restore and post backup deletion replay pass, 9.58 seconds, 517267 encrypted bytes | `recovery.log` |
| `T9_APP_URL=http://localhost:3005 node scripts/verify-t9.mjs` | Readiness, private denial, production internal route denial and 100 authenticated approved plan reads pass at concurrency 5 | `load.log` |

The first bounded read measurement took 22519 ms, with p50 605 ms, p95 3037 ms and maximum 8209 ms. A final run after the harness cleanup fix passed in 17361 ms, with p50 699 ms, p95 1537 ms and maximum 1959 ms (`load-final.log`). Both database gates were disabled. These are observations on this resource constrained host, not a passed production performance target. No write load or model latency is inferred.

## Failures and corrections

The first harness launch used an APP_URL different from the isolated port and correctly received HTTP 403. Restarting with `APP_URL=http://localhost:3005` resolved that configuration error. Sandbox loopback denial was resolved by authorized local execution.

The maximum CSV staging case failed repeatedly at `scripts/verify-t5.mjs` line 722. PostgreSQL logs report statement timeout inside `stage_import_plan`, including frozen source capture. An additive SQL experiment expanded the provenance map once, but the maximum case still timed out. The experiment was removed and the original function restored. No migration or higher timeout is retained. The local migration CLI also found existing T8 columns absent from its migration ledger, so no reset or history rewrite was attempted. Empty database rehearsal passes; the existing local migration ledger discrepancy is an operational gap to reconcile deliberately.

The host reported only about 287 to 1600 MiB free during this run. The independent reviewer encountered transient ENOSPC creating a temporary directory, then passed on retry. This may contribute to timing variability but does not prove the CSV failure is environmental. The maximum supported size remains a failing release check until it passes unchanged limits on an adequately resourced environment or a proven implementation fix. No preexisting files were deleted to obtain a pass.

T6 contained two pre T8 assertions requiring synchronous owner physical deletion. T8 immediately fences expired owner Storage SELECT, which also prevents Storage DELETE from selecting those bytes. The harness now proves immediate due status and HTTP 410 before independent cleanup, then requires the physical deletion receipt afterward. Discard likewise checks immediate denial followed by restricted cleanup. No product policy was relaxed. The final complete T6 suite passes.

## Browser evidence

Chromium drove the actual standalone app at `http://localhost:3005` using synthetic fixture sessions obtained through the real local Auth service. No authentication bypass was introduced. Ten authenticated screens were loaded: event list, event creation, approved plan, manual records, updates, proposal review, frozen evidence, history, briefing and privacy settings. Their rendered headings were checked. Each passed axe WCAG A/AA/2.1 AA rules with zero reported violations and document width equal to viewport at 320, 360, 390, 768 and 1280 CSS pixels. Results are in `output/playwright/t9-browser-results.json`; each route has a `t9-*.png` capture. The mobile approved plan screenshot was visually inspected and was readable without clipped content.

Keyboard input edited a synthetic room name, entered a reason, confirmed exact facts and created a ready proposal through the real UI. Enter opened its explicit approval confirmation. The proposal subsequently showed “Status: approved” and “Changes saved as revision 3”, recorded in `approved-state.log`. Its selected saved revision briefing rendered “Approved revision 3” and the changed room name. `print-final.log`, `output/playwright/t9-briefing.pdf` and the visually inspected `t9-print.png` record that print surface. This is a partial keyboard journey, not a full keyboard or screen reader certification. The initial print capture raced navigation and showed revision 2; it was replaced only after explicitly waiting for the selected revision 3 heading. Full size print pagination remains unverified.

A further real browser edit introduced a session collision. The resulting candidate showed infeasible status with COVERAGE, ROOM_OVERLAP and DEPENDENCY errors, a disabled Review approval button, zero axe violations and 320/320 document/viewport width. `conflict.log`, `conflict-disabled.log` and `output/playwright/t9-conflict.png` record this blocked state. No invalid approval was attempted.

Full browser sign in/resend/expiry, import correction interactions, empty list, 200 percent zoom, full size print pagination, browser voice capture, native Safari, physical microphones, mobile hardware, VoiceOver/NVDA and complete keyboard focus restoration remain unverified in this pass. API and component tests cover portions of these behaviors, but do not substitute for the required device/browser observations.

## Acceptance matrix

“Local evidence” means the listed synthetic checks passed for that portion. It does not declare an entire release criterion met when its browser, provider or deployed requirements remain open.

| Criterion | T9 observation and remaining boundary |
|---|---|
| AC-01 | Local Auth, resend limits, expiry, sign out and isolation pass in T2. Full browser session recovery remains open |
| AC-02 | T2 through T8 owner, anonymous, worker, Storage, history and export denial checks pass locally. Deployed isolation remains open |
| AC-03 | T2/T3 local setup, interval and timezone parity checks pass |
| AC-04 | FAIL, maximum CSV staging times out despite ordinary limit and validation checks passing |
| AC-05 | CSV malformed/oversized and T6 real codec/disguised input checks pass locally |
| AC-06 | Saved mappings, duplicates, corrections and fencing pass ordinary T5 cases. Maximum staging and browser correction journey remain open |
| AC-07 | Manual six collection confirmation passes. Maximum imported plan cannot complete this run |
| AC-08 | Frozen source, immutable corrections, snapshots and history checks pass locally |
| AC-09 | Saved text, exact confirmation and immutable original distinction pass locally |
| AC-10 | Real conversion and controlled transcript review pass. Native recording, permission and physical device matrix remain open |
| AC-11 | Deterministic impact and controlled interpretation checks pass. Live semantic evaluation remains open |
| AC-12 | T3 parity and whole plan database checks pass locally; maximum imported path remains failing |
| AC-13 | Availability, role, overlap and cancellation checks pass local deterministic suites. Live evaluation remains open |
| AC-14 | Missing facts, controlled questions and saved answers pass locally. Live ambiguity evaluation remains open |
| AC-15 | Controlled request coverage and explicit withdrawal checks pass T4/T7. Live model quality remains open |
| AC-16 | Bad evidence and unknown source rejection pass local suites. No live evaluation claim |
| AC-17 | Candidate edits, rejection, resumption and generation checks pass T7 and component checks |
| AC-18 | Real transactional approval, late rollback and receipts pass T3/T4/T7 |
| AC-19 | Stale head, generation and restoration context conflicts pass locally |
| AC-20 | Concurrent approvals and immutable lost acknowledgement receipts pass T3/T4 |
| AC-21 | Saved jobs/questions, lease recovery and late generation fences pass controlled suites |
| AC-22 | Reviewed restoration, later unavailability and context fences pass final T7 run |
| AC-23 | Approved revision text/CSV and deterministic briefing pass T4/T7. Full print pagination remains open |
| AC-24 | Controlled failures, lease restart and preserved drafts pass T4 worker/T6/T8. Actual provider outage remains untested |
| AC-25 | Local hostile input, evidence validation, restricted worker and no model commit checks pass. 90 live adversarial runs remain blocked |
| AC-26 | Local lifecycle, expiry, private ZIP, purge and deletion replay pass T8. Complete independent request history and hosted object restore remain open |
| AC-27 | Ten real screens and component states checked. Conflict errors and disabled approval also observed. Full screen/state/device/browser inventory remains open |
| AC-28 | Ten screen axe and five width checks pass. Full manual accessibility target remains unverified |
| AC-29 | Local budgets, quotas and disabled access gates pass. Actual deployment geography, notices and provider billing bounds remain blocked |
| AC-30 | Empty migration rehearsal and encrypted synthetic recovery pass. Hosted monitoring, actual object restoration, rollback, RPO and RTO remain open |
| AC-31 | Fresh scoped code review found no new unsupported customer claim. Complete copy/export audit and all visual states are not certified |
| AC-32 | T10 excluded by explicit instruction. No deployment, publication or submission performed |

## Release gates and handoff

G0 remains partial because provider authority, account access and geography prerequisites are unresolved. G1 remains blocked by live Meta interpretation. G2 is locally exercised but cannot close the deployed privacy and full supported size boundaries. G3 remains incomplete for devices, accessibility and all browser states. G4 remains blocked by hosted recovery, deletion history reconciliation, monitoring and rollback. G5 remains blocked, zero of the required 90 selected model runs were executed. G6 is not authorized.

The 30 named E01 to E30 cases in the approved verification contract remain the live evaluation ledger. Controlled tests are not counted as model runs or substituted for semantic usefulness, human review, billing or latency measurements.

The [fresh review](2026-10-29-t9-review.md) records independent scoped inspection and focused test results. Same model family independence is not guaranteed. The [T8 runbook](2026-10-29-t8-runbook.md) remains authoritative for isolated recovery and mandatory deletion request reconciliation before restored access.

Recommended next local work is to reproduce and profile maximum CSV staging with adequate disk capacity, without weakening limits, policy, evidence or atomicity. Then complete the listed browser/device/accessibility/print observations. Live provider evaluation and hosted operational checks remain separately gated; keep AI disabled. T9 and release scope stay in progress. No acceptance box is marked complete by this report.

Only the T9 browser session and the app started for this run on port 3005 were stopped. Preexisting servers and local Supabase were left running. Scope status is in progress; no acceptance completion box was ticked. The approved verification and delivery contracts were not rewritten. Their older milestone prose remains historical and should not override this evidence.
