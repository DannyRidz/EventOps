# T1. Runnable foundation and shared UI

## Summary

You approved the plan on 27 October 2026 and authorized the first milestone with verification. This document narrows T1 into its implementation and verification contract. It does not redefine the later operational loop as a completed foundation feature.

## Decision

Use the approved Next.js, React and TypeScript stack with npm, CSS tokens, ESLint, Prettier, Vitest and Testing Library. Run on the installed Node 24 LTS and pin dependencies in the lockfile. Implement the preparation portion of S01 and shared controls now; add real account entry in T2. Avoid an inert sign in or event creation control before its behavior exists.

Keep state and error recovery exercises at `/internal/foundation` and `/internal/recovery`. A narrow proxy rejects all internal paths before rendering in production, including when the development opt in flag is present. The page also checks the environment. The process liveness route does not pretend to check a database or AI provider.

## Requirements

| ID | T1 acceptance criterion | Full release connection |
|---|---|---|
| FND-01 | The official scaffold installs reproducibly with the pinned Node version, passes strict checks, builds and starts its standalone production output with static assets | T1 tooling |
| FND-02 | The introduction has real preparation navigation, coherent approved tokens, honest content, and a useful not found route | AC-27 and AC-31, foundation portion |
| FND-03 | Shared buttons, fields and empty/loading/error states have useful names, described errors, retained input, disabled behavior and keyboard retry | AC-27 and AC-28, shared component portion |
| FND-04 | Desktop and 320 CSS px layouts have no horizontal overflow; keyboard focus and skip navigation work; automated accessibility checks pass on built surfaces | AC-28, tested foundation surfaces only |
| FND-05 | Every internal verification path returns HTTP 404 in production even with the opt in flag enabled; no event data is fabricated | AC-31 |
| FND-06 | The health endpoint returns uncached process liveness, and the actual route error fallback can fetch fresh server content on retry | Runtime foundation |
| FND-07 | Repository guidance, test preferences, CI configuration and milestone evidence reflect the actual code and remaining work | T1 handoff |

These are T1 checks, not substitutes for the 32 full release criteria. Authentication, workspace isolation, database records, AI, imports, voice, approved changes, deployment, and the full accessibility assessment are not implemented by T1.

## Feature design and value sourcing

| Surface or value | Source |
|---|---|
| Introduction and preparation copy | Approved product and experience specifications, no live event records |
| Visual values | `src/styles/tokens.css`; direction in `design.md` |
| Shared controls | Explicit component props and native browser states |
| Field descriptions | The same field's hint/error IDs and caller supplied described by IDs |
| Page recovery | Installed Next.js 16.4.3 `retry` callback, which fetches fresh server content |
| Recovery exercise readiness | A local browser test cookie, read only by the development gated internal route |
| Internal route access | Server environment and explicit development flag, never a query parameter |
| Health result | Reachable running server process only |

## Build plan

1. Create official framework scaffold and reproducible install, satisfies FND-01.
2. Capture real repository conventions and CI, satisfies FND-01 and FND-07.
3. Implement tokens, page shell, preparation page and not found recovery, satisfies FND-02 and FND-04.
4. Implement shared form/state components and isolated exercise routes, satisfies FND-03 and FND-05.
5. Add current framework error recovery and standalone start packaging, satisfies FND-01 and FND-06.
6. Exercise real browser and HTTP behavior, run clean checks, and record actual coverage, satisfies FND-01 through FND-07.

## Consequences

T1 is useful infrastructure with real public preparation content, not a working organizer account or operations loop. No production resources or credentials are required. CI is configured but has not been run by GitHub until the change is pushed. The initially interrupted fresh review was resumed and completed; its final verdict is Approve with no outstanding findings. Author model detection was unavailable, so a contrasting model family guarantee is not claimed.

ESLint 9.39.5 matches the peer ranges of the current official Next.js lint plugins. npm marks that major deprecated, while the plugins do not yet declare compatibility with ESLint 10. Preserve the compatible set for this milestone, record the maintenance limitation and recheck the upstream toolchain before release. npm audit and actual checks remain required; neither proves future vulnerability absence.

## Verification

Verified on 27 October 2026 against the actual local application. Screenshots and raw command logs are local ignored artifacts under `output/playwright/`.

| Criterion | Verdict and observed evidence |
|---|---|
| FND-01 | PASS. Clean `npm ci --offline`, `npm run check`, production build and standalone `npm start`. Logs: `t1-install.log`, `t1-check.log`, `t1-build.log`. The installed runtime is Node 24.15.0 with npm 11.12.1 |
| FND-02 | PASS. Browser loaded `/`, followed preparation navigation to `/#prepare`, received a real 404 for `/missing-page` and returned home using its link. `t1-production.png` and `t1-final-browser.log` |
| FND-03 | PASS. Real internal surface showed empty and loading states; retry changed the error to a recovered state; a field retained its typed value and described its error; approval control remained disabled. `t1-states.png` and component tests |
| FND-04 | PASS for the tested T1 surfaces. Real browser at 1280 and 320 CSS px had matching viewport/document width. axe found no violations on the introduction at both widths and the exercised internal form state. Keyboard Tab exposed a solid focus indicator on the skip link; Enter focused `main-content`. `t1-desktop.png`, `t1-mobile.png`, `t1-production-mobile.png`, `t1-final-browser.log` |
| FND-05 | PASS. The final standalone build, started with `EVENTOPS_INTERNAL_UI=1`, returned HTTP 404 for both `/internal/foundation` and `/internal/recovery`. Proxy regression tests cover production, disabled local flag and explicitly enabled development |
| FND-06 | PASS. `/api/health` returned 200, `{"status":"ok"}` and `Cache-Control: no-store`. A real server-render error reached the route fallback; after changing the isolated test readiness cookie, Try again fetched fresh content at the same URL and rendered Server recovery completed. `t1-health.json`, `t1-health-headers.txt`, `t1-server-error.png`, `t1-server-recovered.png` |
| FND-07 | PASS. `AGENTS.md`, `CLAUDE.md`, `design.md`, test preferences, CI and scope match the built milestone. Fresh review completed with no outstanding findings in [review](../../reviews/2026-10-27-t1-foundation.md) |

All 17 tests across six files pass. The final lint, formatting, route type generation and strict TypeScript checks pass. The dependency audit reports zero known vulnerabilities at the time of this run. The real HTTP checks also confirmed the configured response headers. Browser console errors were confined to intentional failure/404 exercises, not an unhandled normal-page error.

Verification found and fixed the streamed internal 404 returning status 200, incorrect standalone start packaging, the route recovery callback, and the root error document's missing title. Regression coverage was added for the access boundary, callback and root document metadata.

## Practical limits and next step

This is not a WCAG conformance certification. No live VoiceOver/NVDA assessment or full organizer journey exists yet. The root fallback's standalone title/language/safe content were verified by rendering and parsing its HTML document in a regression test; a real root layout crash was not manually induced. The route level server crash and recovery were exercised in the browser.

GitHub has not executed the CI workflow because nothing was pushed. No database, authentication, paid resource, production deployment, repository publication or AI provider call was created for this milestone. The next delivery task is T2, real sign in, private workspace and event setup. Whole release criteria remain open until their actual features are implemented and verified.
