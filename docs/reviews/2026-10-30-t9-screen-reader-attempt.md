# T9 screen reader attempt and native keyboard check

Date: 30 October 2026, Asia/Brunei.

## Result

Native Chrome keyboard navigation on the public sign in page passes the checks
below. A reliable VoiceOver announcement or caption could not be observed, so
the screen reader criterion remains unverified. This is neither a screen reader
pass nor evidence of an application screen reader defect. Full AC-27/28 and T9
remain open.

The working tree was clean at entry, at `2f8934a`. Existing committed work and
synthetic fixtures were preserved. The previously verified standalone production
build ran on loopback port 3005. No source, environment or provider gate changed.
No worker, live AI, sign in, form submission, attestation or terms acceptance was
performed. No payment, deployment, commit or push occurred.

## VoiceOver observation and restoration

System Settings initially showed VoiceOver off. VoiceOver Utility initially had
the caption panel on, welcome dialog on and AppleScript control off. Those
preferences were not changed. VoiceOver was temporarily enabled through its
normal Settings switch for this requested check.

The EventOps tab was brought into view and a VoiceOver navigation command was
attempted. The available browser accessibility state and screenshot did not show
an observable caption or announcement. The application inventory exposed
VoiceOver Utility but no usable VoiceOver caption window. The prior hanging
VoiceOver application inspection was not repeated, and no automation/security
preference was enabled to work around it. No complete spoken flow is claimed.

VoiceOver was restored to off through the normal Settings switch and independently
read as off afterward. The private confirmation is saved in
`/private/tmp/eventops-t9-20261030-voiceover-restored.txt`. The utility was returned
to its original General panel with AppleScript control still off. Only the task
utility and Settings were closed. Final application inventory showed Settings
not running and no VoiceOver Utility entry. The task browser tab and port 3005
server were closed; preexisting applications and Supabase were preserved.

## Actual native keyboard checks

These observations use native Chrome keyboard events and actual focus state,
not inferred DOM order:

| Action | Observed result |
|---|---|
| Reload, then Tab | First focus target is Skip to content |
| Enter on Skip to content | Focus moves to `MAIN` with ID `main-content` |
| Tab | Email address field receives focus with its accessible label |
| Tab | Adult roster attestation receives focus with its full label and value 0 |
| Tab, Tab | Account terms, then privacy notice links receive focus, neither activated |
| Tab | Disabled Send email code is skipped; Event preparation checklist receives focus |

Final read only state confirmed attestation false and Send email code disabled.
No email address was entered. Ignored private screenshot:
`output/playwright/t9-20261030-keyboard-public.png`.

The existing no terms restriction was preserved. No protected browser session
was available in this native tab; the full authenticated proposal/approval/dialog
flow was not tested or bypassed. Physical mobile hardware and reliable spoken
screen reader observation still require a suitable human/device verification
session. The earlier automated, native device and controlled SQL evidence retains
its previously recorded scope.
