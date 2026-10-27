// Local evaluation only. Native CLI 2.122 does not yet serve Auth templates.
// Configure the real GoTrue process through its documented template URL variables.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const home = process.env.SUPABASE_HOME;
if (!home || !home.startsWith("/private/tmp/"))
  throw new Error("Set SUPABASE_HOME to a dedicated /private/tmp directory.");
const templateOrigin =
  process.env.LOCAL_TEMPLATE_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(templateOrigin))
  throw new Error("Local template origin must be loopback HTTP.");
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name === "auth" && path.endsWith("/bin/auth")) {
      let body = await readFile(path, "utf8");
      body = body.replace(
        /^export GOTRUE_MAILER_TEMPLATES_(MAGIC_LINK|CONFIRMATION)=.*\n/gm,
        "",
      );
      body = body.replace(
        "#!/bin/sh\n",
        `#!/bin/sh\nexport GOTRUE_MAILER_TEMPLATES_MAGIC_LINK='${templateOrigin}/auth-code.html'\nexport GOTRUE_MAILER_TEMPLATES_CONFIRMATION='${templateOrigin}/auth-code.html'\n`,
      );
      await writeFile(path, body);
    }
  }
}
await walk(join(home, "cache/stack/slim-services/auth"));
const cli = "node_modules/.bin/supabase";
for (const args of [
  ["stop"],
  [
    "start",
    "--runtime",
    "native",
    "--exclude",
    "studio,realtime,storage,functions,analytics,pooler",
    "--eager",
  ],
]) {
  const result = spawnSync(cli, args, { env: process.env, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}
console.log(
  "Local Supabase restarted with the email code template. Keep EventOps running at the template origin.",
);
