# Review, main, 2026-11-04

**Reviewed by**: Codex, fresh independent review agent (implementation author's model identity not supplied)
**Scope**: Seven uncommitted files: collection runner, campaign planner, SQL fixture helper, database-lab export parameter, optional claim SQL fence, campaign-plan tests and subsequent campaign-entry tests
**Verdict**: Approve after the resolution review below (initial verdict: Changes requested)

## Summary

The change prepares 90 identified collection slots and can collect bounded text or audio responses through restricted SQL workers in a temporary database. The existing USD 1 campaign journal remains authoritative, evaluator answers are excluded from model inputs, and results explicitly remain unscored. No demonstrated overspend or oracle leakage was found. The live execution gate needs direct controlled regression coverage, and the collector should reject input changes that contradict the corpus's recorded hashes.

## Major

### 🟠 Exercise the live execution gate before database/provider access, `scripts/run-t9-live-evaluation.mjs:90`

**Problem**: The new authorization, provider-flag, voice-flag and selected-budget branches are not exercised by the submitted tests. `campaign-plan.test.ts` checks the planner and journal parser, but never invokes the runner's execution preflight. The successful controlled rehearsal bypasses these live-mode branches. In particular, no test proves that an insufficient allowance exits before `databaseLab`, receipt creation or provider access.

**Why it matters**: This boundary separates offline preparation from paid provider work and temporary gate enablement. A planning-helper test would remain green if a future edit moved the allowance or authorization checks below those effects. The configured-runner review rubric treats untested spend/access branching as a major coverage gap.

**Suggested fix**: Add controlled execution-preflight tests with injected database/provider boundaries or a testable preflight function actually used by the runner. Cover missing approval, each missing required provider flag, missing voice authorization for E28, insufficient allowance, and an eligible bounded selection. Assert that rejected cases cannot create a database, alter a gate, create an execution receipt, reserve funds or call a provider. Do not use a real key or make live requests for these tests.

## Minor

### 🟡 Validate each recorded input hash before planning or collection, `scripts/lib/t9-campaign-plan.mjs:40`

**Problem**: `campaignPlan` validates the case count and ordered IDs, but does not compare `input_sha256` with the corresponding serialized input. The runner verifies application source hashes only. An in-memory change to E02's confirmed text with its original input hash left intact still produced all 90 slots during this review.

**Why it matters**: An accidental corpus edit can be collected under the named case despite failing the established corpus integrity contract. Computing a fresh overall corpus hash records the modified file but does not detect that inconsistency.

**Suggested fix**: Verify all per-case input hashes before any database or provider work, preferably by reusing the established pure corpus validation boundary. Add a stale-input-hash rejection test. Keep evaluator-only fields out of model context while validating them locally.

## Strengths

- Default `--prepare` performs no database or provider operation. The existing journal is required, its USD 1 limit is checked, and every external call still passes through the fsynced reservation guard with stable per-slot keys. No live ledger override or refund path was introduced.
- The full plan requires USD 13.266 of worst-case reservations. Fresh preparation reported USD 0.768 already reserved and USD 0.232 remaining, so all 90 slots cannot pass the current live allowance preflight. Text slots reserve at most USD 0.15; each audio file conservatively reserves USD 0.018.
- Text uses the normal context packer and checks base, source, text and plan at the transport boundary. The complete corpus, expected outcomes, fault controls and organizer answers are not passed to the model. Audio sends converted fixture bytes, without authored transcripts or correction answers.
- The normal restricted analysis/voice worker functions remain in use. The configurable claim fence preserves rollback for null or unexpected claims. Owner functions establish synthetic plans and confirmed text, and the collector checks that the official revision does not change.
- Cleanup attempts gate disablement, worker closure, role removal and database closure independently; a cleanup error marks the report failed. The database lab checks the running project's gates before setup and after ordinary successful teardown. The export-path option is passed as an argument to `unzip`, without shell interpolation.
- `acceptance` remains `not_evaluated`, semantic/workflow review fields remain null, and collection ends at `collected_not_scored`, including recorded worker failures. That is a collection outcome rather than a quality pass.

## Test coverage and evidence

Fresh offline checks on Node 24.15.0:

- Campaign-plan and live-evidence suites: 12 tests passed across two files.
- `--prepare`: 90 slots, USD 13.266 maximum, unchanged USD 1 journal, USD 0.232 remaining, `can_fit_current_allowance: false`, zero live calls and no acceptance result.
- Controlled in-memory corruption probe: changing input text without updating its input hash was accepted, reproducing the minor finding without modifying files.

Read the supplied controlled rehearsal receipt at `output/t9-live-rehearsal-private/rehearsal-9ba42ed4-c7ff-4dcd-bc3c-21d96817ac0f/rehearsal-9ba42ed4-c7ff-4dcd-bc3c-21d96817ac0f-receipt.json`. It records completed E02 analysis and all four E28 audio jobs, zero live provider calls, empty cleanup errors and unscored results. This reviewer did not rerun the database/audio rehearsal or independently observe its teardown. No private environment files, model keys or exported account contents were read, and no live execution was attempted.

## Full-case and budget scope limits

The runner supplies initial plan/text collection for the named cases, with E28 handled as audio collection. It does not implement their complete acceptance workflows:

| Cases | Remaining evidence beyond this collector |
| --- | --- |
| E01–E06, E08, E10, E16–E18, E21 | Independent interpretation/semantic review, any required clarification, organizer confirmation, approval and final-state checks |
| E07 | Repeated/nonexistent-time variants and their required offset/rejection observations |
| E09, E12, E15, E20 | Specified fabricated facts/evidence or invalid-output fault injections |
| E11 | Transcript-origin preservation and review workflow in addition to hostile-text interpretation |
| E13, E14, E19, E25–E27, E29, E30 | Stale-head races, replay, contradictory-answer handling, worker death/reclaim, late results, restoration, quota races and post-commit briefing recovery respectively |
| E22–E24 | Controlled transport/refusal/schema fault variants; an incidental real failure does not cover every variant |
| E28 | Speech-quality review, correction/confirmation, microphone-denial/device behavior, audio-derived analysis and deletion checks |

No case is approved by this runner. Its temporary database is dropped, so missing lifecycle/fault steps need their own execution evidence; later semantic scoring cannot establish actions that never ran. These omissions are openly declared collection limits, not findings that this collection-only change falsely claims full acceptance.

Normal SQL budget and rate-limit functions apply within each isolated invocation. A new invocation creates a new SQL ledger; this is not evidence of cumulative SQL rate enforcement across independent collector invocations. The existing persistent USD 1 journal remains the cross-invocation monetary bound. With the present allowance, a full campaign is blocked; extending budget or campaign scheduling would need a separate design preserving cumulative limits rather than repeatedly recreating SQL history to accelerate work.

No code, specs, external services, commits or live gates were changed by this reviewer. The only authored artifact is this review.

## Resolution review

The planner now checks every case's serialized input against its recorded `input_sha256`, before producing slots. The new mutation test rejects a changed confirmed request with the old hash. The minor finding is closed.

Added actual entry-point tests launch the runner in a temporary working directory containing a synthetic private journal. Preloaded database-connect and fetch traps prevent real I/O and leave a marker if touched. Missing approval, a disabled access-verification flag and insufficient full-campaign allowance all produce their specific errors with no marker or execution receipt. These tests cover the previously untested entry boundary directly rather than merely recomputing the plan.

The final tests also cover the distinct missing-voice-authorization error and an eligible E02/repeat-1 selection. That eligible selection reaches only the injected database-connect trap and produces a failed controlled receipt with zero provider calls. The preload supplies synthetic local database status, so no real Supabase availability or credentials are required. Final independent targeted execution passed all 18 tests across campaign-plan, campaign-entry and live-evidence, and `git diff --check` passed. The major coverage finding is closed.

**Final verdict: Approve.** No open blocker, major, minor or nit remains in this seven-file collection/preparation scope. The findings above are retained as review history. Approval does not certify all 30 case workflows, live quality, cross-invocation SQL rate enforcement or release readiness; the stated collection and allowance limits remain in force.

## Local startup and recovery assertion follow-up

**Scope**: Only the subsequent uncommitted changes in `package.json` and `scripts/verify-t8-recovery.mjs`.

**Verdict**: Approve. No new findings.

The start command explicitly loads the repository's optional application `.env.local` before launching the standalone server. That supplies runtime configuration such as `APP_URL` to the existing origin check; it does not alter or bypass that check. Read the installed Next.js environment-variable and deployment guides and verified the referenced origin-check code. A synthetic temporary-directory probe on pinned Node 24.15.0 passed file loading, inherited-environment precedence and startup without the optional file. No actual application or worker environment file was read, and no server was started by this reviewer. The command is scoped to the documented local application configuration; it does not introduce loading of the separate worker key file.

The recovery drill now compares the full ordered revision rows of the retained source event with all revisions visible to its owner in the restored database. It requires a nonempty source set, catches missing/extra/changed restored revisions, and retains the separate stranger-zero-rows and forbidden-delete assertions. This is stronger than assuming every export has exactly one revision. The change does not alter backup contents, recovery writes, deletion replay or the uniquely named temporary database cleanup.

The main agent's successful browser mutation after restart and isolated recovery rerun are separate verification evidence. This reviewer performed the synthetic startup-option probe and code review only; no database drill, live provider call, account action or user-data mutation was performed. Full check/build results queued by the main agent are not represented here as independently observed passes.
