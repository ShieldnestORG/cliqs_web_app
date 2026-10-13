#!/usr/bin/env node
// Generates styles/house-style.bridge.css: the house style's tokens as the shadcn variables this app reads (unit 2, 2026-10-12).
//
//   node scripts/build-bridge.mjs            write the file, at the sha named in styles/house-style.tokens.css's header
//   node scripts/build-bridge.mjs --check    write nothing; exit 1 if the file on disk is not what this script produces
//
// shadcn/Tailwind read HSL channel triplets (`hsl(var(--primary))`, `hsl(var(--border) / 0.06)`); the canonical tokens are hex.
// The mapping (shadcn variable -> canonical token) is the `bridge` object of the house style's check/adapters/cliqs.json, read
// with `git show <sha>:...` together with tokens.json at the SAME sha as the vendored file, so the two cannot disagree.
//   - a #RRGGBB colour becomes `H S% L%`, with the fewest decimals that convert back to the same hex (the check that drift.mjs
//     also runs, in the other direction); the source token and hex are in a comment on the line;
//   - any other value (radius, shadow, easing, duration, tracking) is copied as written, a `var(--hs-x)` reference included
//     (--radius-btn stays `var(--hs-radius-pill)`, so the one line that flips every button shape in the vendored file still does);
//   - the dark values go in :root; the light values that differ go twice, in the OS-light media block and in :root[data-theme="light"],
//     the same two selectors the vendored file uses, so a forced attribute wins and "no attribute" follows the OS.
// This file is one of the two that may hold a raw colour (the other is house-style.tokens.css). Never edit it, regenerate.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDORED = join(ROOT, "styles", "house-style.tokens.css");
const OUT = join(ROOT, "styles", "house-style.bridge.css");
const REPO = process.env.HOUSE_STYLE ?? "/Users/exe/Downloads/Claude/house-style";
const check = process.argv.includes("--check");

const head = existsSync(VENDORED)
  ? /^\/\* VENDORED-FROM: ShieldnestORG\/house-style ([0-9a-f]{7,40}) /.exec(
      readFileSync(VENDORED, "utf8"),
    )
  : null;
if (!head) {
  console.error(
    "build-bridge: styles/house-style.tokens.css is missing or has no VENDORED-FROM header (run scripts/vendor-house-style.mjs <sha> first)",
  );
  process.exit(2);
}
const sha = head[1];
const show = (path) => {
  try {
    return execFileSync("git", ["-C", REPO, "show", `${sha}:${path}`], {
      encoding: "utf8",
      maxBuffer: 1 << 24,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    console.error(
      `build-bridge: cannot read ${sha}:${path} in ${REPO} (HOUSE_STYLE=<dir>): ${String(e.stderr || e.message).trim()}`,
    );
    process.exit(2);
  }
};
const tokens = JSON.parse(show("tokens.json"));
const adapter = JSON.parse(show("check/adapters/cliqs.json"));
const bridge = adapter.bridge;
if (!bridge || typeof bridge !== "object") {
  console.error(`build-bridge: ${sha}:check/adapters/cliqs.json has no "bridge" map`);
  process.exit(2);
}

// drift.mjs reads the same adapter one-to-one through `names`; every such pair must be a bridge entry, or the drift gate checks a different name than this file writes.
for (const [short, pv] of Object.entries(adapter.names)) {
  if (bridge[pv] !== short) {
    console.error(
      `build-bridge: adapter names ${short} -> ${pv}, but bridge maps ${pv} -> ${bridge[pv]}`,
    );
    process.exit(2);
  }
}

// The same conversion drift.mjs applies (HSL triplet back to hex), so a round trip that is off by one fails here, not later.
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function hexToTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn,
    l = (mx + mn) / 2;
  let h = 0,
    s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  for (let dec = 1; dec <= 4; dec++) {
    const q = (v) => +v.toFixed(dec);
    const H = q(h),
      S = q(s * 100),
      L = q(l * 100);
    if (hslToHex(H, S, L).toLowerCase() === hex.toLowerCase()) return `${H} ${S}% ${L}%`;
  }
  throw new Error(`no HSL triplet with <= 4 decimals converts back to ${hex}`);
}

const emit = (value) =>
  /^#[0-9a-fA-F]{6}$/.test(value)
    ? { text: hexToTriplet(value), note: value.toUpperCase() }
    : { text: value, note: "as written" };

const rows = [];
for (const [pv, short] of Object.entries(bridge)) {
  const tok = `--hs-${short}`;
  for (const th of ["dark", "light"])
    if (tokens.themes[th][tok] === undefined) {
      console.error(`build-bridge: ${tok} (for ${pv}) is not in tokens.json ${th} at ${sha}`);
      process.exit(2);
    }
  const dark = emit(tokens.themes.dark[tok]),
    light = emit(tokens.themes.light[tok]);
  rows.push({ pv, tok, dark, light, differs: dark.text !== light.text });
}
const line = (r, theme, indent) =>
  `${indent}${r.pv}: ${r[theme].text};  /* ${r.tok} ${r[theme].note} */`;
const lightRows = rows.filter((r) => r.differs);

const produced = [
  `/* GENERATED-FROM: ShieldnestORG/house-style ${sha} tokens.json + check/adapters/cliqs.json by scripts/build-bridge.mjs; do not edit, regenerate */`,
  `/* The house style's tokens as the shadcn variables this app reads: HSL channel triplets for hsl(var(--x)), other values as written.`,
  `   ${rows.length} variables; ${lightRows.length} differ in the light theme. Dark is :root; light is the OS-light media block and :root[data-theme="light"] (same selectors as house-style.tokens.css).`,
  `   Which variable takes which token is the "bridge" map of the adapter named above. Allowed to hold raw colours, with house-style.tokens.css (the gate in scripts/check-house-style.mjs). */`,
  ``,
  `:root {`,
  ...rows.map((r) => line(r, "dark", "  ")),
  `}`,
  ``,
  `@media (prefers-color-scheme: light) {`,
  `  :root:not([data-theme="dark"]) {`,
  ...lightRows.map((r) => line(r, "light", "    ")),
  `  }`,
  `}`,
  ``,
  `:root[data-theme="light"] {`,
  ...lightRows.map((r) => line(r, "light", "  ")),
  `}`,
  ``,
].join("\n");

if (check) {
  const onDisk = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (onDisk === produced) {
    console.log(
      `build-bridge --check: ok (${sha}, ${rows.length} variables, ${lightRows.length} in the light blocks)`,
    );
    process.exit(0);
  }
  console.error(
    `build-bridge --check: FAIL: styles/house-style.bridge.css is ${onDisk === null ? "missing" : "not what the script produces for " + sha} (a hand edit, a changed map, or a stale sha). Regenerate: node scripts/build-bridge.mjs`,
  );
  process.exit(1);
}
writeFileSync(OUT, produced);
console.log(
  `build-bridge: wrote styles/house-style.bridge.css from ${sha} (${rows.length} variables, ${lightRows.length} in the light blocks)`,
);
