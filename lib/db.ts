/**
 * Database Switcher
 *
 * File: lib/db.ts
 *
 * Unified interface that delegates to the appropriate database backend:
 *
 *   1. BYODB (Bring Your Own Database) – if a user-supplied MongoDB URI
 *      is present in the request context (via AsyncLocalStorage), all
 *      operations are routed to the user's database.
 *
 *   2. Default MongoDB – if MONGODB_URI or cliqs_MONGODB_URI is set and reachable.
 *
 *   3. Local JSON file – fallback for development.
 *
 * When the default MongoDB is active, multisig queries merge results from
 * both MongoDB and localDb so records created before MongoDB was configured
 * are still discoverable.
 *
 * The graphql/ adapter layer imports from here instead of directly
 * from localDb or mongoDb.
 */

import escapeStringRegexp from "escape-string-regexp";
import * as localDb from "./localDb";
import * as mongoDb from "./mongodb";
import { isMongoAvailable } from "./mongodb";
import { getRequestByodbUri } from "./byodb/middleware";
import { getDynamicDb } from "./byodb/dynamicMongo";
import { hasDefaultMongoConfig } from "./defaultMongoConfig";
import { ObjectId, type Db, type WithId, type Document } from "mongodb";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// BYODB document interfaces – match the shape from mongodb.ts so that
// `collection<T>(name)` calls return strongly-typed cursors/documents.
// ---------------------------------------------------------------------------

interface BMultisig {
  chainId: string;
  address: string;
  creator: string | null;
  pubkeyJSON: string;
  name: string | null;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface BTransaction {
  txHash: string | null;
  creatorId: string;
  dataJSON: string;
  status?: "pending" | "broadcast" | "cancelled";
  payloadHash?: string;
  signDocHash?: string;
  createdAt: string;
  updatedAt: string;
}

interface BSignature {
  transactionId: string;
  bodyBytes: string;
  signature: string;
  address: string;
  createdAt: string;
}

interface BNonce {
  chainId: string;
  address: string;
  nonce: number;
}

// Cache the availability check for 60 seconds (only when available – retry sooner on failure)
let _mongoAvailable: boolean | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 5_000; // Retry connection sooner when it failed

async function usesMongo(): Promise<boolean> {
  if (!hasDefaultMongoConfig()) return false;

  const now = Date.now();
  const interval = _mongoAvailable === false ? RETRY_INTERVAL_MS : CHECK_INTERVAL_MS;
  if (_mongoAvailable !== null && now - _lastCheck < interval) {
    return _mongoAvailable;
  }

  _mongoAvailable = await isMongoAvailable();
  _lastCheck = now;

  if (_mongoAvailable) {
    console.log("[DB] Using MongoDB Atlas");
  } else {
    console.log(
      "[DB] MongoDB connection failed – will not fall back to local DB when MONGODB_URI or cliqs_MONGODB_URI is set",
    );
  }

  return _mongoAvailable;
}

/**
 * When default MongoDB env is set, MongoDB is required. Do not fall back to localDb.
 * Throws a clear error if MongoDB is configured but connection failed.
 * Call only when BYODB is not in use (byodb already checked by caller).
 */
async function requireMongoOrLocalDb(): Promise<"mongo" | "local"> {
  if (hasDefaultMongoConfig()) {
    const available = await usesMongo();
    if (!available) {
      throw new Error(
        "MongoDB is configured (MONGODB_URI or cliqs_MONGODB_URI) but connection failed. " +
          "Verify the connection string, network access, and that your MongoDB Atlas IP allowlist includes Vercel (or use 0.0.0.0/0 for serverless).",
      );
    }
    return "mongo";
  }
  return "local";
}

// ---------------------------------------------------------------------------
// BYODB helpers – thin wrappers that mirror mongoDb operations using
// a dynamic Db instance from the user's connection string.
// ---------------------------------------------------------------------------

function docId(doc: WithId<Document>): string {
  return doc._id.toHexString();
}

/** Get the user's BYODB Db instance, or null if not in BYODB mode. */
async function getByodbInstance(): Promise<Db | null> {
  const uri = getRequestByodbUri();
  if (!uri) return null;
  return getDynamicDb(uri);
}

// Collection names (match mongodb.ts)
const COL = {
  MULTISIGS: "multisigs",
  TRANSACTIONS: "transactions",
  SIGNATURES: "signatures",
  NONCES: "nonces",
} as const;

/**
 * De-duplicate multisig arrays by address, preferring records with a creator.
 */
function _dedupeMultisigs<T extends { address: string; creator?: string | null }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const existing = map.get(item.address);
    if (!existing || (item.creator && !existing.creator)) {
      map.set(item.address, item);
    }
  }
  return Array.from(map.values());
}

// ============================================================================
// Multisig Operations
// ============================================================================

export const getMultisig = async (chainId: string, address: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BMultisig>(COL.MULTISIGS);
    const withCreator = await col.findOne({ chainId, address, creator: { $ne: null } });
    if (withCreator) return { ...withCreator, id: docId(withCreator) };
    const any = await col.findOne({ chainId, address });
    if (any) return { ...any, id: docId(any) };
    return null;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getMultisig(chainId, address);
  return localDb.getMultisig(chainId, address);
};

export const getMultisigById = async (id: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BMultisig>(COL.MULTISIGS);
    try {
      const doc = await col.findOne({ _id: new ObjectId(id) });
      if (doc) return { ...doc, id: docId(doc) };
    } catch {
      const doc = await col.findOne({ address: id });
      if (doc) return { ...doc, id: docId(doc) };
    }
    return null;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getMultisigById(id);
  return localDb.getMultisigById(id);
};

export const getCreatedMultisigs = async (chainId: string, creatorAddress: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BMultisig>(COL.MULTISIGS);
    const docs = await col.find({ chainId, creator: creatorAddress }).toArray();
    return docs.map((d) => ({ ...d, id: docId(d) }));
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getCreatedMultisigs(chainId, creatorAddress);
  return localDb.getCreatedMultisigs(chainId, creatorAddress);
};

export const getBelongedMultisigs = async (chainId: string, memberPubkey: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BMultisig>(COL.MULTISIGS);
    const candidates = await col
      .find({ chainId, pubkeyJSON: { $regex: escapeStringRegexp(memberPubkey) } })
      .toArray();
    const exact = candidates.filter((doc) => {
      try {
        const parsed = JSON.parse(doc.pubkeyJSON);
        const pubkeys: { value?: string; key?: string }[] =
          parsed?.value?.pubkeys || parsed?.pubkeys || [];
        return pubkeys.some((pk) => pk.value === memberPubkey || pk.key === memberPubkey);
      } catch {
        return true;
      }
    });
    return exact.map((d) => ({ ...d, id: docId(d) }));
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getBelongedMultisigs(chainId, memberPubkey);
  return localDb.getBelongedMultisigs(chainId, memberPubkey);
};

export const createMultisig = async (multisig: {
  chainId: string;
  address: string;
  creator: string | null;
  pubkeyJSON: string;
  name?: string | null;
  description?: string | null;
}) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BMultisig>(COL.MULTISIGS);
    const now = new Date().toISOString();
    const existing = await col.findOne({
      chainId: multisig.chainId,
      address: multisig.address,
    });
    if (existing) {
      if (multisig.creator && !existing.creator) {
        await col.updateOne(
          { _id: existing._id },
          { $set: { creator: multisig.creator, updatedAt: now } },
        );
        return existing.address as string;
      }
      throw new Error(
        `Cliq already exists on ${multisig.chainId} with address ${multisig.address}`,
      );
    }
    await col.insertOne({
      ...multisig,
      name: multisig.name || null,
      description: multisig.description || null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return multisig.address;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.createMultisig(multisig);
  return localDb.createMultisig(multisig);
};

// ============================================================================
// Transaction Operations
// ============================================================================

export const getTransaction = async (transactionId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    try {
      const doc = await col.findOne({ _id: new ObjectId(transactionId) });
      if (doc) return { ...doc, id: docId(doc) };
    } catch {
      /* invalid ObjectId */
    }
    return null;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getTransaction(transactionId);
  return localDb.getTransaction(transactionId);
};

export const getTransactionsByCreator = async (creatorId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const docs = await col.find({ creatorId }).toArray();
    return docs.map((d) => ({ ...d, id: docId(d) }));
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getTransactionsByCreator(creatorId);
  return localDb.getTransactionsByCreator(creatorId);
};

export const getPendingTransactionsByCreator = async (creatorId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const docs = await col
      .find({ creatorId, txHash: null, status: { $ne: "cancelled" } })
      .toArray();
    return docs.map((d) => ({ ...d, id: docId(d) }));
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getPendingTransactionsByCreator(creatorId);
  return localDb.getPendingTransactionsByCreator(creatorId);
};

export const createTransaction = async (transaction: {
  dataJSON: string;
  creatorId: string;
  txHash: string | null;
  payloadHash?: string;
}) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const now = new Date().toISOString();
    const result = await col.insertOne({
      ...transaction,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return result.insertedId.toHexString();
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.createTransaction(transaction);
  return localDb.createTransaction(transaction);
};

export const updateTransactionHash = async (transactionId: string, txHash: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const result = await col.updateOne(
      { _id: new ObjectId(transactionId) },
      { $set: { txHash, status: "broadcast", updatedAt: new Date().toISOString() } },
    );
    if (result.matchedCount === 0) {
      throw new Error(`Transaction with id ${transactionId} not found`);
    }
    return;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.updateTransactionHash(transactionId, txHash);
  return localDb.updateTransactionHash(transactionId, txHash);
};

export const cancelTransaction = async (transactionId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const tx = await col.findOne({ _id: new ObjectId(transactionId) });
    if (!tx) throw new Error(`Transaction with id ${transactionId} not found`);
    if (tx.txHash) throw new Error("Cannot cancel a transaction that has already been broadcast");
    await col.updateOne(
      { _id: new ObjectId(transactionId) },
      { $set: { status: "cancelled", updatedAt: new Date().toISOString() } },
    );
    return;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.cancelTransaction(transactionId);
  return localDb.cancelTransaction(transactionId);
};

export const updateTransactionPayloadHash = async (
  transactionId: string,
  payloadHash: string,
  signDocHash?: string,
) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const update: Record<string, string> = {
      payloadHash,
      updatedAt: new Date().toISOString(),
    };
    if (signDocHash) update.signDocHash = signDocHash;
    await col.updateOne({ _id: new ObjectId(transactionId) }, { $set: update });
    return;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") {
    return mongoDb.updateTransactionPayloadHash(transactionId, payloadHash, signDocHash);
  }
  return localDb.updateTransactionPayloadHash(transactionId, payloadHash, signDocHash);
};

// ============================================================================
// Signature Operations
// ============================================================================

export const getSignaturesByTransaction = async (transactionId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BSignature>(COL.SIGNATURES);
    const docs = await col.find({ transactionId }).toArray();
    return docs.map((d) => ({ ...d, id: docId(d) }));
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getSignaturesByTransaction(transactionId);
  return localDb.getSignaturesByTransaction(transactionId);
};

export const createSignature = async (signature: {
  transactionId: string;
  bodyBytes: string;
  signature: string;
  address: string;
}) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BSignature>(COL.SIGNATURES);
    const existing = await col.findOne({
      transactionId: signature.transactionId,
      address: signature.address,
    });
    if (existing) {
      throw new Error(
        `Signature already exists for transaction ${signature.transactionId} and address ${signature.address}`,
      );
    }
    const result = await col.insertOne({
      ...signature,
      createdAt: new Date().toISOString(),
    });
    return result.insertedId.toHexString();
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.createSignature(signature);
  return localDb.createSignature(signature);
};

// ============================================================================
// Nonce Operations
// ============================================================================

export const getNonce = async (chainId: string, address: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BNonce>(COL.NONCES);
    const doc = await col.findOne({ chainId, address });
    if (!doc) return null;
    return { nonce: doc.nonce };
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") {
    const result = await mongoDb.getNonce(chainId, address);
    return result ? result : null;
  }
  return localDb.getNonce(chainId, address);
};

export const createOrUpdateNonce = async (chainId: string, address: string, nonce: number) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const col = byodb.collection<BNonce>(COL.NONCES);
    await col.updateOne({ chainId, address }, { $set: { nonce } }, { upsert: true });
    return;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.createOrUpdateNonce(chainId, address, nonce);
  return localDb.createOrUpdateNonce(chainId, address, nonce);
};

// ============================================================================
// Privacy / Wipe Operations
// ============================================================================

export const wipeCompletedTransactions = async (multisigId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const txCol = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const sigCol = byodb.collection<BSignature>(COL.SIGNATURES);
    const broadcastTxs = await txCol.find({ creatorId: multisigId, status: "broadcast" }).toArray();
    const txIds = broadcastTxs.map((t) => docId(t));
    const sigResult = await sigCol.deleteMany({ transactionId: { $in: txIds } });
    const txResult = await txCol.deleteMany({ creatorId: multisigId, status: "broadcast" });
    return {
      deletedTransactions: txResult.deletedCount,
      deletedSignatures: sigResult.deletedCount,
    };
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.wipeCompletedTransactions(multisigId);
  return {
    deletedTransactions: 0,
    deletedSignatures: 0,
    localDbNotice:
      "Wipe is not supported for local JSON database. To delete your transaction data, manually remove or edit the data/local-db.json file on your computer.",
  };
};

export const wipeAllTransactions = async (multisigId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const txCol = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const sigCol = byodb.collection<BSignature>(COL.SIGNATURES);
    const allTxs = await txCol.find({ creatorId: multisigId }).toArray();
    const txIds = allTxs.map((t) => docId(t));
    const sigResult = await sigCol.deleteMany({ transactionId: { $in: txIds } });
    const txResult = await txCol.deleteMany({ creatorId: multisigId });
    return {
      deletedTransactions: txResult.deletedCount,
      deletedSignatures: sigResult.deletedCount,
    };
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.wipeAllTransactions(multisigId);
  return {
    deletedTransactions: 0,
    deletedSignatures: 0,
    localDbNotice:
      "Wipe is not supported for local JSON database. To delete your transaction data, manually remove or edit the data/local-db.json file on your computer.",
  };
};

export const exportTransactionHistory = async (multisigId: string) => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const txCol = byodb.collection<BTransaction>(COL.TRANSACTIONS);
    const sigCol = byodb.collection<BSignature>(COL.SIGNATURES);
    const txs = await txCol.find({ creatorId: multisigId }).sort({ createdAt: -1 }).toArray();
    const history = [];
    for (const tx of txs) {
      const sigs = await sigCol.find({ transactionId: docId(tx) }).toArray();
      history.push({
        id: docId(tx),
        txHash: tx.txHash,
        status: tx.status,
        dataJSON: tx.dataJSON,
        payloadHash: tx.payloadHash,
        createdAt: tx.createdAt,
        signatures: sigs.map((s) => ({
          address: s.address,
          signature: s.signature,
          bodyBytes: s.bodyBytes,
        })),
      });
    }
    return history;
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.exportTransactionHistory(multisigId);
  const txs = localDb.getTransactionsByCreator(multisigId);
  return txs.map((tx) => ({
    id: tx.id,
    txHash: tx.txHash,
    status: tx.status,
    dataJSON: tx.dataJSON,
    payloadHash: tx.payloadHash,
    createdAt: undefined,
    signatures: localDb.getSignaturesByTransaction(tx.id).map((s) => ({
      address: s.address,
      signature: s.signature,
      bodyBytes: s.bodyBytes,
    })),
  }));
};

export const getStorageStats = async () => {
  const byodb = await getByodbInstance();
  if (byodb) {
    const [multisigCount, transactionCount, signatureCount] = await Promise.all([
      byodb.collection<BMultisig>(COL.MULTISIGS).countDocuments(),
      byodb.collection<BTransaction>(COL.TRANSACTIONS).countDocuments(),
      byodb.collection<BSignature>(COL.SIGNATURES).countDocuments(),
    ]);
    const stats = await byodb.stats();
    const estimatedSizeMB = Math.round((stats.dataSize / (1024 * 1024)) * 100) / 100;
    return { multisigCount, transactionCount, signatureCount, estimatedSizeMB };
  }

  const backend = await requireMongoOrLocalDb();
  if (backend === "mongo") return mongoDb.getStorageStats();
  return null;
};

// ============================================================================
// Initialization
// ============================================================================

let _initialized = false;
let _migrated = false;

/**
 * Migrate localDb multisig records to MongoDB.
 * Runs once per process lifetime. Records that already exist in MongoDB
 * (matched by chainId + address) are skipped.
 */
async function migrateLocalMultisigsToMongo(): Promise<void> {
  if (_migrated) return;
  _migrated = true;

  try {
    // Read all multisigs from localDb
    // localDb stores data across all chains, so we read them all
    const localMultisigs = (() => {
      try {
        const dbPath = path.join(process.cwd(), "data", "local-db.json");
        if (!fs.existsSync(dbPath)) return [];
        const data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
        return data.multisigs || [];
      } catch {
        return [];
      }
    })();

    if (localMultisigs.length === 0) return;

    let migrated = 0;
    for (const m of localMultisigs) {
      try {
        // Check if already in MongoDB
        const existing = await mongoDb.getMultisig(m.chainId, m.address);
        if (existing) continue;

        await mongoDb.createMultisig({
          chainId: m.chainId,
          address: m.address,
          creator: m.creator || null,
          pubkeyJSON: m.pubkeyJSON,
          name: m.name || null,
          description: m.description || null,
        });
        migrated++;
      } catch (e) {
        // Skip duplicates or other errors for individual records
        console.log(
          `[DB] Migration skipped ${m.address}: ${e instanceof Error ? e.message : "unknown"}`,
        );
      }
    }

    if (migrated > 0) {
      console.log(`[DB] Migrated ${migrated} multisig(s) from localDb to MongoDB`);
    }
  } catch (e) {
    console.error("[DB] Migration failed:", e);
  }
}

export const initDb = async () => {
  if (_initialized) return;
  _initialized = true;

  if (await usesMongo()) {
    await mongoDb.ensureIndexes();

    // Migrate any localDb records to MongoDB so they're not orphaned
    await migrateLocalMultisigsToMongo();

    // Run auto-cleanup on startup
    const days = parseInt(process.env.MONGODB_AUTO_CLEANUP_DAYS || "30", 10);
    const removed = await mongoDb.autoCleanup(days);
    if (removed > 0) {
      console.log(`[DB] Auto-cleanup removed ${removed} old transactions`);
    }
  }
};
