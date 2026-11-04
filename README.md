# EventOps

Keep a small event’s schedule, rooms, volunteer assignments and briefing consistent when plans change. Describe a change, review its evidence and approve the exact revision that becomes official.

**[Watch the demo, about 2 minutes 55 seconds](https://drive.google.com/file/d/1uRFZMs3qVcsGUfl1h9QGJ6daKRtYy5dJ/view)** · [Verification evidence](docs/reviews/2026-11-05-t9-local-analysis-fixes.md) · [Architecture](docs/specs/0001-eventops/0002-architecture.md)

## For judges

EventOps is a working **local prototype**, demonstrated with fictional event records. There is no hosted application URL or shared judge login. The video is an edited walkthrough of actual application screens and a previously completed live Meta workflow, with labeled synthetic narration. It does not represent a new continuous model run.

The core workflow is **Describe, Review, Confirm, Approve, Briefing**:

1. Enter records or import the six CSV collections: rooms, sessions, volunteers, availability, assignments and dependencies. Review and explicitly confirm the starting plan.
2. Save and confirm an update. Meta can interpret the request or produce a draft voice transcript. Missing facts remain questions, and transcripts require correction and confirmation.
3. Review affected records, exact before and proposed values, source evidence and deterministic plan checks.
4. Confirm the interpretation and new facts, then separately approve the proposed revision. Stale or invalid changes cannot replace the current plan.
5. Open the approved briefing, compare history, or export text and CSV. Print briefing also supports the browser’s Save as PDF.

**You can review the application without enabling AI or supplying a model key.** Local sign-in, the guided sample, manual changes, evidence review, approval, history and briefing work with the provider gates disabled. A confirmed text update remains awaiting model access until processing is deliberately configured.

### Quick walkthrough after setup

1. Sign in at `/sign-in` using the code in the local test inbox described below. Review any personal attestation and terms yourself.
2. From **My events**, choose the fictional sample, or open `/events/sample`. Review its records, select the explicit review checkbox and load the draft. Its fixed example date is 4 November 2026, in Asia/Brunei.
3. Review the starting plan and confirm revision 1. Loading a sample never approves records automatically.
4. Open **Guide** for the five workflow steps. With AI disabled, use **Propose manual changes** to exercise the review path. For a small example, change Room 2 capacity from 40 to 41 and enter a reason for the change.
5. Save for checks, inspect the evidence, choose **Review approval**, then approve only after reviewing the exact change. Open **Briefing** and **History** to inspect the resulting revision.

The sample also offers an optional text update moving Opening to Room 2 at 12:00–13:00, recording Alex unavailable at 10:00–13:00 and replacing Alex with Sam. Inserting that suggestion does not save, confirm or send it. The video shows the earlier completed live text path; new live processing is off by default.

## Meta integration

| Meta model                  | Role                                                                                                 | Authority                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `muse-spark-1.3`            | Interpret confirmed logistics updates and select among supplied, deterministically validated options | Cannot approve an official plan or execute external actions                   |
| `muse-voice-transcribe-1.0` | Produce a draft transcript from an explicitly uploaded recording                                     | Cannot turn a transcript into confirmed facts or start analysis automatically |

Both adapters call Meta Model API directly from separate restricted workers. Confirmed text and a minimized relevant plan are sent for interpretation; source data is treated as untrusted content. Deterministic code constructs options and checks occupancy, buffers, capacity, equipment, volunteer roles, availability and dependencies. PostgreSQL recomputes candidate integrity, evidence and request coverage inside the approval transaction.

Bounded real Meta tests have exercised text clarification, organizer confirmation, candidate adoption, approval and briefing, plus transcription, correction and cleanup. Those observations are distinct from controlled tests. Some saved text repeats ask unnecessary questions, and synthetic speech transcripts can omit important details. Organizer review is essential.

**General live AI is currently disabled.** New model calls and paid hosting are paused. The private API key belongs only in the relevant worker environment, never in the browser, README or web process. Live use requires the operator’s own authorized access, verified billing and privacy prerequisites, both application flags and database gates, and an approved spending limit. A key alone does not enable processing.

## Run locally

The verified development path uses **Node 24.15.0**, **npm 11.12.1** and the lockfile’s **Supabase CLI 2.122.0**. The native service instructions below use a dedicated macOS temporary directory; the native runtime is experimental. The repository also supports local Supabase through Docker, but the native Auth template adapter below is specific to the native runtime. Docker image execution is not yet verified.

### 1. Install the application dependencies

```sh
nvm use
npm ci
cp -n .env.example .env.local
```

`cp -n` preserves an existing private environment file. Use only synthetic records for this local evaluation.

### 2. Start local Supabase

```sh
SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase start --runtime native --exclude studio,realtime,functions,analytics,pooler --eager
SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase status --output-format json
```

The first start downloads the pinned local services. Keep Auth, PostgreSQL, mail and Storage enabled. Copy these values into the private `.env.local`:

```dotenv
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=<API_URL from local status>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from local status>
```

Keep the provider flags in `.env.example` at `0`. Do not use a service role or secret key for browser configuration. Status output can contain credentials; do not commit it, captured mail or session files.

Apply any pending additive migrations without resetting the database:

```sh
SUPABASE_HOME=/private/tmp/eventops-supabase npx supabase migration up --local
```

### 3. Start EventOps and configure local code delivery

```sh
npm run dev
```

Keep the application running at `http://localhost:3000`. In another terminal:

```sh
SUPABASE_HOME=/private/tmp/eventops-supabase LOCAL_TEMPLATE_ORIGIN=http://localhost:3000 node scripts/local-supabase.mjs
```

The native CLI does not serve the configured Auth template paths. This development adapter updates the Auth launcher inside the dedicated temporary service cache and restarts local services so confirmation and magic-link emails contain the six-digit code. It uses real local Auth verification, expiry and throttling; it is not a sign-in bypass.

Open `/sign-in`. Read the code in the Mailpit inbox URL printed by Supabase status, normally **http://127.0.0.1:54324**. Local messages appear there, **not in Gmail**. If the app is already running on another origin, use that same origin for APP_URL and LOCAL_TEMPLATE_ORIGIN.

### Production build on your machine

Stop the development server before switching to the production server:

```sh
npm run build
HOSTNAME=127.0.0.1 npm start
```

`npm start` loads the existing private `.env.local` when present; host-supplied values take precedence. `/api/health` checks process liveness. `/api/ready` checks database access, not email, AI, backups or full release readiness. Production rejects `/internal/foundation` and `/internal/recovery`.

## Worker and operations notes

Normal application writes use owner-scoped database functions. Workers use restricted `eventops_worker` functions and cannot approve plans. New analysis workers declare prompt v2 in the same transaction as their lease claim; legacy v1 runs and saved evaluation evidence are retained separately.

| Process                 | Command                    | Required private configuration                                                                                                       |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Analysis                | `npm run worker`           | Dedicated restricted database login, model key and explicitly verified access flags; processing remains disabled by default          |
| Voice and audio cleanup | `npm run worker:voice`     | Restricted database and Storage identity; live conversion additionally needs a reviewed ffmpeg executable and enabled provider gates |
| Retention               | `npm run worker:retention` | Restricted database and Storage identity plus `EVENTOPS_DELETION_LEDGER` on independent durable storage                              |

Use [worker.env.example](worker.env.example) for the separate worker environment. Retention additionally needs `EVENTOPS_RETENTION_STORAGE_TOKEN`; `EVENTOPS_RETENTION_ONCE=1` runs one sweep. Cleanup must operate independently of model enablement. Do not use an owner or service role credential as a normal worker identity.

The prepared container files default AI off and exclude private environment files. The worker image does not include ffmpeg and is not a verified live voice image. Hosted database, mail, backup, monitoring, deletion-ledger durability and rollback checks remain open. See the [operations runbook](docs/reviews/2026-10-29-t8-runbook.md) and [hosting preparation](docs/reviews/2026-11-04-hosting-preparation.md) before any hosted release.

## Verification and known limits

Latest recorded local results, 5 November 2026:

| Check                       | Recorded result                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`             | Lint, formatting, generated route types, strict TypeScript and **216 tests across 36 files** pass                                       |
| `npm run build`             | Production compilation and standalone packaging pass                                                                                    |
| Migration rehearsal         | All **43 migrations** apply to an isolated empty schema                                                                                 |
| Controlled worker rehearsal | Known conflict and clarification are persisted together; no candidate is exposed, official head unchanged, zero provider calls          |
| Real model campaign         | **24 of 90 v1 slots collected**; saved traces have preliminary AI review, not independent human acceptance or an aggregate quality pass |
| Revised prompt v2           | Locally verified with controlled responses; **no live v2 quality result**                                                               |

The demo and original submission precede the latest local fixes. Historical test counts and statuses in dated evidence describe those earlier runs. The retained v1 campaign intentionally refuses source or migration drift; do not repin it or reset reservations to replay completed slots under v2.

Human audible screen-reader acceptance, the full protected Safari and physical mobile matrix, independent speech review, container execution and hosted operational recovery remain unverified. This prototype is not certified production-ready. The successful local backup drill does not establish hosted recovery objectives.

Useful records and commands:

- [Latest local fixes and verification](docs/reviews/2026-11-05-t9-local-analysis-fixes.md)
- [Saved trace review and observed quality issues](docs/reviews/2026-11-04-t9-saved-trace-review.md)
- [Actual authenticated browser workflow](docs/reviews/2026-11-03-t9-browser-verification.md)
- [Guided sample verification](docs/reviews/2026-11-04-guided-sample-completion.md)
- [Evaluation instructions and version boundaries](evals/t9/Task.md)
- `node scripts/verify-t9-prompt-version.mjs`: isolated controlled claim/version/rollback and worker persistence checks; requires local services and an existing private synthetic T8 export.
- `node scripts/verify-t3-migrations.mjs`: isolated schema rehearsal; requires local services and matching PostgreSQL client tools.

Recorded runs use synthetic fixtures and private exports that are not committed. A fresh clone needs its own local fixtures before integration scripts can run. Unit and component checks do not need a model key. The full delivery and release contract is tracked in the [living scope](docs/scope/scope.md).

## Contributions

Built for the Meta Global AI Developer Hackathon, Indie Developer track, Build for Your World. AI coding assistance supported implementation, debugging, tests and documentation, with human direction and separate review. Third-party dependencies retain their respective licenses.
