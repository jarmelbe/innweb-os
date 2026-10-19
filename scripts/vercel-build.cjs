const { execFileSync } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const path = require("node:path");

const bin = (name) => path.join(process.cwd(), "node_modules", name);
const prismaCli = bin("prisma/build/index.js");
const nextCli = bin("next/dist/bin/next");

function run(script, args) {
  if (!existsSync(script)) throw new Error(`Build tool not found: ${script}`);
  execFileSync(process.execPath, [script, ...args], { stdio: "inherit", env: process.env });
}

run(prismaCli, ["generate"]);

const tests = readdirSync(path.join(process.cwd(), "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join("tests", name));
if (tests.length === 0) throw new Error("CSV regression tests were not found.");
execFileSync(process.execPath, ["--test", ...tests], { stdio: "inherit", env: process.env });

if (process.env.INNWEB_VERIFY_RECORD_COUNTS === "1") {
  run(path.join(process.cwd(), "scripts/verify-crm-state.cjs"), []);
}

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error("Production builds require DATABASE_URL and DIRECT_URL to apply database migrations.");
  }
  run(prismaCli, ["migrate", "deploy"]);
}

run(nextCli, ["build"]);
