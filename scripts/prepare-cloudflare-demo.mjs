import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "output/cloudflare-deployment/site");
const video = process.env.EVENTOPS_DEMO_VIDEO_PATH;
if (!video || !path.isAbsolute(video)) {
  throw new Error(
    "Set EVENTOPS_DEMO_VIDEO_PATH to the absolute approved demo video path.",
  );
}
const expectedVideoHash =
  "76b39f86b45c9ceebbfb8fe6c3e5ba1243678e86fec7d5f8e52b8ddf146d144b";
if (
  createHash("sha256")
    .update(await readFile(video))
    .digest("hex") !== expectedVideoHash
) {
  throw new Error(
    "Video differs from the approved public demo; review before publication.",
  );
}
await mkdir(output, { recursive: true });
const sources = new Map([
  ["index.html", "demo-site/index.html"],
  ["styles.css", "demo-site/styles.css"],
  ["_headers", "demo-site/_headers"],
  ["tokens.css", "src/styles/tokens.css"],
  ["icon.svg", "src/app/icon.svg"],
  ["demo.mp4", video],
]);
const existing = await readdir(output);
if (existing.some((name) => !sources.has(name))) {
  throw new Error(
    "Unexpected file in demo output; review it before packaging.",
  );
}
for (const [name, source] of sources) {
  await copyFile(
    path.isAbsolute(source) ? source : path.join(root, source),
    path.join(output, name),
  );
}
console.log(`Prepared ${sources.size} public static files in ${output}`);
