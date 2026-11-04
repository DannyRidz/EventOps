# Review, main, 2026-11-04

**Reviewed by**: Codex, fresh independent review agent (implementation author's model identity not supplied)
**Scope**: Current uncommitted campaign allowance amendment, retained database/anchor, collector/resume wiring, fixture and workflow drivers, controlled rehearsals and related tests
**Verdict**: Approve

## Summary

The amendment preserves the original USD 1 journal and its prior USD 0.768 charges while recording the user's explicitly authorized USD 15 total ceiling. Retained SQL state, a single-operator lock and saved slot phases materially improve pacing and interruption handling. Provider results are saved before controlled scenario mutations, and quality acceptance remains unscored. Both originally reported major issues are resolved in the follow-up below. The final minor fixture-fidelity issue in the E23 controlled deadline is also resolved. There are no open findings in this review scope.

## Original major findings (resolved)

### 🟠 Reconcile reservations even when a retained slot object exists, `scripts/run-t9-live-evaluation.mjs:220`

**Problem**: The prior-reservation check applies only when no prior slot object exists. A restored SQL snapshot can retain `phase: prepared` and an empty request list while the independent journal already contains that slot's call-1 reservation. The runner then recreates a transport with request index zero. The duplicate first reservation throws inside the fetcher, which the production adapter treats as a network failure; its next retry can reserve a previously unused call-2 and send another request under stale SQL history.

**Why it matters**: The aggregate USD 15 guard still bounds spend, but the collector no longer fails closed on uncertain prior execution and can bypass retained SQL attempt/rate history after state rollback. An existing database and matching corpus identity alone do not establish that its slot state is current.

**Suggested fix**: Compare journal reservation keys and amounts against each retained slot's durable request records before creating a transport. Reject inconsistent or absent request history, including a prepared slot with preexisting journal calls and no matching records. For non-completed SQL jobs, stop on preexisting reservations rather than permitting a retry through the transport's network-error branch. Add a controlled stale-state regression that proves zero new provider calls/reservations.

The related missing-database issue was reported during review and has been addressed in code: the fsynced private campaign anchor requires the original retained SQL database, and prior T9 reservations require an existing anchor. That is an improvement, but does not itself detect an older snapshot of an existing database.

### 🟠 Exercise the real malformed-output repair boundary for E24, `scripts/lib/t9-case-workflows.mjs:559`

**Problem**: The E24 malformed-schema variant invokes `createMetaTransport`, then rejects its returned value using a separate local `z.object({ schema_version: z.literal(1) })` check. It does not pass that response through `analyzeUpdate`'s real closed schemas, shared repair allowance or worker persistence. Nevertheless, the step is recorded as passed.

**Why it matters**: The E24 contract requires bounded repair or an unresolved failure that cannot become approvable. This check would still pass if the actual application stopped enforcing that contract. The new workflow evidence cannot establish that behavior merely by independently recognizing a malformed object.

**Suggested fix**: Run controlled refusal/malformed envelopes through the real orchestrator or restricted worker and assert the actual call count, final result/error, official head and absence of an approvable proposal. Alternatively, explicitly label the missing orchestration/persistence portion as not exercised so the workflow cannot be counted complete. No live provider request is needed.

## Strengths

- Amendment rows are append-only, hash chained, fsynced and serialized with the same lock as reservations. Previous charges remain counted; idempotent amendment replay checks the exact prior/new ceiling and approval text. Inspection requires the original USD 1 header and rejects an effective ceiling above USD 15. The collector never invokes the amendment function automatically.
- The normal restricted workers and SQL quota functions remain in use. A fixed retained database preserves actual model-run rows across invocations, and its corpus identity and migration hash are checked before reuse. A session advisory lock prevents two operators from processing the retained campaign concurrently.
- Unknown provider work is not normally retried on resume: request records are saved before reservation/I/O, incomplete audio rows stop, and `workflow_running` requires inspection instead of replaying mutations. Completed SQL output can be recovered without another provider call. Completed slots are reused.
- The actual worker result and billing rows are saved at the collected phase before the workflow phase begins. Controlled lease/quota mutations use separate temporary fault databases rather than rewriting the retained live quota ledger.
- Text still passes only the normal minimized plan/confirmed text context. Evaluator probes, expected results, controlled alternatives and fault controls remain outside the live transport. Audio receives fixture bytes, with correction text introduced only afterward.
- The E28 coupled rehearsal records original transcript preservation, explicit correction/confirmation and restricted cleanup acknowledgements for four audio jobs. Independent speech quality and physical microphone behavior remain explicitly pending.

## Test coverage and verification

Independently ran the amendment, campaign-plan, campaign-entry and live-evidence suites: 19 tests passed across four files at the reviewed checkpoint. Also reran `scripts/verify-t9-allowance.mjs`: concurrency, replay, changed payload/limit, restart, uncertain completion, stale lock, truncation and hash-chain checks passed with no provider requests. These checks use temporary synthetic ledgers; this reviewer did not amend the real campaign journal.

Read the controlled coupled receipt under `output/t9-live-rehearsal-private/rehearsal-6454684c-9ac7-48c6-b0e2-c4b89eda8269/`. It records E02 controlled approval, four completed E28 jobs and four cleanup acknowledgements, zero live calls, empty cleanup errors and `acceptance: not_evaluated`. This reviewer inspected that receipt rather than rerunning the database/audio rehearsal. The retained-database test was inspected: it checks operator exclusion, corpus identity drift, saved state and ten-per-hour SQL history across restarts. Its actual execution was reported by the main agent, not independently run here.

The standalone all-case rehearsal now reports a gap when an E28 step lacks collected audio, rather than counting that missing step as a pass. Semantic review fields remain null. Passing SQL/control steps still does not establish live model quality, complete device behavior or every browser/HTTP path.

## Scope limits

This review covers synthetic campaign tooling, not production deployment or a full T9 release verdict. The user's USD 15 approval was supplied in the task context; the review neither creates spending authority nor performs the real amendment. No live request, authentication, legal acknowledgement, worker enablement, external service change, commit or push was performed by this reviewer. Private environment files and exported account contents were not read. Only this review file was authored.

## Resolution review

The reservation reconciliation now runs before transport construction for every selected slot, including slots with retained objects. `t9-slot-integrity.mjs` requires exact journal/request counts and request identities when prior charges exist. A prepared slot with prior charges must have a completed SQL job; absent state, stale empty history, wrong request indices and a noncompleted charged job stop before provider I/O. The two new regression tests cover those cases. The anchor requires the original database after first creation, and existing T9 charges require an existing anchor. An independent temporary-directory probe confirmed missing-anchor refusal, initial creation, reuse and identity-drift refusal. No real anchor was created.

E22–E24 now use normal queue/reserve/claim/stage/finish behavior through the actual restricted worker and orchestrator in a separate temporary fault database. The inspected `output/t9-workflow-private/run-Kkp8Bw/receipt.json` records E24 refusal as one call ending in persisted `PROVIDER_REFUSAL`, and malformed schema as two calls ending in persisted `ANALYSIS_FAILED`, with null result, preserved draft and unchanged official head. This closes the malformed-output finding. E22 records one rate-limit call without sleeping. The standalone E28 result correctly remains `additional_collection_required` with a `not_exercised` step; the separate coupled audio receipt supplies its four controlled audio jobs.

Independently reran the campaign-slot, amendment, campaign-plan, campaign-entry and live-evidence suites: **21 tests passed across five files**. The updated retained-database script also explicitly tests missing required state before database creation, and preserves ten SQL model-run rows across two restarts before denying the eleventh queue request. Its passing execution and the full 184-test check were reported by the implementation agent; this reviewer inspected the script and independently ran the targeted suites, not that database drill or full check.

## Original minor finding (resolved)

### Use the pinned E23 deadline in the controlled transport, `scripts/lib/t9-case-workflows.mjs:971`

Every E23 fault specifies `remaining_deadline_ms: 1000`, but the new worker helper substitutes 10000 for all non-E22 cases. Consequently the receipt records the original 1000 ms input beside 1500/3000 ms controlled elapsed time while marking the step passed. Use `fault.remaining_deadline_ms ?? 10000` so the replay exercises the pinned input, and rerun the controlled fault evidence. This is an evidence-fidelity issue; it does not alter the live allowance or provider path.

## Final deadline verification

The helper now uses each fault's pinned `remaining_deadline_ms` before its default and records that effective value. Independently inspected the replacement `output/t9-workflow-private/run-uKBqN9/receipt.json`: E22–E24 all record controlled steps passed, zero live provider calls and `acceptance: not_evaluated`. E23's 500/503 trials stop after two requests and 500 ms; its timeout trial ends as persisted `ANALYSIS_LIMIT` after one request and 1000 ms; empty output fails after one request without sleeping. All four use the pinned 1000 ms deadline. E24 still records refusal at one call and malformed output at two calls, with persisted failed jobs and null results. This closes the final minor finding.

Final verdict: **Approve**, with zero open major, minor or nit findings. The implementation agent additionally reports 22 targeted tests across six suites passing; the independently executed 21-test result and receipt-inspection limits above remain unchanged. This approval covers the reviewed campaign code and controlled evidence, not live quality acceptance or full T9 release readiness. No real amendment or live request was performed during this resolution review.
