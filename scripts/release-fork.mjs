#!/usr/bin/env node
// publishes this fork as @anthonyalayo/zod; consume with "zod": "npm:@anthonyalayo/zod@^4.7.1"
// usage: node scripts/release-fork.mjs [--publish] [--auth-type=web]   (default is a dry run; run `nub run build` first)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NAME = "@anthonyalayo/zod";
const VERSION = "4.7.2";
const REPO = "git+https://github.com/anthonyalayo/zod.git";

const pkgDir = join(new URL("..", import.meta.url).pathname, "packages", "zod");
if (!existsSync(join(pkgDir, "v4", "index.js"))) throw new Error("packages/zod is not built, run `nub run build` first");

const manifestPath = join(pkgDir, "package.json");
const original = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(original);
const upstream = manifest.version;
manifest.name = NAME;
manifest.version = VERSION;
manifest.description = `${manifest.description} (fork adding schema.update() message overrides, based on zod@${upstream})`;
manifest.repository = { type: "git", url: REPO };
delete manifest.publishConfig;
// the version check compares against upstream's versions.ts; the fork keeps that runtime version
delete manifest.scripts?.prepublishOnly;

let tgz;
try {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  tgz = join(pkgDir, execFileSync("npm", ["pack", "--ignore-scripts"], { cwd: pkgDir, encoding: "utf8" }).trim().split("\n").pop());
} finally {
  writeFileSync(manifestPath, original);
}
console.log(`${NAME}@${VERSION} (upstream ${upstream}) -> ${tgz}`);

const args = ["publish", tgz, "--access", "public"];
if (!process.argv.includes("--publish")) args.push("--dry-run");
const authType = process.argv.find((a) => a.startsWith("--auth-type="));
if (authType) args.push(authType);
execFileSync("npm", args, { stdio: "inherit" });
