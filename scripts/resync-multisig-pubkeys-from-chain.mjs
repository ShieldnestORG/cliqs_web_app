#!/usr/bin/env node
/**
 * Resync multisig pubkeys from chain into MongoDB.
 *
 * Reads all multisigs from MongoDB, queries each chain for the current pubkey
 * via CosmJS StargateClient, and updates pubkeyJSON and address with the
 * correct format. Fixes str.match broadcast errors from malformed pubkey data.
 *
 * Usage:
 *   npm run resync:pubkeys
 *
 * Env (from .env.local):
 *   MONGODB_URI       - MongoDB connection
 *   MONGODB_DB_NAME   - Database name (default: cliqs)
 *   CHAIN_CONFIG      - Optional JSON override for chain config
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import {
  createMultisigThresholdPubkey,
  pubkeyToAddress,
  isMultisigThresholdPubkey,
} from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import { StargateClient } from "@cosmjs/stargate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load .env.local
try {
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        process.env[m[1].trim()] = val;
      }
    }
  }
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cliqs";

function ensureProtocol(url) {
  if (!url) return url;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("ws://") ||
    url.startsWith("wss://")
  ) {
    return url;
  }
  return `https://${url}`;
}

function toBase64String(val) {
  if (typeof val === "string") return val;
  if (val instanceof Uint8Array) return toBase64(val);
  if (Array.isArray(val)) return toBase64(new Uint8Array(val));
  throw new Error("Cannot convert pubkey value to base64 string");
}

function loadChainConfig() {
  const envOverride = process.env.CHAIN_CONFIG;
  if (envOverride) {
    try {
      return JSON.parse(envOverride);
    } catch (e) {
      console.warn("Invalid CHAIN_CONFIG JSON, falling back to file:", e.message);
    }
  }
  const configPath = join(__dirname, "chains-config.json");
  if (!existsSync(configPath)) {
    throw new Error(`chains-config.json not found at ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Add it to .env.local");
    process.exit(1);
  }

  const chainConfig = loadChainConfig();
  const chainIds = Object.keys(chainConfig);
  if (chainIds.length === 0) {
    console.error("No chains configured in chains-config.json");
    process.exit(1);
  }
  console.log("Chain config loaded:", chainIds.join(", "));

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const col = client.db(MONGODB_DB_NAME).collection("multisigs");
  const multisigs = await col.find({}).toArray();

  if (multisigs.length === 0) {
    console.log("No multisigs in database.");
    await client.close();
    return;
  }
  console.log(`Found ${multisigs.length} multisig(s) to process.\n`);

  let updated = 0;
  let skippedNoConfig = 0;
  let skippedNotFound = 0;
  let skippedNotMultisig = 0;
  let errors = 0;

  const clientsByChain = new Map();

  for (const m of multisigs) {
    const { chainId, address } = m;
    const cfg = chainConfig[chainId];
    if (!cfg || !cfg.nodeAddress || !cfg.addressPrefix) {
      console.warn(`  SKIP (no config): ${address} (${chainId})`);
      skippedNoConfig++;
      continue;
    }

    try {
      let stargateClient = clientsByChain.get(chainId);
      if (!stargateClient) {
        stargateClient = await StargateClient.connect(ensureProtocol(cfg.nodeAddress));
        clientsByChain.set(chainId, stargateClient);
      }

      const account = await stargateClient.getAccount(address);
      if (!account) {
        console.warn(`  SKIP (not on chain): ${address} (${chainId})`);
        skippedNotFound++;
        continue;
      }
      if (!account.pubkey) {
        console.warn(`  SKIP (no pubkey): ${address} (${chainId})`);
        skippedNotMultisig++;
        continue;
      }
      if (!isMultisigThresholdPubkey(account.pubkey)) {
        console.warn(`  SKIP (not multisig threshold): ${address} (${chainId})`);
        skippedNotMultisig++;
        continue;
      }

      const rawPubkeys = account.pubkey.value.pubkeys;
      const pubkeys = rawPubkeys.map((p) => ({
        type: p.type || "tendermint/PubKeySecp256k1",
        value: toBase64String(p.value ?? p.key),
      }));
      const threshold = Number(account.pubkey.value.threshold);
      const multisigPubkey = createMultisigThresholdPubkey(pubkeys, threshold);
      const derivedAddress = pubkeyToAddress(multisigPubkey, cfg.addressPrefix);
      const now = new Date().toISOString();

      const updateFields = {
        pubkeyJSON: JSON.stringify(multisigPubkey),
        updatedAt: now,
      };
      if (derivedAddress !== address) {
        updateFields.address = derivedAddress;
      }

      await col.updateOne({ chainId, address }, { $set: updateFields });
      updated++;
      console.log(`  UPDATED: ${address} (${chainId})`);
    } catch (e) {
      errors++;
      console.error(`  ERROR: ${address} (${chainId}):`, e.message);
    }
  }

  for (const c of clientsByChain.values()) {
    c.disconnect();
  }
  await client.close();

  console.log("\n--- Summary ---");
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no config): ${skippedNoConfig}`);
  console.log(`  Skipped (not on chain): ${skippedNotFound}`);
  console.log(`  Skipped (not multisig): ${skippedNotMultisig}`);
  console.log(`  Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
