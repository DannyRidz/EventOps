# Review, main, 2026-11-03

**Reviewed by**: Separate AI review agent (the implementation author's model identity was not supplied)
**Scope**: 30 changed files, `cad6f1c..7ad4ca861019f477d5b9fd2c24109c391e9b7cb3`, plus eleven follow-up uncommitted files and relevant unchanged worker, allowance and SQL approval/access boundaries
**Verdict**: Approve following the resolution review below (original verdict: Approve with nits)

## Summary

The production change raises the analysis header wait to the existing 35 second request bound and explicitly selects minimal reasoning, while preserving the fixed endpoint/model, token limit, three call ceiling and overall deadline. The synthetic live harness uses restricted worker functions, a durable aggregate reservation journal and separate owner confirmation/approval transactions. No blocker or major regression was found; the remaining findings concern evidence preservation, diagnostic interference and stale rehearsal narration. This code review does not establish full T9 release acceptance or T10 completion.

## Minor

### 🟡 Preserve an existing attempt receipt when rejecting replay, `scripts/verify-live-analysis.mjs:427`

**Problem**: Every save truncates `${attempt}-receipt.json`, and the runner never claims that receipt path exclusively before starting. Reusing an attempt label overwrites its earlier evidence even when the campaign journal rejects the duplicate provider call. Controlled and live runs have separate journals but share this receipt path; text and voice share it as well.

**Why it matters**: The budget journal preserves amounts but not transcripts, provider request IDs, usage or approval results. A rejected rerun or an ordinary controlled/live label collision can erase the evidence needed to explain earlier spend and the claimed successful workflow.

**Suggested fix**: Claim an attempt identity exclusively before running and reject duplicates without writing the original receipt. Include mode/kind in the identity or deliberately require globally unique labels. Use atomic progress writes for the newly claimed attempt, and cover duplicate, controlled/live and text/voice collisions without provider access.

### 🟡 Keep response diagnostics from changing adapter retry behavior, `scripts/verify-live-analysis.mjs:256`

**Problem**: The guarded fetch parses a successful response clone as JSON before returning the original response to `createMetaTransport`. A malformed HTTP 200 body throws here, so the adapter sees a fetch rejection and may issue up to three charged network retries. Without this wrapper it reads the response and returns `PROVIDER_SHAPE` after one call. The clone reads also consume the full body before the adapter's 128 KB response cap runs; the error-body clone at line 267 has the same unbounded read pattern.

**Why it matters**: The harness described as the normal adapter path changes failure classification, call count and spend for malformed responses, and diagnostics bypass the adapter's memory bound. This does not weaken the production adapter or bypass the USD 1 journal, but it reduces the fidelity of the live verification.

**Suggested fix**: Make bounded diagnostic capture best effort and return the original HTTP response regardless of diagnostic parse failure. Prefer collecting validated metadata at the adapter boundary. Add controlled malformed/oversized response checks that prove classification and call count match the unwrapped adapter.

### 🟡 Update the manual script's obsolete access explanation, `docs/delivery/t10/demo-current.md:59`

**Problem**: The script still instructs the speaker to say real evaluation is blocked by account access. The new live evidence and the delivery README explicitly supersede that historical inference with successful bounded text and voice calls.

**Why it matters**: This remains the linked current manual rehearsal, so following its narration would give an inaccurate explanation of the outstanding evaluation work and contradict the accompanying submission draft.

**Suggested fix**: State that this take demonstrates the manual path, bounded synthetic live smoke tests have separate evidence, and the full evaluation remains unexecuted. Retain the device, accessibility and production limitations.

## Strengths

- The regression test proves that an eleven second response now succeeds; request assertions preserve strict schema, fixed model, token cap, disabled provider storage and absence of tools.
- The campaign guard reserves before I/O, retains uncertain charges, rejects changed allowance/reused keys and fails closed on stale locks or malformed journals. Its concurrency/restart tests passed independently.
- The live text probe verifies that the official head is unchanged before confirmation/approval, checks the expected room/time/assignee, and verifies approval replay. Existing SQL still recomputes typed requests, the complete candidate and evidence within owner-scoped transactions; worker grants remain separate.
- The voice evidence retains the failed legacy clip outcome and distinguishes fixture Storage deletion from actual hosted HTTP/JWT and physical-device verification. The corpus still records zero executed live evaluation runs.

## Test coverage

Fresh offline checks on Node 24.15.0:

- `npm test -- src/features/analysis/analysis.test.ts`: 26 tests passed in one file.
- `node scripts/verify-t9-allowance.mjs`: concurrency, replay, changed payload/limit, restart, uncertain completion, stale lock, truncation and hash-chain checks passed; no provider calls.
- `node scripts/prepare-t9-evaluation.mjs --self-test`: six corrupt-corpus checks rejected; 30 cases remain prepared offline with zero live runs/provider calls.
- Independent byte/hash verification passed for all ten delivery fixture manifest entries and the Samantha audio fixture. This is not an audio-quality observation.

The production change has meaningful regression coverage. The harness records controlled access-denial and voice success checks, but the receipt collision and malformed-response diagnostic cases above need focused controlled regression coverage. The full application check/build and SQL/browser acceptance suites were not rerun by this reviewer; their historical results were read as scoped evidence, not counted as fresh passes.

## Scope limits

Read root and voice guidance, the text-worker specification, all changed textual artifacts, fixture manifests, and the relevant unchanged provider/worker, allowance and SQL confirmation/approval/access implementations. The binary audio was checked against its manifest, not listened to. No private environment/secret files or private live receipts were read, no live requests or sign-in/terms actions were performed, and no external services were changed. Therefore the live-call and restoration narratives were assessed for consistency with code and committed evidence, not independently reproduced. No deployment, recording, publication, commit or push was performed. This verdict applies to the reviewed code range; remaining full live evaluation, protected/device/accessibility and hosted operational gates stay open.

## Follow-up review, uncommitted evidence fixes and browser verifier

Reviewed the uncommitted `scripts/lib/live-evidence.mjs`, its Vitest tests, both existing live-harness callers, revised manual narration, and new `scripts/verify-browser-analysis.mjs`. The three original minor findings above are resolved: receipt creation rejects all duplicate labels before work, progress writes use private temporary files and atomic replacement, response diagnostics are bounded and best effort, and narration accurately distinguishes separate live smoke evidence from this manual take. The original findings are retained as review history.

The browser verifier verifies the loopback database, explicit test gates, the exact designated event/job/update and expected volunteer names, then checks the frozen provider context before external I/O. It uses the existing USD 1 journal with USD 0.05 per request and the adapter's three-call ceiling. It does not approve a result or perform a sign-in. No live request was made by this reviewer.

An initial major was reported immediately: checking active job IDs before calling the global `claim()` was not atomic, so a different newly queued job could be claimed and failed even though provider-context assertions prevented its transmission. The added transaction fence now rolls back a returned unexpected job before `runOne` can process it. One related edge remained at the time of this follow-up:

### 🟠 Roll back null claims in the one-job fence, `scripts/lib/live-evidence.mjs:16`

**Problem**: The fence commits when `claim()` returns null. That SQL function can update a stale job or abandon/finish an expired attempt and then return null. An unrelated job queued between the active-ID check and `claim()` can therefore still be changed, even though no job payload reaches the JavaScript identity check.

**Why it matters**: This verifier temporarily enables the real local database gate under authorization for one synthetic job. It must not commit state transitions for another job merely because the claim function did not return a payload.

**Suggested fix**: Roll back a null claim as well, returning the null result so the bounded polling loop can continue. Only commit a non-null claim whose ID exactly matches the designated job. Add a controlled null-result rollback regression test.

**Follow-up verdict at this checkpoint**: Changes requested for the null-claim fence edge; the three original minor findings are closed.

Fresh targeted checks passed 32 tests in two files (26 analysis tests plus six evidence/fence tests). The tests cover duplicate and mode-collision receipts, symlink refusal, malformed/oversized diagnostic classification without extra requests, unexpected-claim rollback and expected-claim commit. This is controlled test evidence, not a live browser/provider or database-restoration observation.

### Final resolution review

The null-claim branch now explicitly rolls back and returns its result; only a non-null exact job-ID match commits. The new null-result regression verifies the transaction sequence. Reran the evidence suite after that edit: all seven tests passed. Together with the unchanged 26 analysis tests verified immediately beforehand, all 33 targeted tests passed in this follow-up. The claim-race finding and its null-result edge are closed, and no open blocker, major, minor or nit remains in this reviewed change. Final code-review verdict: **Approve**. This does not retroactively certify an execution started before the final fence edit, nor does it close the broader T9 release gates.

## Approval keyboard-focus follow-up

**Scope**: Only the new changes in `src/features/plans/proposal-actions.tsx`, `src/features/plans/proposal-actions.test.tsx` and `src/components/ui/button.tsx`.

**Verdict**: Approve. No new findings.

The confirmation heading receives programmatic focus when the review step opens, remains outside normal sequential tab order, and places subsequent keyboard navigation at the approval controls. Returning restores focus to the newly rendered Review approval button. The effect does not steal focus on initial mount. The shared button's native element props now include the ref and continue passing it through to the actual button; default button type, disabled behavior and visual variants remain unchanged. The existing separate approval action and receipt-key handling are preserved.

Independently ran `npm test -- src/features/plans/proposal-actions.test.tsx` on Node 24.15.0: all three tests passed. The new test exercises keyboard opening, heading focus, both confirmation controls, return focus and absence of a request during review/back navigation. Existing tests retain blocked/stale approval and lost-response receipt-key coverage. No live calls or browser actions were performed by this reviewer. The main agent's reported full check/build and actual browser approval are separate evidence and were not counted as independently reproduced here.

## Privacy keyboard-focus follow-up

**Scope**: Only the new changes in `src/features/privacy/settings-form.tsx` and `src/features/privacy/settings-form.test.tsx`. Read the review prompt/rubric, root and privacy guidance, the privacy/retention/recovery specification and its operations runbook.

**Verdict**: Approve. No new findings.

The event-trash and account-deletion confirmations now focus explanatory text on opening. That text is programmatically focusable without adding an extra sequential tab stop. Cancel restores focus to the matching event or account trigger through a keyed element map; account trigger remounting is handled by its callback ref. A single confirmation value keeps the shared prompt ref attached to one prompt at a time, and initial mount does not move focus. The diff changes no request payload, lifecycle authority, deletion timing or confirmation requirement.

Independently ran `npm test -- src/features/privacy/settings-form.test.tsx` on Node 24.15.0: all five tests passed. Both new keyboard cases exercise opening, explanatory-text focus, sequential confirm/cancel navigation, return to the correct trigger, dismissal and zero network requests. Existing tests cover retention preview, explicit confirmation, failed-save status and the scheduled-deletion recovery surface. No live provider calls, browser actions or lifecycle mutations were performed by this reviewer. The main agent's browser reproduction and broader check/build are separate evidence; this approval is limited to the two-file focus fix.
