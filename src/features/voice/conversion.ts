import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { audioMime, MAX_AUDIO_BYTES } from "./contracts";
const execute = promisify(execFile);
export async function convertRecording(
  bytes: Uint8Array,
  mime: string,
  binary: string,
) {
  if (!isAbsolute(binary) || !bytes.length || bytes.length > MAX_AUDIO_BYTES)
    throw new Error("INVALID_AUDIO");
  audioMime(mime, bytes);
  const directory = await mkdtemp(join(tmpdir(), "eventops-audio-"));
  try {
    const input = join(directory, "recording"),
      output = join(directory, "converted.wav");
    await writeFile(input, bytes, { mode: 0o600 });
    // Fixed local paths only, no shell, no network protocols, bounded time/output.
    await execute(
      binary,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-format_whitelist",
        "matroska,webm,mov",
        "-codec_whitelist",
        "opus,aac",
        "-protocol_whitelist",
        "file",
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-map_metadata",
        "-1",
        "-t",
        "120.1",
        "-ac",
        "1",
        "-ar",
        "24000",
        "-c:a",
        "pcm_s16le",
        "-threads",
        "1",
        "-f",
        "wav",
        output,
      ],
      {
        timeout: 20000,
        maxBuffer: 16384,
        env: { PATH: "/usr/bin:/bin", NODE_ENV: "production" },
      },
    );
    const wav = await readFile(output);
    const duration = wavDuration(wav);
    return { wav, duration };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export function wavDuration(wav: Buffer) {
  if (
    wav.length > 5_800_000 ||
    wav.toString("ascii", 0, 4) !== "RIFF" ||
    wav.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("INVALID_AUDIO");
  let format = false,
    frames = 0;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString("ascii", offset, offset + 4),
      size = wav.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + size > wav.length) throw new Error("INVALID_AUDIO");
    if (tag === "fmt ")
      format =
        size >= 16 &&
        wav.readUInt16LE(start) === 1 &&
        wav.readUInt16LE(start + 2) === 1 &&
        wav.readUInt32LE(start + 4) === 24000 &&
        wav.readUInt16LE(start + 14) === 16;
    if (tag === "data") frames += size / 2;
    offset = start + size + (size % 2);
  }
  const duration = Math.ceil(frames / 24);
  if (!format || !Number.isInteger(frames) || duration < 1 || duration > 120000)
    throw new Error("AUDIO_DURATION");
  return duration;
}
