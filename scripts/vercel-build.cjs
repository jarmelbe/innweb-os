const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const bin = (name) => path.join(process.cwd(), "node_modules", name);
const prismaCli = bin("prisma/build/index.js");
const nextCli = bin("next/dist/bin/next");

function run(script, args) {
  if (!existsSync(script)) throw new Error(`Build tool not found: ${script}`);
  execFileSync(process.execPath, [script, ...args], { stdio: "inherit", env: process.env });
}

run(prismaCli, ["generate"]);

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error("Production builds require DATABASE_URL and DIRECT_URL to apply database migrations.");
  }
  run(prismaCli, ["migrate", "deploy"]);
}

run(nextCli, ["build"]);
