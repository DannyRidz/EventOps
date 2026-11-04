# T9 saved trace and packaging review

4 November 2026, Asia/Brunei. Completed a no cost review of the 24 collected slots and three deployment packaging files. No new provider requests, resource provisioning, deployment, commits or pushes occurred. The tree was clean at entry; previously prepared work was already present in the current checkout and was preserved.

## Evidence and method

Read the authored expectations in `evals/t9/corpus.json`, the latest saved result for each case and repeat from `output/live-analysis-private/corpus-*-receipt.json`, provider request metadata, and the recorded workflow evidence. All three repeats of E01 through E07 and E28 were inspected. A separate review agent challenged the initial observations and independently read all 24 saved results. This is AI trace review, not independent human acceptance or an acoustic listening test. No reviewer model family independence guarantee is asserted.

The private `output/t9-semantic-review-private/assessment.json` records each observation, its original receipt path and SHA256. Original receipts and their null semantic acceptance fields were not modified. No overall release quality score was calculated from this partial collection.

## Findings

| Case | Repeats | Assessment from the saved evidence |
|---|---|---|
| E01 occupied destination and cancellation | 1, 2, 3 | All remain unresolved. The first two focus on cancellation without surfacing the Room 2 collision or asking for a nonconflicting time. Repeat 3 asks about time flexibility, but does not identify Workshop's recorded occupancy. This is a conflict explanation and completeness concern, not evidence of an invalid approval. |
| E02 specified move and replacement | 1, 3 | Both unnecessarily ask for more information, an unavailability interval or the reason Alex cannot cover. The authored case has no unresolved fields and expects a valid candidate. Neither repeat exercises approval. |
| E02 specified move and replacement | 2 | Produces the requested move and replacement. The selected option passes recorded SQL checks and deliberate synthetic adoption and approval. This supports this one repeat, not a 90 percent campaign result. |
| E03 unavailable replacement | 1 | Identifies the recorded unavailability but asks whether to proceed anyway. The required response is a valid replacement or resolution of the unavailable interval, not wording that suggests the constraint may be ignored. No option or approval follows. |
| E03 unavailable replacement | 2, 3 | Repeat 2 asks about availability conditionally without surfacing the actual unavailable interval. Repeat 3 omits it. Both ask additional identity or room/time questions instead of clearly explaining the known blocker. |
| E04 replacement availability absent | 1 | Asks for missing availability, supporting the required unresolved fact, but adds unnecessary room/time and replacement questions. |
| E04 replacement availability absent | 2, 3 | Neither asks for Rowan's missing availability. Both stay unresolved over room/time questions. Being unresolved does not itself satisfy the requirement to surface the actual missing fact. |
| E05 room capacity absent | 1, 2, 3 | No candidate is accepted, and capacity remains unresolved. The message says capacity must meet attendance but does not identify Room 2's missing value. Safe blocking is supported; specificity could be improved. |
| E06 relative date conflicts | 1, 2, 3 | All ask which calendar date is intended. Saved collection evidence leaves the official head unchanged. This supports the intended clarification behavior for these repeats. |
| E07 DST fold and gap | 1 | Asks which record is affected, but does not surface either the fold offset or nonexistent spring time. |
| E07 DST fold and gap | 2 | Asks which repeated time is intended, but does not identify the nonexistent spring time. |
| E07 DST fold and gap | 3 | Asks which fold occurrence and a valid alternative to the nonexistent time. Deterministic setup variant checks are recorded separately and do not establish model consistency across repeats. |
| E28 voice | 1, 2, 3 | All six speech transcripts omit or distort authored operational facts, including the move and room. The saved original bytes have not been independently assessed by a human listener, so acoustic quality is not scored. Silence/noise jobs fail without automatic analysis. Raw transcript preservation, correction, explicit confirmation and cleanup are recorded in the workflow receipts. |

The voice expectation is a safe review and correction path, not an exact transcript match threshold. The text mismatch is therefore recorded as a recognition concern, not converted into an invented acoustic score or an automatic failure of the entire E28 workflow.

The 100 recorded workflow steps marked passed and two steps marked not exercised are structural observations. In particular, an empty option list can satisfy a validation loop without proving a useful candidate was produced. Passing those steps cannot override the semantic mismatches above. No accepted invalid candidate was found in these saved traces, but this limited review cannot certify every hard invariant across the 66 uncollected slots.

## Instrumentation gap

The 24 slots contain 37 saved provider request records: 25 text requests and 12 audio requests. All have latency. The text requests have request IDs and token usage, while all 12 audio request records have null request IDs and no usage payload. The audio adapter's diagnostic summary also reports zero content length despite completed speech transcripts being present elsewhere in the result. These summaries do not prove empty provider responses. Provider billing reconciliation and whether the speech endpoint supplies usable request metadata need separate investigation; no missing values were invented or replaced with estimated invoice amounts.

## Deployment packaging review

A separate review of `Dockerfile`, `Dockerfile.worker` and `.dockerignore` found no concrete blocker, major or minor defect from the available source evidence. Runtime worker imports are production dependencies; worker entry points and module hooks are copied; the web output belongs to the nonroot node user; private environment and key files are excluded; provider flags default off.

The actual container images have not been built or run because no container engine is installed. Retention requires an independently durable mounted ledger writable by the node user. The worker image has no ffmpeg and must not be represented as ready for live voice conversion. These limitations remain in the [hosting preparation evidence](2026-11-04-hosting-preparation.md). No image runtime, volume durability or hosted acceptance pass is claimed.

## Validation and next fixes

The offline corpus self test passes: 30 cases, 15 constraint probes, four DST variants and six deliberately corrupted corpus rejections, with zero provider calls. `git diff --check` passes. No application code was changed, so the existing 201 test and production build evidence was not rerun or relabeled as fresh here.

Recommended implementation order is to make known deterministic blockers visible even when interpretation asks questions, reduce unnecessary questions for explicit moves and replacements, and improve voice request metadata collection without fabricating unavailable provider fields. Changes to prompts, packing or orchestration require updated source pins and fresh evaluation; old collected runs remain tied to the old version. No prompt patch or source hash regeneration was made during this review.

The no spending instruction keeps new model calls and paid hosting stopped. Human screen reader observations, physical device verification and hosted operational evidence remain distinct from this completed saved trace review. No T9 acceptance checkbox was ticked. Scope review notes should point here without marking full release verification accepted.
