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
2. Run `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase start --runtime native --exclude studio,realtime,storage,functions,analytics,pooler --eager`. The first start downloads the pinned local services. The experimental native runtime supports macOS 14 or later on Apple silicon and supported Linux environments. Docker can also run the stack.
3. Read local endpoints with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase status --output-format json`. Set `NEXT_PUBLIC_SUPABASE_URL` to its API_URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its PUBLISHABLE_KEY. Set APP_URL to `http://localhost:3000`. Do not copy secret or service role keys into the application.
4. Run `npm run dev`. In another terminal, run `SUPABASE_HOME=/private/tmp/eventops-supabase node scripts/local-supabase.mjs`. This development adapter adds GoTrue template URL environment variables to the downloaded Auth shell launcher in that dedicated temporary cache, then restarts local services. CLI 2.122 cannot serve `content_path` templates in its native runtime. The adapter retains real email delivery, OTP verification, expiry and throttling. Keep EventOps running at port 3000 so Auth can fetch the static code template.
5. Open `/sign-in`. Find the delivered code in the local Mailpit URL printed by status (normally `http://127.0.0.1:54324`). Sign in, create an event, reload its draft and continue editing.

To repeat the live checks, save `supabase status --output-format json` to a private file, then run `T2_STATUS_FILE=/path/to/status.json node scripts/verify-t2.mjs` while EventOps is running. The harness requires loopback services, creates only synthetic records and moves one synthetic account's OTP timestamp to test expiry. It covers real sign in, resend limits, ownership, direct database policies, concurrent saves, quotas and sign out. Its default status path is `/private/tmp/eventops-local-status.json`. Never commit status output, captured mail or session cookies.

For a production build, stop the dev server, run `npm run build`, then `HOSTNAME=127.0.0.1 node --env-file=.env.local .next/standalone/server.js`. Stop local services with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase stop`. A database reset deletes local records; use it only deliberately.

Hosted readiness remains open: operator identity and complete legal notices, a mail domain, Resend SMTP, Supabase configuration and real delivery checks. Configure email confirmations, six digit codes, 600 second expiry and a 60 second resend minimum. Both signup confirmation and magic link email templates must use `supabase/templates/code.html`. No provider account was created or terms accepted. Meta model access has not been tested. The local notice permits synthetic evaluation only. Deployment remains a separate authorization.

## T3 plan integrity

T3 adds the backend for operational plans. Authenticated APIs can stage all six record types, capture immutable manual evidence, confirm revision 1, create a checked manual proposal and approve it transactionally. The server and PostgreSQL both validate the whole plan. Replays return immutable receipts, while stale generations, conflicting heads, invalid constraints and bad evidence cannot commit. Setup edits preserve staged records and require fresh staging before confirmation. Approved event pages and lists read the current revision.

The manual plan editor, proposal review controls, AI interpretation and briefing flow belong to T4. T3 APIs are not a claim that those screens exist.

Apply migrations locally with `SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase migration up --local`. Start the local services and application using the T2 instructions. Run `node scripts/verify-t3.mjs` for real Auth, database, source, approval race and fault checks. It requires local `psql`, creates synthetic records, inserts deliberately damaged test candidates with administrative local SQL, temporarily injects a receipt failure scoped to a synthetic event, and restores test lifecycle flags. It never targets hosted services. Use `T3_APP_URL` and `T3_STATUS_FILE` to override the loopback defaults.

`node scripts/verify-t3-migrations.mjs` rehearses every migration in a temporary local database, supplies only the referenced managed Auth schema contract, and drops that temporary database afterward. It does not reset the running project. The real-service harness separately verifies managed Auth and row policies in the running Supabase database.

The immutable v1 plan contract lives in `src/features/plans/schema.ts`. Its JSON Schema is embedded in the migration and checked for drift by tests. Supabase's pg_jsonschema extension enforces the same field shape in PostgreSQL. Future schema changes need a new version and migration; do not rewrite already applied migrations. The [T3 specification](docs/specs/0001-eventops/0010-plan-integrity.md) records input and patch formats. The [verification record](docs/reviews/2026-10-27-t3-plan-integrity.md) records the actual checks and remaining boundaries.
