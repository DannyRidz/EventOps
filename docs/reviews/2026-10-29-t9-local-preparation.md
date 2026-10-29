# T9 local evaluation preparation

Date: 29 October 2026, Asia/Brunei.

## Result

The draft offline corpus now contains all 30 named cases from the approved
verification contract. It includes synthetic plan data, exact update text,
expected facts, permitted alternatives, unresolved fields, prohibited effects,
workflow controls and reference constraint reports. The [task boundary](../../evals/t9/Task.md)
describes what is and is not executable. All 90 live evaluation slots remain
`not_run`. No quality threshold or complete T9 acceptance is claimed.

The working tree was clean at entry at commit `547308e`. No existing uncommitted
work was removed. No application source, schema, provider configuration, private
environment contents or approved specification changed. No terms were accepted,
payment details changed, resources provisioned, deployment performed, commit
created or push made during this continuation. No email was sent in this local
work. Earlier support communication was separately requested by the user.

## Actual checks

`node scripts/prepare-t9-evaluation.mjs --self-test` passes. It checks 30 valid
initial plans, 15 explicit candidate constraint probes, four DST variants, source
and input hashes, unique cases and six corruption rejection checks. Valid
candidates and deliberately invalid candidates are both covered. The negative
checks reject altered text, erased constraint reports, duplicate cases, enabled
live status, fabricated live run counts and stale source hashes. This command
does not import a provider transport or access credentials, HTTP or databases.

`npm run check` passes after the final script changes: lint, formatting,
generated route types, strict typecheck, and 158 tests in 26 files. The initial
post change check failed formatting because the generated JSON did not match
Prettier. Generation now uses the installed formatter; the final complete check
passes. Log: `/private/tmp/eventops-t9-corpus-final-check.log`.

The existing production standalone build was started on loopback port 3005.
`T9_APP_URL=http://localhost:3005 node scripts/verify-t9.mjs` passes using the
saved synthetic session. Public health/readiness, anonymous denial, disabled
internal routes, private no store responses and 100 protected plan reads at
concurrency five pass. Total read time was 9680 ms, p50 464 ms, p95 629 ms and
maximum 920 ms. Both database provider gates were false before and after the
smoke run. Log: `/private/tmp/eventops-t9-corpus-smoke.log`. These are bounded
local reads, not a production load or live model latency result.

No fresh account sign in, terms checkbox, auth workaround, microphone capture or
screen reader setting was attempted. No new production build was needed for
these evaluator only files; runtime smoke used the previously verified build.
The application and prior build evidence remain unchanged. The task server was
stopped after checking. Preexisting Supabase and other user applications remain.

## Separate review

A separate agent read all 30 cases and found invalid starting plan assumptions,
oracle answers inside DST inputs and inconsistent aggregate budget fixture
totals. Those were corrected. Starting plans now all pass the validator, missing
availability belongs to an unassigned replacement, restoration cancellation is a
later workflow step, oracle answers are separate, and aggregate reservations
include the workspace total. Concrete intervening revision and edited generation
payloads were also added.

The reviewer independently reran the final offline self test successfully and
reported no outstanding blocker for draft preparation. This is not independent
human semantic approval or cross model evaluation evidence. No model quality
score was produced.

## Remaining gaps

The corpus still needs executable isolated workflow and failure adapters,
normal source/evidence receipt creation and ID mapping, supported audio bytes and
reviewed speech truth for E28, and independent semantic approval before live
execution. The dedicated durable aggregate campaign allowance, including retries
and restarts, remains unimplemented. The existing shared budgets are unchanged.
No existing passing controlled service test is counted as a new real model run.

Meta support has confirmed the promotional credit grant in the separately
reviewed correspondence. The user's latest payment attempt still failed, and the
requested support followup has been sent. This continuation did not recheck or
change that external account. Entitlement, private key, compatibility, actual
usage/billing, geography and provider prerequisites remain open; live AI stays
disabled and provider spend for this continuation is USD 0.

Full screen reader, physical mobile and complete protected native browser/zoom
coverage, the blocked sign in regression retest, hosted deletion reconciliation,
actual hosted object restoration, backup schedules/expiry/key custody,
monitoring/alerts, deployed rollback and operator notices remain the previously
recorded release gates. See the [native evidence](2026-10-29-t9-native-readiness.md)
and [T8 runbook](2026-10-29-t8-runbook.md). This draft corpus closes an offline
preparation gap, not the connected loop, live quality or full release gate.
