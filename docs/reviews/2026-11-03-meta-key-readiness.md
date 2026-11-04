# Meta API key readiness

Later update: [bounded live text workflow verification](2026-11-03-live-text-workflow.md) records explicit temporary gate authorization, six successful provider responses, two valid results and a completed synthetic confirmation, approval and briefing path. The historical restriction banner did not block these successful calls. General live processing remains disabled after the bounded test.

Date: 3 November 2026, Asia/Brunei.

The user authorized creation of a dedicated key and requested live AI enablement. Meta confirmed creation of `EventOps local worker`; its value was saved only to the ignored `.env.worker.local` `MODEL_API_KEY` setting using the private editor. A read without printing the secret confirmed a nonblank setting and file permissions 0600. The key was not placed in web configuration, source control or this report. The clipboard was cleared and the secret display closed.

Fresh billing navigation confirmed a saved default payment method and promotional credits. Both billing and API key pages still explicitly report that the account is restricted because Meta could not place a temporary payment hold. Saved payment details and key creation therefore do not establish successful API access.

Live execution remains blocked. Existing model/access/billing environment gates remain 0; voice is absent and defaults off. No database gate was changed, worker started or provider request sent. Actual provider spend in this session is USD 0. This does not claim a fresh database-gate inspection.

The existing bounded-live prerequisites in [the readiness record](2026-10-29-live-ai-readiness.md) still apply, including synthetic inputs, durable aggregate allowance and verified access/billing semantics. The user's enablement request does not establish those factual attestations. Resolve or recheck Meta's restriction and complete the bounded preflight before enabling execution. No terms, payment settings, deployments, commits or pushes were performed.

Later clarification: the restriction banner does not prove an authenticated inference request will fail. The user explicitly requested an implemented live test. Inspection confirmed that the application already has a fixed Meta Chat Completions adapter in `src/features/analysis/provider.ts`, with the private key configured. No new integration implementation is needed to establish those facts.

An attempted one request synthetic adapter probe, with a durable USD 1 reservation, was rejected by automatic approval review before command execution. The review identified direct transport invocation while live access and billing gates remain disabled as a prohibited bypass. No provider request was sent and no API error or success was observed. Do not interpret this approval rejection as a Meta response. A normal worker test still needs an isolated synthetic job, an integrated durable aggregate limit and explicit temporary gate authorization consistent with completed prerequisite checks.
