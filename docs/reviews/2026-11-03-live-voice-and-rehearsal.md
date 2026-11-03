# Live voice and browser rehearsal status

Date: 3 November 2026, Asia/Brunei. The user authorized continuing with synthetic
voice tests under the remaining USD 0.40 of the existing USD 1 campaign, followed
by browser rehearsal and local T10 preparation. No terms, payment changes,
deployment, publication, commit or push were authorized.

## Live voice results

The first two Meta ASR calls returned HTTP 200 for the existing 7,897 millisecond
Albert clip, but failed the critical speech content check. The second exact
transcript was `12 to 13 Sympathic will cover`. The first transcript was not
retained before its semantic assertion failed; its successful worker completion
and HTTP result were retained. This is an unresolved quality limitation on that
synthetic voice, not a successful content test.

A new fixture used the already installed Samantha voice at 145 words per minute.
Its 5,053 millisecond clip returned HTTP 200 in 3,084 milliseconds and transcribed:

> Move opening to to room 2 from 12 to 13. Synthetic Sam will cover opening.

The room, times and assignee passed the explicit semantic checks. The duplicate
word remains an observed transcription error. The actual worker preserved that
original text, saved the organizer authored correction with expected generation,
confirmed it as voice sourced text and preserved the original transcript source.
Analysis remained blocked because its isolated database gate was off. The
restricted cleanup worker deleted fixture Storage metadata and acknowledged
deletion only after it was absent.

`runVoice`, `createTranscriber`, `convertRecording`, owner functions and the
restricted claim/finish functions were used. The ffmpeg executable was the
previously used installed `/Applications/Stremio.app/Contents/MacOS/ffmpeg`.
The local fixture store supplied hash verified bytes; SQL Storage policies were
exercised for deletion. This does not verify actual Storage HTTP/JWT behavior or
hosted container isolation. No physical microphone was used and no human audio
review is claimed. The two existing synthetic voices are not representative
speech quality evidence.

Controlled verification first exposed missing worker claim context in the test
fixture store. Adding the existing `eventops_worker` claim to that restricted SQL
session made its policy check pass. Application code was not weakened or changed.
This was a harness configuration failure, not a demonstrated product cleanup bug.

## Cost and restoration

All three actual ASR requests reserved USD 0.006 before I/O in the same durable
`output/live-analysis-private/usd1-reservations.jsonl` used for the text tests.
The total retained campaign reservation is now USD 0.618, leaving USD 0.382.
No journal was reset or reservation refunded. At USD 0.18 per hour, clip duration
estimates total USD 0.00104235 across the three requests; this is not a confirmed
invoice. Each SQL voice job conservatively retained its USD 0.018 reservation.
Private receipts are retained without the model key. Both original database
gates remained off and temporary databases and worker logins were removed.

## Browser and T10

The local production app was started on loopback port 3000. Opening `/events`
redirected to `/sign-in`. There is no current authenticated browser session.
The page requires the user's personal adult/authority attestation and says that
continuing accepts account terms. No checkbox, terms acceptance or code request
was performed. The standing no terms boundary prevents completing that action
for the user. The sign in page is left open for human handoff.

The submission draft now distinguishes the real text and voice smoke evidence
from the unexecuted 90 run campaign. A new three minute text rehearsal script
uses the already verified explicit update and keeps actual browser completion,
timing and recording pending. No video was recorded or uploaded.

The official public submission listing was refreshed and still states November
4 at 9 PM Eastern, which is November 5 at 10 AM Asia/Brunei. The internal target
remains November 4 at 8 PM Brunei. The signed out public details do not establish
the authenticated submission form fields. See the [official page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit).

## Remaining work

Final `npm run check` passed lint, formatting, route types, strict type checking
and 159 tests in 26 files. Fixture byte counts and hashes, local document links
and `git diff --check` passed. Both original database gates were false; zero test
databases and zero temporary worker logins remained. The worker key file remained
0600 with every persistent enablement flag disabled. No application source changed
in this continuation, so the earlier passing production build was served rather
than counted as a new build.

Authenticated browser rehearsal, a measured recording, physical audio and
accessibility checks, full model evaluation, production Storage/container and
operations evidence remain open. General live processing remains disabled.
No T9 or T10 completion is claimed by this bounded continuation.
