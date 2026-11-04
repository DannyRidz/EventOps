# Synthetic evaluation budget authorization

Date: 4 November 2026, Asia/Brunei.

The user explicitly answered **“Approve USD 15 total evaluation ceiling”** to the question `call_b79ae0bc27a24ec2b76a978283de95a4`. The question specified that this is the total synthetic Meta API evaluation allowance, includes USD 0.768 already reserved, permits up to USD 14.232 additional reservations within that total and applies only after the remaining workflow code passes review.

This supersedes the original USD 1 monetary ceiling for the synthetic evaluation campaign. It does not authorize payment details, paid hosting, deployment, legal acceptance, publication, commit or push. All those boundaries remain unchanged.

The original `output/live-analysis-private/usd1-reservations.jsonl` remains the authority. Its filename and original header are preserved. The authorized increase is recorded as an additional hash-chained `allowance_amendment` row, with the original USD 1 limit, new USD 15 limit, user approval text, timestamp and prior hash. Existing charges are retained. No separate live allowance or refund is permitted.

Append key: `user-approved-usd15-20261104`. If the amendment already exists with identical values, it replays without appending another row. Conflicting approvals, incomplete journals and changed reservation payloads fail closed. No provider call is part of recording this amendment.
