# Hosting preparation and spending withdrawal

4 November 2026, Asia/Brunei.

You initially approved the separate synthetic staging proposal with a USD 100 monthly ceiling for one month. After Supabase requested payment setup, you stated that you do not want to pay for anything at the moment. That later instruction takes precedence. No paid provisioning or further live model evaluation is authorized by the withdrawn hosting allowance. Existing historical evaluation reservations remain unchanged.

## Actual account state

Render sign in through the existing linked identity succeeded without a new permission or terms acceptance. The EventOps web service form was inspected, not submitted. It offered USD 7 per month for 0.5 CPU and 512 MB RAM. No Render service was created and no charge incurred.

A dedicated Supabase organization named EventOps staging was created on Free. Its identifier is `ejynsgmvqesnrezszgzp`. No existing project or organization was changed. Supabase blocks a new free project because the account has reached its two active free project limit. The Pro checkout shows USD 25 per month and no payment methods. No card, billing address, plan confirmation or project password was entered. After your spending withdrawal, the checkout was dismissed and the organization was visibly still Free. No database was provisioned.

Private screenshot evidence is in `output/hosting-staging/supabase-free-plan.png`. No hosted EventOps URL exists. You reported owning no domain and requested a memorable address. `eventops-staging` is the intended host supplied label, subject to availability; no domain was purchased or address reserved. A host supplied web address does not establish a verified SMTP sender domain.

## Local packaging completed

Prepared `.dockerignore`, `Dockerfile` and `Dockerfile.worker`. Both images select Node 24.15.0 on Debian Bookworm slim and run as the node user. The web image copies only standalone output with static assets. The worker image installs locked production dependencies and has separate entry commands. Both default provider flags to disabled. Private environment files, Git history and ignored output are excluded from the build context. The context allowlist includes only named application build inputs.

The worker image does not include ffmpeg. It is suitable as preparation for retention or audio cleanup with provider flags off; live voice requires a separately verified converter image before enablement. The analysis process intentionally fails closed while its access flags are off. Neither Docker recipe is claimed as a built or verified container image, because no Docker, Podman or equivalent engine is installed.

Read the installed Next.js 16.4.3 deployment, self hosting and environment guides before packaging. Public Supabase settings are explicit build arguments because browser public environment variables are fixed during the Next build. Model credentials are never build arguments or web image inputs.

## Clean build verification

Created a temporary copy of exactly the web build inputs, excluding private environment files and tests. An initial attempt to install a second dependency tree exhausted local disk space, which also interrupted automatic approval review. Removed only that attempt's generated dependency and build copies. Reused the installed locked dependency bytes through temporary hard links, then ran a clean production build with synthetic public settings and Node 24.15.0. It passed. No real hosted service was contacted by those synthetic settings.

Started the resulting standalone server on loopback port 3011 with AI flags off. Observed home, sign in and health HTTP 200; unauthenticated event and workspace export HTTP 401; internal foundation and recovery HTTP 404. Confirmed no environment file in the temporary build root or standalone output. Stopped that temporary server and removed only the task's temporary build copy. Existing port 3000 services and user work were preserved. The build log is retained in ignored `output/hosting-staging/clean-build.log`.

These results verify the clean application build inputs and basic runtime boundaries. They do not verify a container engine, a hosted database, mail delivery, monitoring, independent object backup, actual host restore, retention scheduling or rollback. `git diff --check` passes. No commit, push, deployment, payment, terms acceptance or new provider request occurred.

## Current continuation boundary

All paid setup is stopped. The free organization has no database and no subscription. Existing unrelated projects will not be paused or deleted to evade the account limit. Hosted testing can resume when a no cost isolated database becomes legitimately available or you separately authorize paid resources again. Local packaging remains uncommitted for review, with the submitted artifacts preserved.
