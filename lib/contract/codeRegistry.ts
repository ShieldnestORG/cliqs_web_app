/**
 * Contract Code Registry
 *
 * File: lib/contract/codeRegistry.ts
 *
 * Maps chain IDs to known CW3-Fixed, CW3-Flex, and CW4-Group contract
 * code IDs.  Also provides on-chain validation so we can verify a
 * user-provided code ID actually exists and is the expected contract type
 * before attempting instantiation.
 *
 * Sources for well-known code IDs:
 *   • CosmWasm/cw-plus releases — https://github.com/CosmWasm/cw-plus
 *   • Chain-specific registries (Juno, Osmosis, etc.)
 *
 * Users can always override with a custom code ID; the registry merely
 * provides sensible defaults and validation.
 */

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { loadDeploymentLog, DeploymentLogEntry } from "@/lib/deploymentLog";

// ============================================================================
// Types
// ============================================================================

/** Known contract code IDs for a given chain */
export interface ChainCodeIds {
  /** CW3-Fixed multisig code ID */
  cw3Fixed?: number;
  /** CW3-Flex multisig code ID */
  cw3Flex?: number;
  /** CW4-Group code ID */
  cw4Group?: number;
  /** Human-readable label for this config (e.g. "cw-plus v0.16") */
  source?: string;
}

/**
 * Chain-specific deployment constraints.
 *
 * Different chains run different wasmd versions, impose different WASM
 * size limits, and may require specific gas parameters.  These constraints
 * are surfaced in the UI so users know what to expect during deployment.
 */
export interface ChainDeploymentConstraints {
  /** The wasmd module version running on-chain (e.g. "v0.54.0") */
  wasmdVersion?: string;
  /** Maximum WASM bytecode size in KB (e.g. 800 for Coreum) */
  wasmSizeLimitKB?: number;
  /** Whether the chain supports bulk-memory WASM opcodes */
  supportsBulkMemory?: boolean;
  /** Recommended gas adjustment multiplier for contract instantiation */
  gasAdjustment?: number;
  /** Whether contract upload is permissioned (governance-gated) */
  permissionedUpload?: boolean;
  /** Whether an admin address is required during instantiation */
  requiresAdmin?: boolean;
  /** Recommended Docker optimizer image for compiling contracts for this chain */
  optimizerImage?: string;
  /** Maximum supported Rust toolchain version (e.g. "1.81" for non-bulk-memory chains) */
  maxRustVersion?: string;
  /** User-facing notes/warnings about deploying on this chain */
  notes?: string[];
}

/** Validated code info returned from on-chain query */
export interface ValidatedCodeInfo {
  codeId: number;
  creator: string;
  /** SHA-256 checksum of the stored Wasm bytecode */
  checksum: string;
  /** Whether the code ID exists on-chain */
  exists: boolean;
  /** Best-guess contract type based on post-instantiation probing */
  detectedType?: "cw3-fixed" | "cw3-flex" | "cw4-group" | "unknown";
  error?: string;
}

/** Suggestion entry surfaced to the form UI */
export interface CodeIdSuggestion {
  codeId: number;
  label: string;
  source: "registry" | "devtools" | "user";
}

// ============================================================================
// Well-known code IDs per chain
//
// These are populated from the canonical cw-plus releases deployed to
// major chains.  They will drift as new versions are uploaded — keep
// this table up-to-date when a new cw-plus release is cut or when a
// chain performs a code-ID migration.
//
// Chains not listed here will fall back to DevTools history or manual entry.
// ============================================================================

const WELL_KNOWN_CODE_IDS: Record<string, ChainCodeIds> = {
  // ── Juno mainnet ────────────────────────────────────────────────────
  "juno-1": {
    cw3Fixed: 82,
    cw3Flex: 83,
    cw4Group: 84,
    source: "cw-plus v0.16 (Juno mainnet)",
  },

  // ── Juno testnet (uni-6) ───────────────────────────────────────────
  "uni-6": {
    cw3Fixed: 171,
    cw3Flex: 172,
    cw4Group: 173,
    source: "cw-plus v0.16 (Juno testnet uni-6)",
  },

  // ── Osmosis mainnet ────────────────────────────────────────────────
  "osmosis-1": {
    cw3Fixed: 54,
    cw3Flex: 55,
    cw4Group: 56,
    source: "cw-plus (Osmosis mainnet)",
  },

  // ── Neutron mainnet ────────────────────────────────────────────────
  "neutron-1": {
    cw3Fixed: 53,
    cw3Flex: 54,
    cw4Group: 55,
    source: "cw-plus (Neutron mainnet)",
  },

  // ── Stargaze mainnet ───────────────────────────────────────────────
  "stargaze-1": {
    cw3Fixed: 38,
    cw3Flex: 39,
    cw4Group: 40,
    source: "cw-plus (Stargaze mainnet)",
  },

  // ── Terra 2 mainnet ────────────────────────────────────────────────
  "phoenix-1": {
    cw3Fixed: 91,
    cw3Flex: 92,
    cw4Group: 93,
    source: "cw-plus (Terra 2 mainnet)",
  },

  // ── Injective mainnet ──────────────────────────────────────────────
  "injective-1": {
    cw3Fixed: 67,
    cw3Flex: 68,
    cw4Group: 69,
    source: "cw-plus (Injective mainnet)",
  },

  // ── Archway mainnet ────────────────────────────────────────────────
  "archway-1": {
    cw3Fixed: 30,
    cw3Flex: 31,
    cw4Group: 32,
    source: "cw-plus (Archway mainnet)",
  },

  // ── Migaloo mainnet ────────────────────────────────────────────────
  "migaloo-1": {
    cw3Fixed: 25,
    cw3Flex: 26,
    cw4Group: 27,
    source: "cw-plus (Migaloo mainnet)",
  },

  // ── Coreum mainnet ──────────────────────────────────────────────────
  "coreum-mainnet-1": {
    source: "Coreum mainnet (user-deployed)",
  },

  // ── Coreum testnet ──────────────────────────────────────────────────
  "coreum-testnet-1": {
    source: "Coreum testnet (user-deployed)",
  },
};

// ============================================================================
// Chain-specific deployment constraints
//
// Maps chain IDs to deployment-time constraints that affect how contracts
// must be compiled, uploaded, and instantiated. Used by the UI to surface
// chain-specific warnings and by the instantiation flow to adjust gas.
// ============================================================================

const CHAIN_DEPLOYMENT_CONSTRAINTS: Record<string, ChainDeploymentConstraints> = {
  // ── Coreum mainnet ──────────────────────────────────────────────────
  "coreum-mainnet-1": {
    wasmdVersion: "v0.54.0",
    wasmSizeLimitKB: 800,
    supportsBulkMemory: false,
    gasAdjustment: 1.3,
    permissionedUpload: false,
    optimizerImage: "cosmwasm/optimizer:0.16.1",
    maxRustVersion: "1.81",
    notes: [
      "Coreum does not support bulk-memory WASM opcodes — contracts must be compiled with Rust <= 1.81 or the Docker optimizer",
      "WASM bytecode must be under 800KB after optimization",
      "Use cosmwasm/optimizer:0.16.1 for production builds (includes wasm-opt)",
    ],
  },

  // ── Coreum testnet ──────────────────────────────────────────────────
  "coreum-testnet-1": {
    wasmdVersion: "v0.54.0",
    wasmSizeLimitKB: 800,
    supportsBulkMemory: false,
    gasAdjustment: 1.3,
    permissionedUpload: false,
    optimizerImage: "cosmwasm/optimizer:0.16.1",
    maxRustVersion: "1.81",
    notes: [
      "Coreum testnet mirrors mainnet constraints: no bulk-memory, 800KB WASM limit",
      "Use cosmwasm/optimizer:0.16.1 for production builds",
    ],
  },

  // ── Juno mainnet ────────────────────────────────────────────────────
  "juno-1": {
    wasmdVersion: "v0.50.0",
    wasmSizeLimitKB: 1200,
    supportsBulkMemory: true,
    gasAdjustment: 1.3,
    permissionedUpload: false,
  },

  // ── Osmosis mainnet ────────────────────────────────────────────────
  "osmosis-1": {
    wasmdVersion: "v0.50.0",
    wasmSizeLimitKB: 1200,
    supportsBulkMemory: true,
    gasAdjustment: 1.4,
    permissionedUpload: true,
    notes: [
      "Contract code upload on Osmosis requires governance approval",
    ],
  },

  // ── Neutron mainnet ────────────────────────────────────────────────
  "neutron-1": {
    wasmdVersion: "v0.51.0",
    wasmSizeLimitKB: 1200,
    supportsBulkMemory: true,
    gasAdjustment: 1.3,
    permissionedUpload: false,
  },

  // ── Injective mainnet ──────────────────────────────────────────────
  "injective-1": {
    wasmdVersion: "v0.50.0",
    wasmSizeLimitKB: 800,
    supportsBulkMemory: true,
    gasAdjustment: 1.5,
    permissionedUpload: true,
    notes: [
      "Contract code upload on Injective may require governance approval",
      "Higher gas adjustment recommended due to gas estimation variability",
    ],
  },

  // ── Terra 2 mainnet ────────────────────────────────────────────────
  "phoenix-1": {
    wasmdVersion: "v0.50.0",
    wasmSizeLimitKB: 1200,
    supportsBulkMemory: true,
    gasAdjustment: 1.4,
    permissionedUpload: false,
  },
};

// ============================================================================
// Local user overrides
// ============================================================================

const USER_CODE_IDS_STORAGE_KEY = "cosmos-multisig-user-code-ids";

interface UserCodeIdStore {
  [chainId: string]: ChainCodeIds;
}

function loadUserCodeIds(): UserCodeIdStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(USER_CODE_IDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserCodeIdStore) : {};
  } catch {
    return {};
  }
}

export function saveUserCodeIds(chainId: string, codeIds: ChainCodeIds): void {
  if (typeof window === "undefined") return;
  const store = loadUserCodeIds();
  store[chainId] = { ...store[chainId], ...codeIds };
  localStorage.setItem(USER_CODE_IDS_STORAGE_KEY, JSON.stringify(store));
}

// ============================================================================
// Live chain constraint queries
//
// Queries the chain's actual wasm module params and node info to get
// real-time constraints rather than relying solely on a static table.
// Results are cached in-memory for the session and in localStorage
// for persistence across page loads.
// ============================================================================

/** In-memory cache: chainId → constraints (populated on first query) */
const liveConstraintsCache: Record<string, ChainDeploymentConstraints> = {};

/** localStorage key for persisting queried constraints */
const CHAIN_CONSTRAINTS_CACHE_KEY = "cosmos-multisig-chain-constraints";

/** How long cached constraints are valid (24 hours) */
const CONSTRAINTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedConstraintEntry {
  constraints: ChainDeploymentConstraints;
  fetchedAt: number;
}

function loadCachedConstraints(): Record<string, CachedConstraintEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAIN_CONSTRAINTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCachedConstraints(chainId: string, constraints: ChainDeploymentConstraints): void {
  if (typeof window === "undefined") return;
  try {
    const store = loadCachedConstraints();
    store[chainId] = { constraints, fetchedAt: Date.now() };
    localStorage.setItem(CHAIN_CONSTRAINTS_CACHE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

/**
 * Parse the code upload access permission from the wasm params response.
 * `permission` field can be "Everybody", "Nobody", or "AnyOfAddresses".
 */
function isPermissionedUpload(accessType: string | number | undefined): boolean {
  if (!accessType) return false;
  const normalized = String(accessType).toLowerCase();
  return normalized !== "everybody" && normalized !== "1" && normalized !== "access_type_everybody";
}

/**
 * Query the chain's REST/LCD endpoint for wasm module params.
 *
 * Endpoint: GET /cosmwasm/wasm/v1/codes/params
 *
 * Response shape:
 * {
 *   "params": {
 *     "code_upload_access": { "permission": "Everybody" | "Nobody" | "AnyOfAddresses", "addresses": [] },
 *     "instantiate_default_permission": "Everybody" | "Nobody" | ...,
 *     "max_wasm_code_size": "1228800"   // string, bytes
 *   }
 * }
 */
async function queryWasmParams(restEndpoint: string): Promise<{
  maxWasmCodeSizeBytes?: number;
  uploadPermission?: string;
  instantiatePermission?: string;
} | null> {
  try {
    const res = await fetch(`${restEndpoint}/cosmwasm/wasm/v1/codes/params`);
    if (!res.ok) return null;
    const data = await res.json();
    const params = data?.params;
    if (!params) return null;

    return {
      maxWasmCodeSizeBytes: params.max_wasm_code_size
        ? Number(params.max_wasm_code_size)
        : undefined,
      uploadPermission: params.code_upload_access?.permission,
      instantiatePermission: params.instantiate_default_permission,
    };
  } catch {
    return null;
  }
}

/**
 * Query the chain's node info to extract application version.
 *
 * Endpoint: GET /cosmos/base/tendermint/v1beta1/node_info
 *
 * We look for "wasmd" or "cosmwasm" in the app version string.
 */
async function queryNodeInfo(restEndpoint: string): Promise<{
  appVersion?: string;
  cosmosSdkVersion?: string;
  wasmVersion?: string;
} | null> {
  try {
    const res = await fetch(`${restEndpoint}/cosmos/base/tendermint/v1beta1/node_info`);
    if (!res.ok) return null;
    const data = await res.json();

    const appVersion = data?.application_version?.version ||
                       data?.application_version?.app_version;
    const cosmosSdkVersion = data?.application_version?.cosmos_sdk_version;

    // Try to extract wasmd version from build_deps or name
    let wasmVersion: string | undefined;
    const buildDeps: string[] = data?.application_version?.build_deps || [];
    for (const dep of buildDeps) {
      const depStr = typeof dep === "string" ? dep : (dep as { key?: string })?.key || "";
      if (depStr.includes("wasmd") || depStr.includes("cosmwasm")) {
        const match = depStr.match(/v?(\d+\.\d+\.\d+)/);
        if (match) {
          wasmVersion = `v${match[1]}`;
          break;
        }
      }
    }

    return { appVersion, cosmosSdkVersion, wasmVersion };
  } catch {
    return null;
  }
}

/**
 * Derive an LCD/REST endpoint from an RPC endpoint.
 * Many nodes serve REST on port 1317 when RPC is on 26657,
 * but we also try the RPC endpoint itself since many providers
 * serve both on the same port.
 */
function deriveRestEndpoints(rpcEndpoint: string): string[] {
  const endpoints = [rpcEndpoint];
  try {
    const url = new URL(rpcEndpoint);
    // If port is 26657, also try 1317 (standard LCD port)
    if (url.port === "26657") {
      url.port = "1317";
      endpoints.push(url.toString().replace(/\/$/, ""));
    }
    // Also try without explicit port (many providers serve REST on same URL)
    if (url.port) {
      const noPort = new URL(rpcEndpoint);
      noPort.port = "";
      endpoints.push(noPort.toString().replace(/\/$/, ""));
    }
  } catch {
    // Invalid URL, just use as-is
  }
  return endpoints;
}

/**
 * Query live chain constraints by hitting the chain's REST endpoints.
 * Tries multiple endpoint variants and caches the result.
 */
export async function queryChainConstraints(
  nodeAddress: string,
  chainId: string,
): Promise<ChainDeploymentConstraints> {
  // Check in-memory cache first
  if (liveConstraintsCache[chainId]) {
    return liveConstraintsCache[chainId];
  }

  // Check localStorage cache
  const cachedStore = loadCachedConstraints();
  const cached = cachedStore[chainId];
  if (cached && (Date.now() - cached.fetchedAt) < CONSTRAINTS_CACHE_TTL_MS) {
    liveConstraintsCache[chainId] = cached.constraints;
    return cached.constraints;
  }

  // Query live
  const restEndpoints = deriveRestEndpoints(nodeAddress);
  let wasmParams: Awaited<ReturnType<typeof queryWasmParams>> = null;
  let nodeInfo: Awaited<ReturnType<typeof queryNodeInfo>> = null;

  for (const endpoint of restEndpoints) {
    if (!wasmParams) {
      wasmParams = await queryWasmParams(endpoint);
    }
    if (!nodeInfo) {
      nodeInfo = await queryNodeInfo(endpoint);
    }
    if (wasmParams && nodeInfo) break;
  }

  // Build constraints from live data
  const live: ChainDeploymentConstraints = {};

  if (wasmParams) {
    if (wasmParams.maxWasmCodeSizeBytes) {
      live.wasmSizeLimitKB = Math.floor(wasmParams.maxWasmCodeSizeBytes / 1024);
    }
    if (wasmParams.uploadPermission) {
      live.permissionedUpload = isPermissionedUpload(wasmParams.uploadPermission);
    }
  }

  if (nodeInfo?.wasmVersion) {
    live.wasmdVersion = nodeInfo.wasmVersion;
  }

  // Merge with static fallback (static provides notes, gasAdjustment, bulk-memory info, optimizer hints)
  const staticConstraints = CHAIN_DEPLOYMENT_CONSTRAINTS[chainId] || {};
  const merged: ChainDeploymentConstraints = {
    ...staticConstraints,
    ...live,
    // Notes come from static only — live can't know about build toolchain advice
    notes: staticConstraints.notes || [],
  };

  // Build dynamic notes from live data if static had none
  if ((!merged.notes || merged.notes.length === 0) && (wasmParams || nodeInfo)) {
    const dynamicNotes: string[] = [];
    if (merged.wasmSizeLimitKB) {
      dynamicNotes.push(`WASM bytecode size limit: ${merged.wasmSizeLimitKB}KB`);
    }
    if (merged.permissionedUpload) {
      dynamicNotes.push("Contract code upload is permissioned — may require governance approval");
    }
    if (merged.wasmdVersion) {
      dynamicNotes.push(`Running wasmd ${merged.wasmdVersion}`);
    }
    if (dynamicNotes.length > 0) {
      merged.notes = dynamicNotes;
    }
  }

  // Cache results
  liveConstraintsCache[chainId] = merged;
  saveCachedConstraints(chainId, merged);

  return merged;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get deployment constraints for a chain (synchronous — static + cached only).
 *
 * For the freshest data, use `queryChainConstraints()` which hits the chain's
 * REST endpoint. This synchronous version returns cached live results if available,
 * otherwise falls back to the static table.
 */
export function getChainConstraints(chainId: string): ChainDeploymentConstraints | undefined {
  // Prefer cached live results, fall back to static
  if (liveConstraintsCache[chainId]) {
    return liveConstraintsCache[chainId];
  }

  // Check localStorage cache
  const cachedStore = loadCachedConstraints();
  const cached = cachedStore[chainId];
  if (cached && (Date.now() - cached.fetchedAt) < CONSTRAINTS_CACHE_TTL_MS) {
    liveConstraintsCache[chainId] = cached.constraints;
    return cached.constraints;
  }

  // Fall back to static table
  return CHAIN_DEPLOYMENT_CONSTRAINTS[chainId];
}

/**
 * Get the recommended gas adjustment for a chain, falling back to default.
 * Checks live cache → static table → fallback value.
 */
export function getGasAdjustment(chainId: string, fallback = 1.3): number {
  const constraints = getChainConstraints(chainId);
  return constraints?.gasAdjustment ?? fallback;
}

/**
 * Get code IDs for a chain, merging well-known defaults → user overrides.
 * Returns undefined for chains we don't have any data about.
 */
export function getCodeIdsForChain(chainId: string): ChainCodeIds | undefined {
  const wellKnown = WELL_KNOWN_CODE_IDS[chainId];
  const userOverrides = loadUserCodeIds()[chainId];

  if (!wellKnown && !userOverrides) return undefined;

  return {
    ...wellKnown,
    ...userOverrides,
  };
}

/**
 * Return whether we have well-known code IDs for this chain.
 */
export function hasRegistryForChain(chainId: string): boolean {
  return chainId in WELL_KNOWN_CODE_IDS;
}

/**
 * Build a list of code ID suggestions for a given contract type,
 * combining: registry → DevTools uploads → user overrides.
 */
export function getCodeIdSuggestions(
  chainId: string,
  contractType: "cw3-fixed" | "cw3-flex" | "cw4-group",
): CodeIdSuggestion[] {
  const suggestions: CodeIdSuggestion[] = [];
  const seen = new Set<number>();

  // 1. Well-known registry
  const wellKnown = WELL_KNOWN_CODE_IDS[chainId];
  if (wellKnown) {
    const id = contractType === "cw3-fixed" ? wellKnown.cw3Fixed
      : contractType === "cw3-flex" ? wellKnown.cw3Flex
      : wellKnown.cw4Group;

    if (id && !seen.has(id)) {
      seen.add(id);
      suggestions.push({
        codeId: id,
        label: `${wellKnown.source || "Registry"}`,
        source: "registry",
      });
    }
  }

  // 2. User overrides
  const userOverrides = loadUserCodeIds()[chainId];
  if (userOverrides) {
    const id = contractType === "cw3-fixed" ? userOverrides.cw3Fixed
      : contractType === "cw3-flex" ? userOverrides.cw3Flex
      : userOverrides.cw4Group;

    if (id && !seen.has(id)) {
      seen.add(id);
      suggestions.push({
        codeId: id,
        label: "User saved",
        source: "user",
      });
    }
  }

  // 3. DevTools deployment log (match by chainId + contract type hint)
  const devLog = loadDeploymentLog();
  const typeLabels: Record<string, string[]> = {
    "cw3-fixed": ["cw3", "cw3-fixed", "cw3_fixed", "multisig"],
    "cw3-flex": ["cw3-flex", "cw3_flex", "flex"],
    "cw4-group": ["cw4", "cw4-group", "cw4_group", "group"],
  };
  const matchLabels = typeLabels[contractType] || [];

  const devEntries = devLog.filter(
    (e: DeploymentLogEntry) =>
      e.chainId === chainId &&
      e.stage === "upload" &&
      e.codeId &&
      e.codeId > 0 &&
      (matchLabels.some(
        (lbl) =>
          (e.contractType || "").toLowerCase().includes(lbl) ||
          (e.label || "").toLowerCase().includes(lbl),
      )),
  );

  for (const entry of devEntries) {
    if (entry.codeId && !seen.has(entry.codeId)) {
      seen.add(entry.codeId);
      suggestions.push({
        codeId: entry.codeId,
        label: `DevTools upload${entry.label ? `: ${entry.label}` : ""}`,
        source: "devtools",
      });
    }
  }

  return suggestions;
}

// ============================================================================
// On-chain validation
// ============================================================================

/**
 * Validate that a code ID exists on-chain and optionally probe
 * whether it matches the expected contract type.
 *
 * This performs a lightweight `getCodeDetails()` query. If the code ID
 * does not exist, we return `exists: false` with an error message.
 */
export async function validateCodeId(
  nodeAddress: string,
  codeId: number,
): Promise<ValidatedCodeInfo> {
  try {
    const client = await CosmWasmClient.connect(nodeAddress);
    const codeDetails = await client.getCodeDetails(codeId);

    return {
      codeId,
      creator: codeDetails.creator,
      checksum: codeDetails.checksum
        ? typeof codeDetails.checksum === "string"
          ? codeDetails.checksum
          : Buffer.from(codeDetails.checksum).toString("hex")
        : "",
      exists: true,
    };
  } catch (error) {
    return {
      codeId,
      creator: "",
      checksum: "",
      exists: false,
      error:
        error instanceof Error
          ? error.message
          : `Code ID ${codeId} not found on chain`,
    };
  }
}

/**
 * Validate a code ID and attempt to detect if it's a CW3 or CW4 contract
 * by instantiating a dry-run query against existing instances (if any).
 */
export async function validateAndDetectType(
  nodeAddress: string,
  codeId: number,
): Promise<ValidatedCodeInfo> {
  const base = await validateCodeId(nodeAddress, codeId);
  if (!base.exists) return base;

  try {
    const client = await CosmWasmClient.connect(nodeAddress);

    // Look for existing contracts from this code ID
    const contracts = await client.getContracts(codeId);
    if (contracts.length === 0) {
      return { ...base, detectedType: "unknown" };
    }

    const sampleAddress = contracts[0];

    // Try CW3 threshold query (works for both fixed and flex)
    try {
      const threshold = await client.queryContractSmart(sampleAddress, { threshold: {} });
      if (threshold) {
        // Distinguish fixed vs flex: flex has group_addr in config
        try {
          const config = await client.queryContractSmart(sampleAddress, { config: {} });
          if (config && "group_addr" in config) {
            return { ...base, detectedType: "cw3-flex" };
          }
        } catch {
          // config query failed — likely CW3-Fixed (no config query)
        }
        return { ...base, detectedType: "cw3-fixed" };
      }
    } catch {
      // Not a CW3 contract
    }

    // Try CW4 total_weight query
    try {
      const weight = await client.queryContractSmart(sampleAddress, { total_weight: {} });
      if (weight && "weight" in weight) {
        return { ...base, detectedType: "cw4-group" };
      }
    } catch {
      // Not a CW4 contract
    }

    return { ...base, detectedType: "unknown" };
  } catch {
    return { ...base, detectedType: "unknown" };
  }
}
