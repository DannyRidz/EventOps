# T9 hosted readiness and recovery preparation

Date: 4 November 2026, Asia/Brunei. Hosted verdict: **blocked, no configured EventOps target**. No deployment or paid provisioning is authorized or performed.

## Actual target inventory

Read only inspection of the local configuration found APP_URL on localhost, public Supabase URL on 127.0.0.1 and the private worker database on 127.0.0.1. Only hostnames were printed, never keys or credentials. No deployment descriptor, container build definition, infrastructure file or hosted EventOps URL was found in the repository search. Unrelated projects visible in other browser tabs were not treated as EventOps infrastructure.

Local `GET /api/health` and `GET /api/ready` each returned HTTP 200 and `{"status":"ok"}`. These establish local liveness/database access only. They do not establish hosted mail, monitoring, backups, provider geography or a public release.

## Fresh local recovery drill

The prior temporary T8 ZIP was absent. Exclusively copied the existing synthetic browser workspace export from `/Users/asmasalleh/Downloads/eventops-workspace.zip` into `/private/tmp/eventops-t8-export.zip`, mode 0600, without overwriting an existing file. This is the same private ZIP whose member hashes were verified in the preceding T9 continuation.

Used the installed matching PostgreSQL 17.11 `pg_dump` and `psql` under the local Supabase cache with `scripts/verify-t8-recovery.mjs`. The first drill restored the current two-revision fixture but failed a test assertion hardcoded to one revision. The script was repaired to compare the exact complete source revision rows against restored rows under the owner's policies. The unrelated actor still sees zero revisions, and direct deletion remains rejected. This strengthens the history check and does not modify the application database.

The rerun exited 0 and reported:

- Encrypted database dump restores schema, ACLs, owner isolation, approved head, raw receipt and hash matched object manifest into the isolated target.
- Post-backup independent raw deletion replay removes restored bytes and metadata before access.
- Event deletion replay removes cyclic revision/evidence rows atomically.
- Local elapsed restore: **2.59 seconds**. Encrypted artifact: **779,719 bytes**. Production RPO/RTO: **unverified**.

The source and target were temporary loopback databases and removed in finally. Final inspection found zero collector roles, zero evaluation/backup/restore drill databases, zero queued/running analysis jobs and both running-project AI gates false. No hosted provider object store or independent durable host ledger was exercised.

## Concrete hosted acceptance checklist

The existing [T8 runbook](2026-10-29-t8-runbook.md) remains authoritative. The following is the evidence to collect after a specific isolated hosted target and the necessary operations are authorized. No boxes below are passed by the local drill.

| Requirement | Required actual evidence | Current gap |
|---|---|---|
| Target and operator | Exact app, database and object-service targets, regions, named responsible operator and contact | EventOps host and operator configuration absent |
| Auth mail/session | Hosted code delivery, resend/expiry, revocation and recovery behavior in a synthetic account | Local Mailpit evidence only |
| Independent backup | Scheduled encrypted database and original object-byte copies, consistent hashes, separate key custody, seven-day expiry | No configured destination/schedule/key store |
| Deletion reconciliation | Independently recoverable latest requests and cancellations, including requests made before a maintenance sweep | Local replay exists; durable hosted request history absent |
| Actual restore | Restore into authorized isolated host and object service, apply deletions before access, verify immutable history and owner isolation | Local PostgreSQL/object-manifest drill only |
| Retention worker | Restricted identity, independent ledger path, executed schedule, cleanup and ledger-failure behavior | Local worker only, no host schedule |
| Monitoring | Observed heartbeat, backup age, retention lag, queue age and bounded error alerts delivered to the operator | No external alert delivery/heartbeat integration |
| Application rollback | Previous compatible image exercised against current additive schema, protected read/approval smoke afterward | No deployed image or rollback target |
| Geography/notices | Trusted proxy/IP handling, licensed country lookup, actual provider/host regions and completed operator notices | Hosted configuration and operator facts unverified |
| RPO/RTO | Measured loss window and full host/object recovery time, evaluated against 24-hour/four-hour targets | Local 2.59 seconds cannot certify either target |

A hosted restore must keep provider gates and public access disabled until independent deletion history, source hashes, current heads, tenant denial and approval replay/rollback are verified. If deletion history is incomplete, restored originals stay suppressed and affected access remains disabled. Rollback uses a compatible image, never a destructive down migration. The user retains publication, terms, payments and deployment boundaries.

## Startup defect repaired during this work

The local standalone server had been launched without the root environment file. Reads and readiness worked, but writes returned “Sign in is temporarily unavailable” because APP_URL was absent. `npm start` now uses Node 24's optional `.env.local` loading before the standalone server. Environment values supplied by the host still take precedence. No private file is copied into the build or committed, and the web environment check showed no MODEL_API_KEY.

Read the installed version-matched Next environment and deployment guides before the change. After restarting through the corrected command, the same browser save succeeded and created a pending synthetic capacity proposal. No new sign in or terms action was used. Independent startup checks and code review approved the change in the [campaign review](2026-11-04-t9-campaign-review.md).
