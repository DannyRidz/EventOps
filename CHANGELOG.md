# Changelog

## [Unreleased]

### Added

- Event preparation page with clear workflow and input guidance.
- Shared accessible controls, empty/loading/error states, and a useful not found page.
- Local runtime foundation, reproducible dependency lock, strict checks, component tests and CI configuration.
- Development only state and server recovery exercises, rejected before rendering in production.

### Fixed

- Page recovery requests fresh server content using Next.js's current retry interface.
- Production starts from the standalone build with its required static assets.
