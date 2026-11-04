# Sample events and workflow guidance

The [guided sample specification](../../../docs/specs/0001-eventops/0014-guided-sample.md) governs this area.

- `sample.ts` owns explicitly fictional setup, raw input and suggested text. Keep it separate from internal verification fixtures. The normal staging function supplies actual IDs and frozen evidence.
- Loading uses existing owner scoped event and draft APIs, never direct writes, automatic plan confirmation or provider execution.
- `create.ts` retains only the creation UUID in tab scoped session storage. Read the durable plan before staging. Stage only a matching empty generation 1 draft; preserve any existing staged or approved records. Missing storage, changed setup and ambiguous writes fail without blind overwrite.
- `data.ts` recognizes sample help from the immutable owner scoped event creation snapshot. Recognition changes guidance only, never authentication, authorization or approval.
- Suggestions fill an empty new update only on explicit click. They never replace typed or saved text, save, confirm or send it to AI.
- Guide steps are instructions, not completion receipts. Show actual starting plan state and the real process AI flag; keep manual fallback available. Do not claim remote judge access from this local feature.
- Verify with `npx vitest run src/features/samples src/features/updates/update-form.test.tsx src/features/plans/editor.test.tsx` and the normal repository checks. Real browser evidence belongs in docs/reviews, with live provider gates left unchanged.

_Drafted by /sync from the introducing change, worth a quick human pass._
