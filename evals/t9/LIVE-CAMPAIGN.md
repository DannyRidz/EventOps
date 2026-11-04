# T9 collection preparation and budget proposal

Updated 4 November 2026, Asia/Brunei. Status: full workflow code independently approved; USD 15 total synthetic evaluation ceiling explicitly approved. Live collection has started; acceptance remains unscored.

Latest execution: 14/90 slots collected; text paused at the normal hourly SQL guard. All E28 repeats collected. USD 1.734 retained, USD 13.266 remaining. No quality acceptance claimed. [Actual batch evidence](../../docs/reviews/2026-11-04-t9-live-batch.md).

## Safe commands

From the repository root with pinned Node 24:

```sh
node scripts/run-t9-live-evaluation.mjs --prepare
node scripts/prepare-t9-evaluation.mjs --self-test
```

Preparation verifies application source hashes, each case input hash, all 30 ordered case identities and the existing private USD 1 journal. It emits 90 uniquely identified slots with no scores or enabled calls. It opens no database and makes no provider request. The journal is read, never reset or amended.

The controlled rehearsal exercises E02 text and all four E28 audio files once through real restricted SQL workers, with injected responses and no provider I/O:

```sh
T9_PROFILE_EXPORT=/absolute/path/to/existing-private-synthetic-export.zip \
EVENTOPS_FFMPEG_PATH=/absolute/path/to/installed/ffmpeg \
node scripts/run-t9-live-evaluation.mjs --rehearse
```

The export supplies an existing profile snapshot only inside a temporary SQL fixture. It does not sign in, create legal consent or provide an HTTP authentication bypass. Audio uses a local fixture store rather than hosted Storage. Rehearsals have their own explicitly controlled reservation journals; they do not replace the actual live journal or authorize spending. Private receipts are exclusive and cannot overwrite earlier attempts.

## Collection scope

The separate `--execute` entry requires explicit synthetic live approval, all applicable verified provider flags, a private key and sufficient **existing** aggregate allowance before receipt creation or database/provider access. The user approved a USD 15 aggregate ceiling, recorded as an append-only amendment in the original journal. The first E02 repeat collected one actual response; it requested clarification and did not approve a proposal. Further execution preserves the retained campaign database and normal SQL quotas.

Text goes through the normal context packer, analysis adapter, restricted claim/stage/finish functions and SQL reservations. Only that fixture's plan and confirmed text reach the model. Audio goes through codec conversion, the normal ASR adapter and restricted voice worker. Authored transcripts, oracle facts, expected answers, fault controls and workflow instructions never enter provider context. The running application's gates remain off; only the isolated fixture's applicable gate can be enabled for collection, then is disabled in cleanup. Official heads remain unchanged during collection; explicit synthetic organizer workflow steps may subsequently approve validated candidates in the isolated fixture.

Successful collection means `collected_not_scored`, with `acceptance: not_evaluated`. It preserves actual results, errors, usage, request IDs, latency, estimated SQL charges, candidate validation, fixture inputs and null semantic/workflow review fields. A failed provider response can be a collected observation; it is not an accepted case. Case workflow drivers now record organizer confirmation, proposal adoption and approval where applicable, separately from raw collection. Release quality remains unscored.

The [earlier collection review](../../docs/reviews/2026-11-04-t9-campaign-review.md) lists the original case workflow omissions, now addressed by the reviewed workflow drivers except physical device observations. In particular, collecting text for E13 or E25 does not perform its stale approval or worker death scenario. E28 collection does not establish microphone denial, correction, confirmation or cleanup. Existing controlled case results retain their own evidence type. They are not converted into live passes.

## Approved synthetic evaluation budget

These are conservative internal reservations, not a provider pricing quote or an instruction to purchase anything.

| Component                            | Calculation                                   | Maximum reservation |
| ------------------------------------ | --------------------------------------------- | ------------------: |
| Text collection                      | 29 cases × 3 repeats × 3 requests × USD 0.05  |          USD 13.050 |
| Audio collection                     | E28 × 3 repeats × 4 fixture files × USD 0.018 |           USD 0.216 |
| New collection total                 | 90 slots                                      |      **USD 13.266** |
| Existing retained reservations       | Current live journal                          |       **USD 0.768** |
| Combined maximum                     | Existing plus proposed collection             |      **USD 14.034** |
| Recommended future aggregate ceiling | Includes USD 0.966 contingency                |      **USD 15.000** |

The user explicitly approved USD 15 total, including the prior USD 0.768, in reply to `call_b79ae0bc27a24ec2b76a978283de95a4`. The original journal header and reservations remain intact; a hash-chained amendment records the increase. See [authorization](../../docs/reviews/2026-11-04-t9-budget-authorization.md).

The workflow drivers, durable SQL campaign state, anchor and journal reconciliation received [independent approval](../../docs/reviews/2026-11-04-t9-full-workflow-review.md). Controlled verification passes 184 tests; replacement E22–E24 evidence exercises the actual restricted worker, including bounded malformed-output repair. These are controlled results, not live quality scores.

## Campaign execution and remaining acceptance

1. Add actual case workflow drivers around collection and preserve their SQL/source/approval receipts. Each of the approved 30 cases needs its own observations, not a model response alone. Use the existing controlled runner as a reference, not as a substitute result.
2. Keep cumulative SQL quota/rate history across campaign pacing and restarts. Live invocations now use the same retained database, durable slot phases and private anchor. Recreating a fixture to evade a quota is prohibited. Automatic scheduling is not yet implemented.
3. Preserve normal limits: ten analyses per workspace per rolling hour, USD 2 workspace daily, USD 10 global daily and USD 50 global lifetime, plus applicable voice limits. Eighty seven analysis slots require at least nine hourly batches under the count limit; daily budgets may require longer. Do not falsify timestamps or clear SQL reservations to meet a deadline.
4. Establish sufficient explicitly authorized aggregate funds and verified billing bounds. Recheck the selected model/prompt/schema pins when execution is scheduled.
5. Assign independent semantic review, authored audio review and workflow review. Record each hard invariant and the critical-case results. Do not compute the useful-candidate threshold from collected rows with missing workflow evidence.

The live campaign is authorized within the approved ceiling. No live quality score or full T9 acceptance is claimed. The engineering list above describes the original gaps; items 1, 2 and the authorization portion of 4 are now implemented and reviewed. Normal pacing, independent semantic review, physical device checks and hosted acceptance remain necessary.
