#!/usr/bin/env node
/**
 * Migrate data from one MongoDB cluster to another.
 *
 * Copies multisigs, transactions, signatures, and nonces.
 * Preserves _ids so creatorId and transactionId references remain valid.
 *
 * Usage:
 *   SOURCE_MONGODB_URI="mongodb+srv://...@source.mongodb.net/..." \
 *   DEST_MONGODB_URI="mongodb+srv://...@dest.mongodb.net/..." \
 *   npm run migrate:mongo-to-mongo
 *
 * Or set both in .env.local and run npm run migrate:mongo-to-mongo
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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

const SOURCE_MONGODB_URI = process.env.SOURCE_MONGODB_URI || "";
const DEST_MONGODB_URI = process.env.DEST_MONGODB_URI || process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || process.env.SOURCE_DB_NAME || process.env.DEST_DB_NAME || "cliqs";

const COLLECTIONS = ["multisigs", "transactions", "signatures", "nonces"];
const BATCH_SIZE = 100;

async function ensureIndexes(client, dbName) {
  const db = client.db(dbName);

  await db.collection("multisigs").createIndex({ chainId: 1, address: 1 }, { unique: true });
  await db.collection("multisigs").createIndex({ chainId: 1, creator: 1 });

  await db.collection("transactions").createIndex({ creatorId: 1 });
  await db.collection("transactions").createIndex({ creatorId: 1, status: 1 });
  await db.collection("transactions").createIndex({ status: 1, updatedAt: 1 });

  await db.collection("signatures").createIndex({ transactionId: 1 });
  await db.collection("signatures").createIndex({ transactionId: 1, address: 1 }, { unique: true });

  await db.collection("nonces").createIndex({ chainId: 1, address: 1 }, { unique: true });

  console.log("[Migration] Indexes ensured on destination");
}

async function migrateCollection(sourceCol, destCol, name) {
  const cursor = sourceCol.find({});
  let total = 0;
  let batch = [];

  for await (const doc of cursor) {
    batch.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      const result = await destCol.bulkWrite(batch, { ordered: false });
      total += (result.upsertedCount || 0) + (result.modifiedCount || 0);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await destCol.bulkWrite(batch, { ordered: false });
    total += result.upsertedCount + result.modifiedCount;
  }

  return total;
}

async function main() {
  if (!SOURCE_MONGODB_URI) {
    console.error("SOURCE_MONGODB_URI not set. Set it in .env.local or pass as env var.");
    process.exit(1);
  }
  if (!DEST_MONGODB_URI) {
    console.error("DEST_MONGODB_URI not set. Set it in .env.local or pass as env var.");
    process.exit(1);
  }

  console.log("[Migration] Connecting to source...");
  const sourceClient = new MongoClient(SOURCE_MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  await sourceClient.connect();

  console.log("[Migration] Connecting to destination...");
  const destClient = new MongoClient(DEST_MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  await destClient.connect();

  const sourceDb = sourceClient.db(DB_NAME);
  const destDb = destClient.db(DB_NAME);

  try {
    for (const colName of COLLECTIONS) {
      const sourceCol = sourceDb.collection(colName);
      const destCol = destDb.collection(colName);
      const count = await migrateCollection(sourceCol, destCol, colName);
      console.log(`[Migration] ${colName}: ${count} document(s)`);
    }

    await ensureIndexes(destClient, DB_NAME);
    console.log("[Migration] Done.");
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
