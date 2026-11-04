// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdtemp, chmod, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Verification helper.
import { campaignAnchor } from "../../../scripts/lib/t9-campaign-anchor.mjs";
describe("retained SQL campaign anchor", () => {
  it("requires previous state after initialization and refuses identity drift or a lost anchor", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eventops-anchor-"));
    await chmod(dir, 0o700);
    try {
      await expect(campaignAnchor(dir, "a".repeat(64), true)).rejects.toThrow();
      expect(await readdir(dir)).toEqual([]);
      expect(await campaignAnchor(dir, "a".repeat(64))).toEqual({
        requireExistingCampaign: false,
      });
      expect(await campaignAnchor(dir, "a".repeat(64))).toEqual({
        requireExistingCampaign: true,
      });
      await expect(campaignAnchor(dir, "b".repeat(64))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
