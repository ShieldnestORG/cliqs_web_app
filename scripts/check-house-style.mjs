#!/usr/bin/env node
// The house-style gate for the cliqs app (unit 2, 2026-10-12). Four checks, all run, exit 1 if any fails:
//   1. vendor   scripts/vendor-house-style.mjs --check   styles/house-style.tokens.css is exactly the canonical file at its header sha
//   2. bridge   scripts/build-bridge.mjs --check         styles/house-style.bridge.css is exactly what the generator writes for that sha
//   3. drift    the house style's own check/drift.mjs, read from the SAME sha (git show into a temp dir), run on the bridge with the
//               "cliqs" adapter: every bridged token must be `equal` in both themes. A canonical token the adapter does not map reads
//               `missing` by design and is only counted. (drift.mjs compares values and exits 1 on any missing, so it is run with
//               --report-only and its lines are judged here.)
//   4. colour   scripts/raw-colour.sh: no numeric colour (#hex, rgb()/rgba()/hsl() with a digit after the parenthesis) in styles/*.css
//               or tailwind.config.js outside the two house-style files; it prints nothing when clean. The import order in pages/_app.tsx
//               (tokens, bridge, globals) is checked here too.
// Needs the house-style checkout (HOUSE_STYLE=<dir>, default /Users/exe/Downloads/Claude/house-style) because the pinned sha is read from it.
// Prints one line per passing check and the failures in full. No packages, nothing is started.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOUSE = process.env.HOUSE_STYLE ?? "/Users/exe/Downloads/Claude/house-style";
let failed = 0;
const ok = (name, detail) => console.log(`ok    ${name}: ${detail}`);
const fail = (name, lines) => {
  failed++;
  console.error(`FAIL  ${name}`);
  for (const l of [].concat(lines)) console.error(`      ${l}`);
};
const run = (script, args = []) =>
  spawnSync("node", [join(ROOT, "scripts", script), ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: process.env,
  });

// 1 and 2
for (const [name, script] of [
  ["vendor", "vendor-house-style.mjs"],
  ["bridge", "build-bridge.mjs"],
]) {
  const r = run(script, ["--check"]);
  if (r.status === 0) ok(name, r.stdout.trim());
  else fail(name, (r.stderr || r.stdout).trim().split("\n"));
}

// 3
const head = /^\/\* VENDORED-FROM: ShieldnestORG\/house-style ([0-9a-f]{7,40}) /.exec(
  readFileSync(join(ROOT, "styles", "house-style.tokens.css"), "utf8"),
);
if (!head) fail("drift", "styles/house-style.tokens.css has no VENDORED-FROM header");
else {
  const sha = head[1];
  const tmp = mkdtempSync(join(tmpdir(), "cliqs-drift-"));
  try {
    for (const f of [
      "tokens.css",
      "check/drift.mjs",
      "check/lib/css.mjs",
      "check/adapters/cliqs.json",
    ]) {
      mkdirSync(dirname(join(tmp, f)), { recursive: true });
      writeFileSync(
        join(tmp, f),
        execFileSync("git", ["-C", HOUSE, "show", `${sha}:${f}`], {
          encoding: "utf8",
          maxBuffer: 1 << 24,
        }),
      );
    }
    writeFileSync(join(tmp, "package.json"), '{"type":"module"}\n'); // drift.mjs is ESM; the temp dir has no package.json above it
    const r = spawnSync(
      "node",
      [
        join(tmp, "check/drift.mjs"),
        join(ROOT, "styles", "house-style.bridge.css"),
        "--adapter",
        "cliqs",
        "--report-only",
        "--label",
        "cliqs bridge",
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) fail("drift", (r.stderr || r.stdout).trim().split("\n").slice(0, 8));
    else {
      const bad = r.stdout
        .split("\n")
        .filter(
          (l) =>
            l.startsWith("differs") || (l.startsWith("missing") && !l.includes("(--cliqs-unused-")),
        );
      const summary = r.stdout.split("\n").find((l) => l.startsWith("# SUMMARY")) ?? "";
      const equal = r.stdout.split("\n").filter((l) => l.startsWith("equal")).length;
      if (bad.length)
        fail("drift", [
          `${bad.length} bridged token(s) differ or are missing against ${sha}:`,
          ...bad.slice(0, 8).map((l) => l.slice(0, 200)),
        ]);
      else if (equal === 0) fail("drift", "no token compared equal: the adapter maps nothing?");
      else
        ok(
          "drift",
          `${sha}: ${equal} bridged tokens equal in both themes, differs 0, bridged-but-missing 0 (${summary.replace("# SUMMARY cliqs: ", "")})`,
        );
    }
  } catch (e) {
    fail(
      "drift",
      `cannot read the house-style files at ${sha} in ${HOUSE}: ${
        String(e.stderr || e.message)
          .trim()
          .split("\n")[0]
      }`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// 4
const raw = spawnSync("bash", [join(ROOT, "scripts", "raw-colour.sh")], { encoding: "utf8" });
if (raw.status === 0 && raw.stdout === "")
  ok(
    "colour",
    "scripts/raw-colour.sh printed nothing: no numeric colour in styles/*.css or tailwind.config.js outside house-style.tokens.css / house-style.bridge.css",
  );
else
  fail("colour", [
    "scripts/raw-colour.sh found numeric colours outside the two house-style files:",
    ...raw.stdout.trim().split("\n").slice(0, 20),
  ]);

const app = readFileSync(join(ROOT, "pages", "_app.tsx"), "utf8");
const order = ["house-style.tokens.css", "house-style.bridge.css", "globals.css"].map((f) =>
  app.indexOf(`@/styles/${f}`),
);
if (order.some((i) => i < 0) || order[0] > order[1] || order[1] > order[2])
  fail(
    "imports",
    "pages/_app.tsx must import styles/house-style.tokens.css, then house-style.bridge.css, then globals.css",
  );
else ok("imports", "pages/_app.tsx imports tokens, bridge, globals in that order");

if (failed) {
  console.error(`house-style gate: ${failed} check(s) FAILED`);
  process.exit(1);
}
