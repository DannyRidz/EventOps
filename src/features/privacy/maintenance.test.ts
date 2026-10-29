import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendTombstone, retentionSweep } from "./maintenance";
import { privateZip } from "./zip";
describe("private ZIP", () => {
  it("produces stored records with safe paths and a central directory", () => {
    const zip = privateZip([
      { name: "workspace.json", bytes: Buffer.from('{"private":true}') },
    ]);
    expect(zip.readUInt32LE()).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(1);
    expect(zip.includes(Buffer.from('{"private":true}'))).toBe(true);
    expect(() =>
      privateZip([{ name: "../escape", bytes: new Uint8Array() }]),
    ).toThrow("EXPORT_PATH");
    expect(() =>
      privateZip([{ name: "x", bytes: new Uint8Array(100) }], 100),
    ).toThrow("EXPORT_LIMIT");
  });
});
describe("retention failures", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("never purges when independent ledger persistence fails", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ work: { objects: [], targets: [{ kind: "event", id }] } }],
    });
    await expect(
      retentionSweep({ query } as never, vi.fn(), async () => {
        throw new Error("disk full");
      }),
    ).rejects.toThrow("disk full");
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("continues other deletions and records before requesting atomic purge", async () => {
    const order: string[] = [];
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            work: {
              objects: [
                { bucket: "event-imports", path: `${id}/${id}/file.csv` },
              ],
              targets: [{ kind: "event", id }],
            },
          },
        ],
      })
      .mockImplementation(async () => {
        order.push("purge");
        return { rows: [{ done: false }] };
      });
    const result = await retentionSweep(
      { query } as never,
      async () => {
        throw new Error("Storage unavailable");
      },
      async () => {
        order.push("ledger");
      },
    );
    expect(order).toEqual(["ledger", "purge"]);
    expect(result).toEqual({
      code: "RETENTION_SWEEP",
      deleted: 0,
      failed: 1,
      purged: 0,
    });
  });
  it("durably stores only minimal opaque identifiers with private file permissions", async () => {
    const folder = await mkdtemp(join(tmpdir(), "eventops-ledger-")),
      path = join(folder, "tombstones.jsonl");
    try {
      await appendTombstone(path, { kind: "account", id });
      const row = JSON.parse(await readFile(path, "utf8"));
      expect(Object.keys(row).sort()).toEqual([
        "deleted_at",
        "expires_at",
        "id",
        "kind",
      ]);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
