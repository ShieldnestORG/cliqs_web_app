#!/usr/bin/env node
/**
 * One-time migration: copy pubkey multisigs from data/local-db.json to MongoDB.
 *
 * Use this when you have multisigs in local JSON and want them in MongoDB
 * for production. No chain scan - just reads the existing file.
 *
 * Usage: npm run migrate:multisigs-to-mongo
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "data", "local-db.json");

// Load .env.local
try {
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cliqs";

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Add it to .env.local");
    process.exit(1);
  }

  if (!existsSync(DB_PATH)) {
    console.error("No data/local-db.json found. Nothing to migrate.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(DB_PATH, "utf-8"));
  const multisigs = data.multisigs || [];

  if (multisigs.length === 0) {
    console.log("No multisigs in local-db. Nothing to migrate.");
    return;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const col = client.db(MONGODB_DB_NAME).collection("multisigs");

  let migrated = 0;
  for (const m of multisigs) {
    const doc = {
      chainId: m.chainId,
      address: m.address,
      creator: m.creator ?? null,
      pubkeyJSON: m.pubkeyJSON,
      name: m.name ?? null,
      description: m.description ?? null,
      version: m.version ?? 1,
      createdAt: m.createdAt ?? new Date().toISOString(),
      updatedAt: m.updatedAt ?? new Date().toISOString(),
    };
    await col.updateOne(
      { chainId: m.chainId, address: m.address },
      { $set: doc },
      { upsert: true }
    );
    migrated++;
    console.log(`  ${m.address} (${m.chainId})`);
  }

  await client.close();
  console.log(`\nMigrated ${migrated} multisig(s) to MongoDB (${MONGODB_DB_NAME}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
