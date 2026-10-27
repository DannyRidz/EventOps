import { cpSync, existsSync } from "node:fs";

// Next's standalone server expects static assets beside its generated server.
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public"))
  cpSync("public", ".next/standalone/public", { recursive: true });
