# Privacy, retention and recovery

Read `docs/specs/0001-eventops/0013-privacy-retention-recovery.md` and `docs/reviews/2026-10-29-t8-runbook.md` from the repository root.

- Lifecycle mutations use owner scoped SQL functions, workspace then event locks and expected generations. Archive is read only. Trash and account deletion hide content immediately. Restoration cannot extend retention or resurrect cancelled jobs.
- Retention resolves the current approved event metadata, otherwise the saved draft. The immutable creation receipt is never the retention authority.
- Raw CSV access must pass `csv_original_available` and the scoped receipt function. Authenticated users have no SELECT grant on `original_bytes`. Cleanup clears both Storage and the receipt, preserving frozen cells until event purge.
- The maintenance process has only `eventops_worker` privileges. Record and fsync all selected tombstones to independent storage before deleting bytes or rows. Missing metadata is required before acknowledgement. Model enablement and credentials never gate cleanup.
- The independent ledger uses opaque event, account, CSV and audio IDs only. Latest deletion requests and cancellations must be reconciled before a restored target is served. Missing history blocks access. The database copy of tombstones alone cannot authorize recovery.
- ZIP exports use known paths, hash verified originals, safe CSVs, an omission manifest and explicit memory bounds. Preflight SQL record sizes before aggregation. Recheck workspace generation before returning bytes. Unexpected Storage errors fail the export.
- Operational output accepts fixed codes and numeric counts only. Hosted scheduling, independent storage, alerts, geographic controls, notices and production recovery remain release prerequisites; do not imply those are connected.
- `node scripts/verify-t8.mjs` exercises synthetic loopback services. `T8_PG_DUMP=/matching/pg_dump node scripts/verify-t8-recovery.mjs` rehearses encrypted isolated recovery after the service suite creates its private temporary ZIP. Keep live AI disabled.
