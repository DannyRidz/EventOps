# EventOps

Event operations with reviewed changes to schedules, rooms, and volunteer assignments.

## Local setup

Use Node 24.15.0 (`nvm use`) and npm 11.12.1. Run `npm ci`, then `npm run dev` and open http://localhost:3000.

`npm run check` runs lint, formatting, strict type checking and tests. `npm run build` creates the production build; `npm start` serves it. `GET /api/health` checks process liveness only.

## Current milestone

T1 provides the runnable foundation, preparation page, shared accessible controls and states, development verification surface, repository guidance and CI configuration. T2 now adds authentication and event setup as described below. AI providers are not connected. No external credentials are needed for T1.

To inspect isolated states, run `EVENTOPS_INTERNAL_UI=1 npm run dev` and visit `/internal/foundation`. Production always responds with 404 for that route, even if the flag is set. Keep `.env.local` private. `.env.example` documents the local flags.

The complete [plan](docs/specs/0001-eventops/index.md), [delivery order](docs/specs/0001-eventops/0007-delivery.md), and [scope](docs/scope/scope.md) are durable project records. The first complete operational loop follows event setup.

The [T1 verification record](docs/specs/0001-eventops/0008-foundation.md) documents the local build, 17 tests, real browser checks, recovery exercise, review and remaining limitations. `/internal/recovery` is an additional development only server-error exercise; production rejects it.

## T2 accounts and event setup

T2 adds email code sign in, one private workspace per organizer, event setup drafts and authenticated draft reads. PostgreSQL policies and transactional functions enforce ownership, a ten event limit, retry receipts and stale edit rejection. An event setup draft is not an approved operational plan.

For local verification, use synthetic email addresses ending in `@example.test`. Mail is captured locally and never sent to an external inbox. PostgreSQL client tools (`psql`) are needed for the expiry fixture in the live verification script.

1. Copy `.env.example` to `.env.local`. Keep it private.
2. Run `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase start --runtime native --exclude studio,realtime,functions,analytics,pooler --eager`. The first start downloads the pinned local services. The experimental native runtime supports macOS 14 or later on Apple silicon and supported Linux environments. Docker can also run the stack.
3. Read local endpoints with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase status --output-format json`. Set `NEXT_PUBLIC_SUPABASE_URL` to its API_URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its PUBLISHABLE_KEY. Set APP_URL to `http://localhost:3000`. Do not copy secret or service role keys into the application.
4. Run `npm run dev`. In another terminal, run `SUPABASE_HOME=/private/tmp/eventops-supabase node scripts/local-supabase.mjs`. This development adapter adds GoTrue template URL environment variables to the downloaded Auth shell launcher in that dedicated temporary cache, then restarts local services. CLI 2.122 cannot serve `content_path` templates in its native runtime. The adapter retains real email delivery, OTP verification, expiry and throttling. Keep EventOps running at port 3000 so Auth can fetch the static code template.
5. Open `/sign-in`. Find the delivered code in the local Mailpit URL printed by status (normally `http://127.0.0.1:54324`). Sign in, create an event, reload its draft and continue editing.

To repeat the live checks, save `supabase status --output-format json` to a private file, then run `T2_STATUS_FILE=/path/to/status.json node scripts/verify-t2.mjs` while EventOps is running. The harness requires loopback services, creates only synthetic records and moves one synthetic account's OTP timestamp to test expiry. It covers real sign in, resend limits, ownership, direct database policies, concurrent saves, quotas and sign out. Its default status path is `/private/tmp/eventops-local-status.json`. Never commit status output, captured mail or session cookies.

For a production build, stop the dev server, run `npm run build`, then `HOSTNAME=127.0.0.1 node --env-file=.env.local .next/standalone/server.js`. Stop local services with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase stop`. A database reset deletes local records; use it only deliberately.

Hosted readiness remains open: operator identity and complete legal notices, a mail domain, Resend SMTP, Supabase configuration and real delivery checks. Configure email confirmations, six digit codes, 600 second expiry and a 60 second resend minimum. Both signup confirmation and magic link email templates must use `supabase/templates/code.html`. No provider account was created or terms accepted. Meta model access has not been tested. The local notice permits synthetic evaluation only. Deployment remains a separate authorization.

## T3 plan integrity

T3 adds the backend for operational plans. Authenticated APIs can stage all six record types, capture immutable manual evidence, confirm revision 1, create a checked manual proposal and approve it transactionally. The server and PostgreSQL both validate the whole plan. Replays return immutable receipts, while stale generations, conflicting heads, invalid constraints and bad evidence cannot commit. Setup edits preserve staged records and require fresh staging before confirmation. Approved event pages and lists read the current revision.

T4 now adds the local manual editor, proposal review and briefing screens described below. Live Meta access remains disabled pending provider prerequisites.

Apply migrations locally with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase migration up --local`. Start the local services and application using the T2 instructions. Run `node scripts/verify-t3.mjs` for real Auth, database, source, approval race and fault checks. It requires local `psql`, creates synthetic records, inserts deliberately damaged test candidates with administrative local SQL, temporarily injects a receipt failure scoped to a synthetic event, and restores test lifecycle flags. It never targets hosted services. Use `T3_APP_URL` and `T3_STATUS_FILE` to override the loopback defaults.

`node scripts/verify-t3-migrations.mjs` rehearses every migration in a temporary local database, supplies only the referenced managed Auth schema contract, and drops that temporary database afterward. It does not reset the running project. The real-service harness separately verifies managed Auth and row policies in the running Supabase database.

The immutable v1 plan contract lives in `src/features/plans/schema.ts`. Its JSON Schema is embedded in the migration and checked for drift by tests. Supabase's pg_jsonschema extension enforces the same field shape in PostgreSQL. Future schema changes need a new version and migration; do not rewrite already applied migrations. The [T3 specification](docs/specs/0001-eventops/0010-plan-integrity.md) records input and patch formats. The [verification record](docs/reviews/2026-10-27-t3-plan-integrity.md) records the actual checks and remaining boundaries.

## T4 local operations loop

Open an event and choose **Enter starting plan**. Add rooms, sessions, volunteers, availability, assignments and dependencies as needed. New record references use their entered identifiers. Save for checks, inspect the whole starting plan and frozen field evidence, then explicitly confirm revision 1. For approved events, **Propose manual changes** creates a checked candidate. Review before/proposed/evidence rows and use **Review approval** before saving a new official revision. Invalid and stale candidates remain blocked. Rejection preserves the official plan.

**Updates** saves text before it can be confirmed. Original text and corrections remain distinct. Confirming exact saved text records a durable **Awaiting model access** job. No analysis runs and no text goes to a provider. You can reload acknowledged text, or prepare exact manual changes. **Briefing** uses only the selected approved revision; older briefings are explicitly historical.

Apply all additive T4 migrations with the same local migration command above. `node scripts/verify-t4.mjs` runs loopback only synthetic service checks, including a temporary scoped SQL failure trigger removed afterward. It requires local `psql`. Use `T4_APP_URL` and `T4_STATUS_FILE` to override the application and private status file defaults. Keep sessions and mail out of source control. The browser keeps only retry operation UUIDs in tab scoped session storage, never private plan text.

T4 implementation is complete locally, including typed Meta interpretation, deterministic options, a restricted durable worker, retries, cancellation and cost controls. The model path is verified with controlled responses only. Live provider execution remains disabled and unverified. Required terms, account/model/billing/retention access, hosted mail, operator notices and deployment readiness remain external gates. See the [T4 completion record](docs/reviews/2026-10-28-t4-worker-completion.md) for evidence and the acceptance boundary. No deployment, terms acceptance, live model call or paid resource creation occurred.

## Analysis worker

`npm run worker` starts the separate Node worker when its environment is already supplied. You can also use `node --env-file=.env.worker.local scripts/analysis-worker.mjs`. Copy `worker.env.example` to that ignored private file when configuring it deliberately. Keep `MODEL_API_KEY` and `WORKER_DATABASE_URL` only in the worker environment, never the web or browser configuration. The worker uses the same pinned Node runtime and source checkout.

The database login must have only `eventops_worker` membership. The worker sets that restricted role and invokes only its claim, stage and finish functions. It cannot approve, read arbitrary application tables or use an owner JWT. An operator can prepare the login using administrative SQL, then set its password privately with psql's `\password` command:

```sql
create role eventops_worker_login login noinherit;
grant eventops_worker to eventops_worker_login;
\password eventops_worker_login
```

Do not enable live processing until the user has handled required provider terms and the operator has verified authorized access, Standard model availability, billing bounds and privacy/retention behavior. The three `EVENTOPS_MODEL_ENABLED`, `EVENTOPS_META_ACCESS_VERIFIED` and `EVENTOPS_META_BILLING_BOUND_VERIFIED` flags default to `0` in the examples. Web and worker must receive the verified flags deliberately, and an administrator must separately enable `eventops_private.analysis_budget_lock.enabled`. These settings are attestations, not an automatic legal acceptance or proof of access. They remain disabled in this implementation session.

When enabled, confirming text queues a reserved analysis. You can close the browser, return to **Updates**, open the saved analysis and review the original text, every interpreted request, affected records and validated choices. Confirm that the interpretation covers the complete update and confirms any new facts before creating a proposal. Approval remains a separate action. Corrected text or a changed head blocks the older result. Questions and unsupported requests remain unresolved and offer correction or the manual editor. Queued or running work can be cancelled.

Each attempt reserves USD 0.15. Limits are one active job per event, two per workspace, ten per workspace/hour, ten across all generations of an update, USD 2 per workspace/UTC day, USD 10 globally/UTC day and USD 50 lifetime development allowance. Unknown and abandoned attempts retain their reservation; only known usage or queued work that never started is reconciled. Provider retries and repair share a three call, 90 second envelope. A failed job offers explicit retry within those quotas. Operator/provider notices and actual hosted measurements remain required before launch.

`node scripts/verify-t4-worker.mjs` runs the real local database/worker path with controlled responses, not Meta. It requires loopback services and local PostgreSQL client tools, creates only synthetic accounts/records, uses a disposable restricted login, temporarily adjusts synthetic ledger/attempt fixtures and restores the local database gate afterward. Use `T4_WORKER_APP_URL` and `T4_WORKER_STATUS_FILE` for overrides. It tests lease fences, exact SQL/TypeScript request parity, schema drift, UTC budgets and concurrent reservation limits, generation limits, cancellation, safe telemetry, organizer confirmation and approval. No live provider key is needed.

## T5 CSV imports and correction

Open an unapproved event and choose **Imports**. Download the six header templates, upload UTF 8 CSV files, map source columns and review every included row. Files are limited to 2 MiB each and 10 MiB per batch. Quoted commas, escaped quotes, LF, CRLF and a UTF 8 BOM are supported. A malformed file fails before a batch is saved.

Originals are stored in the private `event-imports` Supabase Storage bucket. PostgreSQL independently parses the uploaded bytes and retains a bounded immutable verification receipt. Downloads verify hashes and recover from that receipt if the Storage copy is missing or mismatched. Referenced originals have no authenticated overwrite or delete policy. Cleanup may remove only unreferenced objects in an owned draft event. Retention and purge across both copies remain T8 work.

Mappings, cell corrections, exclusions, explicit Keep one decisions and repeated-time offsets save as immutable correction versions. Invalid corrections can be saved and resumed. Conflicting IDs block staging. Equal names never merge records. Exact repeated files open their earlier batch. Review all defaults before replacing the starting draft. Whole plan checks and optional manual coverage precede the separate revision 1 confirmation. Later bulk replacement is rejected; use a reviewed manual proposal for subsequent changes.

The native local stack must include Storage, as in the updated startup command above. Apply all migrations with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase migration up --local`. No reset is needed. `node scripts/verify-t5.mjs` runs synthetic loopback Auth, database and private Storage checks. Its default app URL is `http://localhost:3001`; set `T5_APP_URL` and `T5_STATUS_FILE` to override the loopback defaults. `T5_BOUNDARIES=1 node scripts/verify-t5.mjs` also stages and confirms all six maximum collection counts with a near 2 MiB file. It requires local `psql`; a scoped synthetic failure trigger is removed in a finally block. Private fixture sessions stay under `/private/tmp`.

The completion and browser evidence are recorded in [T5 local completion](docs/reviews/2026-10-28-t5-imports-completion.md). Live Meta execution remains disabled. No provider key, credit balance or live model behavior is inferred from local import tests.

## T6 voice recording and transcript review

Updates now includes local recording, stop, playback and discard. The typed update stays available throughout. Supported input is WebM with Opus or MP4 with AAC, limited to 120 seconds and 10 MiB. Recording requires a secure browser context (HTTPS or loopback), permission and a supported MediaRecorder codec. Audio is sent to Meta only after an explicit upload, with the processing notice shown before recording. Original transcript text is immutable, corrections save as new draft generations, and exact text confirmation remains separate from analysis and plan approval.

Live transcription is disabled. `EVENTOPS_VOICE_ENABLED=0` is the default in both environments. Future activation also requires the existing verified access and billing flags, a worker only model key, and deliberate activation of the private `eventops_private.voice_gate`. No credential alone enables work. Provider terms, payment setup and API key provisioning remain external blockers. Submitted credit and billing support requests do not establish an available credit balance.

`npm run worker:voice` runs the separate restricted worker. It needs `WORKER_DATABASE_URL` with only `eventops_worker` membership, private Storage URL/publishable configuration, and `EVENTOPS_AUDIO_STORAGE_TOKEN`, a separately scoped signed JWT whose role is `eventops_worker`. It must never receive an owner token or service role key. Provisioning that credential and verifying hosted Storage JWT support remain operator prerequisites, not actions performed here. The role can read only registered `event-audio` objects, delete them only when due, and cannot upload or overwrite objects or read other buckets. An additional restrictive row policy prevents other permissive policies from broadening that boundary.

Cleanup runs without a model key, ffmpeg, provider access flags or the database transcription gate. Keep the cleanup worker running with its restricted database and Storage configuration even while transcription is disabled. Deletion failures stay pending and retry every sweep. Stop ingestion if cleanup is unavailable; a stopped process cannot enforce a wall clock retention promise. Hosted scheduling, credential rotation, monitoring and outage escalation require operational verification before enabling uploads.

Provider execution additionally needs an absolute `EVENTOPS_FFMPEG_PATH` in the private worker environment. The reviewed executable belongs in the approved restricted worker container with no network, secrets, unrelated file access or privileges available to the conversion process. The child receives only fixed arguments, a minimal environment, a private temporary directory, local file protocols, allowed demuxers/codecs, one thread and a 20 second deadline. It outputs mono 16 bit PCM WAV at 24 kHz, checks decoded duration and removes temporary files on success or failure. Local verification used an already installed ffmpeg, without installing a package or changing system software. Production container isolation is still an operator gate.

Uploads create durable leased jobs. The browser may close after the server acknowledges the job. Incomplete uploads can retry the same local recording and key, or retry an already uploaded object after returning to the page. A missing incomplete object must be discarded before recording again. The worker checks the byte receipt before decoding, saves only a transcript draft, and rejects stale leases and discarded jobs. Silence or unusable responses fail explicitly; no confidence scores or invented transcript are shown. Failed transcription preserves existing text and permits a new recording or typing. Each recording reserves USD 0.018 conservatively for at most three possible calls across process restarts, sharing the USD 50 development, USD 10 global/day and USD 2 workspace/day bounds with text analysis. Recording attempts are capped at twenty per workspace/UTC day, two active per workspace and one active per event.

Raw audio becomes due for deletion immediately on confirmed text or discard, otherwise within 24 hours of success/final failure, with a seven day absolute ceiling from creation. Incomplete uploads expire after ten minutes. Original transcript sources and byte/hash metadata remain distinct from the removable recording. Confirmation attempts immediate Storage deletion and the independent worker sweeps pending deletion. A physical object must be absent before the cleanup receipt is acknowledged. Audio cleanup does not delete the transcript draft or change the official plan. Broader T8 account retention and purge must include these records.

Apply additive migrations with the existing local command, then run:

```sh
EVENTOPS_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-t6.mjs
```

This harness uses loopback Auth, mail, Storage and PostgreSQL, a disposable restricted database login, real conversion and controlled transcription responses. It reads the local native stack JWT signing fixture only to mint a ten minute test Storage identity in memory, never a provider key. Override `T6_APP_URL`, `T6_STATUS_FILE` and `T6_LOCAL_STATE_FILE` for another loopback setup. Synthetic quota rows and the database voice gate are restored in finally blocks. Browser fixtures are private files under `/private/tmp`; captures stay in ignored `output/playwright/`. Native Safari, physical mobile microphones and real service acceptance remain separate release checks.
