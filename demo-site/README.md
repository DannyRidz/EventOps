# Public EventOps overview

Published at https://eventops-plan.pages.dev/ using Cloudflare Pages Direct Upload. This static page presents the existing video, workflow and repository setup links. It has no authentication, event storage, model credentials, analytics or live model calls. It is separate from the Next.js application.

Prepare the public assets from the repository root:

```sh
EVENTOPS_DEMO_VIDEO_PATH=/absolute/path/to/approved-walkthrough.mp4 node scripts/prepare-cloudflare-demo.mjs
```

The allowlisted output is `output/cloudflare-deployment/site/`: HTML, stylesheet, shared design tokens, icon, response headers and the approved public video. The script checks the shortened overview recording SHA256. The submitted original is preserved separately. To reproduce the public copy, use the reviewed ffmpeg binary to trim the original at 151.7 seconds with stream copying and `-movflags +faststart`: `ffmpeg -i original.mp4 -t 151.7 -map 0:v:0 -map 0:a:0 -c copy -movflags +faststart walkthrough.mp4`. The script rejects different bytes. Upload only those six files, or a ZIP with those files at its root, to the existing `eventops-plan` Pages project. Never upload the repository, environment files, private fixtures or the whole output directory. This project uses manual uploads and has no Git integration.

Use the current free plan without adding a domain, payment method or paid resources. Future publication must also respect the submission freeze and the participant's authorization. The page's deployment does not verify full application hosting or complete T9.
