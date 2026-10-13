#!/usr/bin/env node
// Vendors the house style's canonical tokens.css into the cliqs app (unit 2, 2026-10-12).
//
//   node scripts/vendor-house-style.mjs <sha>            write styles/house-style.tokens.css from that commit
//   node scripts/vendor-house-style.mjs                  same, at the sha named in the file's own header
//   node scripts/vendor-house-style.mjs [<sha>] --check  write nothing; exit 1 if the file on disk is not what this script produces
//
// The canonical file is read with `git show <sha>:tokens.css` in the house-style checkout (HOUSE_STYLE=<dir> moves it; default
// /Users/exe/Downloads/Claude/house-style), so a working-tree edit there cannot leak in. Unlike the Labs layer, cliqs needs NO
// rescoping: shadcn reads :root, and the canonical file is already `:root` (dark) + `:root[data-theme="light"]` + an OS-light
// media block. The only change is one header line. No packages, nothing is started.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "styles", "house-style.tokens.css");
const REPO = process.env.HOUSE_STYLE ?? "/Users/exe/Downloads/Claude/house-style";
const check = process.argv.includes("--check");
let sha = process.argv.slice(2).find((a) => !a.startsWith("--"));

const HEADER =
  /^\/\* VENDORED-FROM: ShieldnestORG\/house-style ([0-9a-f]{7,40}) tokens\.css, unchanged; do not edit, re-vendor \*\/\n/;
if (!sha) {
  const onDisk = existsSync(OUT) ? HEADER.exec(readFileSync(OUT, "utf8")) : null;
  if (!onDisk) {
    console.error(
      "vendor-house-style: no sha given and styles/house-style.tokens.css has no VENDORED-FROM header",
    );
    process.exit(2);
  }
  sha = onDisk[1];
}
if (!/^[0-9a-f]{7,40}$/.test(sha)) {
  console.error(`vendor-house-style: "${sha}" is not a commit sha`);
  process.exit(2);
}

let canonical;
try {
  canonical = execFileSync("git", ["-C", REPO, "show", `${sha}:tokens.css`], {
    encoding: "utf8",
    maxBuffer: 1 << 24,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  console.error(
    `vendor-house-style: cannot read ${sha}:tokens.css in ${REPO} (is the house-style checkout there? HOUSE_STYLE=<dir>): ${String(e.stderr || e.message).trim()}`,
  );
  process.exit(2);
}
// The shape this app relies on: dark base on :root, a forced-light block, an OS-light block.
for (const re of [
  /^:root \{$/m,
  /^:root\[data-theme="light"\] \{$/m,
  /^  :root:not\(\[data-theme="dark"\]\) \{$/m,
]) {
  if (!re.test(canonical)) {
    console.error(
      `vendor-house-style: ${sha}:tokens.css has no line matching ${re} (the canonical shape changed: update the app before re-vendoring)`,
    );
    process.exit(2);
  }
}

const produced = `/* VENDORED-FROM: ShieldnestORG/house-style ${sha} tokens.css, unchanged; do not edit, re-vendor */\n${canonical}`;

if (check) {
  const onDisk = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (onDisk === produced) {
    console.log(`vendor-house-style --check: ok (${sha}, ${produced.length} bytes)`);
    process.exit(0);
  }
  console.error(
    `vendor-house-style --check: FAIL: styles/house-style.tokens.css is ${onDisk === null ? "missing" : "not what the script produces for " + sha} (a hand edit, or a stale sha). Re-vendor: node scripts/vendor-house-style.mjs ${sha}`,
  );
  process.exit(1);
}
writeFileSync(OUT, produced);
console.log(
  `vendor-house-style: wrote styles/house-style.tokens.css from ${sha} (${produced.length} bytes)`,
);
