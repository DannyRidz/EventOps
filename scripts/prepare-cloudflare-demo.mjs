import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "output/cloudflare-deployment/site");
const video = process.env.EVENTOPS_DEMO_VIDEO_PATH;
if (!video || !path.isAbsolute(video)) {
  throw new Error(
    "Set EVENTOPS_DEMO_VIDEO_PATH to the absolute approved walkthrough video path.",
  );
}
const expectedVideoHash =
  "19cf548b25631339e597a12792a0994c73ce1380e977915b3032bc8ee196c0a3";
if (
  createHash("sha256")
    .update(await readFile(video))
    .digest("hex") !== expectedVideoHash
) {
  throw new Error(
    "Video differs from the approved public recording; review before publication.",
  );
}
await mkdir(output, { recursive: true });
const sources = new Map([
  ["index.html", "demo-site/index.html"],
  ["styles.css", "demo-site/styles.css"],
  ["_headers", "demo-site/_headers"],
  ["tokens.css", "src/styles/tokens.css"],
  ["icon.svg", "src/app/icon.svg"],
  ["walkthrough.mp4", video],
]);
const existing = await readdir(output);
if (existing.some((name) => !sources.has(name))) {
  throw new Error(
    "Unexpected file in overview output; review it before packaging.",
  );
}
for (const [name, source] of sources) {
  await copyFile(
    path.isAbsolute(source) ? source : path.join(root, source),
    path.join(output, name),
  );
}
console.log(`Prepared ${sources.size} public static files in ${output}`);
