# Voice and transcript review

Read the approved audio contract in `docs/specs/0001-eventops/0005-ai.md`, architecture and operations contracts, and [T6 evidence](../../../docs/reviews/2026-10-28-t6-voice-completion.md).

- Browser capture accepts WebM/Opus or MP4/AAC, at most 120 seconds and 10 MiB. Keep typing, stop, playback and discard available, and release microphone tracks and object URLs.
- Private Storage objects have immutable byte/hash job receipts. Worker and playback verify those receipts before using bytes. Never permit overwrite or derive facts from unchecked audio.
- The dedicated worker uses only restricted database functions and a separately scoped `eventops_worker` Storage JWT, never owner or service credentials. Its mandatory restrictive Storage policy limits it to registered audio and due deletion.
- Use the approved restricted container for ffmpeg. Fixed arguments, local protocols, codec restrictions and deadlines supplement container isolation. Conversion temporary files are always removed.
- Only a current worker lease can complete a transcript. Preserve exact original text separately from corrections, including whitespace. Save corrections with the expected generation. Exact organizer confirmation and the existing analysis/proposal/approval boundary remain mandatory.
- Audio and text share the budget lock, development allowance and workspace concurrency limit. The conservative USD 0.018 reservation covers three maximum duration transcription calls across restarts.
- Cleanup must run independently of provider enablement and credentials. Immediate confirmation/discard deletion, 24 hour finalized cleanup, seven day absolute expiry and ten minute incomplete upload expiry remain enforced through durable due dates. Acknowledge deletion only after Storage metadata is absent; retry failures.
- `npm run worker:voice` uses private worker configuration. Live voice, analysis and database gates remain disabled until operator prerequisites pass. `scripts/verify-t6.mjs` uses controlled transcription responses and temporary loopback credentials, never live provider access.
- Native Safari, physical mobile/desktop microphones, hosted Storage role support and container operations remain release verification gaps. Do not advertise verified device support from Chromium synthetic capture alone.

_Drafted by /sync from the introducing change, worth a quick human pass._
