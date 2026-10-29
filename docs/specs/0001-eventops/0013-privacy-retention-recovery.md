# T8 privacy, retention and recovery

**Status**: In Progress
**Date**: 2026-10-29
**Authorized by**: user instruction to use recommendations without questions

## Summary and decision

Extend the approved operations contract in place. Keep lifecycle authority in PostgreSQL, private downloads in authenticated routes and cleanup in a separate restricted process. Reuse Supabase and Node without new providers. A database only tombstone is insufficient because a restore could erase it, so the maintenance process must durably record opaque deletion identifiers in an independent ledger before purging.

## Requirements

AC-02, AC-24, AC-26, AC-29 and AC-30 apply as described in verify.md. Prove locally with synthetic accounts and bytes. Do not enable live AI, provision, deploy or accept terms. Production verification remains separate.

## Feature design

Settings at `/events/settings` show workspace deletion state and all retained events, including trash. Each event shows status, retention and exact purge deadline. Archive makes an event read only. Reopen restores draft/active according to its current head and enforces ten active events. Trash hides all content immediately, cancels work and permits restoration for seven days. Restoration never extends the event retention deadline. Event retention is 30, 90 (default) or 365 days from the event local date's end resolved in its saved timezone. Preview the new date before saving. Expiry schedules event purge directly. Unconfirmed setup expires after 30 inactive days. Unreferenced text drafts expire after 30 inactive days; linked confirmations remain until event purge.

All actions use verified owner scoped functions with workspace then event locks. Reauthentication uses the Auth session original creation timestamp selected by the verified `session_id`, within ten minutes, independently checked in SQL for account deletion and recovery. A refreshed JWT `iat` is not authority. Deletion disables reads and processing immediately; explicit recovery during seven days cancels it. Purge removes event rows, raw bytes, storage objects, membership, workspace, profile, Auth sessions and identity. Recovery never recreates cancelled jobs. Tombstones for events, accounts, CSV artifacts and audio jobs have kind, opaque id, deletion time and expiry only. Keep it independently for at least the seven day backup window. Purge can retry safely; never acknowledge Storage deletion until metadata is absent. Account purge additionally records the account id before deleting Auth.

Private workspace ZIP export includes JSON records (including trash during grace), all retained revisions as safe CSV tables, verified available original CSV/audio bytes and an omission manifest for expired files. No model or auth secrets are exported. Generate directly in the authenticated request, no persisted export URL or object. Preflight the total serialized database records at 32 MiB before aggregating tables. Enforce a 64 MiB archive bound and one concurrent export per owner process; exceeding the bound is an explicit error, never a partial export. Recheck authorization and lifecycle generation before releasing the result.

CSV expiry is 30 days from capture or earlier explicit raw deletion. Clear both Storage bytes and the database byte receipt. Preserve frozen cells and hash. Audio uses existing due dates. Orphan private uploads expire after one hour. Restrictive Storage policies enforce expiry and workspace deletion even if permissive policies broaden. Maintenance runs independently of model access, lists at most 100 due objects per sweep and purges only after all related objects are gone. Separate worker API functions provide no arbitrary table or Auth access.

Operational logs use an allowlist of codes and numeric counts, without content or stable user identifiers. A private worker health result reports due object count, pending event purges and queue age; hosted cleanup lag alerts remain a prerequisite. Database readiness returns only success/failure. Local backup drill uses an isolated database, actual object bytes and SHA256 manifest, encrypted artifact, and independent tombstone replay before verification. This is a local drill, not a hosted backup service or measured production RPO/RTO.

Public privacy copy describes actual local behavior, potential provider processing, backup limits and unresolved operator facts without inventing identity, jurisdiction or compliance. Geographic live processing stays blocked by existing disabled gates; actual geographic enforcement remains a production prerequisite.

## Build plan

1. Add lifecycle columns, owner actions, read/write fences, file expiry, maintenance and export functions.
2. Add settings and private ZIP route, safe file labels and notices.
3. Add restricted maintenance process, independent ledger and local recovery tooling/runbook.
4. Exercise real loopback HTTP, Auth, database and Storage boundaries, rollback, recovery and regressions. Run check and production build. Record results and gaps.

## Consequences and migration

Additive schema and replacement functions retain existing plan and evidence contracts. Foreign keys between event records become deferrable for one atomic purge of cyclic revision/proposal relationships. Constraints remain enforced at transaction end. Reverting the app cannot restore purged bytes, so rehearse in an isolated database first. No destructive down migration.

## Rationale

A parallel lifecycle service would duplicate ownership and introduce races. Scoped SQL and existing Storage APIs keep the authority in one place. Local encrypted recovery artifacts validate mechanics without claiming an independent hosted destination exists.

## Local completion and production boundary

The local build and synthetic verification are recorded in [T8 evidence](../../reviews/2026-10-29-t8-completion.md). Complete deletion request/cancellation reconciliation is mandatory before restored access, including the interval before maintenance records a tombstone. Missing history blocks access; suppress restored raw originals if necessary. Hosted schedules, independent durable ledger storage and rotation, actual provider object restoration, alert delivery, geographic processing controls and complete operator notices remain open. This implementation does not claim production recovery readiness.
