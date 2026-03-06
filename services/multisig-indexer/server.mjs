import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { Pool } from "pg";
import { StargateClient } from "@cosmjs/stargate";
import { sha256 } from "@cosmjs/crypto";
import { fromBase64, toHex } from "@cosmjs/encoding";
import {
  createMultisigThresholdPubkey,
  isMultisigThresholdPubkey,
  isSecp256k1Pubkey,
  pubkeyToAddress,
} from "@cosmjs/amino";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.MULTISIG_INDEXER_DATABASE_URL || process.env.DATABASE_URL || "";
const API_KEY = process.env.MULTISIG_INDEXER_API_KEY || "";
const CHAIN_REGISTRY_BRANCH = process.env.MULTISIG_INDEXER_CHAIN_REGISTRY_BRANCH || "master";
const CHAIN_REGISTRY_REPO =
  process.env.MULTISIG_INDEXER_CHAIN_REGISTRY_REPO || "cosmos/chain-registry";
const GITHUB_TOKEN = process.env.MULTISIG_INDEXER_GITHUB_TOKEN || "";
const CHAIN_CACHE_TTL_MS = Number.parseInt(
  process.env.MULTISIG_INDEXER_CHAIN_CACHE_TTL_MS || String(15 * 60 * 1000),
  10,
);
const REFRESH_INTERVAL_MS = Number.parseInt(
  process.env.MULTISIG_INDEXER_REFRESH_INTERVAL_MS || "0",
  10,
);
const REFRESH_BATCH_SIZE = Number.parseInt(
  process.env.MULTISIG_INDEXER_REFRESH_BATCH_SIZE || "25",
  10,
);
const REQUEST_BODY_LIMIT_BYTES = Number.parseInt(
  process.env.MULTISIG_INDEXER_REQUEST_BODY_LIMIT_BYTES || String(512 * 1024),
  10,
);

if (!DATABASE_URL) {
  throw new Error("MULTISIG_INDEXER_DATABASE_URL or DATABASE_URL must be configured");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number.parseInt(process.env.MULTISIG_INDEXER_PG_POOL_SIZE || "10", 10),
  connectionTimeoutMillis: Number.parseInt(
    process.env.MULTISIG_INDEXER_PG_CONNECT_TIMEOUT_MS || "10000",
    10,
  ),
  ssl:
    process.env.MULTISIG_INDEXER_PG_SSL === "false"
      ? false
      : process.env.NODE_ENV === "development"
        ? false
        : { rejectUnauthorized: false },
});

const eventClients = new Set();
const chainConfigCache = new Map();
let chainDirectoryCache = { expiresAt: 0, entries: [] };
let backgroundRefreshTimer = null;
let schemaReady = false;
let schemaError = null;

const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS multisig_indexer;

CREATE TABLE IF NOT EXISTS multisig_indexer.multisigs (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'native_amino',
  threshold INTEGER,
  pubkey_fingerprint TEXT,
  raw_multisig_pubkey JSONB,
  label TEXT,
  description TEXT,
  creator TEXT,
  source_first_seen TEXT NOT NULL,
  first_seen_height BIGINT,
  last_seen_height BIGINT,
  last_seen_tx_hash TEXT,
  verification_status TEXT NOT NULL DEFAULT 'inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, multisig_address)
);

CREATE TABLE IF NOT EXISTS multisig_indexer.multisig_members (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  member_address TEXT,
  member_pubkey_fingerprint TEXT,
  raw_member_pubkey JSONB,
  weight INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'inferred',
  first_seen_height BIGINT,
  last_seen_height BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS multisig_members_chain_multisig_position_idx
  ON multisig_indexer.multisig_members (chain_id, multisig_address, position);

CREATE INDEX IF NOT EXISTS multisig_members_chain_member_address_idx
  ON multisig_indexer.multisig_members (chain_id, member_address);

CREATE INDEX IF NOT EXISTS multisig_members_chain_member_pubkey_idx
  ON multisig_indexer.multisig_members (chain_id, member_pubkey_fingerprint);

CREATE INDEX IF NOT EXISTS multisig_members_chain_multisig_idx
  ON multisig_indexer.multisig_members (chain_id, multisig_address);

CREATE TABLE IF NOT EXISTS multisig_indexer.multisig_discovery_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  tx_hash TEXT,
  height BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS multisig_discovery_events_chain_multisig_idx
  ON multisig_indexer.multisig_discovery_events (chain_id, multisig_address, created_at DESC);

CREATE TABLE IF NOT EXISTS multisig_indexer.indexer_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function json(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function text(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

function sanitizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function requireWriteAuth(req) {
  if (!API_KEY) return true;
  const header = req.headers.authorization;
  if (!header) return false;
  return header === `Bearer ${API_KEY}`;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > REQUEST_BODY_LIMIT_BYTES) {
      throw new Error(`Request body exceeded ${REQUEST_BODY_LIMIT_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizePubkeyFingerprint(pubkey) {
  return `sha256:${toHex(sha256(fromBase64(pubkey)))}`;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPositiveInteger(value, fieldName) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function normalizeWeight(value) {
  if (value === undefined || value === null) return 1;
  return asPositiveInteger(value, "member.weight");
}

function normalizeHeight(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function normalizeSource(source) {
  const allowed = new Set([
    "app_import",
    "observed_tx",
    "account_pubkey",
    "contract_query",
    "manual_admin",
  ]);
  if (typeof source !== "string" || !allowed.has(source)) {
    return "app_import";
  }
  return source;
}

function normalizeConfidence(source) {
  switch (source) {
    case "account_pubkey":
    case "contract_query":
      return "confirmed";
    case "observed_tx":
      return "confirmed";
    case "manual_admin":
      return "stale";
    default:
      return "inferred";
  }
}

function normalizeSimplePubkey(value) {
  if (typeof value === "string" && value) {
    return { type: "tendermint/PubKeySecp256k1", value };
  }

  if (!isObject(value)) return null;

  if (typeof value.type === "string" && value.type.includes("Secp256k1") && typeof value.value === "string") {
    return { type: "tendermint/PubKeySecp256k1", value: value.value };
  }

  const typeUrl =
    typeof value["@type"] === "string"
      ? value["@type"]
      : typeof value.typeUrl === "string"
        ? value.typeUrl
        : null;
  const key =
    typeof value.key === "string"
      ? value.key
      : typeof value.value === "string"
        ? value.value
        : null;

  if (typeUrl && typeUrl.toLowerCase().includes("secp256k1") && key) {
    return { type: "tendermint/PubKeySecp256k1", value: key };
  }

  return null;
}

function buildRawMultisigPubkey(input) {
  if (isObject(input.rawMultisigPubkey)) {
    return input.rawMultisigPubkey;
  }

  const members = Array.isArray(input.members) ? input.members : [];
  const simpleMembers = members
    .map((member) => (isObject(member) ? normalizeSimplePubkey(member.pubkey ?? member.rawMemberPubkey) : null))
    .filter(Boolean);

  if (simpleMembers.length !== members.length || simpleMembers.length === 0) {
    return null;
  }

  return createMultisigThresholdPubkey(simpleMembers, asPositiveInteger(input.threshold, "threshold"));
}

function flattenMembers(pubkey, addressPrefix, members, positionCounter) {
  if (isMultisigThresholdPubkey(pubkey)) {
    for (const nested of pubkey.value.pubkeys) {
      flattenMembers(nested, addressPrefix, members, positionCounter);
    }
    return;
  }

  if (!isSecp256k1Pubkey(pubkey)) {
    return;
  }

  const position = positionCounter.value++;
  members.push({
    position,
    weight: 1,
    pubkey: pubkey.value,
    pubkeyFingerprint: normalizePubkeyFingerprint(pubkey.value),
    address: pubkeyToAddress(pubkey, addressPrefix),
    rawMemberPubkey: pubkey,
  });
}

function membersFromAccountPubkey(multisigAddress, pubkey) {
  const addressPrefix = multisigAddress.split("1")[0];
  const members = [];
  flattenMembers(pubkey, addressPrefix, members, { value: 0 });
  return members;
}

function validateImportBody(body) {
  if (!isObject(body)) {
    throw new Error("Expected a JSON object");
  }
  if (typeof body.chainId !== "string" || !body.chainId) {
    throw new Error("chainId is required");
  }
  if (typeof body.multisigAddress !== "string" || !body.multisigAddress) {
    throw new Error("multisigAddress is required");
  }
  if (body.type !== "native_amino" && body.type !== "cw_contract" && body.type !== "unknown") {
    throw new Error('type must be "native_amino", "cw_contract", or "unknown"');
  }
  const threshold = asPositiveInteger(body.threshold, "threshold");
  const members = Array.isArray(body.members) ? body.members : [];
  if (members.length === 0) {
    throw new Error("members must contain at least one member");
  }

  return {
    chainId: body.chainId,
    multisigAddress: body.multisigAddress,
    type: body.type,
    threshold,
    members: members.map((member, index) => {
      if (!isObject(member)) {
        throw new Error(`members[${index}] must be an object`);
      }

      const normalizedPubkey = normalizeSimplePubkey(member.pubkey ?? member.rawMemberPubkey);
      const pubkey = normalizedPubkey?.value;
      const pubkeyFingerprint =
        typeof member.pubkeyFingerprint === "string" && member.pubkeyFingerprint
          ? member.pubkeyFingerprint
          : pubkey
            ? normalizePubkeyFingerprint(pubkey)
            : null;

      return {
        address: typeof member.address === "string" && member.address ? member.address : null,
        pubkey,
        pubkeyFingerprint,
        weight: normalizeWeight(member.weight),
        position:
          typeof member.position === "number" && Number.isInteger(member.position) && member.position >= 0
            ? member.position
            : index,
        rawMemberPubkey: normalizedPubkey ?? member.rawMemberPubkey ?? member.pubkey ?? null,
      };
    }),
    label: typeof body.label === "string" && body.label ? body.label : null,
    description: typeof body.description === "string" && body.description ? body.description : null,
    source: normalizeSource(body.source),
    creator: typeof body.creator === "string" && body.creator ? body.creator : null,
    rawMultisigPubkey: buildRawMultisigPubkey(body),
    firstSeenHeight: normalizeHeight(body.firstSeenHeight),
    lastSeenHeight: normalizeHeight(body.lastSeenHeight),
    lastSeenTxHash: typeof body.lastSeenTxHash === "string" && body.lastSeenTxHash ? body.lastSeenTxHash : null,
  };
}

async function ensureSchema() {
  await pool.query(SCHEMA_SQL);
}

async function upsertMultisig(client, payload, options = {}) {
  const source = normalizeSource(options.source || payload.source);
  const confidence = options.confidence || normalizeConfidence(source);
  const rawMultisigPubkey = options.rawMultisigPubkey || payload.rawMultisigPubkey || null;
  const pubkeyFingerprint =
    typeof payload.pubkeyFingerprint === "string" && payload.pubkeyFingerprint
      ? payload.pubkeyFingerprint
      : null;

  await client.query("BEGIN");
  try {
    await client.query(
      `
      INSERT INTO multisig_indexer.multisigs (
        chain_id,
        multisig_address,
        type,
        threshold,
        pubkey_fingerprint,
        raw_multisig_pubkey,
        label,
        description,
        creator,
        source_first_seen,
        first_seen_height,
        last_seen_height,
        last_seen_tx_hash,
        verification_status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (chain_id, multisig_address)
      DO UPDATE SET
        type = EXCLUDED.type,
        threshold = EXCLUDED.threshold,
        pubkey_fingerprint = COALESCE(EXCLUDED.pubkey_fingerprint, multisig_indexer.multisigs.pubkey_fingerprint),
        raw_multisig_pubkey = COALESCE(EXCLUDED.raw_multisig_pubkey, multisig_indexer.multisigs.raw_multisig_pubkey),
        label = COALESCE(EXCLUDED.label, multisig_indexer.multisigs.label),
        description = COALESCE(EXCLUDED.description, multisig_indexer.multisigs.description),
        creator = COALESCE(EXCLUDED.creator, multisig_indexer.multisigs.creator),
        last_seen_height = COALESCE(EXCLUDED.last_seen_height, multisig_indexer.multisigs.last_seen_height),
        last_seen_tx_hash = COALESCE(EXCLUDED.last_seen_tx_hash, multisig_indexer.multisigs.last_seen_tx_hash),
        verification_status = EXCLUDED.verification_status,
        updated_at = NOW()
      `,
      [
        payload.chainId,
        payload.multisigAddress,
        payload.type,
        payload.threshold,
        pubkeyFingerprint,
        rawMultisigPubkey ? JSON.stringify(rawMultisigPubkey) : null,
        payload.label,
        payload.description,
        payload.creator,
        source,
        payload.firstSeenHeight,
        payload.lastSeenHeight,
        payload.lastSeenTxHash,
        confidence,
      ],
    );

    await client.query(
      `DELETE FROM multisig_indexer.multisig_members WHERE chain_id = $1 AND multisig_address = $2`,
      [payload.chainId, payload.multisigAddress],
    );

    for (const member of payload.members) {
      await client.query(
        `
        INSERT INTO multisig_indexer.multisig_members (
          chain_id,
          multisig_address,
          member_address,
          member_pubkey_fingerprint,
          raw_member_pubkey,
          weight,
          position,
          source,
          confidence,
          first_seen_height,
          last_seen_height
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
        `,
        [
          payload.chainId,
          payload.multisigAddress,
          member.address,
          member.pubkeyFingerprint,
          member.rawMemberPubkey ? JSON.stringify(member.rawMemberPubkey) : null,
          member.weight,
          member.position,
          source,
          confidence,
          payload.firstSeenHeight,
          payload.lastSeenHeight,
        ],
      );
    }

    await client.query(
      `
      INSERT INTO multisig_indexer.multisig_discovery_events (
        chain_id,
        multisig_address,
        event_type,
        source,
        tx_hash,
        height,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        payload.chainId,
        payload.multisigAddress,
        options.eventType || "multisig_imported",
        source,
        payload.lastSeenTxHash,
        payload.lastSeenHeight,
        JSON.stringify({
          threshold: payload.threshold,
          label: payload.label,
          memberCount: payload.members.length,
          confidence,
        }),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function fetchMultisigRowsByWhere(whereSql, values) {
  const multisigsResult = await pool.query(
    `
    SELECT
      m.chain_id,
      m.multisig_address,
      m.type,
      m.threshold,
      m.raw_multisig_pubkey,
      m.label,
      m.description,
      m.creator,
      m.source_first_seen,
      m.first_seen_height,
      m.last_seen_height,
      m.last_seen_tx_hash,
      m.verification_status
    FROM multisig_indexer.multisigs m
    ${whereSql}
    ORDER BY m.last_seen_height DESC NULLS LAST, m.updated_at DESC
    `,
    values,
  );

  if (multisigsResult.rows.length === 0) {
    return [];
  }

  const memberKeys = multisigsResult.rows.map((row, index) => `($1, $${index + 2})`).join(", ");
  const memberValues = [multisigsResult.rows[0].chain_id, ...multisigsResult.rows.map((row) => row.multisig_address)];

  const membersResult = await pool.query(
    `
    SELECT
      chain_id,
      multisig_address,
      member_address,
      member_pubkey_fingerprint,
      raw_member_pubkey,
      weight,
      position,
      source,
      confidence
    FROM multisig_indexer.multisig_members
    WHERE (chain_id, multisig_address) IN (${memberKeys})
    ORDER BY multisig_address, position
    `,
    memberValues,
  );

  const membersByAddress = new Map();
  for (const member of membersResult.rows) {
    const key = `${member.chain_id}:${member.multisig_address}`;
    const existing = membersByAddress.get(key) || [];
    existing.push({
      address: member.member_address,
      pubkeyFingerprint: member.member_pubkey_fingerprint,
      pubkey: member.raw_member_pubkey?.value || member.raw_member_pubkey?.key || null,
      weight: member.weight,
      position: member.position,
      source: member.source,
      confidence: member.confidence,
      rawMemberPubkey: member.raw_member_pubkey,
    });
    membersByAddress.set(key, existing);
  }

  return multisigsResult.rows.map((row) => ({
    chainId: row.chain_id,
    multisigAddress: row.multisig_address,
    address: row.multisig_address,
    type: row.type,
    threshold: row.threshold,
    members: membersByAddress.get(`${row.chain_id}:${row.multisig_address}`) || [],
    source: row.source_first_seen,
    confidence: row.verification_status,
    firstSeenHeight: row.first_seen_height,
    lastSeenHeight: row.last_seen_height,
    lastSeenTxHash: row.last_seen_tx_hash,
    label: row.label,
    name: row.label,
    description: row.description,
    creator: row.creator,
    rawMultisigPubkey: row.raw_multisig_pubkey,
    pubkeyJSON: row.raw_multisig_pubkey ? JSON.stringify(row.raw_multisig_pubkey) : null,
  }));
}

function emitEvent(type, payload) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of eventClients) {
    client.write(frame);
  }
}

async function getChainDirectoryEntries() {
  if (chainDirectoryCache.expiresAt > Date.now()) {
    return chainDirectoryCache.entries;
  }

  const apiBase = `https://api.github.com/repos/${CHAIN_REGISTRY_REPO}/contents`;
  const [mainnetResponse, testnetResponse] = await Promise.all([
    fetch(apiBase, { headers: githubHeaders() }),
    fetch(`${apiBase}/testnets`, { headers: githubHeaders() }),
  ]);

  if (!mainnetResponse.ok || !testnetResponse.ok) {
    throw new Error("Failed to load chain-registry directory listing");
  }

  const [mainnetEntries, testnetEntries] = await Promise.all([
    mainnetResponse.json(),
    testnetResponse.json(),
  ]);

  const entries = [
    ...mainnetEntries
      .filter((entry) => entry.type === "dir" && !entry.path.startsWith(".") && entry.path !== "testnets")
      .map((entry) => ({ path: entry.path })),
    ...testnetEntries
      .filter((entry) => entry.type === "dir" && !entry.path.startsWith("testnets/."))
      .map((entry) => ({ path: entry.path })),
  ];

  chainDirectoryCache = {
    expiresAt: Date.now() + CHAIN_CACHE_TTL_MS,
    entries,
  };

  return entries;
}

async function resolveChainConfig(chainId) {
  const cached = chainConfigCache.get(chainId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const overrides = process.env.MULTISIG_INDEXER_CHAIN_OVERRIDES_JSON
    ? JSON.parse(process.env.MULTISIG_INDEXER_CHAIN_OVERRIDES_JSON)
    : {};
  if (overrides[chainId]) {
    const value = overrides[chainId];
    chainConfigCache.set(chainId, { expiresAt: Date.now() + CHAIN_CACHE_TTL_MS, value });
    return value;
  }

  const entries = await getChainDirectoryEntries();
  const branchBase = `https://cdn.jsdelivr.net/gh/${CHAIN_REGISTRY_REPO}@${CHAIN_REGISTRY_BRANCH}`;

  for (let offset = 0; offset < entries.length; offset += 25) {
    const batch = entries.slice(offset, offset + 25);
    const settled = await Promise.allSettled(
      batch.map((entry) => fetch(`${branchBase}/${entry.path}/chain.json`).then((response) => response.json())),
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      const chain = result.value;
      if (chain?.chain_id !== chainId) continue;

      let rpcEndpoints = Array.isArray(chain.apis?.rpc)
        ? chain.apis.rpc.map((rpc) => rpc.address).filter((address) => address.startsWith("https://"))
        : [];

      if ((chain.chain_name || "").toLowerCase().includes("coreum")) {
        const preferred = chainId.toLowerCase().includes("testnet")
          ? "https://coreum-testnet-rpc.polkachu.com"
          : "https://coreum-rpc.polkachu.com";
        rpcEndpoints = [preferred, ...rpcEndpoints.filter((endpoint) => endpoint !== preferred)];
      }

      const value = {
        chainId,
        addressPrefix: chain.bech32_prefix,
        rpcEndpoints,
      };
      chainConfigCache.set(chainId, { expiresAt: Date.now() + CHAIN_CACHE_TTL_MS, value });
      return value;
    }
  }

  throw new Error(`Could not resolve chain config for ${chainId}`);
}

async function connectChainClient(chainId) {
  const chain = await resolveChainConfig(chainId);
  for (const endpoint of chain.rpcEndpoints) {
    try {
      const client = await StargateClient.connect(endpoint);
      await client.getHeight();
      return { client, chain };
    } catch {}
  }
  throw new Error(`No healthy RPC endpoint found for ${chainId}`);
}

async function refreshMultisigFromChain(chainId, multisigAddress) {
  const { client, chain } = await connectChainClient(chainId);
  try {
    const account = await client.getAccount(multisigAddress);
    if (!account?.pubkey || !isMultisigThresholdPubkey(account.pubkey)) {
      throw new Error(`No multisig account pubkey found on chain for ${multisigAddress}`);
    }

    const members = membersFromAccountPubkey(multisigAddress, account.pubkey);
    const payload = {
      chainId,
      multisigAddress,
      type: "native_amino",
      threshold: Number(account.pubkey.value.threshold),
      members,
      label: null,
      description: null,
      source: "account_pubkey",
      creator: null,
      rawMultisigPubkey: account.pubkey,
      firstSeenHeight: null,
      lastSeenHeight: await client.getHeight(),
      lastSeenTxHash: null,
      pubkeyFingerprint: null,
    };

    const dbClient = await pool.connect();
    try {
      await upsertMultisig(dbClient, payload, {
        source: "account_pubkey",
        confidence: "confirmed",
        rawMultisigPubkey: account.pubkey,
        eventType: "multisig_refreshed",
      });
    } finally {
      dbClient.release();
    }

    emitEvent("multisig:updated", {
      chainId,
      multisigAddress,
      changedMemberAddresses: members.map((member) => member.address).filter(Boolean),
      changedMemberPubkeyFingerprints: members.map((member) => member.pubkeyFingerprint).filter(Boolean),
      source: "account_pubkey",
      height: payload.lastSeenHeight,
      txHash: null,
    });

    return {
      chainId,
      multisigAddress,
      threshold: payload.threshold,
      memberCount: members.length,
      rpcEndpointsTried: chain.rpcEndpoints.length,
    };
  } finally {
    await client.disconnect();
  }
}

async function refreshKnownMultisigs({ chainId = null, limit = REFRESH_BATCH_SIZE } = {}) {
  const result = await pool.query(
    `
    SELECT chain_id, multisig_address
    FROM multisig_indexer.multisigs
    ${chainId ? "WHERE chain_id = $1" : ""}
    ORDER BY updated_at ASC
    LIMIT ${Number(limit)}
    `,
    chainId ? [chainId] : [],
  );

  const refreshed = [];
  const errors = [];
  for (const row of result.rows) {
    try {
      refreshed.push(await refreshMultisigFromChain(row.chain_id, row.multisig_address));
    } catch (error) {
      errors.push({
        chainId: row.chain_id,
        multisigAddress: row.multisig_address,
        error: sanitizeError(error),
      });
    }
  }
  return { refreshed, errors };
}

function startBackgroundRefreshWorker() {
  if (!Number.isFinite(REFRESH_INTERVAL_MS) || REFRESH_INTERVAL_MS <= 0) {
    return;
  }

  backgroundRefreshTimer = setInterval(async () => {
    try {
      const distinctChains = await pool.query(
        `SELECT DISTINCT chain_id FROM multisig_indexer.multisigs ORDER BY chain_id ASC`,
      );
      for (const row of distinctChains.rows) {
        await refreshKnownMultisigs({ chainId: row.chain_id, limit: REFRESH_BATCH_SIZE });
      }
    } catch (error) {
      console.error("[multisig-indexer] background refresh failed:", sanitizeError(error));
    }
  }, REFRESH_INTERVAL_MS);
}

async function handleHealth(_req, res) {
  try {
    if (!schemaReady) {
      json(res, 200, {
        ok: false,
        service: "multisig-indexer",
        database: "initializing",
        error: schemaError,
        time: new Date().toISOString(),
      });
      return;
    }

    await pool.query("SELECT 1");
    json(res, 200, {
      ok: true,
      service: "multisig-indexer",
      database: "up",
      time: new Date().toISOString(),
    });
  } catch (error) {
    json(res, 503, {
      ok: false,
      service: "multisig-indexer",
      database: "down",
      error: sanitizeError(error),
    });
  }
}

async function handleSse(req, res) {
  if (!requireWriteAuth(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  eventClients.add(res);
  req.on("close", () => eventClients.delete(res));
}

async function handleImport(req, res) {
  if (!requireWriteAuth(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const body = validateImportBody(await readJsonBody(req));
  const client = await pool.connect();
  try {
    await upsertMultisig(client, body, {
      source: body.source,
      confidence: normalizeConfidence(body.source),
      rawMultisigPubkey: body.rawMultisigPubkey,
      eventType: "multisig_imported",
    });
  } finally {
    client.release();
  }

  emitEvent("multisig:imported", {
    chainId: body.chainId,
    multisigAddress: body.multisigAddress,
    changedMemberAddresses: body.members.map((member) => member.address).filter(Boolean),
    changedMemberPubkeyFingerprints: body.members.map((member) => member.pubkeyFingerprint).filter(Boolean),
    source: body.source,
    height: body.lastSeenHeight,
    txHash: body.lastSeenTxHash,
  });

  json(res, 200, {
    ok: true,
    chainId: body.chainId,
    multisigAddress: body.multisigAddress,
    memberCount: body.members.length,
    confidence: normalizeConfidence(body.source),
  });
}

async function handleRefresh(req, res) {
  if (!requireWriteAuth(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const body = await readJsonBody(req);
  if (!isObject(body) || typeof body.chainId !== "string" || typeof body.multisigAddress !== "string") {
    json(res, 400, { error: "chainId and multisigAddress are required" });
    return;
  }

  const refreshed = await refreshMultisigFromChain(body.chainId, body.multisigAddress);
  json(res, 200, { ok: true, refreshed });
}

async function handleBackfill(req, res) {
  if (!requireWriteAuth(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const body = await readJsonBody(req);
  const chainId = isObject(body) && typeof body.chainId === "string" ? body.chainId : null;
  const explicitAddresses =
    isObject(body) && Array.isArray(body.multisigAddresses)
      ? body.multisigAddresses.filter((value) => typeof value === "string" && value)
      : [];

  if (explicitAddresses.length > 0 && !chainId) {
    json(res, 400, { error: "chainId is required when multisigAddresses are provided" });
    return;
  }

  if (explicitAddresses.length > 0) {
    const refreshed = [];
    const errors = [];
    for (const multisigAddress of explicitAddresses) {
      try {
        refreshed.push(await refreshMultisigFromChain(chainId, multisigAddress));
      } catch (error) {
        errors.push({ chainId, multisigAddress, error: sanitizeError(error) });
      }
    }
    json(res, 200, { ok: true, refreshed, errors });
    return;
  }

  const result = await refreshKnownMultisigs({
    chainId,
    limit:
      isObject(body) && typeof body.limit === "number" && Number.isInteger(body.limit) && body.limit > 0
        ? body.limit
        : REFRESH_BATCH_SIZE,
  });
  json(res, 200, { ok: true, ...result });
}

async function handleByAddress(_req, res, url, address) {
  const chainId = url.searchParams.get("chain") || url.searchParams.get("chainId");
  if (!chainId) {
    json(res, 400, { error: "chain query parameter is required" });
    return;
  }

  const multisigs = await fetchMultisigRowsByWhere(
    `
    INNER JOIN multisig_indexer.multisig_members mm
      ON mm.chain_id = m.chain_id
      AND mm.multisig_address = m.multisig_address
    WHERE m.chain_id = $1
      AND mm.member_address = $2
    `,
    [chainId, address],
  );

  json(res, 200, {
    chainId,
    query: { address },
    multisigs,
  });
}

async function handleByPubkey(_req, res, url, pubkeyFingerprint) {
  const chainId = url.searchParams.get("chain") || url.searchParams.get("chainId");
  if (!chainId) {
    json(res, 400, { error: "chain query parameter is required" });
    return;
  }

  const multisigs = await fetchMultisigRowsByWhere(
    `
    INNER JOIN multisig_indexer.multisig_members mm
      ON mm.chain_id = m.chain_id
      AND mm.multisig_address = m.multisig_address
    WHERE m.chain_id = $1
      AND mm.member_pubkey_fingerprint = $2
    `,
    [chainId, pubkeyFingerprint],
  );

  json(res, 200, {
    chainId,
    query: { pubkeyFingerprint },
    multisigs,
  });
}

async function handleGetMultisig(_req, res, url, multisigAddress) {
  const chainId = url.searchParams.get("chain") || url.searchParams.get("chainId");
  if (!chainId) {
    json(res, 400, { error: "chain query parameter is required" });
    return;
  }

  const multisigs = await fetchMultisigRowsByWhere(
    `WHERE m.chain_id = $1 AND m.multisig_address = $2`,
    [chainId, multisigAddress],
  );

  if (multisigs.length === 0) {
    json(res, 404, { error: "Multisig not found" });
    return;
  }

  json(res, 200, multisigs[0]);
}

async function handleGetMembers(_req, res, url, multisigAddress) {
  const chainId = url.searchParams.get("chain") || url.searchParams.get("chainId");
  if (!chainId) {
    json(res, 400, { error: "chain query parameter is required" });
    return;
  }

  const multisigs = await fetchMultisigRowsByWhere(
    `WHERE m.chain_id = $1 AND m.multisig_address = $2`,
    [chainId, multisigAddress],
  );

  if (multisigs.length === 0) {
    json(res, 404, { error: "Multisig not found" });
    return;
  }

  json(res, 200, {
    chainId,
    multisigAddress,
    members: multisigs[0].members,
  });
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await handleHealth(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/events") {
      await handleSse(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/multisigs/import") {
      await handleImport(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/multisigs/refresh") {
      await handleRefresh(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/multisigs/backfill") {
      await handleBackfill(req, res);
      return;
    }

    const byAddressMatch = url.pathname.match(/^\/v1\/multisigs\/by-address\/([^/]+)$/);
    if (req.method === "GET" && byAddressMatch) {
      await handleByAddress(req, res, url, decodeURIComponent(byAddressMatch[1]));
      return;
    }

    const byPubkeyMatch = url.pathname.match(/^\/v1\/multisigs\/by-pubkey\/([^/]+)$/);
    if (req.method === "GET" && byPubkeyMatch) {
      await handleByPubkey(req, res, url, decodeURIComponent(byPubkeyMatch[1]));
      return;
    }

    const membersMatch = url.pathname.match(/^\/v1\/multisigs\/([^/]+)\/members$/);
    if (req.method === "GET" && membersMatch) {
      await handleGetMembers(req, res, url, decodeURIComponent(membersMatch[1]));
      return;
    }

    const multisigMatch = url.pathname.match(/^\/v1\/multisigs\/([^/]+)$/);
    if (req.method === "GET" && multisigMatch) {
      await handleGetMultisig(req, res, url, decodeURIComponent(multisigMatch[1]));
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      json(res, 200, {
        ok: true,
        service: "multisig-indexer",
        endpoints: [
          "GET /health",
          "GET /v1/multisigs/by-address/:address",
          "GET /v1/multisigs/by-pubkey/:pubkeyFingerprint",
          "GET /v1/multisigs/:multisigAddress",
          "GET /v1/multisigs/:multisigAddress/members",
          "POST /v1/multisigs/import",
          "POST /v1/multisigs/refresh",
          "POST /v1/multisigs/backfill",
          "GET /v1/events",
        ],
      });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[multisig-indexer] request failed:", error);
    text(res, 500, sanitizeError(error));
  }
}

const server = createServer(route);

async function start() {
  server.listen(PORT, HOST, () => {
    console.log(`[multisig-indexer] listening on http://${HOST}:${PORT}`);
  });

  const initialize = async () => {
    try {
      await ensureSchema();
      schemaReady = true;
      schemaError = null;
      console.log("[multisig-indexer] database schema ready");
      startBackgroundRefreshWorker();
    } catch (error) {
      schemaReady = false;
      schemaError = sanitizeError(error);
      console.error("[multisig-indexer] schema initialization failed:", schemaError);
      setTimeout(initialize, 10000);
    }
  };

  void initialize();
}

process.on("SIGINT", async () => {
  if (backgroundRefreshTimer) clearInterval(backgroundRefreshTimer);
  await pool.end();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
  if (backgroundRefreshTimer) clearInterval(backgroundRefreshTimer);
  await pool.end();
  server.close(() => process.exit(0));
});

start().catch((error) => {
  console.error("[multisig-indexer] failed to start:", error);
  process.exit(1);
});
