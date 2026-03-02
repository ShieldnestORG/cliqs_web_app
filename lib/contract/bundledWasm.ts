/**
 * Bundled WASM Loader
 *
 * File: lib/contract/bundledWasm.ts
 *
 * Loads pre-compiled CW3/CW4 WASM binaries bundled in /public/wasm/.
 * These are the optimized builds from the CosmWasm/cw-plus releases,
 * compiled with cosmwasm/optimizer so they're small enough for any chain.
 *
 * Users can either use these bundled binaries (default) or upload their
 * own custom .wasm file for advanced use cases.
 */

export type BundledContractType = "cw3-fixed" | "cw3-flex" | "cw4-group";

interface BundledContractInfo {
  path: string;
  label: string;
  expectedSizeRange: [number, number]; // [min, max] in bytes
}

const BUNDLED_CONTRACTS: Record<BundledContractType, BundledContractInfo> = {
  "cw3-fixed": {
    path: "/wasm/cw3_fixed_multisig.wasm",
    label: "CW3 Fixed Multisig (cw-plus v0.16)",
    expectedSizeRange: [200_000, 400_000],
  },
  "cw3-flex": {
    path: "/wasm/cw3_flex_multisig.wasm",
    label: "CW3 Flex Multisig (cw-plus v0.16)",
    expectedSizeRange: [250_000, 450_000],
  },
  "cw4-group": {
    path: "/wasm/cw4_group.wasm",
    label: "CW4 Group (cw-plus v0.16)",
    expectedSizeRange: [150_000, 300_000],
  },
};

const wasmCache = new Map<BundledContractType, Uint8Array>();

/**
 * Load a bundled WASM binary from /public/wasm/.
 * Results are cached in memory after first load.
 */
export async function loadBundledWasm(contractType: BundledContractType): Promise<Uint8Array> {
  const cached = wasmCache.get(contractType);
  if (cached) return cached;

  const info = BUNDLED_CONTRACTS[contractType];
  if (!info) {
    throw new Error(`Unknown bundled contract type: ${contractType}`);
  }

  const response = await fetch(info.path);
  if (!response.ok) {
    throw new Error(
      `Failed to load bundled WASM for ${contractType}: ${response.status} ${response.statusText}. ` +
        `Run "scripts/download-wasm.sh" to download the binaries.`,
    );
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const [minSize, maxSize] = info.expectedSizeRange;
  if (bytes.length < minSize || bytes.length > maxSize) {
    console.warn(
      `[bundledWasm] ${contractType} size ${bytes.length} bytes is outside expected range ` +
        `[${minSize}, ${maxSize}]. The file may be corrupted or a different version.`,
    );
  }

  wasmCache.set(contractType, bytes);
  return bytes;
}

/**
 * Get metadata about a bundled contract without loading the binary.
 */
export function getBundledContractInfo(contractType: BundledContractType): BundledContractInfo {
  return BUNDLED_CONTRACTS[contractType];
}

/**
 * Check if bundled WASM binaries are available (HEAD request).
 */
export async function checkBundledWasmAvailable(
  contractType: BundledContractType,
): Promise<boolean> {
  try {
    const info = BUNDLED_CONTRACTS[contractType];
    const response = await fetch(info.path, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the size of a bundled WASM binary in a human-readable format.
 */
export function formatWasmSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// Manifest
// ============================================================================

export interface WasmManifest {
  version: number;
  generatedAt: string;
  cwPlusVersion: string;
  optimizerImage: string;
  buildMethod: string;
  allCoreumSafe: boolean;
  contracts: Record<
    string,
    {
      file: string;
      sizeBytes: number;
      sha256: string;
      hasBulkMemory: boolean;
      coreumSafe: boolean;
      bulkMemoryOpcodes?: Array<{ name: string; count: number }>;
    }
  >;
}

const MANIFEST_CONTRACT_KEYS: Record<BundledContractType, string> = {
  "cw3-fixed": "cw3_fixed_multisig",
  "cw3-flex": "cw3_flex_multisig",
  "cw4-group": "cw4_group",
};

let manifestCache: WasmManifest | null = null;

/**
 * Load the WASM manifest from /public/wasm/manifest.json.
 * Returns null if the manifest can't be loaded.
 */
export async function loadWasmManifest(): Promise<WasmManifest | null> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch("/wasm/manifest.json");
    if (!res.ok) return null;
    manifestCache = await res.json();
    return manifestCache;
  } catch {
    return null;
  }
}

/**
 * Check if a bundled contract is safe for a specific chain scenario.
 * Uses the manifest (no binary download needed).
 */
export async function isBundledWasmCoreumSafe(contractType: BundledContractType): Promise<boolean> {
  const manifest = await loadWasmManifest();
  if (!manifest) return false;
  const key = MANIFEST_CONTRACT_KEYS[contractType];
  return manifest.contracts[key]?.coreumSafe ?? false;
}
