/**
 * MongoDB Database Adapter
 *
 * File: lib/mongoDb.ts
 *
 * Drop-in replacement for localDb operations using MongoDB Atlas.
 * Every function mirrors the localDb signature so the graphql/ adapter
 * layer can swap transparently.
 *
 * Storage budget: 512 MB free tier.
 * - Completed transactions can be wiped or auto-cleaned after 30 days
 * - Users can download history before deletion
 */

import { ObjectId, WithId, Document, MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

if (uri) {
  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
}

/**
 * Get MongoDB database instance
 */
export const getDb = async (): Promise<Db | null> => {
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db();
  } catch (e) {
    console.error("Failed to connect to MongoDB:", e);
    return null;
  }
};

/**
 * Check if MongoDB is available and connected
 */
export const isMongoAvailable = async (): Promise<boolean> => {
  if (!uri) return false;
  try {
    const db = await getDb();
    return !!db;
  } catch {
    return false;
  }
};

/**
 * Collection names
 */
export const Collections = {
  MULTISIGS: "multisigs",
  TRANSACTIONS: "transactions",
  SIGNATURES: "signatures",
  NONCES: "nonces",
};

// ============================================================================
// Types (mirror localDb types but with _id for Mongo)
// ============================================================================

interface MongoMultisig {
  _id?: ObjectId;
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

interface MongoTransaction {
  _id?: ObjectId;
  txHash: string | null;
  creatorId: string; // multisig address (not ObjectId – keeps compat with localDb)
  dataJSON: string;
  status?: "pending" | "broadcast" | "cancelled";
  payloadHash?: string;
  signDocHash?: string;
  createdAt: string;
  updatedAt: string;
}

interface MongoSignature {
  _id?: ObjectId;
  transactionId: string;
  bodyBytes: string;
  signature: string;
  address: string;
  createdAt: string;
}

interface MongoNonce {
  _id?: ObjectId;
  chainId: string;
  address: string;
  nonce: number;
}

// Helper to convert Mongo _id to string id
function docId(doc: WithId<Document>): string {
  return doc._id.toHexString();
}

// ============================================================================
// Multisig Operations
// ============================================================================

export const getMultisig = async (
  chainId: string,
  address: string,
): Promise<(MongoMultisig & { id: string }) | null> => {
  const db = await getDb();
  if (!db) return null;

  const col = db.collection<MongoMultisig>(Collections.MULTISIGS);

  // Prefer one with creator
  const withCreator = await col.findOne({ chainId, address, creator: { $ne: null } });
  if (withCreator) return { ...withCreator, id: docId(withCreator) };

  const any = await col.findOne({ chainId, address });
  if (any) return { ...any, id: docId(any) };

  return null;
};

export const getMultisigById = async (
  id: string,
): Promise<(MongoMultisig & { id: string }) | null> => {
  const db = await getDb();
  if (!db) return null;

  const col = db.collection<MongoMultisig>(Collections.MULTISIGS);

  let doc: WithId<MongoMultisig> | null = null;
  try {
    doc = await col.findOne({ _id: new ObjectId(id) });
  } catch {
    // id might be an address from localDb migration – try address lookup
    doc = await col.findOne({ address: id });
  }

  if (!doc) return null;
  return { ...doc, id: docId(doc) };
};

export const getCreatedMultisigs = async (
  chainId: string,
  creatorAddress: string,
): Promise<(MongoMultisig & { id: string })[]> => {
  const db = await getDb();
  if (!db) return [];

  const col = db.collection<MongoMultisig>(Collections.MULTISIGS);
  const docs = await col.find({ chainId, creator: creatorAddress }).toArray();
  return docs.map((d) => ({ ...d, id: docId(d) }));
};

export const getBelongedMultisigs = async (
  chainId: string,
  memberPubkey: string,
): Promise<(MongoMultisig & { id: string })[]> => {
  const db = await getDb();
  if (!db) return [];

  const col = db.collection<MongoMultisig>(Collections.MULTISIGS);

  // Use $regex to narrow candidates, then filter with exact JSON match
  // to avoid false positives from substring matching
  const candidates = await col
    .find({ chainId, pubkeyJSON: { $regex: memberPubkey } })
    .toArray();

  const exactMatches = candidates.filter((doc) => {
    try {
      const parsed = JSON.parse(doc.pubkeyJSON);
      const pubkeys: { value?: string; key?: string }[] =
        parsed?.value?.pubkeys || parsed?.pubkeys || [];
      return pubkeys.some(
        (pk) => pk.value === memberPubkey || pk.key === memberPubkey,
      );
    } catch {
      // Fallback: keep the regex match if JSON parsing fails
      return true;
    }
  });

  return exactMatches.map((d) => ({ ...d, id: docId(d) }));
};

export const createMultisig = async (multisig: {
  chainId: string;
  address: string;
  creator: string | null;
  pubkeyJSON: string;
  name?: string | null;
  description?: string | null;
}): Promise<string> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoMultisig>(Collections.MULTISIGS);
  const now = new Date().toISOString();

  const existing = await col.findOne({
    chainId: multisig.chainId,
    address: multisig.address,
  });

  if (existing) {
    if (multisig.creator && !existing.creator) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            creator: multisig.creator,
            ...(multisig.name && { name: multisig.name }),
            ...(multisig.description && { description: multisig.description }),
            updatedAt: now,
          },
        },
      );
      return existing.address;
    }
    throw new Error(
      `Cliq already exists on ${multisig.chainId} with address ${multisig.address}`,
    );
  }

  const doc: MongoMultisig = {
    chainId: multisig.chainId,
    address: multisig.address,
    creator: multisig.creator,
    pubkeyJSON: multisig.pubkeyJSON,
    name: multisig.name || null,
    description: multisig.description || null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  return doc.address;
};

// ============================================================================
// Transaction Operations
// ============================================================================

export const getTransaction = async (
  transactionId: string,
): Promise<(MongoTransaction & { id: string }) | null> => {
  const db = await getDb();
  if (!db) return null;

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);

  let doc: WithId<MongoTransaction> | null = null;
  try {
    doc = await col.findOne({ _id: new ObjectId(transactionId) });
  } catch {
    return null;
  }

  if (!doc) return null;
  return { ...doc, id: docId(doc) };
};

export const getTransactionsByCreator = async (
  creatorId: string,
): Promise<(MongoTransaction & { id: string })[]> => {
  const db = await getDb();
  if (!db) return [];

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const docs = await col.find({ creatorId }).toArray();
  return docs.map((d) => ({ ...d, id: docId(d) }));
};

export const getPendingTransactionsByCreator = async (
  creatorId: string,
): Promise<(MongoTransaction & { id: string })[]> => {
  const db = await getDb();
  if (!db) return [];

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const docs = await col
    .find({
      creatorId,
      txHash: null,
      status: { $ne: "cancelled" },
    })
    .toArray();
  return docs.map((d) => ({ ...d, id: docId(d) }));
};

export const createTransaction = async (transaction: {
  dataJSON: string;
  creatorId: string;
  txHash: string | null;
  payloadHash?: string;
}): Promise<string> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const now = new Date().toISOString();

  const doc: MongoTransaction = {
    txHash: transaction.txHash,
    creatorId: transaction.creatorId,
    dataJSON: transaction.dataJSON,
    status: "pending",
    payloadHash: transaction.payloadHash,
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);
  return result.insertedId.toHexString();
};

export const updateTransactionHash = async (
  transactionId: string,
  txHash: string,
): Promise<void> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const result = await col.updateOne(
    { _id: new ObjectId(transactionId) },
    { $set: { txHash, status: "broadcast", updatedAt: new Date().toISOString() } },
  );

  if (result.matchedCount === 0) {
    throw new Error(`Transaction with id ${transactionId} not found`);
  }
};

export const cancelTransaction = async (transactionId: string): Promise<void> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);

  const tx = await col.findOne({ _id: new ObjectId(transactionId) });
  if (!tx) throw new Error(`Transaction with id ${transactionId} not found`);
  if (tx.txHash) throw new Error("Cannot cancel a transaction that has already been broadcast");

  await col.updateOne(
    { _id: new ObjectId(transactionId) },
    { $set: { status: "cancelled", updatedAt: new Date().toISOString() } },
  );
};

export const updateTransactionPayloadHash = async (
  transactionId: string,
  payloadHash: string,
  signDocHash?: string,
): Promise<void> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const update: Record<string, string> = {
    payloadHash,
    updatedAt: new Date().toISOString(),
  };
  if (signDocHash) update.signDocHash = signDocHash;

  await col.updateOne({ _id: new ObjectId(transactionId) }, { $set: update });
};

// ============================================================================
// Signature Operations
// ============================================================================

export const getSignaturesByTransaction = async (
  transactionId: string,
): Promise<(MongoSignature & { id: string })[]> => {
  const db = await getDb();
  if (!db) return [];

  const col = db.collection<MongoSignature>(Collections.SIGNATURES);
  const docs = await col.find({ transactionId }).toArray();
  return docs.map((d) => ({ ...d, id: docId(d) }));
};

export const createSignature = async (signature: {
  transactionId: string;
  bodyBytes: string;
  signature: string;
  address: string;
}): Promise<string> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoSignature>(Collections.SIGNATURES);

  const existing = await col.findOne({
    transactionId: signature.transactionId,
    address: signature.address,
  });

  if (existing) {
    throw new Error(
      `Signature already exists for transaction ${signature.transactionId} and address ${signature.address}`,
    );
  }

  const doc: MongoSignature = {
    ...signature,
    createdAt: new Date().toISOString(),
  };

  const result = await col.insertOne(doc);
  return result.insertedId.toHexString();
};

// ============================================================================
// Nonce Operations
// ============================================================================

export const getNonce = async (
  chainId: string,
  address: string,
): Promise<{ nonce: number } | null> => {
  const db = await getDb();
  if (!db) return null;

  const col = db.collection<MongoNonce>(Collections.NONCES);
  const doc = await col.findOne({ chainId, address });
  if (!doc) return null;
  return { nonce: doc.nonce };
};

export const createOrUpdateNonce = async (
  chainId: string,
  address: string,
  nonce: number,
): Promise<void> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const col = db.collection<MongoNonce>(Collections.NONCES);
  await col.updateOne(
    { chainId, address },
    { $set: { nonce } },
    { upsert: true },
  );
};

// ============================================================================
// Wipe / Cleanup Operations (privacy features)
// ============================================================================

/**
 * Wipe all broadcast (completed) transactions for a multisig.
 * Returns the count of deleted transactions and their signatures.
 */
export const wipeCompletedTransactions = async (
  multisigId: string,
): Promise<{ deletedTransactions: number; deletedSignatures: number }> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const txCol = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const sigCol = db.collection<MongoSignature>(Collections.SIGNATURES);

  // Find all broadcast transactions for this multisig
  const broadcastTxs = await txCol
    .find({ creatorId: multisigId, status: "broadcast" })
    .toArray();

  const txIds = broadcastTxs.map((t) => docId(t));

  // Delete signatures for those transactions
  const sigResult = await sigCol.deleteMany({
    transactionId: { $in: txIds },
  });

  // Delete the transactions
  const txResult = await txCol.deleteMany({
    creatorId: multisigId,
    status: "broadcast",
  });

  return {
    deletedTransactions: txResult.deletedCount,
    deletedSignatures: sigResult.deletedCount,
  };
};

/**
 * Wipe ALL transactions (pending + broadcast) for a multisig.
 * Nuclear option for full privacy wipe.
 */
export const wipeAllTransactions = async (
  multisigId: string,
): Promise<{ deletedTransactions: number; deletedSignatures: number }> => {
  const db = await getDb();
  if (!db) throw new Error("MongoDB not available");

  const txCol = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const sigCol = db.collection<MongoSignature>(Collections.SIGNATURES);

  const allTxs = await txCol.find({ creatorId: multisigId }).toArray();
  const txIds = allTxs.map((t) => docId(t));

  const sigResult = await sigCol.deleteMany({
    transactionId: { $in: txIds },
  });

  const txResult = await txCol.deleteMany({ creatorId: multisigId });

  return {
    deletedTransactions: txResult.deletedCount,
    deletedSignatures: sigResult.deletedCount,
  };
};

/**
 * Export all transactions for a multisig as a JSON array.
 * Users can download this before wiping.
 */
export const exportTransactionHistory = async (
  multisigId: string,
): Promise<object[]> => {
  const db = await getDb();
  if (!db) return [];

  const txCol = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const sigCol = db.collection<MongoSignature>(Collections.SIGNATURES);

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
};

/**
 * Auto-cleanup: delete broadcast transactions older than `daysOld` days.
 * Run this periodically (e.g. via cron or on API startup) to stay under 512 MB.
 */
export const autoCleanup = async (daysOld: number = 30): Promise<number> => {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const cutoffISO = cutoff.toISOString();

  const txCol = db.collection<MongoTransaction>(Collections.TRANSACTIONS);
  const sigCol = db.collection<MongoSignature>(Collections.SIGNATURES);

  // Find old broadcast transactions
  const oldTxs = await txCol
    .find({
      status: "broadcast",
      updatedAt: { $lt: cutoffISO },
    })
    .toArray();

  if (oldTxs.length === 0) return 0;

  const txIds = oldTxs.map((t) => docId(t));

  await sigCol.deleteMany({ transactionId: { $in: txIds } });
  const result = await txCol.deleteMany({
    _id: { $in: oldTxs.map((t) => t._id!) },
  });

  console.log(`[MongoDB] Auto-cleanup: removed ${result.deletedCount} old transactions`);
  return result.deletedCount;
};

/**
 * Get storage stats for the database (approximate).
 */
export const getStorageStats = async (): Promise<{
  multisigCount: number;
  transactionCount: number;
  signatureCount: number;
  estimatedSizeMB: number;
} | null> => {
  const db = await getDb();
  if (!db) return null;

  const [multisigCount, transactionCount, signatureCount] = await Promise.all([
    db.collection(Collections.MULTISIGS).countDocuments(),
    db.collection(Collections.TRANSACTIONS).countDocuments(),
    db.collection(Collections.SIGNATURES).countDocuments(),
  ]);

  const stats = await db.stats();
  const estimatedSizeMB = Math.round((stats.dataSize / (1024 * 1024)) * 100) / 100;

  return { multisigCount, transactionCount, signatureCount, estimatedSizeMB };
};

// ============================================================================
// Index Setup (call once on startup)
// ============================================================================

export const ensureIndexes = async (): Promise<void> => {
  const db = await getDb();
  if (!db) return;

  const multisigCol = db.collection(Collections.MULTISIGS);
  await multisigCol.createIndex({ chainId: 1, address: 1 }, { unique: true });
  await multisigCol.createIndex({ chainId: 1, creator: 1 });

  const txCol = db.collection(Collections.TRANSACTIONS);
  await txCol.createIndex({ creatorId: 1 });
  await txCol.createIndex({ creatorId: 1, status: 1 });
  await txCol.createIndex({ status: 1, updatedAt: 1 });

  const sigCol = db.collection(Collections.SIGNATURES);
  await sigCol.createIndex({ transactionId: 1 });
  await sigCol.createIndex(
    { transactionId: 1, address: 1 },
    { unique: true },
  );

  const nonceCol = db.collection(Collections.NONCES);
  await nonceCol.createIndex({ chainId: 1, address: 1 }, { unique: true });

  console.log("[MongoDB] Indexes ensured");
};
