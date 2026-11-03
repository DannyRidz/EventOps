# Bounded live text workflow verification

Date: 3 November 2026, Asia/Brunei. The user explicitly authorized a synthetic test through the normal worker, temporary test gates, a USD 1 aggregate ceiling and restoration afterward.

## Result

The Meta text integration works for the tested synthetic case. Two live worker runs produced `ready_for_confirmation`. The final run also passed organizer interpretation confirmation, proposal creation, transactional approval, approval receipt replay and approved briefing generation. No real event data was sent. This is not full T9 evaluation, a browser acceptance pass or voice verification.

The private key remained in ignored `.env.worker.local` with permissions 0600. The test used the actual adapter, orchestration and `runOne`, with a dedicated restricted PostgreSQL login executing normal claim, stage and finish functions. Setup, confirmation and approval used owner scoped functions. Disposable synthetic SQL identity fixtures were used, with no actual account sign in or legal acceptance.

The original database analysis and voice gates were checked false before and after each run. Only the disposable database analysis gate and process scoped verification flags were temporarily enabled. The web environment received no model key. No general worker was started. Disposable databases and temporary worker logins were removed after verification. Persistent worker enablement flags remain 0.

## Actual attempts

| Attempt | Requests | Result |
| --- | ---: | --- |
| live 01 | 3 | No HTTP response before timeout, `PROVIDER_NETWORK` |
| live 02 | 3 | Diagnostic aborts at 9,999, 9,993 and 9,994 milliseconds |
| live 03 | 1 | HTTP 200 after 26,166 milliseconds, 3,883 input and 4,000 output tokens, no usable result within the output cap |
| live 04 | 3 | Three HTTP 200 responses, 8,535 input and 3,707 output tokens, one option ready for confirmation |
| live 05 | 2 | Two HTTP 200 responses, 4,625 input and 2,142 output tokens, confirmation, approval, replay and briefing passed |

The final candidate moved Opening to Room 2 from 12:00 to 13:00 and assigned Synthetic Sam. SQL validation found no constraint failures. The official head stayed unchanged until explicit synthetic organizer approval. The approved revision was `8a8c729c-1797-4ec0-977f-7035355f773e`; approval replay returned the same receipt.

The final provider request IDs were `54fafdec-8996-44e1-8724-cd87eaae08f1` and `7c2263a0-73ef-46c7-95c7-da81c435e354`. Response header times were 12,614 and 3,951 milliseconds. Both returned `muse-spark-1.3` and stopped normally.

Private synthetic receipts and the durable campaign ledger remain in ignored `output/live-analysis-private/`, without the API key. Stable attempt keys prohibit repeating a previously reserved call. Each request reserves USD 0.05 before I/O. The existing 16,000 input and 4,000 output token bounds, including reasoning, and no paid tools fit that reservation at published rates. The journal enforces USD 1 across attempts and restarts. All 12 reservations remain held, totaling USD 0.60. No reservation was refunded to permit more testing.

Usage reported in the six HTTP 200 responses computes to USD 0.063162 at uncached Standard rates. This is a usage based estimate, not a confirmed provider invoice. The six timed out requests have unknown usage. SQL conservatively charged USD 0.363163 in aggregate, including USD 0.30 for unknown attempts. Promotional credits were not treated as a hard spending safeguard.

## Fixes and validation

The adapter aborted while waiting for response headers after ten seconds. An eleven second controlled response reproduced the failure. Header waiting now uses the existing 35 second request bound within the unchanged 90 second job deadline. The regression test passes and a real response subsequently arrived after 26 seconds.

Default reasoning exhausted the 4,000 token cap on that response. The adapter now explicitly requests documented `minimal` reasoning while retaining the model, strict schema and token cap. Subsequent live runs completed. Organizer confirmation and transactional approval remain mandatory.

The controlled runner check proved access error handling, conservative unknown charge retention and gate restoration without live I/O. `npm run check` passed lint, formatting, route types, strict type checking and 159 tests in 26 files after the adapter changes. The production build and standalone packaging passed. Offline corpus source hashes were refreshed; six corruption checks passed. The 30 case corpus and its 90 live evaluation slots were not executed by this separate smoke campaign.

## Remaining limits

Meta's dashboard restriction banner remains unresolved, but did not block the six successful HTTP responses. Do not interpret the banner alone as proof that the key cannot infer. No payment change or external support message was performed.

The native Supabase package cache was incomplete. Missing official runtime packages were preserved under backup names and downloaded again. The resulting local database had zero profiles and zero events; earlier temporary export and browser fixtures were unavailable. No reset command was issued. Historical authenticated browser data was not recovered. The SQL test establishes the worker and transaction path, not fresh authenticated browser behavior.

Full model evaluation, voice, device/accessibility checks, production privacy and operations, grant expiry and exhaustion behavior, hosted configuration, deployment and submission remain open. No full release claim, persistent live activation, deployment, commit or push occurred. Root guidance and older readiness reports saying all Meta access is blocked describe historical evidence and should be read with this update.

## Official references

The [Chat Completions schema](https://dev.meta.ai/docs/api-reference/chat-completions/schemas) includes reasoning in `max_completion_tokens`. The [reasoning guide](https://dev.meta.ai/docs/reasoning) documents minimal effort. [Pricing](https://dev.meta.ai/docs/pricing-rate-limits) lists Standard Spark input USD 1.25 and output USD 4.25 per million tokens. The [geographic policy](https://dev.meta.ai/legal/geographic-use-policy) was checked; no geographic bypass was used. Synthetic inputs preserve the existing free credit product improvement boundary.
