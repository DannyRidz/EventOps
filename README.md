# EventOps

Event operations with reviewed changes to schedules, rooms, and volunteer assignments.

## Local setup

Use Node 24.15.0 (`nvm use`) and npm 11.12.1. Run `npm ci`, then `npm run dev` and open http://localhost:3000.

`npm run check` runs lint, formatting, strict type checking and tests. `npm run build` creates the production build; `npm start` serves it. `GET /api/health` checks process liveness only.

## Current milestone

T1 provides the runnable foundation, preparation page, shared accessible controls and states, development verification surface, repository guidance and CI configuration. It does not yet authenticate organizers, store events or call AI providers. No external credentials are needed for T1.

To inspect isolated states, run `EVENTOPS_INTERNAL_UI=1 npm run dev` and visit `/internal/foundation`. Production always responds with 404 for that route, even if the flag is set. Keep `.env.local` private. `.env.example` documents the local flags.

The complete [plan](docs/specs/0001-eventops/index.md), [delivery order](docs/specs/0001-eventops/0007-delivery.md), and [scope](docs/scope/scope.md) are durable project records. Authentication and the first complete operational loop follow the foundation.

The [T1 verification record](docs/specs/0001-eventops/0008-foundation.md) documents the local build, 17 tests, real browser checks, recovery exercise, review and remaining limitations. `/internal/recovery` is an additional development only server-error exercise; production rejects it.
