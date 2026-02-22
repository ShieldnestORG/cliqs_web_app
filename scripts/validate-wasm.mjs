#!/usr/bin/env node
/**
 * Validate WASM Binaries at Build Time
 *
 * Run during Vercel/CI builds to ensure WASM binaries are present,
 * valid, and their manifest is up to date.
 *
 * Usage:
 *   node scripts/validate-wasm.mjs           # warn on issues
 *   node scripts/validate-wasm.mjs --strict  # fail build on issues
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = join(__dirname, "..", "public", "wasm");
const MANIFEST_PATH = join(WASM_DIR, "manifest.json");
const REQUIRED_CONTRACTS = [
  "cw3_fixed_multisig",
  "cw3_flex_multisig",
  "cw4_group",
];

const strict = process.argv.includes("--strict");
let hasErrors = false;
let hasWarnings = false;

function error(msg) {
  console.error(`  ERROR: ${msg}`);
  hasErrors = true;
}

function warn(msg) {
  console.warn(`  WARN:  ${msg}`);
  hasWarnings = true;
}

function ok(msg) {
  console.log(`  OK:    ${msg}`);
}

// Scan for bulk-memory opcodes
function scanBulkMemory(data) {
  const ops = [
    [0x08, "memory.init"],
    [0x09, "data.drop"],
    [0x0a, "memory.copy"],
    [0x0b, "memory.fill"],
  ];
  const hits = [];
  for (const [byte2, name] of ops) {
    let count = 0;
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i] === 0xfc && data[i + 1] === byte2) count++;
    }
    if (count > 0) hits.push({ name, count });
  }
  return hits;
}

console.log("\nValidating WASM binaries...\n");

// 1. Check manifest exists
if (!existsSync(MANIFEST_PATH)) {
  error("public/wasm/manifest.json not found");
  error("Run: python3 scripts/generate-wasm-manifest.py");
  process.exit(strict ? 1 : 0);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
ok(`Manifest found (cw-plus ${manifest.cwPlusVersion}, built via ${manifest.buildMethod})`);

// 2. Check each required contract
for (const name of REQUIRED_CONTRACTS) {
  const wasmPath = join(WASM_DIR, `${name}.wasm`);

  if (!existsSync(wasmPath)) {
    error(`${name}.wasm not found in public/wasm/`);
    continue;
  }

  const data = readFileSync(wasmPath);
  const sizeKB = Math.ceil(data.length / 1024);

  // Validate WASM magic
  if (data[0] !== 0x00 || data[1] !== 0x61 || data[2] !== 0x73 || data[3] !== 0x6d) {
    error(`${name}.wasm is not a valid WASM file (bad magic number)`);
    continue;
  }

  // Check SHA256 against manifest
  const sha256 = createHash("sha256").update(data).digest("hex");
  const manifestEntry = manifest.contracts?.[name];

  if (manifestEntry?.sha256 && manifestEntry.sha256 !== sha256) {
    warn(`${name}.wasm SHA256 mismatch — manifest may be stale`);
    warn(`  File:     ${sha256}`);
    warn(`  Manifest: ${manifestEntry.sha256}`);
  }

  // Check for bulk-memory opcodes
  const bulkHits = scanBulkMemory(data);
  if (bulkHits.length > 0) {
    const opsStr = bulkHits.map((h) => `${h.name} x${h.count}`).join(", ");
    warn(`${name}.wasm contains bulk-memory opcodes: ${opsStr}`);
    warn(`This WASM will NOT work on Coreum and other non-bulk-memory chains`);
    warn(`Run the build-wasm CI workflow to produce optimizer-built binaries`);
  } else {
    ok(`${name}.wasm — ${sizeKB}KB, no bulk-memory, all-chain safe`);
  }
}

// 3. Check if optimizer-built
if (manifest.buildMethod === "github-release-download") {
  warn("WASM binaries are from GitHub releases (not optimizer-built)");
  warn("These may contain bulk-memory opcodes incompatible with some chains");
  warn("Run: gh workflow run build-wasm.yml");
} else if (manifest.buildMethod === "github-actions-optimizer") {
  ok("Binaries built with cosmwasm/optimizer via CI");
}

// 4. Summary
console.log("");
if (hasErrors) {
  console.error("WASM validation FAILED — fix errors above");
  process.exit(strict ? 1 : 0);
} else if (hasWarnings) {
  console.warn("WASM validation passed with WARNINGS");
  console.warn("The app will work but some chains may reject the bundled WASM");
  process.exit(0);
} else {
  console.log("WASM validation PASSED — all binaries are chain-safe");
  process.exit(0);
}
