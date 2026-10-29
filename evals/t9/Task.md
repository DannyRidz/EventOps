# T9 offline evaluation preparation

Status: Draft with controlled local execution evidence. Agent reviewed, no human approval or live evaluation is claimed.

## Purpose

Prepare reproducible synthetic inputs for the 30 named cases in the approved
[verification contract](../../docs/specs/0001-eventops/verify.md). This supplements
the existing controlled provider and service suites. It does not replace them
or establish the required 90 real selected model runs.

## Data and boundaries

`corpus.json` materializes one synthetic plan, exact update text where applicable,
workflow controls, fault variants, expected facts, permitted alternatives,
unresolved fields, prohibited effects and reference constraint reports for each
case. IDs are stable synthetic UUIDs. The clock and event timezone are explicit.
All initial plans must pass the real schema and deterministic validator. Missing
replacement availability belongs to an unassigned roster member. Later
cancellations belong to the restoration workflow, not an invalid approved head.

The 15 constraint probes deliberately include both valid and invalid candidates.
Their expected rule sets are specified independently before the current
validator report is saved. Reports include record IDs and exact conflict intervals.
Messages are recorded for drift detection, not used as a model wording rubric.
Four DST variants require rejection of a missing fold offset and a spring gap,
and distinguish both valid fold instants.

Only the selected case's plan and current confirmed text should enter the real
application's normal context packing boundary. The complete corpus is evaluator
control data. Never send expected results, constraint probes, workflow controls,
fault descriptions or oracle values to a model. E07 oracle answers are separated
from its setup inputs. E28's spoken name is evaluator truth, and the correction
is supplied only at the organizer correction step, after transcription.

## Reproduction

Use pinned Node 24.15.0 and installed dependencies from the repository root:

```sh
node scripts/prepare-t9-evaluation.mjs --self-test
```

The command reads local files, runs the real pure validator and timezone resolver,
checks source/input hashes and rejects six deliberately corrupted corpus variants.
It has no transport, credential, database or worker access. It reports no model
quality score and never changes live run statuses. To deliberately regenerate
after reviewing source changes:

```sh
node scripts/prepare-t9-evaluation.mjs --write --self-test
```

Review the resulting diff. Regeneration is not evidence of preserved semantics.
Source hashes pin the current generator and application behavior; the separate
preflight ledger's historical source hashes are preserved.

## Controlled local execution

`EVENTOPS_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-t9-evaluation.mjs`
runs the real orchestrator with injected responses and the SQL functions in a
uniquely named temporary loopback database. It creates normal event, source,
text confirmation and approval receipts and maps fixture IDs to captured IDs.
An existing synthetic profile snapshot comes from the private T8 export. No
bootstrap, sign in, terms acceptance or application authentication bypass is
used. The SQL fixture's claims simulate an authenticated actor solely inside
the temporary database; this does not verify HTTP authentication.

Both AI gates stay false in the running project and the temporary database.
The command refuses extra arguments and replaces global fetch with a rejection.
Every transport call receives an explicit controlled fetcher. No live mode exists.
The temporary database is removed in finally. Three repeats per case are local
checks, never the three required live model repeats. The output records exact
checks and limitations per case in ignored private `output/`.

`node scripts/verify-t9-allowance.mjs` checks the durable campaign journal with
concurrent child processes, restart, duplicate and changed keys, uncertain call
completion, stale lock, incomplete journal and hash chain tampering. Reservations
are integer microdollars, fsynced before the wrapped operation. They are never
refunded after uncertain completion. Reusing a reserved operation key blocks a
second call. A stale lock requires inspection; it is never automatically cleared.
The private directory and ledger modes are enforced. Existing application
workspace/global/lifetime limits are separate and unchanged.

The controlled runner uses one fixed campaign journal under private ignored
`output/t9-campaign-private/`, with a synthetic USD 13.50 ceiling. A second run
against that journal blocks reused attempts. For a deliberately separate offline
test campaign, choose a new absolute `T9_CAMPAIGN_LEDGER` in a private directory.
Never erase or reset a ledger to retry an uncertain live call. These controlled
reservations are not billed usage or authority to spend. A future live harness
must use the same guard around every attempt and retain normal application limits.

`EVENTOPS_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/prepare-t9-audio.mjs`
checks four materialized synthetic audio files and their hashes through the real
restricted converter. Silence and fixed seed noise use Opus. Authored local
speech from the installed macOS Albert voice is included as Opus and AAC. The
manifest records authored text and leaves independent human review null. Only
an explicit `--write` regenerates bytes, using installed local tools. No voice
download, real microphone recording or provider is needed.

## Future live execution and evidence

Pass iff the actual isolated application state and provider traces satisfy the
approved case semantics and every hard invariant. A model's assertion of success
is not evidence. Check real source ownership, request disposition, approval
receipts, complete snapshots, job generations and external effects. Accept
equivalent valid alternatives and require independent human review where semantic
judgment is needed. The official threshold remains zero hard invariant failures
and at least 90 percent of fully specified feasible cases yielding a useful valid
candidate within budgets. All critical cases must pass each of three repeats.

Every live run needs actual usage, billing, latency, tool results, citation
resolution and final validation evidence. Infrastructure and setup failures
invalidate a run rather than becoming a model score. Preserve failed traces.

## Remaining work before any live campaign

The controlled adapters now exercise SQL source/approval receipts, request replay,
stale heads, generation fences, real SQL budget races, transport faults and local
audio conversion. They do not establish actual model interpretation quality or
full HTTP/Storage worker operation. E25 deliberately replaces an expired lease in
the isolated fixture; the automatic claim/reclaim process remains disabled rather
than enabling a gate for the test. E27 proves that a historical assignment with
later absence cannot pass constraint/approval checks, but is not a new full
restoration browser journey. The prior T7 evidence owns that broader journey.

E28 now has supported audio bytes and content hashes, controlled transcription
adapter failure/name responses and original/correction SQL checks. It still needs
independent speech review and actual provider transcription evidence. Local
conversion does not prove physical device or recognition behavior. The repeated/nonexistent time variants are
separate setup checks, not an instruction to change the existing event date.

Provider entitlement, a private key, compatibility and actual usage probes,
independent semantic review, authorized live aggregate allowance and integration
of the tested guard into a future live harness remain open. Existing shared
workspace/global/lifetime budgets must remain enforced. No spending authority,
provider enablement, hosted deployment or Harbor installation is implied.
