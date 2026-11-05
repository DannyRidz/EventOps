# Public demo overview

Published at https://eventops-demo.pages.dev/ using Cloudflare Pages Direct Upload. This static page presents the existing video, workflow and repository setup links. It has no authentication, event storage, model credentials, analytics or live model calls. It is separate from the Next.js application.

Prepare the public assets from the repository root:

```sh
EVENTOPS_DEMO_VIDEO_PATH=/absolute/path/to/approved-demo.mp4 node scripts/prepare-cloudflare-demo.mjs
```

The allowlisted output is `output/cloudflare-deployment/site/`: HTML, stylesheet, shared design tokens, icon, response headers and the approved public video. The script checks the video SHA256 against the submitted recording. Download that exact recording from the public video link in the root README if it is not available locally. Upload only those six files, or a ZIP with those files at its root, to the existing `eventops-demo` Pages project. Never upload the repository, environment files, private fixtures or the whole output directory. This project uses manual uploads and has no Git integration.

Use the current free plan without adding a domain, payment method or paid resources. Future publication must also respect the submission freeze and the participant's authorization. The page's deployment does not verify full application hosting or complete T9.
