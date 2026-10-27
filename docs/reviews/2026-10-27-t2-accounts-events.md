# T2 accounts and event setup

Date: 27 October 2026. Verdict: locally verified, code review approved for this slice. Hosted readiness and model access remain open.

## Built

Real Supabase email codes, verified server identity and HttpOnly cookies. Recorded adult and authority attestation and notice versions. Idempotent workspace creation. Owner row policies and restricted transactional functions. Event setup stores a local date, IANA zone, hours, location labels, resolved instants and offsets. Creation receipts survive later edits. Version checks reject stale edits. A workspace cannot exceed ten events, including concurrent requests. Private draft read and edit screens make the absence of an approved plan explicit. Authenticated bootstrap can be retried without reusing a consumed code.

Public notices describe synthetic local evaluation only. They are not a substitute for the actual operator's legal notices.

## Automated evidence

`npm run check`: lint, formatting and strict types pass, 28 tests across nine files pass. Tests include missing and repeated DST times, reversed UTC order, HTTP origin and size checks, described controls and workspace recovery after code consumption.

`npm audit --audit-level=moderate`: zero vulnerabilities. A final check rerun initially hit local disk exhaustion; clearing only this task's disposable npm download cache restored space, and all 28 tests and other checks passed again. The audit was rerun with network access after a sandbox DNS failure and passed.

`npm run build`: production compilation, type checking, page generation and standalone packaging pass. Production requests: anonymous private API 401, anonymous event page 307 to sign in, internal foundation page 404.

`node scripts/verify-t2.mjs`: 19 live service checks pass against the final local production build. These use actual GoTrue, Mailpit, PostgREST and PostgreSQL, not mocked sessions:

1. Anonymous private API denied.
2. Two real delivered email codes sign in separate accounts, invalid and consumed codes fail, cookies are HttpOnly.
3. Resend before verification is rejected by the server.
4. Concurrent workspace bootstrap returns one workspace.
5. Concurrent event creation returns one event.
6. Saved setup reloads as a draft with no approved revision.
7. The second owner cannot list, read or alter the first owner's event.
8. Concurrent edits produce one success and one stale conflict.
9. Original creation receipt still resolves after editing.
10. Direct RPC rejects null snapshot fields.
11. Direct RPC rejects missing, malformed and mismatched UTC offsets.
12. Direct table insertion is denied.
13. Database policy independently hides another owner's draft.
14. Reversed UTC interval returns 422.
15. Concurrent creation cannot exceed ten events.
16. Direct password signup cannot issue an unverified session.
17. Foreign mutation origin is denied.
18. Sign out removes browser access.
19. A delivered code with its synthetic account's sent timestamp moved eleven minutes into the past is rejected by the real Auth verifier.

The expiry check changes only a synthetic fixture timestamp using local psql. It does not bypass verification. Logs are held in private temporary files, including `/private/tmp/eventops-t2-live.log` and the build log. Final check and audit results are recorded in the command outputs for this session. The durable repeatable harness is in `scripts/verify-t2.mjs`.

## Browser evidence

Production browser: email and attestation, actual delivered code, empty private workspace, create event, save and view draft. Mobile saved draft at 390 by 844 has no horizontal overflow. Axe WCAG A/AA and 2.1 AA scan reports zero violations on the saved draft. The development sign in form also preserves entered email and checked consent after loading. Mobile edit validation also reports zero axe violations. An invalid interval remains editable, keyboard submission saves the correction, a reload shows version 2, and browser sign out returns to sign in. Screenshots are in ignored `output/playwright/t2/`.

## Fresh review

A fresh gpt-6-astra reviewer read the diff, specification and tests without authoring code. The author model was not reliably detectable, so a different model family is not guaranteed. Initial findings covered unverified email signup, SQL null validation, mutable creation receipts, resend limits, UTC ordering, consumed code recovery and explicit offset validation. Each was fixed, and live or component regressions were added. The final read returned **Approve for the T2 slice**, no outstanding blockers or majors. The reviewer inspected code but did not independently run the commands above.

## Acceptance boundary

AC 01 is locally exercised for code, resend, expiry, workspace, sign out and saved draft resumption. AC 02 covers the new account/event APIs, database functions and row policies; future storage, jobs, evidence, exports and history remain for their slices. AC 03 setup and timezone behavior is exercised. AC 29 covers this slice's attestation, notices, secret boundary and event quota; geographic access, model allowlist, cost reservations and actual deployment remain unverified. Full release acceptance is not claimed.

The experimental native Supabase CLI does not serve email `content_path` templates. A documented local adapter adds GoTrue template URL settings to the downloaded Auth launcher in a dedicated temporary cache. Actual Auth sends and verifies the codes. No hosted account, external email, legal acceptance, paid resource, deployment or Meta call was performed. Hosted Resend delivery and Meta access require the missing configuration and user handled provider terms. T3 can proceed locally with immutable plan records and approval transactions.
