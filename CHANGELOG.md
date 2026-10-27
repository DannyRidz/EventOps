# Changelog

## [Unreleased]

### Added

- Immutable plan sources and revisions, field evidence resolution, and owner scoped history APIs.
- Whole plan constraint checks in TypeScript and PostgreSQL, with shared schema and parity fixtures.
- Transactional initial confirmation and manual proposal approval with durable replay receipts.
- Local migration rehearsal, approval race, evidence tampering and transaction rollback verification.

- Email code sign in, account consent, one private workspace, and sign out.
- Saved event setup with explicit timezone and UTC offsets, draft versions, retry receipts and stale edit protection.
- Owner database policies, transactional event limits, and real local service verification.

- Event preparation page with clear workflow and input guidance.
- Shared accessible controls, empty/loading/error states, and a useful not found page.
- Local runtime foundation, reproducible dependency lock, strict checks, component tests and CI configuration.
- Development only state and server recovery exercises, rejected before rendering in production.

### Fixed

- Approved event summaries use the latest revision rather than stale setup metadata.
- Setup edits preserve acknowledged plan records and require fresh validation before confirmation.

- Page recovery requests fresh server content using Next.js's current retry interface.
- Production starts from the standalone build with its required static assets.
