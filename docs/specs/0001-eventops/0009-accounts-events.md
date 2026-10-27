# T2 accounts and event setup

The approved T2 slice uses Supabase email OTP, server cookies and PostgreSQL row policies. These implementation recommendations follow your approval and request to proceed without questions.

## Requirements and sources

AC 01 and 02: verify email with a six digit code before reading or writing private data. Supabase owns code expiry (600 seconds), resend throttling (60 seconds) and token verification. The server validates the user with Auth, never a user id from a request. Account creation records an adult and authority attestation, terms version and privacy version. One owner has one workspace, created idempotently in a database transaction.

AC 03: the organizer supplies event name, one local date, explicit IANA timezone, operating start and end and location labels. The browser suggests its timezone, the organizer confirms it. Temporal rejects invalid dates and missing clock times, and requires an explicit offset for a repeated clock time. Store local values and resolved UTC instants together. No overnight events. At most ten active events per workspace.

Event ids and timestamps come from PostgreSQL. A request id supplied by the client makes event creation repeatable. A saved setup is a draft with a generation, not an approved plan. Updating requires the observed generation, stale edits return 409. Authenticated reads show the owner's saved setup, generation and saved timestamp. No approved revision exists in T2. Event child records use composite workspace and event keys. Inaccessible ids return 404. There is no local storage persistence.

## Interfaces

POST /api/auth/code accepts email and an adult/authority attestation. POST /api/auth/verify accepts email, code and attestation. POST /api/auth/sign-out ends the session. POST /api/workspace/bootstrap records consent and creates the workspace. GET and POST /api/events list and create. PUT /api/events/:id/draft compares expected_generation. GET /api/events/:id/plan reads the saved draft. Mutation requests must have the configured APP_URL Origin and JSON bodies of at most 16 KiB. Errors have code, message, field_errors, request_id and optional retry_after_seconds. Private responses use no-store.

## Screens

Reuse the existing white, neutral and blue design with readable typography. /sign-in has email then code, resend cooldown, expired/invalid and service error states. Attestation and processing notice appear before sending. /events has an honest empty state or saved event links, create and sign out. /events/new and /events/:id/edit share a labeled setup form with save progress and described errors. /events/:id/plan shows draft status, setup details, save time and edit link. No imagery is needed.

## Delivery boundaries

Use a local native Supabase runtime for synthetic verification where possible. This is experimental development tooling and does not replace hosted verification. Production needs the operator's legal notices, configured domain and Resend SMTP, and the same OTP settings and template. No provider terms are accepted by the agent. Meta access remains unverified until authorized credentials and terms acceptance exist. T3 owns immutable operational plan records and approval transactions.

## Verification

Unit tests exercise input validation, missing and repeated DST times, origin checks and error contracts. Real local Auth and database checks cover email verification, idempotent workspace and create, saved draft reload, stale edits, unauthenticated denial and two owners reading and writing each other's ids. Browser checks cover the actual email code and setup journey if the local mail runtime supports the code template. Report blocked checks explicitly.
