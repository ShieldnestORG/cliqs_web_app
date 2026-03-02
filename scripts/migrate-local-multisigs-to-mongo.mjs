#!/usr/bin/env node
/**
 * One-time migration: copy multisigs, transactions, signatures, and nonces
 * from data/local-db.json to MongoDB (e.g. Vercel's Atlas cluster).
 *
 * Use this when you have local JSON data and want to move it to production MongoDB.
 * Preserves ID references between collections.
 *
 * Usage: npm run migrate:multisigs-to-mongo
 *
 * Requires MONGODB_URI in .env.local (your Vercel/destination cluster).
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

async function ensureIndexes(db) {
  await db.collection("multisigs").createIndex({ chainId: 1, address: 1 }, { unique: true });
  await db.collection("transactions").createIndex({ creatorId: 1 });
  await db.collection("transactions").createIndex({ creatorId: 1, status: 1 });
  await db.collection("signatures").createIndex({ transactionId: 1 });
  await db.collection("signatures").createIndex({ transactionId: 1, address: 1 }, { unique: true });
  await db.collection("nonces").createIndex({ chainId: 1, address: 1 }, { unique: true });
}

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Add it to .env.local (use your Vercel MongoDB).");
    process.exit(1);
  }

  if (!existsSync(DB_PATH)) {
    console.error("No data/local-db.json found. Nothing to migrate.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(DB_PATH, "utf-8"));
  const multisigs = data.multisigs || [];
  const transactions = data.transactions || [];
  const signatures = data.signatures || [];
  const nonces = data.nonces || [];

  const total = multisigs.length + transactions.length + signatures.length + nonces.length;
  if (total === 0) {
    console.log("No data in local-db.json. Nothing to migrate.");
    return;
  }

  console.log("[Migration] Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();

  const db = client.db(MONGODB_DB_NAME);
  const multisigCol = db.collection("multisigs");
  const txCol = db.collection("transactions");
  const sigCol = db.collection("signatures");
  const nonceCol = db.collection("nonces");

  const localToMongoMultisig = {};
  const localToMongoTx = {};

  // 1. Migrate multisigs; build localId -> mongoId map
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
    await multisigCol.updateOne(
      { chainId: m.chainId, address: m.address },
      { $set: doc },
      { upsert: true },
    );
    const inserted = await multisigCol.findOne({ chainId: m.chainId, address: m.address });
    if (m.id && inserted?._id) {
      localToMongoMultisig[m.id] = inserted._id.toHexString();
    }
    console.log(`  multisig: ${m.address} (${m.chainId})`);
  }

  // 2. Migrate transactions; build localTxId -> mongoId map
  for (const t of transactions) {
    const mongoCreatorId = localToMongoMultisig[t.creatorId] ?? t.creatorId;
    const doc = {
      creatorId: mongoCreatorId,
      txHash: t.txHash ?? null,
      dataJSON: t.dataJSON,
      status: t.status ?? "pending",
      payloadHash: t.payloadHash,
      signDocHash: t.signDocHash,
      createdAt: t.createdAt ?? new Date().toISOString(),
      updatedAt: t.updatedAt ?? new Date().toISOString(),
    };
    const result = await txCol.insertOne(doc);
    if (t.id && result.insertedId) {
      localToMongoTx[t.id] = result.insertedId.toHexString();
    }
    console.log(`  transaction: ${t.id} -> ${result.insertedId?.toHexString?.()}`);
  }

  // 3. Migrate signatures (transactionId must point to mongo tx id)
  for (const s of signatures) {
    const mongoTxId = localToMongoTx[s.transactionId] ?? s.transactionId;
    const doc = {
      transactionId: mongoTxId,
      bodyBytes: s.bodyBytes,
      signature: s.signature,
      address: s.address,
      createdAt: s.createdAt ?? new Date().toISOString(),
    };
    await sigCol.updateOne(
      { transactionId: mongoTxId, address: s.address },
      { $set: doc },
      { upsert: true },
    );
    console.log(`  signature: ${s.address} -> tx ${mongoTxId}`);
  }

  // 4. Migrate nonces
  for (const n of nonces) {
    await nonceCol.updateOne(
      { chainId: n.chainId, address: n.address },
      { $set: { nonce: n.nonce } },
      { upsert: true },
    );
    console.log(`  nonce: ${n.address} (${n.chainId}) = ${n.nonce}`);
  }

  await ensureIndexes(db);
  await client.close();

  console.log(
    `\n[Migration] Done. Migrated ${multisigs.length} multisig(s), ${transactions.length} transaction(s), ${signatures.length} signature(s), ${nonces.length} nonce(s) to ${MONGODB_DB_NAME}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
