// Synthetic offline files only. Uses installed local speech and codec binaries.
import "./lib/t9-source.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
const { convertRecording } =
  await import("../src/features/voice/conversion.ts");

const root = "evals/t9/audio";
const binary = process.env.EVENTOPS_FFMPEG_PATH;
assert.ok(
  binary && isAbsolute(binary),
  "Set EVENTOPS_FFMPEG_PATH to an installed binary",
);
assert.ok(process.argv.slice(2).every((x) => x === "--write"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const transcript =
  "Move Opening to Room 2 from twelve to thirteen. Synthetic Sam will cover Opening.";
if (process.argv.includes("--write")) {
  const temp = await mkdtemp(join(tmpdir(), "eventops-t9-audio-"));
  try {
    const pcm = Buffer.alloc(24000 * 2 * 2);
    let seed = 271828;
    for (let i = 0; i < pcm.length; i += 2) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pcm.writeInt16LE(Math.floor((seed / 2 ** 32 - 0.5) * 3000), i);
    }
    await writeFile(join(temp, "noise.pcm"), pcm, { mode: 0o600 });
    await writeFile(join(temp, "silence.pcm"), Buffer.alloc(pcm.length), {
      mode: 0o600,
    });
    execFileSync(
      "/usr/bin/say",
      ["-v", "Albert", "-o", join(temp, "speech.aiff"), transcript],
      { timeout: 20000 },
    );
    const manifest = {
      schema_version: 1,
      synthetic: true,
      provider_calls: 0,
      human_audio_review: null,
      files: [],
    };
    for (const [name, codec, extension, mime] of [
      ["silence", "libopus", "webm", "audio/webm"],
      ["noise", "libopus", "webm", "audio/webm"],
      ["speech", "libopus", "webm", "audio/webm"],
      ["speech", "aac", "mp4", "audio/mp4"],
    ]) {
      const file = `${name}.${extension}`;
      execFileSync(
        binary,
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          ...(name === "speech"
            ? []
            : ["-f", "s16le", "-ar", "24000", "-ac", "1"]),
          "-i",
          join(temp, name === "speech" ? "speech.aiff" : `${name}.pcm`),
          "-map_metadata",
          "-1",
          "-ac",
          "1",
          "-ar",
          "24000",
          "-c:a",
          codec,
          `${root}/${file}`,
        ],
        { timeout: 20000 },
      );
      const bytes = await readFile(`${root}/${file}`);
      const converted = await convertRecording(bytes, mime, binary);
      manifest.files.push({
        file,
        mime,
        bytes: bytes.length,
        sha256: hash(bytes),
        duration_ms: converted.duration,
        authored_transcript: name === "speech" ? transcript : null,
        kind: name,
        voice: name === "speech" ? "installed macOS Albert" : null,
      });
    }
    await writeFile(
      `${root}/manifest.json`,
      JSON.stringify(manifest, null, 2) + "\n",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
assert.equal(manifest.files.length, 4);
for (const file of manifest.files) {
  assert.match(file.file, /^(silence|noise|speech)\.(webm|mp4)$/);
  const bytes = await readFile(`${root}/${file.file}`);
  assert.equal(hash(bytes), file.sha256);
  assert.equal(bytes.length, file.bytes);
  const converted = await convertRecording(bytes, file.mime, binary);
  assert.equal(converted.duration, file.duration_ms);
  assert.ok(converted.duration <= 120000);
  await assert.rejects(() =>
    convertRecording(Buffer.from("not media"), file.mime, binary),
  );
}
console.log(
  JSON.stringify({
    supported_audio_files: 4,
    codec_conversion: "pass",
    hash_checks: "pass",
    malformed_rejected: 4,
    provider_calls: 0,
    human_audio_review: manifest.human_audio_review,
  }),
);
