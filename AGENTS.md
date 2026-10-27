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
- No broad reformatting of planning documents. Preserve existing work.
- Read relevant version matched Next.js guides in `node_modules/next/dist/docs/` before changing framework behavior. `agentRules: false` keeps dev startup from rewriting repository guidance.

## Git

- integration: off. Leave commits, pushes and repository visibility to the user unless explicitly requested.

## Tooling

ESLint, Prettier, strict TypeScript, Vitest and Testing Library. CI runs equivalent checks and production build. No implicit hook installation or extra skill/connector discovery.

## Specs

[Plan](docs/specs/0001-eventops/index.md), [scope](docs/scope/scope.md), [delivery](docs/specs/0001-eventops/0007-delivery.md). T1 is foundation. T2 accounts and event setup and T3 plan integrity are locally verified; hosted configuration and the T4 editor/AI/briefing loop remain separate tasks.

## Agent skills

- [frontend-design](/Users/asmasalleh/.codex/skills/frontend-design/SKILL.md): approved visual system and content discipline.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
