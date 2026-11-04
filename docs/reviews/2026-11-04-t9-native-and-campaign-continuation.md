# T9 campaign, native accessibility and recovery continuation

Date: 4 November 2026, Asia/Brunei. Full T9 remains in progress.

## Outcome by requested order

1. Built and reviewed a guarded **collection component**, a 90-slot preparation plan and a [budget proposal](../../evals/t9/LIVE-CAMPAIGN.md). Offline rehearsal passed through the normal text worker and four audio worker jobs. Full case workflow drivers, cumulative scheduling and independent semantic acceptance remain open; this is not a completed 90-case release evaluator.
2. Reattempted native VoiceOver on the authenticated proposal page at the user's explicit request. Keyboard focus and cancellation were directly observed with VoiceOver enabled. Spoken/caption output remained unobservable, so full screen reader acceptance stays unverified. Protected Safari was interrupted by user navigation; no physical mobile result is claimed.
3. Inspected configuration and ran fresh local encrypted recovery. The drill passes after correcting a single-revision test assumption. Hosted execution is blocked because no EventOps hosted target is configured; see the [hosted readiness record](2026-11-04-t9-hosted-readiness.md).

The initial working tree contained the unfinished collector changes from the interrupted turn; all were preserved and completed within the collection scope. No terms, payment, paid resource, live provider request, deployment, publication, commit or push occurred.

## Collector results and review

`node scripts/run-t9-live-evaluation.mjs --prepare` passes, prepares 30 cases times three repeats and reports maximum new reservations of USD 13.266. The existing journal is intact at USD 0.768 retained and USD 0.232 available under its unchanged USD 1 limit. Full execution fails its budget preflight before database/provider access. This document does not grant a higher allowance.

The controlled rehearsal receipt is private:
`output/t9-live-rehearsal-private/rehearsal-9ba42ed4-c7ff-4dcd-bc3c-21d96817ac0f/rehearsal-9ba42ed4-c7ff-4dcd-bc3c-21d96817ac0f-receipt.json`.
It records E02 text and all four E28 audio files, zero live provider calls, empty cleanup errors and `acceptance: not_evaluated`. The first attempt failed because the old temporary T8 export was absent, before any case or request. The successful attempt explicitly used the existing private synthetic workspace export as its isolated profile input.

Independent review found and closed a missing per-case input hash check and missing actual entry preflight tests. The new child-process tests use synthetic journals and database/fetch traps. They prove missing approval, missing provider verification, missing voice verification and insufficient allowance reject before database/network I/O or execution receipt creation. An eligible E02/repeat-1 selection reaches only the controlled database trap. Eighteen targeted tests pass. [Review verdict: Approve](2026-11-04-t9-campaign-review.md).

The collector intentionally leaves workflow and semantic review null and never performs organizer confirmation or approval. The review and campaign document list all unexecuted case-specific faults, lifecycle steps and scoring requirements. Temporary fixture teardown does not establish cumulative SQL rate history across separate invocations. No prepared slot or controlled response was promoted to a live evaluation result.

## Authenticated native attempt

Used Chrome task tab `700351700` and the user's existing local session. The initial attempt to save a synthetic manual candidate exposed the missing runtime APP_URL problem described in the hosted readiness record. The server was restarted through the repaired npm start command with model, voice, access and billing flags all explicitly 0. The preserved browser form then saved successfully without a new sign in or legal acceptance.

Created pending proposal `0d253314-f20c-4cdc-90bc-1d24e6f18c3b`, generation 1, against approved revision 2 of event `156e37c8-aa0d-49ac-9eeb-f1ecf45817b5`. Its only change is synthetic Room 2 capacity 40 to 41, with a reason naming it as a human accessibility fixture. Plan checks pass. It remains **unapproved**, and current revision 2 is unchanged. The review page is retained for further inspection:
`http://localhost:3000/events/156e37c8-aa0d-49ac-9eeb-f1ecf45817b5/proposals/0d253314-f20c-4cdc-90bc-1d24e6f18c3b`.

After being asked to supply human observations, the user asked the agent to perform the test. System Settings explicitly showed VoiceOver **off** initially. VoiceOver Utility showed caption panel enabled, welcome dialog enabled and AppleScript control disabled. No utility preference was changed. Enabled VoiceOver through its normal Settings switch and read **on**.

Raised the Chrome task window and attempted normal VoiceOver next-item and web-interaction commands. Neither Chrome's accessibility state nor screenshots exposed caption output or an observable spoken announcement. No usable VoiceOver caption application surface appeared in the app inventory. This is a tool observation limit, not a verified speech-quality result or proof of an EventOps screen reader defect.

With VoiceOver still enabled, opened Review approval using the native Chrome accessibility button. Native state directly showed:

| Action | Observed focus |
|---|---|
| Open Review approval | Confirm approval heading |
| Native Tab | Approve revision 3 button |
| Native Tab | Back to proposal button |
| Native Return | Review approval button on the original proposal |

The approval button was not activated. The visible review showed the 40 to 41 comparison, evidence link and explicit save warning. This supports keyboard/focus behavior with VoiceOver on; it does not establish that the heading, values, warnings or errors were correctly spoken across the full workflow.

Restored VoiceOver through Settings and explicitly read **off**. A stale accessibility element ID was rejected during restoration; a fresh observed switch ID was used successfully. Returned the utility to its original General panel, with AppleScript still off. Closed only the task-launched utility and Settings. Final inventory shows System Settings not running and no VoiceOver Utility entry. The task Chrome page remains available; user applications and tabs were preserved.

Safari had no task-specific protected EventOps page observed. A native attempt to open the local workspace was interrupted by user navigation, after which the active page was unrelated. Stopped interacting with it. No Safari protected-flow pass, login, attestation, terms action or physical mobile test is claimed.

## Fresh validation

- `npm run check`: exit 0, lint, formatting, generated route types, strict typecheck and **180 tests in 29 files**.
- `npm run build`: exit 0, including standalone packaging.
- `node scripts/prepare-t9-evaluation.mjs --self-test`: 30 cases, 15 constraint probes, four DST variants and six corrupt-corpus rejections, zero provider calls.
- Recovery drill after its fixture repair: exit 0, exact history/owner isolation, encrypted restore and post-backup deletion replay; 2.59 seconds locally.
- `git diff --check`: passes.
- Final local health/readiness: both HTTP 200 and status ok.
- Final SQL check: analysis false, voice false, zero collector worker roles, zero evaluation/backup/restore drill databases and zero queued/running analysis jobs.

The full live evaluation, human spoken screen reader acceptance, supported physical mobile/Safari matrix and hosted operations remain open. The scope delivery checkbox remains unticked. No full T9 or T10 completion follows from this work.
