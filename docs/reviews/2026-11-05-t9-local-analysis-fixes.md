# T9 local analysis and diagnostic fixes

5 November 2026, Asia/Brunei. The requested local fixes are implemented and verified with controlled responses. No live API request, paid resource, deployment, external message, commit or push occurred. Existing staged review, scope and campaign notes were preserved.

## Root causes and corrections

The deterministic option finder returned immediately whenever the interpreter asked a question. It therefore never checked the extracted changes for known room collisions, missing capacity or replacement availability. The initial regression run reproduced three missing feedback failures and two diagnostic failures.

The option finder now evaluates extracted changes locally even when clarification is pending. Feedback names affected records and the relevant local interval. Every candidate derived message is labeled as conditional on a numbered checked choice. Original recorded unavailability is distinguished from newly proposed unavailability. A valid alternate time prevents a rejected time choice being shown as a blocker. Contradictory requests still stop before candidate application. All options remain hidden while any question or unsupported request is unresolved. Both early and normal returns explicitly warn about question overflow rather than silently presenting a truncated list as complete.

The interpretation policy previously required questions for missing reasons and timing flexibility without distinguishing a feasible explicit change from a blocked request needing alternatives. Prompt v2 now asks only for information needed to resolve the request, treats explicit room/time/replacement details as proposed changes rather than conflicting record identities, and does not turn an assignment replacement into an invented unavailability record. It also instructs the model to ask for resolution of recorded unavailability rather than permission to ignore it. These are policy corrections, not evidence that the live model now consistently follows them. Model questions are never silently discarded to force readiness.

The new additive migration introduces `eventops_worker_api.claim(text)`. The worker declares `PROMPT_VERSION` in its claim. The function validates that version and annotates the claimed reserved attempt under the same transaction and lease. Missing reservations roll back the claim. Legacy `claim()` and its v1 default remain unchanged, so mixed worker versions and historical rows are not relabeled by a global default change. Owner and public roles cannot execute the new overload. The local application has this migration applied; both local provider gates remain false.

The diagnostic helper previously assumed every successful response used chat choices, incorrectly reporting zero content length for speech transcripts. It now recognizes a transcription response, records only its length and whether usage is present, and distinguishes unknown content from an empty transcript. It neither logs the transcript nor invents request IDs, usage or billing. Existing speech records missing metadata remain unchanged.

## Actual verification

* `npm run check`: passes lint, formatting, generated route types, strict TypeScript and **216 tests across 36 files**. Fifteen tests were added beyond the prior 201. A test helper initially needed its return type narrowed; that was corrected before the passing run.
* `npm run build`: passes production compilation and standalone packaging with Node 24.15.0.
* `node scripts/verify-t9-prompt-version.mjs`: passes against a uniquely named isolated database with provider fetch rejected. Covers legacy v1 and explicit v2, unchanged historical rows, owner denial, unsupported version rejection, rollback when a reservation is absent, and actual restricted worker stage/finish persistence of conflict plus clarification. The result stays unresolved with no options; the official head is unchanged. One injected model response is controlled, with zero provider calls.
* `node scripts/verify-t9-workflows.mjs`: exercises all 30 controlled case workflows. The runner records 29 as controlled steps passed and E28 as requiring its separate collected transcript path. Receipt: `output/t9-workflow-private/run-iPc6ss/receipt.json`, state `controlled_steps_with_gaps`, zero live calls, acceptance not evaluated. It is not a replacement for live quality or physical microphone verification.
* `node scripts/verify-t3-migrations.mjs` with matching PostgreSQL 17 tools: all **43 migrations** apply from empty managed schema fixtures. Its temporary database is removed afterward.
* Local migration check: new claim overload exists, owner execution denied, model run history digest unchanged, analysis gate false and voice gate false. No user plan or original live campaign database was altered by this migration application.
* Historical live campaign guard: `--prepare` refuses the changed `orchestrate.ts` source hash before database or provider access. Gate tests use only a disposable current source fixture; the original corpus, allowance journal, state anchor and receipts are not repinned or reset.
* Fresh review found and closed two initial major findings about hypothetical facts and version provenance, plus an overflow issue. The separate reviewer found no remaining concrete blocker or major in the corrected implementation. The reviewer did not independently rerun the full reported suites or assess live model quality.
* `git diff --check` passes. Saved review receipt hashes are checked against the preceding assessment.

Private verification logs are retained under `output/t9-local-fixes-2026-11-05/`. Local disk pressure initially prevented source writes. Only generated `.next/dev/cache` was removed to recover space. Source, staged changes, original recordings and saved verification evidence were preserved.

## Version and release boundary

The 24 collected v1 slots remain evidence for v1 only. No quality score was changed, no v2 live run was collected, and the no spending instruction remains active. A later authorized evaluation needs reviewed v2 inputs and its own durable version identity while retaining all prior reservations; it must not reset the old campaign to bypass budget history. The current retained v1 campaign intentionally refuses source or migration drift.

This fixes the requested local behavior and diagnostics. It does not supply human acoustic or VoiceOver observations, physical device acceptance, container execution or hosted operations. General AI processing remains disabled. The submitted repository head, video and entry were not changed by this work, and no full release acceptance status was assigned.
