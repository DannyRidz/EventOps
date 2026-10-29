# CSV imports

Read the approved import contract in `docs/specs/0001-eventops/0004-data.md` and T5 evidence in `docs/reviews/2026-10-28-t5-imports-completion.md` from the repository root.

- `csv.ts` bounds and parses CSV without evaluating content. PostgreSQL independently reparses original bytes; keep grammar and source line locators in parity.
- `model.ts` defines templates, explicit mapping and duplicate choices, conversion and actionable diagnostics. Missing coverage and availability must remain unresolved.
- `data.ts` owns authenticated I/O. All database mutations use scoped functions; the candidate must match saved correction decisions in SQL.
- Originals use private Storage and a bounded immutable database byte receipt. The receipt is authoritative recovery; never serve a mismatched object. T8 retention purges both copies. Raw receipt downloads use a scoped function; authenticated users cannot SELECT the original byte column.
- Corrections retain original cells, actor and saved generation. Saving corrections fences older staged confirmation. Stage only after explicit whole batch review, then use the existing separate revision 1 confirmation.
- Initial imports never replace an approved plan. Later corrections use the manual proposal path.
- `npm run check` runs parser and UI tests. `T5_BOUNDARIES=1 node scripts/verify-t5.mjs` verifies real loopback services, Storage policies and collection limits. Keep private sessions and synthetic fixtures out of source control.

_Drafted by /sync from the introducing change, worth a quick human pass._
