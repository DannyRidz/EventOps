# Review, main, 2026-10-27

**Reviewed by**: fresh gpt-6-astra reviewer (author model not authoritatively detected; no verified cross-model family guarantee)
**Scope**: 46 files, uncommitted; base main. Lockfile and generated output excluded from source review.
**Verdict**: Approve

## Summary

T1 provides a runnable Next.js foundation, truthful preparation content, shared controls and states, isolated development exercises, and reproducible checks. The production boundary rejects internal routes before rendering and repeats the restriction in each page. The earlier recovery defect and root-document title issue are resolved; no outstanding findings remain. Authentication, persistence, AI, and later milestone capabilities were deliberately excluded from this review's requirements.

## Resolved findings

The global fallback now includes its own descriptive document title. The new `src/app/global-error.test.tsx` renders the complete fallback, parses it as an HTML document, and checks its title, language, recovery control and exclusion of private error text. The narrow follow-up inspected the implementation and passing check/build logs, closing the earlier Minor finding. This verifies the fallback document itself; a real root-layout failure has not been triggered manually in the browser.

The original route and global fallbacks used `reset` for “Try again”. In the installed framework, that clears boundary state without fetching fresh server content; `retry` performs the needed fetch. Both fallbacks now use `retry`, and `src/app/error.test.tsx` verifies route callback wiring without exposing private error text. The implementing agent additionally reported a real browser failure followed by a readiness-cookie change and successful retry at the same URL. Source inspection and the regression test support closing the earlier Major finding.

The earlier ESLint 10/plugin peer mismatch has also been reconciled to ESLint 9.39.5. The foundation spec accurately records the upstream deprecation and the reason for retaining the currently compatible plugin set.

## Strengths

- Internal exercises have both a narrow pre-render proxy restriction and page-level environment checks; the production branch wins even if the opt-in flag is enabled.
- Controls use native disabled behavior, safe default button types, visible labels, combined error/hint descriptions, and retained input. Tests exercise keyboard retry and actual interaction outcomes.
- Process liveness makes no provider-readiness claim, and standalone packaging copies the assets Next.js does not include automatically.
- Public preparation navigation has real destinations, with no fabricated event records or simulated account controls.

## Test coverage

The reviewed command logs show lint, formatting, generated route types, strict type checking, all 17 tests across six files, and the standalone production build passing. The audit log reports zero known vulnerabilities at the time of that run. Tests cover process-health semantics, the internal production/flag boundary, public navigation, input associations and retention, disabled controls, keyboard recovery, route retry wiring, and the global fallback document.

The implementing agent reported a clean install, production HTTP checks for both internal routes with the flag enabled, and real browser checks covering recovery, accessibility, mobile layout, and navigation. The reviewer inspected the saved check/build/audit and health-response logs, and the version-matched local framework guides for error recovery, proxy matching, standalone output, and agent rules. The reviewer did not independently rerun installation, servers, or browser checks. The global fallback document is now covered by a focused render/parse regression test; manually triggering a real root-layout failure remains outside the completed browser verification. GitHub-hosted CI has been configured but has not run for this unpushed change.
