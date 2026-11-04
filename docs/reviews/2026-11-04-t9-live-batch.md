# T9 live campaign batch, 4 November 2026

The user-approved USD 15 total ceiling is recorded in the original append-only journal. Prior charges remain retained. Reviewed workflow code has zero open independent findings. The existing 184-test check passes, and a fresh production build with pinned Node 24 passes.

## Actual execution

Fourteen of 90 slots are collected, not scored: E01–E03 all three repeats, E04 repeats 1–2 and E28 all three repeats. E02 repeat 1 was collected earlier on the same day and reused without another provider call. This batch added ten text analysis jobs using 14 actual requests, then stopped on the normal SQL analysis budget/rate guard before E04 repeat 3. No quota history or clock was reset. A separate E28 invocation completed 12 actual transcription requests through normal voice quotas.

E02 repeat 2 produced a ready candidate and passed actual selected-option adoption, complete SQL validation and transactional approval in its isolated synthetic fixture. E02 repeats 1 and 3 requested clarification; their approval steps are explicitly not exercised. Most other collected text results are unresolved; that status is not itself a semantic pass or failure. Independent case scoring remains pending, and no aggregate useful-candidate threshold is claimed.

All E28 repeats passed collected-transcript preservation, correction, explicit confirmation and restricted cleanup checks. These do not certify physical microphone permission behavior or transcription quality. Cleanup reported no errors in either invocation; isolated provider gates were disabled afterward. Main application provider gates were not enabled by these runs.

Journal totals after the batch: **USD 1.734 reserved**, **USD 13.266 remaining** within the approved USD 15 total. These conservative reservations include historical and uncertain calls; they are not an actual provider invoice. No reservation was refunded.

## Private evidence

- `output/live-analysis-private/corpus-E02-1-1fbaf6e5-d22f-45a4-ba87-3d782390d7e1-receipt.json`
- `output/live-analysis-private/corpus-all-all-0c0df105-04dc-4497-b989-924ab7f68767-receipt.json`: final state `paced_by_sql_limits`, cleanup errors empty.
- `output/live-analysis-private/corpus-E28-all-d22f4e37-b085-4c99-aaf3-ab00e93eb75d-receipt.json`: final state `collected_not_scored`, cleanup errors empty.

The retained campaign database and private state anchor must survive resumption. Resume only after the actual rolling-hour quota permits; do not recreate the database, clear reservations or replay completed slots. Seventy-six slots remain uncollected. Semantic review, human audible VoiceOver acceptance, supported physical devices and hosted operational gates remain open. T9 and T10 are not complete. No deployment, publication, commit, push or submission occurred.
