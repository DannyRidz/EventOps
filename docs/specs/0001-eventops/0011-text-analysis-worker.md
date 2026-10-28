# T4 confirmed text analysis and worker

Date: 28 October 2026. This refines the approved AI and data contracts for the remaining T4 implementation. The user authorized recommendations and completion without questions. The earlier T4 local record describes the starting boundary, not a reason to leave implementable code missing.

## Decision

Extend the existing durable job table additively. Use a separate Node process and a narrowly privileged PostgreSQL login with the `pg` driver. Unlike an Auth owner or service role, it can execute only claim, heartbeat and finish functions in a worker schema. It cannot call approval functions, create an owner session, or read arbitrary tables. A lease token fences results from a replaced worker. Source text, revision and generation are frozen before work. Newer draft generations and changed heads invalidate results.

Keep `MODEL_API_KEY` in the worker only. Live processing needs explicit operator enablement, completed provider terms/access/billing checks and a verified billed-token bound. None of those flags is set by the agent. The production URL and Standard `muse-spark-1.3` are fixed. Controlled test transports use dependency injection inside tests only, not a product fixture mode or arbitrary runtime URL override.

## Sources and behavior

The saved confirmed update supplies text and its frozen source ID. The immutable revision supplies the complete plan, allowed IDs, known availability and constraints. A closed typed intent envelope supplies proposed requests, exact text spans, ambiguities and unsupported requests. The server checks spans, IDs, action fields, duplicate names and schema. Volunteer names are masked in provider input. No contacts, account identity or credentials are included. Model prose is never displayed as a fact.

Deterministic functions resolve exact IDs, compute the impact closure, apply supported intent types, enumerate at most 20 candidates and run the complete validator. No implicit time flexibility is allowed. A requested time range must be explicit. Up to three valid options are retained, ordered by changed sessions, displacement and stable IDs. Missing fields and impossible options yield questions/unresolved results. A second model call may select an existing option; its ID and per request dispositions must match, with citations resolving to the frozen text or base. One shared repair allowance keeps the total within three calls. Explanations shown to the organizer are server generated from validated facts and real citations.

The organizer reviews the original text, every interpreted request, impact, questions and full candidate. A separate explicit confirmation attests that the interpreted requests cover the update and confirms any asserted new facts. Only then does an owner function recompute the candidate from typed requests, freeze the confirmation and create a proposal. Model output alone cannot establish availability or produce an approvable proposal. The existing approval transaction additionally recomputes the confirmed typed request contract for analysis proposals, alongside schema, constraints, provenance, head, digest and canonical patch checks. There is no worker approval capability.

## Durable execution and controls

Confirmation still saves a blocked job when access is not enabled. Once the operator enables verified access, an owner may explicitly queue or retry acknowledged work. Enqueue verifies the current head/generation, reserves $0.15, serializes the global budget, and enforces one active job per event, two per workspace, ten per hour per workspace, $2 per workspace/day, $10 globally/day and $50 lifetime development allowance. Old reservations remain conservatively charged after unknown failures. Reconciliation uses reported billed input/output usage only within the verified bound; unknown usage retains the full reservation. All model requests including repairs and transport retries count toward the three call maximum and worst case reservation.

A job lease lasts beyond the 90 second run deadline. Expired leases can be reclaimed with a new fence. Each retry reserves another worst case envelope; abandoned attempts retain charges. At most three worker attempts are automatic, then explicit retry is required within a ten generation/attempt ceiling. Jobs expose real stages and safe error codes, never raw provider errors. 429 uses Retry-After, network/5xx uses bounded backoff, and all calls honor input/output, response and total deadlines. Provider auth failures do not retry. Queue reads and worker functions fail closed for trashed/archived events or deleted workspaces.

## Verification and completion boundary

Implement and test the interpreter, option tools, guarded adoption/approval, lease races, stale results, quota races, conservative charging, transport failures and repairs with synthetic local services and controlled provider responses. Run the existing manual T4, T3 and T2 suites. Drive the result review and approval UI locally. This can establish local implementation completion without real Meta execution. Live Meta capability, quality, billing semantics and full release acceptance remain blocked until user handled provider prerequisites and authorized synthetic live probes. Do not claim real integration verification or deploy.

## Build plan

1. Closed contracts and pure deterministic interpretation/option tools, AC 11 to 16 and 25.
2. Restricted lease/reservation database functions and worker transport, AC 21, 24 and 29.
3. Owner request confirmation, transactional proposal validation and result UI, AC 09 and 15 to 23.
4. Local service, failure, race, browser and fresh review evidence, keeping the external gates explicit.

## Rationale

Extending the existing queue preserves acknowledged work and keeps the manual fallback. A separate restricted login is preferable to a service role credential with broad authority. Organizer confirmation is required because semantic extraction cannot be made authoritative merely by validating a model's JSON. Shared intent fixtures guard TypeScript/PostgreSQL recomputation parity.

Meta's structured output guide was checked on 28 October 2026. It documents chat completions, JSON Schema strict mode and content responses at https://dev.meta.ai/docs/structured-output. Provider capability is documented, account authorization is not inferred.
