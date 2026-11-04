// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, chmod, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Node verification helper.
import * as allowance from "../../../scripts/lib/t9-allowance.mjs";
// @ts-expect-error Node verification helper.
import * as planner from "../../../scripts/lib/t9-campaign-plan.mjs";
describe("authorized campaign amendment", () => {
  it("appends authorization without replacing retained charges and still blocks call replay", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eventops-amend-"));
    await chmod(dir, 0o700);
    try {
      const path = join(dir, "reservations.jsonl");
      await allowance.reserveCampaign({
        path,
        limitMicrousd: 1000000,
        amountMicrousd: 768000,
        key: "existing",
      });
      const before = await readFile(path, "utf8");
      const change = {
        path,
        previousLimitMicrousd: 1000000,
        newLimitMicrousd: 15000000,
        key: "approved-20261104",
        approval:
          "User approved USD 15 total, including retained reservations.",
      };
      const result = await allowance.amendCampaignAllowance(change);
      expect(result).toEqual({
        alreadyRecorded: false,
        limitMicrousd: 15000000,
        reservedMicrousd: 768000,
      });
      const after = await readFile(path, "utf8");
      expect(after.startsWith(before)).toBe(true);
      expect(planner.inspectJournal(after)).toEqual({
        limit_microusd: 15000000,
        reserved_microusd: 768000,
        remaining_microusd: 14232000,
      });
      expect(
        (await allowance.amendCampaignAllowance(change)).alreadyRecorded,
      ).toBe(true);
      expect(await readFile(path, "utf8")).toBe(after);
      await expect(
        allowance.amendCampaignAllowance({
          ...change,
          approval: "Different approval",
        }),
      ).rejects.toThrow();
      await expect(
        allowance.reserveCampaign({
          path,
          limitMicrousd: 1000000,
          amountMicrousd: 1,
          key: "new",
        }),
      ).rejects.toThrow();
      let calls = 0;
      const config = {
        path,
        limitMicrousd: 15000000,
        amountMicrousd: 50000,
        key: "new-call",
      };
      await allowance.campaignCall(config, async () => calls++)();
      await expect(
        allowance.campaignCall(config, async () => calls++)(),
      ).rejects.toThrow();
      expect(calls).toBe(1);
      await appendFile(path, "{");
      await expect(
        allowance.reserveCampaign({ ...config, key: "truncated" }),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
