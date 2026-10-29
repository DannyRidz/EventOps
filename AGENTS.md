# EventOps

## Stack

TypeScript strict, Node 24 LTS, Next.js App Router, React, CSS variables, npm. The approved [architecture](docs/specs/0001-eventops/0002-architecture.md) also selects Supabase for accounts and event setup in T2, and Meta APIs for later slices. Meta is not connected. Versions are pinned in package-lock.json.

## Build approach

Tracer Bullet (prove one real path through sign in, records, analysis, approval, and briefing, then broaden it).

## Commands

- `nvm use` then `npm ci`: use the pinned runtime and dependencies.
- `npm run dev`: local application.
- `npm run check`: lint, formatting, generated route types, strict typecheck and tests.
- `npm run build` then `npm start`: production build and local production server.
- `EVENTOPS_INTERNAL_UI=1 npm run dev`: enable `/internal/foundation` in development only.
- `node scripts/verify-t4.mjs`: loopback manual editor input, confirmed text, blocked jobs, immutable creation receipts, tenant isolation and transaction rollback checks. Live Meta execution remains disabled.
- `T5_BOUNDARIES=1 node scripts/verify-t5.mjs`: loopback CSV, private Storage, corrections, source integrity, isolation, rollback and maximum collection checks. Local Supabase must include Storage; see README.
- `T9_APP_URL=http://localhost:3005 node scripts/verify-t9-csv-max.mjs`: repeats all six CSV maxima with an existing synthetic browser session, never a sign in or terms action. `T9_SYNTHETIC_STATE` selects private saved state; `T9_MAX_EVENT_ID` verifies saved approved counts without writes. [Final T9 evidence](docs/reviews/2026-10-29-t9-followup.md).
- `T9_APP_URL=http://localhost:3005 node scripts/verify-t9.mjs`: synthetic loopback release smoke and 100 private approved plan reads at concurrency five. Requires the T4 synthetic browser fixtures; verifies both database provider gates remain disabled. This does not certify production load or full release readiness.
- `node scripts/prepare-t9-evaluation.mjs --self-test` and `node scripts/verify-t9-allowance.mjs`: offline corpus integrity and durable campaign reservation checks, never live quality scores.
- `EVENTOPS_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/prepare-t9-audio.mjs`: verifies four materialized synthetic audio files without capture or provider access. `node scripts/verify-t9-evaluation.mjs` with the same ffmpeg variable runs controlled orchestration and SQL receipts in a temporary loopback database using the existing private T8 export. It never signs in or enables either AI gate. Stable campaign keys block replay; see [runner instructions](evals/t9/Task.md) before choosing a separate test ledger.
- `node scripts/verify-t7.mjs`: synthetic loopback answer, candidate editing, restoration context, approval, history, safe outputs, isolation and rollback checks. Live provider gates remain disabled.
- `npm run worker`: separate restricted analysis process, using private worker environment only. `node scripts/verify-t4-worker.mjs` exercises it with controlled responses on loopback services.
- `npm run worker:voice`: restricted transcription and independent audio cleanup process. `EVENTOPS_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-t6.mjs` verifies loopback audio and controlled transcription; live AI stays disabled.
- `npm run format`: format application and root configuration; planning documents are excluded.
- Local accounts require APP_URL and the Supabase URL and publishable key in private `.env.local`. The application never uses a service role key.
- `node scripts/verify-t2.mjs`: live loopback Auth, mail and database checks, including local psql expiry fixtures. Read README setup before running.
- `node scripts/verify-t3.mjs`: loopback plan parity, approval races, damaged evidence and transaction rollback checks using synthetic local SQL fixtures. `node scripts/verify-t3-migrations.mjs` rehearses DDL in a temporary database without resetting the running project.

## Rules

- Prefer pure functions and immutable data. Keep I/O at explicit boundaries.
- Organize by feature with shared UI in `src/components/ui`; server components by default.
- Use named exports except required Next.js route/page conventions and configuration defaults.
- Validate untrusted inputs at boundaries. No client secret or model controlled official write.
- Official event writes must follow the approved evidence, validation and transactional approval contract.
- Account and setup writes use owner scoped PostgreSQL functions, never direct table writes. Save drafts with an expected generation; keep the immutable creation receipt separate from the mutable draft.
- Plan schema v1 is shared with the embedded PostgreSQL JSON Schema and guarded by a drift test. New versions require additive migrations. Approval recomputes and checks the whole candidate, evidence values and request coverage inside its transaction; browser validation is not authority.
- Do not fabricate live records, working integrations, or capability claims. No unfinished product or competition language in customer surfaces.
- Use semantic HTML, keyboard behavior and described errors. Follow [design.md](design.md); values live in `src/styles/tokens.css`.
- Tests cover observable behavior, including error and access boundaries. Vitest is the current runner; browser verification supplements it.
- The worker uses only `eventops_worker` claim/stage/finish functions, never owner or service role credentials. Model output requires organizer interpretation/fact confirmation before proposal creation; approval recomputes that contract. Keep live access gates disabled until operator prerequisites are verified.
- CSV originals use private Storage plus immutable database byte receipts. Download only hash verified bytes; preserve exact original cell and correction generation links. Import corrections must fence earlier staged confirmation.
- No broad reformatting of planning documents. Preserve existing work.
- Read relevant version matched Next.js guides in `node_modules/next/dist/docs/` before changing framework behavior. `agentRules: false` keeps dev startup from rewriting repository guidance.

## Git

- integration: off. Leave commits, pushes and repository visibility to the user unless explicitly requested.

## Tooling

ESLint, Prettier, strict TypeScript, Vitest and Testing Library. CI runs equivalent checks and production build. No implicit hook installation or extra skill/connector discovery.

## Specs

[Plan](docs/specs/0001-eventops/index.md), [scope](docs/scope/scope.md), [delivery](docs/specs/0001-eventops/0007-delivery.md). T1 is foundation. T2 accounts and event setup and T3 plan integrity are locally verified; T4 manual entry, text persistence, evidence review and briefing are locally verified. The interpreter, deterministic options, restricted worker and cost controls are also locally verified with controlled responses. Live Meta access and hosted configuration remain blocked. [T4 evidence](docs/reviews/2026-10-28-t4-worker-completion.md).

## Agent skills

- [frontend-design](/Users/asmasalleh/.codex/skills/frontend-design/SKILL.md): approved visual system and content discipline.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

- T7 restoration compares every pending confirmed candidate, including other restorations, excluding only the candidate itself. New context requires fresh review; immutable receipts still replay. [T7 evidence](docs/reviews/2026-10-29-t7-completion.md).

## Context files

- [src/features/voice/AGENTS.md](src/features/voice/AGENTS.md): private audio jobs, conversion, transcript confirmation, shared budgets and independent cleanup. [T6 evidence](docs/reviews/2026-10-28-t6-voice-completion.md) records local verification and outstanding device/provider checks.

- [src/features/imports/AGENTS.md](src/features/imports/AGENTS.md): CSV parsing, saved corrections, source integrity and verification boundaries. T5 is locally verified; [completion evidence](docs/reviews/2026-10-28-t5-imports-completion.md).

- [src/features/privacy/AGENTS.md](src/features/privacy/AGENTS.md): owner lifecycle functions, bounded private exports, restricted retention and independent deletion replay. [T8 evidence](docs/reviews/2026-10-29-t8-completion.md).
