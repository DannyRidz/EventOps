// Stored ZIP records, no compression or executable paths. Inputs are application selected.
export type ZipFile = { name: string; bytes: Uint8Array };
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function privateZip(
  files: ZipFile[],
  maximum = 64 * 1024 * 1024,
): Buffer {
  if (files.length > 65535) throw new Error("EXPORT_LIMIT");
  const parts: Buffer[] = [],
    directory: Buffer[] = [];
  let offset = 0,
    centralSize = 0;
  const names = new Set<string>();
  for (const file of files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(file.name) ||
      file.name.startsWith("/") ||
      file.name.split("/").includes("..") ||
      names.has(file.name)
    )
      throw new Error("EXPORT_PATH");
    names.add(file.name);
    const name = Buffer.from(file.name),
      bytes = Buffer.from(file.bytes),
      crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8);
    entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(bytes.length, 20);
    entry.writeUInt32LE(bytes.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    offset += header.length + name.length + bytes.length;
    centralSize += entry.length + name.length;
    if (offset + centralSize + 22 > maximum) throw new Error("EXPORT_LIMIT");
    parts.push(header, name, bytes);
    directory.push(entry, name);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
