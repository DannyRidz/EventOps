# Changelog

## [Unreleased]

### Added

- Email code sign in, account consent, one private workspace, and sign out.
- Saved event setup with explicit timezone and UTC offsets, draft versions, retry receipts and stale edit protection.
- Owner database policies, transactional event limits, and real local service verification.

- Event preparation page with clear workflow and input guidance.
- Shared accessible controls, empty/loading/error states, and a useful not found page.
- Local runtime foundation, reproducible dependency lock, strict checks, component tests and CI configuration.
- Development only state and server recovery exercises, rejected before rendering in production.

### Fixed

- Page recovery requests fresh server content using Next.js's current retry interface.
- Production starts from the standalone build with its required static assets.
