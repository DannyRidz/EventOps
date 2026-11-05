# Free Cloudflare demo overview, 5 November 2026

The participant explicitly requested a simple Cloudflare link and approved publishing a free demo overview with the recorded video, workflow and repository links. They completed Cloudflare sign-in and its terms step themselves. The public URL is https://eventops-demo.pages.dev/.

## What was deployed

A separate Cloudflare Pages Direct Upload project, `eventops-demo`, serves six allowlisted static files: HTML, CSS, the existing design tokens, the existing icon, response headers and the exact approved public demo video. There is no Git integration, authentication, database, model key, application worker or live model call. No paid resources, custom domain, payment details or subscription upgrade were added. Existing unrelated Cloudflare projects were left unchanged.

Source is in `demo-site/`. `scripts/prepare-cloudflare-demo.mjs` copies the public allowlist and checks the explicitly supplied video against the approved recording hash. Generated files and private verification captures stay in the ignored `output/cloudflare-deployment/` directory. The root README links to the public overview and distinguishes it from the local application.

The first deployment used a Drive iframe. Its preview loaded but playback remained black in the browser check, so it was replaced with a native HTML video player serving the same approved recording directly from Pages. The separate Drive link remains available as a fallback.

## Actual results

- Cloudflare displayed successful production deployment at the permanent URL.
- Anonymous HTTPS requests returned HTTP 200 for the page and its static assets. HTML, styles, design tokens and icon matched the uploaded bytes.
- The final public video download contains 4,898,707 bytes and SHA256 `76b39f86b45c9ceebbfb8fe6c3e5ba1243678e86fec7d5f8e52b8ddf146d144b`, exactly matching the approved submission recording.
- The final page uses a restrictive content policy with same-origin styles, images and media; response headers deny framing and camera, microphone and geolocation access.
- Native Chrome displayed the public overview, workflow, setup links and explicit local-only application boundary. “Watch demo” moved to the video section. Native video playback reached 0:12, displayed actual recorded application screens and was paused afterward.
- Prettier checks, ESLint for the preparation script and Git whitespace checks passed. Public copy was checked for the requested excluded AI vendor names, with no matches.

The initial Python HTTPS asset check failed because that local Python installation lacks a trusted issuer certificate. Verification then used the system curl client with certificate validation enabled; no TLS protection was bypassed.

## Limits

This is a static overview, not a hosted EventOps workspace. No new live AI evaluation or hosted application operation was tested. The physical mobile, Safari and human screen-reader matrix was not rerun for this page. Deployment does not complete T9 or change the existing no-spending instruction. No commit, push or hackathon submission edit was performed.

## Product wording follow-up, 5 November, 8:14 AM Brunei

At the participant's request, public copy, title, metadata, navigation, section identifiers and media filenames now use EventOps overview and walkthrough wording. Scans of non-test application source and public assets found no demo/prototype/alpha/beta/MVP/coming-soon labels. The three existing home-page tests pass; Prettier, script ESLint and whitespace checks pass. Historical engineering records and language assertions in tests are retained.

The canonical free Pages project is now `eventops-plan`, at https://eventops-plan.pages.dev/. The original address returns HTTP 302 to it; following that redirect anonymously returns the exact final HTML. The original project was retained with a reversible redirect rather than deleted. The README points to the canonical address and still states that the workspace runs locally and live AI is disabled.

The overview recording ends at approximately 151.7 seconds, after the workflow and before the closing recap containing the old label. The original submitted recording and Drive file are unchanged. The shortened version was made by stream-copy trimming the preserved original with the previously reviewed ffmpeg binary, without model calls or synthesized replacement claims. It contains 4,313,252 bytes, SHA256 `19cf548b25631339e597a12792a0994c73ce1380e977915b3032bc8ee196c0a3`. An anonymous download of `/walkthrough.mp4` matches these bytes. The overview preparation script now pins this shortened version and documents reproduction. The root README's separate original submission video remains the preserved full recording.

No new live evaluation, payment, paid resource, account agreement, commit, push or submission edit was performed. This wording change does not change the existing T9 or hosting verification limits.
