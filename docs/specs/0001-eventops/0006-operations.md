# Security, privacy, accessibility, and operations

## Summary

Use a private, isolated workspace and collect only the data needed for event logistics. Before public release, prove authorization, recovery, accessibility, and provider behavior with the actual deployed application. A polished interface is not a release gate by itself.

## Security model

The sole human role in the first release is owner. Each account receives one private workspace; there is no membership editor or invite route. The schema preserves workspace ownership for later roles, but unused roles cannot be assigned through the API. A volunteer is an event record, not an application account. Support has no customer content access screen or impersonation capability.

| Actor | Allowed | Denied |
|---|---|---|
| Visitor | Product information, sign in, public legal pages | All workspace and event content |
| Owner | Read own event data; stage imports and updates; edit proposals; approve; restore; export; delete within policy | Other workspaces, direct mutation of immutable revisions, bypassing checks |
| Worker | Claim scoped jobs; read required inputs; store staging results; run cleanup | Impersonating a user approval or issuing external messages |
| Model | Process the bounded supplied context and return typed candidates | Database credentials, unrestricted tools, plan commit, external account actions |
| Operator | Deploy, rotate credentials, recover infrastructure under an audited procedure | Routine browsing of customer event content; silent changes to official records |

Use server verified sessions, authenticated database calls, and row level security on every tenant owned table. Composite ownership keys protect related records. Tests must include storage paths, source viewers, job IDs, history, exports, RPC functions and expired links, not just event list queries. Broad service credentials exist only in the worker or narrowly scoped account management path, never the browser or normal event reads. Prefer restricted database grants for job functions over giving a worker arbitrary SQL access. [Supabase row security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Protect session cookies with Secure, SameSite, and the auth adapter's supported server flow. Validate identity server side rather than trusting a cached session object. Apply origin/CSRF checks to mutations, redirect allowlists, login and upload rate limits, and a restrictive content security policy. No user supplied HTML or Markdown rendering. Ensure fresh session handling on sign out and expiry; sensitive pages use no shared cache. Never put IDs with confidential text or tokens in analytics URLs.

Default code expiry is ten minutes in the product configuration, resend cooldown at least sixty seconds, and failed verification attempts are throttled by identity and IP. Use generic delivery messages that do not disclose account existence. Require reauthentication within ten minutes for account deletion or recovery setting changes. Operator accounts use the provider's MFA where supported and separate least privilege credentials.

## Uploads and recording

Enforce the [data contract's limits](0004-data.md) at the reverse proxy, request parser, storage policy and worker. Validate extension, MIME and actual bytes independently. Escape filenames; use random object keys under server selected workspace/event prefixes; never derive a path from a supplied filename. Use private buckets and authenticated download handlers. Export URLs expire after five minutes and include no public sharing setting.

Only CSV and the explicit recording formats are processed. Reject archives, executable files and unknown media. Parse CSV as text without formulas, HTML, external links, or macros. Media conversion runs without shell interpolation, using a fixed argument list, restricted CPU, memory, output size, duration and process timeout. No network access from the conversion process. Strip metadata and delete temporary files even on errors. Keep the conversion image patched. No claim of antivirus coverage is made without such a service and verification.

Source records and generated responses are untrusted input to the UI. Escape all output, enforce lengths, and serve downloads with explicit content type and disposition. Source files cannot instruct a model or worker to read a path, retrieve a URL, or contact a volunteer.

## Data minimization, retention, export, deletion

Recommended launch region is Singapore for application and database where supported. This is a latency choice, not a promise of data residency: authentication, email, error tracking and Meta processing may use other locations. Document the actual providers and processing locations in the privacy notice before collecting real data. Do not advertise regional confinement without contractual confirmation.

Use adult organizers and adult volunteer rosters in the initial product boundary. Collect organizer email for sign in, optional display name, logistical volunteer name or alias, availability, and explicit role tags. Do not collect identity documents, phone numbers, medical or accessibility notes about individuals, demographics, salaries, or attendee profiles. Venue features such as step free access are room facts, not individual health information.

At first account creation, record an explicit adult eligibility attestation and the accepted product terms/privacy versions. Do not collect birth dates. Require the organizer to confirm they are authorized to supply the roster and that the supported roster boundary is met. These controls do not independently prove consent or age; the privacy notice must not claim they do.

For geographic access, recommend a licensed local MaxMind country database with current updates, using the deployment's verified client IP source and trusted proxy configuration. Never trust a caller supplied country header. Compare the country result against the current provider restricted territory policy before offering model processing, without storing full IP addresses in event data. Unknown or denied locations cannot call the model; retain an explanatory manual flow only where product and legal policy permit. Database licensing/account setup and the exact host proxy behavior require verification before launch. No geolocation service or account was activated during planning. MaxMind documents account and license key requirements and automated local database updates. [GeoLite documentation](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/).

| Data | Recommended retention | User control |
|---|---|---|
| Raw recording and temporary converted WAV | Delete within 24 hours of successful transcript or failed transcription finalization; absolute maximum seven days | Delete immediately after text confirmation or discard; text alternative always available |
| Original CSV files | 30 days from import | Delete raw file earlier; frozen imported values remain as source records while event is retained |
| Confirmed text, source values, plan revisions, proposals | Until event purge, default 90 days after event date | Shorter event retention of 30 days or extension to 365 days; show effect before changing |
| Unconfirmed drafts and staging | 30 days of inactivity | Discard earlier; warn before automatic expiration |
| Event in trash | Seven day recovery window | Restore during the window; purge afterwards |
| Account deletion | Seven day grace period after reauthentication; sign in may cancel through an explicit recovery flow | Export first; disable processing immediately; purge on deadline |
| Audit and model run content references | Same event lifetime, then purge or remove identifiable references | Deletion removes event content; no indefinite private copy |
| Redacted operational logs | 14 days | No event text, filenames, tokens or raw model bodies |
| Aggregate metrics | 90 days | Counts only, no stable personal identifiers after account purge |
| Generated export objects | 24 hours | Download while authorized; deletion invalidates access |
| Recovery backups | Seven day rolling retention target | Apply deletion tombstones on restore; no normal customer access |

Immutability applies within a retained event. Evidence links remain useful after a raw recording or original file expires because the frozen text or cell value and hash remain. Show “Original recording deleted” honestly; do not pretend playback is available. Deleting an event removes the source values as well as raw files and revisions. Do not preserve private values merely to keep an audit record complete.

Workspace export is a private ZIP created by application code from known files, with JSON snapshots, source values, update and audit records, and CSV plan tables. ZIP input is still rejected. Explicitly identify any expired raw files omitted. Account deletion also removes the auth identity after ownership checks, revokes active sessions, cancels pending work, and deletes provider stored artifacts where used. The selected AI path avoids uploading reusable files to Meta. The app cannot promise deletion of provider retained abuse records; disclose the provider policy accurately.

Backups can retain deleted content until expiry. A separate minimal deletion tombstone ledger outside ordinary restores contains opaque account/event IDs, deletion timestamp and expiry, no event content. Reapply it before restored data is served. Disclose the maximum backup retention and any contractual provider exceptions in the privacy notice. Test deletion of orphan storage objects and partially failed jobs.

Legal pages must name the actual operator, support address, providers, purposes, lawful processing basis as applicable, retention, export and deletion controls, rights handling, and contact route. Those operator identity and jurisdiction facts are unresolved launch dependencies. The plan does not assert GDPR, PDPA, SOC 2, or any other certification or compliance. Legal review and user acceptance of provider terms remain the operator's responsibilities, not actions taken by the planning agent.

## Accessibility and performance requirements

Use the experience specification for the visual and interaction target. Verify WCAG 2.2 AA with automated checks and manual keyboard/screen reader work; automated tools alone are insufficient. Test the core journey with VoiceOver on Safari and NVDA on a supported Windows browser when available. If a required environment is unavailable, record the gap instead of claiming a pass.

Targets to measure at release: plan reads under one second at the 95th percentile at the release limits; ordinary saved mutations under two seconds excluding provider processing; initial largest contentful paint within 2.5 seconds on a representative mobile connection; no layout shift from disappearing approval controls. Load test ten active organizers, two simultaneous analyses and bounded full size events. These are proposed supported loads, not demonstrated capacity. Paginate histories at 25 records and avoid rendering hundreds of editable cells simultaneously.

## Environments and secrets

Use isolated local, staging, and production projects. Staging contains synthetic fixtures only. Never copy real roster data into a public repository or preview environment. A production budget may cover one hosted project; run staging locally if a second paid project is not approved. A production restore exercise still needs an isolated approved target.

Configuration inventory for later implementation:

| Configuration | Handling |
|---|---|
| `APP_URL`, `DEPLOY_ENV`, allowed origins | Nonsecret environment values; HTTPS in hosted environments |
| Supabase URL and publishable key | Only public scoped credentials may reach browser; still require policies |
| Supabase service/admin secret | Worker/account management only, never `NEXT_PUBLIC_*` |
| Restricted job database connection | Worker only, TLS, minimal grants, rotated separately |
| `MODEL_API_KEY`, model allowlist, spend caps | Server and worker secret/config store; no developer key in source |
| SMTP credentials and sender domain | Auth provider configuration; domain verification before public sign in |
| Error tracking DSN and server auth token | Redaction before sending, no session replay by default |
| Backup encryption key and destination credentials | Separate secret store and restricted operator access |
| `FFMPEG_PATH` and worker limits | Fixed image path and config, never request controlled |

Provide a later `.env.example` with names and explanatory placeholders only. Run secret scanning before any repository exposure. Rotate a leaked key immediately, revoke it, inspect use, and rebuild without the secret. Public Git history must also be checked. No production secrets in build arguments, error pages, screenshots, or model prompts.

## Deployments, migrations, and maintenance

After approval, use a reproducible container build and CI gates for type checking, lint, tests, database migrations and dependency scanning. Keep migrations in version control. Use additive changes first, deploy compatible application code, backfill if needed, then remove old fields in a later release. Version snapshot schemas and retain readers for earlier revisions. Never rewrite historical snapshots in place to simplify a migration.

Take a backup and rehearse migrations against an isolated copy before production. Release the web and worker from the same commit with compatible schema versions. Roll back the image for application faults; do not blindly run destructive down migrations. A failed migration blocks deployment. Protected branches and a manual production release step are recommended. Publishing and paid resource creation require separate user authorization; this document does not provide it.

The web service exposes a minimal liveness endpoint; readiness checks database access without revealing credentials. The worker reports heartbeat, oldest queued job age, failed jobs, cost reservations and pending cleanup. A readable current plan must not depend on AI health. No public uptime percentage is claimed.

Weekly: review error patterns, verify backup completion, inspect failed retention jobs and spend. Monthly: patch runtime and media dependencies, check auth mail delivery, run a restore drill, review provider policy/model changes and rerun critical evaluations. Keep an operator runbook with owner and recovery contact, not invented names.

## Backup and incident recovery

Supabase Pro lists daily database backups with seven days of retention. Database backups do not contain stored object bytes. Separate encrypted object copies and a consistent database/object manifest are required for recoverable original files. [Database backups](https://supabase.com/docs/guides/platform/backups).

Recommend a daily encrypted logical database export and object manifest to an independent approved object store, with seven day expiry and access distinct from the live app. The recommended destination is an S3 compatible backup bucket in a separate account, with provisioning deferred until authorized. A daily export gives a recovery point objective of up to 24 hours of data loss and a recovery time objective of four hours. Those are goals to prove; they are not an uptime or recovery guarantee. Events needing near zero loss require a later point in time recovery budget and tested procedure.

Recovery steps:

1. Put writes into maintenance mode and disable AI job pickup; preserve readable data if safe.
2. Restore the database into an isolated target, then restore object bytes matching its manifest. Verify hashes and references.
3. Reapply deletion tombstones, check membership and storage policies, verify revision chains and current heads, and expire incomplete leases.
4. Run the ownership, approval, export and briefing smoke cases. Reconcile jobs and cost reservations without rerunning completed approvals.
5. Switch the application only after verification, announce any known lost changes accurately through the authorized support process, and record a postmortem.

For provider outage, keep text/manual planning available and pause external jobs. For an isolation incident, disable affected access, revoke credentials, preserve redacted evidence, assess scope and applicable notification duties, and communicate only through an authorized operator. The agent has no standing permission to contact users or organizers.

## Monitoring and cost

Alert on approval errors or invariant failures immediately, repeated authorization denials, worker heartbeat absent for two minutes, queue age over two minutes, backup age over 26 hours, retention lag over 24 hours, and budget reservation exhaustion. Redact event content and aggregate by opaque internal identifiers.

Planning baseline: Supabase Pro from $25 monthly, plus application hosting, worker, mail, backup and monitoring. Budget $55 to $90 monthly before AI for a small hosted release, subject to account quotes. Supabase pricing is verified; Render's pricing page did not expose a complete compute table through text extraction, so do not present the range as a quote. [Supabase pricing](https://supabase.com/pricing), [Render pricing](https://render.com/pricing). AI estimates are in the AI specification. No purchase or billing commitment has been made.

## Consequences and release boundary

The short delivery window cannot establish a long operating history. Release only after the actual gates pass, and keep exposure limited if restore drills, privacy disclosures, mail delivery, voice support or provider permissions remain incomplete. A submission can honestly show working implemented behavior without claiming a general public production launch.
