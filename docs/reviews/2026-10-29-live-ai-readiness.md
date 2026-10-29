# Bounded live AI readiness check

Date: 29 October 2026, Asia/Brunei. Verdict: live verification is blocked before provider execution. No live text or transcription request was sent. Actual provider spend for this check is USD 0. T7 was not started.

The user authorized synthetic event text and synthetic audio only, at most USD 1 total, with temporary live gates and restoration afterward. Payment details, new terms acceptance, deployment, commits and pushes were excluded. Architecture, AI, operations/privacy/billing contracts, living scope, root/voice guidance and T4 through T6 completion evidence were read before activation decisions.

## Account evidence

The connected signed in Meta billing page shows USD 150.00 free credits in use, USD 0.00 current balance, and says content processed using free credits may be used for product improvement. This supersedes the earlier records' unconfirmed credit status. It does not establish a production privacy basis or zero data retention.

The same page explicitly says no payment method is on file and one is needed to make API requests. The API keys page has no keys and a disabled Create API key button. Payment remains a concrete blocker despite the active credits. No payment or key creation was attempted.

The account catalog lists `muse-spark-1.3` and `muse-voice-transcribe-1.0` at the approved prices. Catalog presence is not successful authenticated inference. Model entitlement, request compatibility, response quality, latency, actual usage accounting and account rate limits remain unverified.

The visible billing page does not show a credit expiry date. [Provider terms, section 13.3](https://dev.meta.ai/legal/terms-of-service) allow promotional credits to expire according to the account or supplemental terms. The claim deadline is not proof of credit expiry. Exact expiry and account specific exhaustion behavior remain unresolved. Do not deliberately exhaust credits to test this.

Billing calls its USD 10 monthly spend setting email notifications. It is not evidence of a hard stop. General [billing terms](https://dev.meta.ai/legal/terms-of-service) permit automatic payment collection, and [error documentation](https://dev.meta.ai/docs/error-handling) describes HTTP 402 for billing issues or insufficient balance. Neither proves that this grant stops all calls rather than rolling into paid usage after expiry or exhaustion. Treat future requests as billable regardless of credits.

## Privacy and billing safeguards

The free credit product improvement notice applies to this account's current funding arrangement. The public [pricing guide](https://dev.meta.ai/docs/pricing-rate-limits) describes Standard model training exclusions and separate Contributor variants, but does not resolve that account notice. Keep the existing Standard allowlist and restrict any later authorized credit funded test to wholly synthetic inputs. No real event data is approved for this funding mode. [ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) needs separate organization enablement; it is not established here. `store: false` is not a ZDR guarantee.

Published rates remain USD 1.25 input and USD 4.25 output per million Spark tokens and USD 0.18 per voice hour. [Reasoning documentation](https://dev.meta.ai/docs/reasoning) includes reasoning tokens in output budgets and billed output. Actual adapter cap semantics and reported usage still need live measurement before access/billing attestations can be set.

Existing controls remain intact: three calls and USD 0.15 reservation per analysis attempt, USD 0.018 per audio job, shared atomic ledger, workspace/global/day and lifetime limits, conservative unknown charges, evidence validation, organizer confirmation and separate transactional approval. Those existing USD 2/10/50 bounds do not implement this session's USD 1 authorization by themselves. No USD 1 live execution limiter was activated or claimed. Before a future live run, establish a durable aggregate run allowance that includes retries/reclaims, isolate workers and pending jobs, and reserve against the USD 1 ceiling without relying on provider alerts or credits.

## Private configuration and handoff

The existing ignored `.env.worker.local` has owner only permissions (0600), a configured restricted database connection, a blank `MODEL_API_KEY` and all three existing analysis/access/billing flags set to 0. The process has no model key. The web configuration has no model key. No secrets were printed or moved into web configuration. The checked in worker example already records voice configuration names; a provider credential alone cannot enable execution.

If the user independently resolves payment readiness and chooses to provision a key, create a dedicated verification key in Meta's API keys page. Store its value locally by opening `/Users/asmasalleh/repos/EventOps/.env.worker.local` in a private editor and replacing only the blank `MODEL_API_KEY=` value. Keep the existing database URL. Run `chmod 600 .env.worker.local` from the repository. Do not paste the key into chat, a shell command, `.env.local`, screenshots or source control. Leave every enablement flag at 0. Do not start either worker until the remaining privacy, expiry, exhaustion and USD 1 aggregate safeguards pass. No payment setup is authorized by this record.

Both private database gates, `analysis_budget_lock.enabled` and `voice_gate.enabled`, were read as false. The controlled worker harness temporarily exercises its local database gate with injected responses and restores the original false state in its finally block. No live provider gates were enabled. Voice environment flags are absent and therefore disabled.

## Verification evidence

`npm run check` passes lint, formatting, generated routes, strict TypeScript and all 137 tests in 22 files. `npm run build` passes production compilation and standalone packaging.

The controlled loopback worker suite passes all 16 groups through real Auth, mail, PostgreSQL and restricted workers, including interpretation, evidence confirmation, separate approval to revision 2, stale results, lease fencing, budget races and conservative charges. It uses controlled provider responses, not Meta.

The manual T4 loopback suite also passes all 12 groups, including saved text/corrections, immutable receipts, race handling, rollback, tenant denial, evidence backed manual approval and revision 2 briefing. This is local application verification, not a real provider flow.

The initial rerun exposed a harness UTC boundary defect: subtracting two hours put daily budget fixture rows on yesterday's ledger shortly after midnight UTC. The fixture now clamps to the current UTC day's start. During the first hour, the hourly quota can also reject those fixture rows, so that group alone does not isolate daily from hourly enforcement. A related global budget fixture now totals only the current UTC day's model ledger, matching its voice calculation. Production budget functions were unchanged. Two running synthetic jobs left by interrupted harness attempts were explicitly cancelled, retaining their conservative charges, before the successful rerun.

T6 conversion/service checks were not rerun: the previously used ffmpeg executable is unavailable at the inspected local paths. Existing T6 evidence and unit coverage remain valid historical evidence, not a new device or live transcription pass. No software was installed.

## Remaining readiness gaps

Payment readiness and private provider key provisioning block live execution now. Exact grant expiry/exhaustion, privacy conditions for real data, account entitlements, USD 1 aggregate test allowance, live request/usage semantics and complete real provider application flows remain open. Physical microphones, Safari/mobile, restricted hosted conversion, Storage identities, continuous cleanup, operator legal notices, geographic enforcement, hosted mail, recovery and broader release evaluation retain their existing production gates. No full release or actual model acceptance criterion is marked complete.
