/**
 * Dynamic MongoDB Connection Manager
 *
 * File: lib/byodb/dynamicMongo.ts
 *
 * Creates short-lived MongoDB connections from user-supplied connection strings.
 * Each connection is cached for a short TTL to amortize cost across rapid
 * sequential API calls, then closed to avoid leaking resources.
 *
 * Used exclusively by the BYODB middleware – never for the default database.
 */

import { MongoClient, Db } from "mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedConnection {
  client: MongoClient;
  db: Db;
  createdAt: number;
  lastUsed: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** How long (ms) to keep an idle connection before closing it */
const CONNECTION_TTL_MS = 30_000; // 30 seconds

/** Max concurrent user connections */
const MAX_CONNECTIONS = 20;

/** Cleanup interval */
const CLEANUP_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Cache (keyed by SHA-256 fingerprint of connection string)
// ---------------------------------------------------------------------------

const cache = new Map<string, CachedConnection>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Simple hash for cache key derivation (not crypto – just for map keying).
 * Uses djb2 algorithm for speed.
 */
function quickHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return `byodb_${hash.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function startCleanup(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, conn] of cache) {
      if (now - conn.lastUsed > CONNECTION_TTL_MS) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const conn = cache.get(key);
      if (conn) {
        conn.client.close(true).catch(() => {});
        cache.delete(key);
      }
    }

    // Stop timer if cache is empty
    if (cache.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't block process exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a MongoDB `Db` instance from a user-supplied connection string.
 *
 * The connection is cached by URI hash so subsequent calls within the
 * TTL window reuse the same socket. After TTL expires the connection
 * is closed automatically.
 *
 * @throws Error if the URI is invalid or connection fails
 */
export async function getDynamicDb(connectionUri: string): Promise<Db> {
  const key = quickHash(connectionUri);

  // Reuse cached connection if available
  const existing = cache.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.db;
  }

  // Evict oldest if at capacity
  if (cache.size >= MAX_CONNECTIONS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of cache) {
      if (v.lastUsed < oldestTime) {
        oldestTime = v.lastUsed;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const old = cache.get(oldestKey);
      if (old) {
        old.client.close(true).catch(() => {});
        cache.delete(oldestKey);
      }
    }
  }

  // Create new connection with safety options
  const client = new MongoClient(connectionUri, {
    connectTimeoutMS: 8_000,
    socketTimeoutMS: 15_000,
    serverSelectionTimeoutMS: 8_000,
    maxPoolSize: 3, // Keep pool small for user connections
    minPoolSize: 0,
    retryWrites: true,
    retryReads: true,
  });

  await client.connect();
  const db = client.db(); // uses database name from URI

  const now = Date.now();
  cache.set(key, { client, db, createdAt: now, lastUsed: now });
  startCleanup();

  return db;
}

/**
 * Test connectivity to a user-supplied MongoDB URI.
 * Returns timing info or throws on failure.
 */
export async function testConnection(connectionUri: string): Promise<{
  ok: boolean;
  latencyMs: number;
  serverVersion: string;
  dbName: string;
}> {
  const start = Date.now();

  const client = new MongoClient(connectionUri, {
    connectTimeoutMS: 8_000,
    socketTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 8_000,
    maxPoolSize: 1,
    minPoolSize: 0,
  });

  try {
    await client.connect();
    const db = client.db();
    const admin = db.admin();
    const info = await admin.serverInfo();
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      latencyMs,
      serverVersion: info.version || "unknown",
      dbName: db.databaseName,
    };
  } finally {
    await client.close(true).catch(() => {});
  }
}

/**
 * Provision a user's database: create collections and indexes matching
 * the schema from the default MongoDB adapter.
 */
export async function provisionDatabase(connectionUri: string): Promise<{
  collectionsCreated: string[];
  indexesCreated: number;
}> {
  const db = await getDynamicDb(connectionUri);
  const collectionsCreated: string[] = [];
  let indexesCreated = 0;

  // Ensure all required collections exist
  const requiredCollections = ["multisigs", "transactions", "signatures", "nonces"];

  const existingCols = await db.listCollections().toArray();
  const existingNames = new Set(existingCols.map((c) => c.name));

  for (const name of requiredCollections) {
    if (!existingNames.has(name)) {
      await db.createCollection(name);
      collectionsCreated.push(name);
    }
  }

  // Create indexes (matching lib/mongodb.ts ensureIndexes)
  const multisigCol = db.collection("multisigs");
  await multisigCol.createIndex({ chainId: 1, address: 1 }, { unique: true });
  await multisigCol.createIndex({ chainId: 1, creator: 1 });
  indexesCreated += 2;

  const txCol = db.collection("transactions");
  await txCol.createIndex({ creatorId: 1 });
  await txCol.createIndex({ creatorId: 1, status: 1 });
  await txCol.createIndex({ status: 1, updatedAt: 1 });
  indexesCreated += 3;

  const sigCol = db.collection("signatures");
  await sigCol.createIndex({ transactionId: 1 });
  await sigCol.createIndex({ transactionId: 1, address: 1 }, { unique: true });
  indexesCreated += 2;

  const nonceCol = db.collection("nonces");
  await nonceCol.createIndex({ chainId: 1, address: 1 }, { unique: true });
  indexesCreated += 1;

  return { collectionsCreated, indexesCreated };
}

/**
 * Get stats from a user's database.
 */
export async function getDynamicDbStats(connectionUri: string): Promise<{
  multisigCount: number;
  transactionCount: number;
  signatureCount: number;
  estimatedSizeMB: number;
}> {
  const db = await getDynamicDb(connectionUri);

  const [multisigCount, transactionCount, signatureCount] = await Promise.all([
    db.collection("multisigs").countDocuments(),
    db.collection("transactions").countDocuments(),
    db.collection("signatures").countDocuments(),
  ]);

  const stats = await db.stats();
  const estimatedSizeMB = Math.round((stats.dataSize / (1024 * 1024)) * 100) / 100;

  return { multisigCount, transactionCount, signatureCount, estimatedSizeMB };
}

/**
 * Close all cached connections. Call on server shutdown if needed.
 */
export async function closeAll(): Promise<void> {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  for (const [, conn] of cache) {
    await conn.client.close(true).catch(() => {});
  }
  cache.clear();
}
