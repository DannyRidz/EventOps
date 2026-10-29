# T9 native checks and live AI readiness

Date: 29 October 2026, Asia/Brunei.

## Result

Native desktop microphone capture and playback pass in Safari 18.6 and Chrome 154. Native Safari also renders the public sign in page, supports its keyboard path and reaches actual 200 percent zoom. The isolated recovery drill passes again with all 42 migrations. Live AI evaluation remains blocked before execution by the current Meta account restriction, unavailable API key and missing evaluation prerequisites. Full T9 remains in progress.

Existing work was preserved. No application source changed in this pass. Application source at the inspected T9 commit was left unchanged; this agent did not commit or push. No provider terms were accepted, payment details added, API key created, paid resources provisioned, deployment performed or support message sent. AI gates remain off and this agent made no inference or transcription request.

## Native Safari and keyboard

The actual installed Safari version is 18.6. A separate task window opened the production app at `http://localhost:3005/sign-in`. The page displayed the labeled email field, unchecked adult roster attestation and disabled Send email code control. No form was submitted and no attestation was checked.

Safari's existing Advanced preference has ordinary Tab traversal of all page controls disabled. It explicitly identifies Option-Tab as the full traversal shortcut. This preference was left unchanged. Observed Option-Tab focus reached the skip link; Return moved focus to the main content; subsequent Option-Tab presses reached the email field and then the unchecked attestation in order.

Native page controls showed 200 percent zoom. The screenshot shows readable text and a field that fits the available width, with vertical scrolling. Size was restored to 100 percent. This is public page evidence, not a complete authenticated Safari, mobile or native zoom matrix. Evidence: ignored `output/playwright/t9-safari-native-200.png` and the native accessibility observations in this session.

## Physical desktop microphone checks

A test only fixture at `http://127.0.0.1:3006/` used the same three approved recording MIME candidates as the application. It calls the actual browser MediaRecorder and default system microphone, automatically stops after two seconds, offers local playback and discards its Blob/object URL. There is no authentication, provider endpoint, network upload handler, external script or persistent recording storage. This independently verifies native device/codec behavior without repeating the blocked app sign in flow.

| Native browser | Observed device | Actual recording | Duration | Playback and cleanup |
|---|---|---|---|---|
| Safari 18.6 | MacBook Air Microphone | WebM/Opus, 38241 bytes | 2023 ms | Play became Pause with progress; input track ended; local audio discarded |
| Chrome 154 | MacBook Air Microphone (Built-in) | WebM/Opus, 31169 bytes | 2011 ms | Playing true, readyState 4, progress 0.086746 seconds; input track ended; local audio discarded |

Both browsers report support for WebM/Opus and the two MP4/AAC MIME candidates, but only WebM/Opus was physically recorded in these checks. This does not claim an actual AAC capture, transcription quality, a meaningful spoken phrase, another language or mobile hardware.

Safari's native microphone prompt was allowed for the requested local test. Its Website settings were subsequently observed as Ask for `127.0.0.1`, with the default still Ask. Chrome used Allow this time, not a persistent site grant. Task tabs/windows were closed after discarding recordings. No raw microphone recording was written to disk or sent to a provider. The fixture server saw six GET requests and no POST, PUT, PATCH or DELETE. The fixture itself remains in `/private/tmp/eventops-device-check/index.html` for inspection; it contains no captured audio.

Evidence: ignored `output/playwright/t9-safari-physical-microphone.png`, `t9-chrome-physical-microphone.png`, private `/private/tmp/eventops-t9-native-safari.ax.txt`, `eventops-t9-native-chrome-metrics.json` and `eventops-t9-device-server.log`. These checks supplement the earlier production component synthetic stream capture and T6 conversion evidence; they do not certify the complete authenticated Safari workflow or live provider transcription.

## VoiceOver attempt and restoration

System Settings initially showed VoiceOver off. VoiceOver Utility had Show caption panel on and AppleScript control off; those preferences were not changed. VoiceOver was temporarily enabled for the requested test. Inspection of the VoiceOver application then stalled and timed out. No reliable spoken output or complete screen reader journey was observed, so this is not a pass.

VoiceOver was restored through the observed System Settings switch and independently read as off afterward. The restoration line is saved privately in `/private/tmp/eventops-t9-voiceover-restored.txt`. VoiceOver Utility was returned to General and closed. System Settings, which was not running before this task, was also closed and confirmed not running. No security or remote automation setting was enabled. Screen reader acceptance remains open.

No physical mobile browser was exercised through the enabled desktop automation surfaces. Full mobile/device testing, the protected Safari journey and the browser sign in regression retest retain their prior authority/environment limits. The prior automatic approval rejection of the app terms/attestation flow was not retried or bypassed.

## Fresh local operations evidence

`T8_PG_DUMP=<installed PostgreSQL 17 pg_dump> node scripts/verify-t8-recovery.mjs` applied all current 42 migrations to isolated temporary databases, restored an encrypted database and hash matched synthetic object manifest, checked ownership/ACLs and the approved head, and replayed post backup raw file and event deletion. All assertions passed. The final measured drill was 2.29 seconds and 517387 encrypted bytes. Its two temporary databases were removed in finally; the running project was not reset or restored over. Evidence: `/private/tmp/eventops-t9-remaining-recovery.log`.

A read only transaction under `eventops_worker` returned local maintenance health: due objects 0, pending purges 0 and oldest queued analysis age 0 seconds. Evidence: `/private/tmp/eventops-t9-remaining-health.log`. This point observation does not establish continuous cleanup, hosted metrics or alert delivery.

The inspected app and Supabase URLs are loopback. The private worker file has no configured independent deletion ledger path or retention Storage token. No approved hosted EventOps target or hosted schedules/backup/monitoring configuration was established. No unrelated hosted project was changed. Actual hosted object restoration, independent deletion request reconciliation, backup expiry/key custody, alerts, deployed rollback and production RPO/RTO remain unverified under the no provisioning/deployment boundary. The [T8 runbook](2026-10-29-t8-runbook.md) still governs restored access.

Both private environment files now have owner only 0600 permissions. The web file was tightened from 0644 without changing its contents. No model key is present in either file. Worker access/billing flags are zero, voice enablement is absent and therefore off, and both database live provider gates were read false. No worker was started.

## Current live AI readiness

The existing Meta account session reopened through its normal Login link without a new agreement or credential being entered. The signed in dashboard and API key page report an account restriction caused by a failed temporary payment method hold. The key table is empty and Create API key is disabled. Dashboard requests and displayed spend were zero. No billing or payment control was changed. The billing detail panel did not finish loading during its observation, so the older USD 150 credit status is historical, not freshly reconfirmed here.

Evidence: ignored private `output/playwright/t9-meta-api-restricted.png`, captured from only the account page's main content, excluding the identity sidebar and account IDs. The [API key page](https://dev.meta.ai/api-keys) remains the account readiness source. No live probe was sent.

Current official [model documentation](https://dev.meta.ai/docs/models) still lists the selected `muse-spark-1.3` and `muse-voice-transcribe-1.0`. The current [pricing guide](https://dev.meta.ai/docs/pricing-rate-limits) lists Standard Spark input/output at USD 1.25/4.25 per million tokens and voice at USD 0.18 per hour. Contributor variants are not selected. Model catalog presence does not establish this account's request entitlement or compatibility. [ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) requires separate Meta organization enablement; it was not established, and `store: false` does not establish it.

The inspected code reserves USD 0.15 per text analysis attempt and USD 0.018 per voice job. Even one text attempt per each of the 90 runs would reserve USD 13.50, before additional workflow attempts/audio. This is conservative reservation arithmetic, not measured billing or a request to spend that sum. The historical USD 1 synthetic probe allowance is not approval or enforcement for a full 90 run campaign. The existing shared USD 2/10/50 limits are unchanged; a dedicated durable aggregate run allowance covering retries and restarts still needs implementation and verification before execution.

## Offline evaluation ledger

[The preflight ledger](2026-10-29-live-evaluation-preflight.json) records the 30 approved named cases and 90 planned run slots, each explicitly `not_run`. It pins the current model, prompt/schema versions and hashes of provider, orchestration, privacy, tool, schema and validator sources. All result, usage and human review fields are empty. Executed runs and agent provider spend are zero. This is an auditable blocked ledger, not an evaluation harness or evidence of quality.

Exact case inputs, allowed alternatives and expected facts still need to be materialized and reviewed as a complete live corpus. A model request compatibility/usage probe, the aggregate run allowance and independent human assessment of ambiguous outcomes also remain open. Controlled responses, deterministic parity and a synthetic judge cannot substitute for the required 90 real model runs or waive an invariant failure. Existing application validation and approval boundaries must remain intact.

The concrete execution blockers are the restricted provider account, disabled/unavailable key, absent private key, disabled live gates, unresolved aggregate allowance, incomplete live case corpus and unmeasured provider behavior. Resolving account/payment readiness or supplying a private key is an operator action outside this agent's current restrictions. A key alone must not activate the web or worker gates. No terms acceptance, payment update, key creation or inference was performed to work around the block.

## Release status

This pass adds native public Safari/zoom/keyboard evidence, real desktop device/codec/playback evidence in two browsers, a fresh 42 migration recovery drill, restricted local health and current account readiness evidence. Application code and the previously passing 158 test suite were unchanged; the suite was not rerun and is not claimed as a new result. No acceptance box was marked complete. Full T9 remains in progress for screen reader, mobile/full native app flow, auth retest, actual live evaluation and hosted operation gates.

Cleanup closed only the task Safari window, Chrome provider/device tabs, the accessibility utilities opened for this test, and the two loopback servers on ports 3005 and 3006. Existing browser windows and local services were preserved. The static fixture and redacted evidence remain local; there is no saved microphone audio.
