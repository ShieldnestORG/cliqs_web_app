#!/usr/bin/env node
/**
 * Seed Coreum multisigs from chain into database
 *
 * Runs in batches, records progress to a checkpoint file, sleeps between batches,
 * and resumes from checkpoint on restart.
 *
 * Writes pubkey multisigs to MongoDB when MONGODB_URI is set (.env.local);
 * otherwise falls back to data/local-db.json. CW3/CW4 always go to local-db
 * (contractMultisigs and groups are local-only).
 *
 * Usage:
 *   npm run seed:coreum   # loads .env.local, uses MongoDB if configured
 *   node scripts/seed-coreum-multisigs.mjs   # resumes from checkpoint
 *   rm data/seed-coreum-checkpoint.json && npm run seed:coreum   # start fresh
 *
 * Env (from .env.local or shell):
 *   MONGODB_URI       - MongoDB connection (default DB when set)
 *   MONGODB_DB_NAME   - Database name (default: cliqs)
 *   RPC_URL           - RPC endpoint
 *   REST_URL          - REST/LCD endpoint
 *   CHAIN_ID          - chain ID
 *   CW3_CODE_IDS      - comma-separated CW3 code IDs
 *   CW4_CODE_IDS      - comma-separated CW4 code IDs
 *   BATCH_SIZE        - items per batch (default: 25)
 *   SLEEP_SECONDS     - seconds to sleep between batches (default: 3)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load .env.local so MONGODB_URI etc. are available
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

const DB_PATH = join(ROOT, "data", "local-db.json");
const CHECKPOINT_PATH = join(ROOT, "data", "seed-coreum-checkpoint.json");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL || "https://coreum-rpc.polkachu.com";
const REST_URL = process.env.REST_URL || "https://coreum-api.polkachu.com";
const CHAIN_ID = process.env.CHAIN_ID || "coreum-mainnet-1";
const CW3_CODE_IDS = (process.env.CW3_CODE_IDS || "")
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !isNaN(n) && n > 0);
const CW4_CODE_IDS = (process.env.CW4_CODE_IDS || "")
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !isNaN(n) && n > 0);
const BATCH_SIZE = Math.max(1, parseInt(process.env.BATCH_SIZE || "25", 10));
const SLEEP_SECONDS = Math.max(0, parseInt(process.env.SLEEP_SECONDS || "3", 10));
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cliqs";

let mongoClient = null;
let mongoCol = null;

async function getMongoMultisigsCol() {
  if (!MONGODB_URI) return null;
  if (mongoCol) return mongoCol;
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB_NAME);
    mongoCol = db.collection("multisigs");
    return mongoCol;
  } catch (e) {
    console.warn("MongoDB unavailable, falling back to local-db:", e.message);
    return null;
  }
}

async function upsertMultisigMongo(m) {
  const col = await getMongoMultisigsCol();
  if (!col) return false;
  const now = new Date().toISOString();
  const doc = {
    chainId: m.chainId,
    address: m.address,
    creator: m.creator ?? null,
    pubkeyJSON: m.pubkeyJSON,
    name: m.name ?? null,
    description: m.description ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await col.updateOne(
    { chainId: m.chainId, address: m.address },
    { $set: doc },
    { upsert: true }
  );
  return true;
}

function sleep(seconds) {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveCheckpoint(ck) {
  const dataDir = dirname(CHECKPOINT_PATH);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(ck, null, 2));
}

// ---------------------------------------------------------------------------
// DB read/write
// ---------------------------------------------------------------------------

function readDb() {
  if (!existsSync(DB_PATH)) {
    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const initial = {
      multisigs: [],
      transactions: [],
      signatures: [],
      nonces: [],
      contractMultisigs: [],
      contractProposals: [],
      contractVotes: [],
      syncStates: [],
      websocketEvents: [],
      groups: [],
      memberSnapshots: [],
      voteSnapshots: [],
      groupEvents: [],
      credentialClasses: [],
      credentials: [],
      credentialEvents: [],
      policies: [],
      policyViolations: [],
      emergencyEvents: [],
      emergencyStates: [],
      incidents: [],
      alertRules: [],
      alerts: [],
      spendRecords: [],
    };
    writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const data = JSON.parse(readFileSync(DB_PATH, "utf-8"));
  if (!data.contractMultisigs) data.contractMultisigs = [];
  if (!data.groups) data.groups = [];
  if (!data.multisigs) data.multisigs = [];
  return data;
}

function writeDb(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function upsertContractMultisig(db, m) {
  const idx = db.contractMultisigs?.findIndex(
    (x) => x.chainId === m.chainId && x.contractAddress === m.contractAddress
  );
  const now = new Date().toISOString();
  if (idx >= 0) {
    Object.assign(db.contractMultisigs[idx], {
      ...m,
      updatedAt: now,
    });
  } else {
    (db.contractMultisigs = db.contractMultisigs || []).push({
      id: generateId(),
      ...m,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function upsertGroup(db, g) {
  const idx = db.groups?.findIndex(
    (x) => x.chainId === g.chainId && x.groupAddress === g.groupAddress
  );
  const now = new Date().toISOString();
  if (idx >= 0) {
    Object.assign(db.groups[idx], { ...g, updatedAt: now });
  } else {
    (db.groups = db.groups || []).push({
      id: generateId(),
      ...g,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function upsertMultisig(db, m) {
  const idx = db.multisigs?.findIndex(
    (x) => x.chainId === m.chainId && x.address === m.address
  );
  const now = new Date().toISOString();
  if (idx >= 0) {
    Object.assign(db.multisigs[idx], { ...m, updatedAt: now });
  } else {
    (db.multisigs = db.multisigs || []).push({
      id: generateId(),
      ...m,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// REST fetch with pagination
// ---------------------------------------------------------------------------

async function fetchContracts(codeId, paginationKey = null) {
  let url = `${REST_URL}/cosmwasm/wasm/v1/code/${codeId}/contracts?pagination.limit=${BATCH_SIZE}&pagination.count_total=true`;
  if (paginationKey) {
    url += `&pagination.key=${encodeURIComponent(paginationKey)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Contracts fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const contracts = data.contracts || [];
  const nextKey = data.pagination?.next_key || null;
  return { contracts, nextKey };
}

async function fetchAuthAccounts(paginationKey = null) {
  let url = `${REST_URL}/cosmos/auth/v1beta1/accounts?pagination.limit=${BATCH_SIZE}&pagination.count_total=true`;
  if (paginationKey) {
    url += `&pagination.key=${encodeURIComponent(paginationKey)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Auth accounts fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const accounts = data.accounts || [];
  const nextKey = data.pagination?.next_key || null;
  return { accounts, nextKey };
}

// ---------------------------------------------------------------------------
// Phase: CW3
// ---------------------------------------------------------------------------

async function runPhaseCw3(client, db, checkpoint) {
  const codeIds = CW3_CODE_IDS;
  if (codeIds.length === 0) return { phase: "pubkey", done: true };

  const startCodeIdx = checkpoint?.phase === "cw3" ? (checkpoint.codeIndex ?? 0) : 0;
  const startPaginationKey = checkpoint?.phase === "cw3" ? checkpoint.paginationKey ?? null : null;
  let runningTotal = checkpoint?.phase === "cw3" ? (checkpoint.totalSeeded ?? 0) : 0;

  for (let ci = startCodeIdx; ci < codeIds.length; ci++) {
    const codeId = codeIds[ci];
    let paginationKey = startPaginationKey && ci === startCodeIdx ? startPaginationKey : null;
    let batchNum = ci === startCodeIdx && startPaginationKey ? (checkpoint.batchIndex ?? 0) : 0;

    while (true) {
      const { contracts, nextKey: nk } = await fetchContracts(codeId, paginationKey);
      let seeded = 0;
      for (const addr of contracts) {
        try {
          const info = await client.getContract(addr);
          const threshold = await client.queryContractSmart(addr, { threshold: {} });
          let members = [];
          try {
            const voters = await client.queryContractSmart(addr, { list_voters: { limit: 100 } });
            members = (voters.voters || []).map((v) => ({ addr: v.addr, weight: Number(v.weight || 0) }));
          } catch {
            /* ignore */
          }
          const th = threshold?.absolute_count ?? threshold?.threshold_quorum ?? {};
          const thWeight = th.weight ?? 0;
          let maxVoting = 604800;
          try {
            const config = await client.queryContractSmart(addr, { config: {} });
            if (config?.max_voting_period?.time) maxVoting = config.max_voting_period.time;
          } catch {
            /* use default */
          }
          upsertContractMultisig(db, {
            chainId: CHAIN_ID,
            contractAddress: addr,
            codeId,
            creator: info?.creator ?? "",
            label: info?.label ?? "",
            threshold: Number(thWeight) || 1,
            maxVotingPeriodSeconds: maxVoting,
            members,
            name: null,
            description: null,
            lastSyncHeight: 0,
            policyVersion: 1,
          });
          seeded++;
        } catch (e) {
          console.warn(`  Skip ${addr}: ${e.message}`);
        }
      }
      writeDb(db);
      runningTotal += seeded;
      saveCheckpoint({
        phase: "cw3",
        codeIndex: ci,
        codeId,
        paginationKey: nk,
        batchIndex: batchNum,
        totalSeeded: runningTotal,
        lastUpdated: new Date().toISOString(),
      });
      console.log(`  CW3 code ${codeId} batch ${batchNum}: +${seeded} (total ${runningTotal})`);

      if (!nk || contracts.length === 0) break;
      paginationKey = nk;
      batchNum++;
      await sleep(SLEEP_SECONDS);
    }
  }
  return { phase: "cw4", done: false };
}

// ---------------------------------------------------------------------------
// Phase: CW4
// ---------------------------------------------------------------------------

async function runPhaseCw4(client, db, checkpoint) {
  const codeIds = CW4_CODE_IDS;
  if (codeIds.length === 0) return { phase: "pubkey", done: false };

  const startCodeIdx = checkpoint?.phase === "cw4" ? (checkpoint.codeIndex ?? 0) : 0;
  const startPaginationKey = checkpoint?.phase === "cw4" ? checkpoint.paginationKey ?? null : null;
  let runningTotal = checkpoint?.phase === "cw4" ? (checkpoint.totalSeeded ?? 0) : 0;

  for (let ci = startCodeIdx; ci < codeIds.length; ci++) {
    const codeId = codeIds[ci];
    let paginationKey = startPaginationKey && ci === startCodeIdx ? startPaginationKey : null;
    let batchNum = ci === startCodeIdx && startPaginationKey ? (checkpoint.batchIndex ?? 0) : 0;

    while (true) {
      const { contracts, nextKey: nk } = await fetchContracts(codeId, paginationKey);
      let seeded = 0;
      for (const addr of contracts) {
        try {
          const tw = await client.queryContractSmart(addr, { total_weight: {} });
          let members = [];
          try {
            const list = await client.queryContractSmart(addr, { list_members: { limit: 100 } });
            members = (list.members || []).map((m) => ({ addr: m.addr, weight: Number(m.weight || 0) }));
          } catch {
            /* ignore */
          }
          upsertGroup(db, {
            chainId: CHAIN_ID,
            groupAddress: addr,
            groupType: "cw4",
            admin: null,
            multisigAddress: null,
            label: null,
            totalWeight: Number(tw?.weight ?? 0) || 0,
            memberCount: members.length,
            lastSyncHeight: 0,
          });
          seeded++;
        } catch (e) {
          console.warn(`  Skip CW4 ${addr}: ${e.message}`);
        }
      }
      writeDb(db);
      runningTotal += seeded;
      saveCheckpoint({
        phase: "cw4",
        codeIndex: ci,
        codeId,
        paginationKey: nk,
        batchIndex: batchNum,
        totalSeeded: runningTotal,
        lastUpdated: new Date().toISOString(),
      });
      console.log(`  CW4 code ${codeId} batch ${batchNum}: +${seeded} (total ${runningTotal})`);

      if (!nk || contracts.length === 0) break;
      paginationKey = nk;
      batchNum++;
      await sleep(SLEEP_SECONDS);
    }
  }
  return { phase: "pubkey", done: false };
}

// ---------------------------------------------------------------------------
// Phase: Pubkey multisigs (auth accounts)
// ---------------------------------------------------------------------------

function isMultisigAccount(account) {
  if (!account) return false;
  const pk = account.pub_key || account.base_account?.pub_key;
  if (!pk) return false;
  const type = pk["@type"] || pk.type || "";
  if (type.includes("LegacyAminoPubKey") || type.includes("PubKeyMultisigThreshold")) {
    return true;
  }
  return false;
}

function pubkeyToJson(pubkey) {
  const t = pubkey["@type"] || pubkey.type || "";
  if (t.includes("LegacyAminoPubKey")) {
    const pubkeys = pubkey.public_keys || pubkey.value?.pubkeys || [];
    return JSON.stringify({
      type: "tendermint/PubKeyMultisigThreshold",
      value: {
        threshold: Number(pubkey.threshold || pubkey.value?.threshold || 1),
        pubkeys: pubkeys.map((p) => {
          const v = typeof p === "string" ? p : p.value || p.key;
          return { type: "tendermint/PubKeySecp256k1", value: v };
        }),
      },
    });
  }
  return JSON.stringify(pubkey);
}

async function runPhasePubkey(db, checkpoint) {
  const startKey = checkpoint?.phase === "pubkey" ? checkpoint.paginationKey ?? null : null;

  let paginationKey = startKey;
  let totalSeeded = checkpoint?.phase === "pubkey" ? (checkpoint.totalSeeded ?? 0) : 0;
  let batchNum = startKey ? (checkpoint.batchIndex ?? 0) : 0;

  const useMongo = !!MONGODB_URI;

  while (true) {
    const { accounts, nextKey } = await fetchAuthAccounts(paginationKey);
    let seeded = 0;
    let usedLocal = false;
    for (const acc of accounts) {
      const base = acc.base_account || acc;
      const addr = base.address;
      if (!addr) continue;
      if (!isMultisigAccount(acc)) continue;
      const pk = acc.pub_key || base.pub_key;
      if (!pk) continue;
      try {
        const pubkeyJson = pubkeyToJson(pk);
        const m = {
          chainId: CHAIN_ID,
          address: addr,
          creator: null,
          pubkeyJSON: pubkeyJson,
          name: null,
          description: null,
        };
        const written = useMongo ? await upsertMultisigMongo(m) : false;
        if (!written) {
          upsertMultisig(db, m);
          usedLocal = true;
        }
        seeded++;
      } catch (e) {
        console.warn(`  Skip pubkey ${addr}: ${e.message}`);
      }
    }
    if (usedLocal) writeDb(db);
    totalSeeded += seeded;
    saveCheckpoint({
      phase: "pubkey",
      paginationKey: nextKey,
      batchIndex: batchNum,
      totalSeeded,
      lastUpdated: new Date().toISOString(),
    });
    console.log(`  Pubkey batch ${batchNum}: +${seeded} (total ${totalSeeded})`);

    if (!nextKey || accounts.length === 0) {
      console.log("  Pubkey phase complete.");
      return { done: true };
    }
    paginationKey = nextKey;
    batchNum++;
    await sleep(SLEEP_SECONDS);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\nSeed Coreum multisigs\n");
  console.log("Config:", {
    RPC_URL,
    REST_URL,
    CHAIN_ID,
    CW3_CODE_IDS,
    CW4_CODE_IDS,
    BATCH_SIZE,
    SLEEP_SECONDS,
    "pubkey DB": MONGODB_URI ? `MongoDB (${MONGODB_DB_NAME})` : "local-db.json",
  });

  const checkpoint = loadCheckpoint();
  if (checkpoint) {
    console.log("Resuming from checkpoint:", checkpoint.phase, checkpoint.lastUpdated);
  }

  const db = readDb();
  const client = await CosmWasmClient.connect(RPC_URL);

  try {
    if (!checkpoint || checkpoint.phase === "cw3") {
      await runPhaseCw3(client, db, checkpoint);
    }

    if (!checkpoint || checkpoint.phase === "cw4") {
      const ck = loadCheckpoint();
      await runPhaseCw4(client, db, ck);
    }

    const ck = loadCheckpoint();
    await runPhasePubkey(db, ck);
  } finally {
    client.disconnect();
    if (mongoClient) await mongoClient.close();
  }

  console.log("\nDone. Remove data/seed-coreum-checkpoint.json to run again from scratch.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
