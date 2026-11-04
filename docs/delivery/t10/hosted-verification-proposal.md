# Hosted verification proposal

Prepared 4 November 2026. This is a reviewable deployment proposal, not a deployment or authorization to incur charges. It follows the already approved architecture and preserves the submitted code and video.

## Proposed target

Use a separate EventOps staging environment with synthetic records only. Use Render for the Next.js web process and restricted worker processes, Supabase for database, Auth and private Storage, and Resend SMTP for authentication mail. Prefer matching available regions. Keep the staging environment distinct from unrelated projects and from the local campaign database.

The initial website can use the host supplied HTTPS address. Authentication mail needs an authorized sender domain. No domain purchase, unrelated project reuse, account creation, agreement acceptance or payment change is included in the proposal.

## Budget for approval

Proposed hosting ceiling: USD 100 total per month, including taxes and recurring resource charges, for one month of synthetic staging verification. This is a proposed spending limit, not a verified quote or permission to spend. Do not provision if the reviewed combined estimate exceeds it or if a provider cannot enforce an acceptable bound. Renewal needs a separate decision.

Current official Supabase pricing starts Pro at USD 25 per month with daily database backups retained for seven days. Those backups do not by themselves establish independent original object backup or the application recovery contract. Resend lists a free tier with a 100 email daily limit. Render compute, durable storage, independent backup destination, monitoring and any other charges need exact account checkout verification before provisioning. The current Render pricing page did not expose reliable compute amounts to the text reader, so no combined monthly quote is claimed.

The existing USD 15 synthetic Meta evaluation allowance remains separate. It is not a hosting allowance. General live AI stays disabled through staging setup and operational verification. Any later general access requires verified provider, geography and billing controls, not just a successful staging deployment.

Sources checked 4 November: [Render pricing](https://render.com/pricing), [Supabase pricing](https://supabase.com/pricing), [Resend pricing](https://resend.com/pricing).

## Local preparation before any external write

Prepare a pinned container build and dependency inventory from the current reviewed source. The web process uses the standalone Next.js server; the private workers use the existing analysis, voice and retention commands. The voice image needs a verified ffmpeg build. Verify image builds and starts locally before upload. The application currently has no deployment descriptor or container definition, so the image is not yet ready to deploy.

Map secrets by process. Public Supabase connection settings and APP_URL belong in the web environment. The private model key belongs only in the applicable restricted worker. Use dedicated worker identities and scoped Storage access, never owner or service role credentials for normal workers. Keep both database provider gates and worker model flags disabled at initial launch.

Prepare migrations and rehearse them against an isolated database before applying them to the new staging project. Configure HTTPS URLs, exact Auth redirect allowlists, six digit code templates, ten minute expiry and the documented resend minimum. Provider agreements and sender domain access remain participant responsibilities.

## Hosted acceptance sequence

1. Create the authorized isolated target and deploy the locally verified image with AI gates disabled. Check health, database readiness, anonymous denial and two synthetic owners' isolation.
2. Configure the authorized mail domain and SMTP, then verify actual delivery, resend, expiry, session recovery and revocation. The participant performs personal attestations or terms acceptance when required.
3. Run retention with a restricted identity and a durable independent deletion ledger. Verify actual byte deletion, retry behavior and failure alerts with synthetic data.
4. Configure independently encrypted database and private object backups, separate key custody and seven day expiry. Reconcile the latest deletion requests and cancellations, including the interval before a worker sweep.
5. Restore into an isolated hosted database and object service, verify byte hashes, immutable history and tenant denial, apply deletions before access, and measure data loss and recovery time against the 24 hour and four hour objectives.
6. Exercise failure notifications for heartbeat, backup age, retention lag and queue age. Verify delivery to the authorized operator, with no event content or secrets in telemetry.
7. Rehearse rollback to a compatible prior application image against the additive schema. Repeat protected reads and transactional approval checks using synthetic records. Never run destructive down migrations.
8. Record exact targets, image digests, regions, measured outcomes, costs and residual failures. A deployment alone does not pass these steps.

## Authorization still needed

The participant's earlier instruction explicitly prohibited deployment and paid provisioning. Approval of this proposal would need to explicitly permit a separate synthetic EventOps staging deployment and its hosting ceiling. It would not authorize accepting legal terms, entering payment details, changing the hackathon entry, pushing commits, reusing unrelated infrastructure or enabling general model traffic.

No provider resources, accounts, domains or hosting subscriptions were created while preparing this proposal. Existing local changes are preserved.
