import { ChainInfo } from "@/context/ChainsContext/types";
import { DbMultisig } from "@/graphql";
import { sha256 } from "@cosmjs/crypto";
import { fromBase64, fromBech32, toHex } from "@cosmjs/encoding";
import {
  createMultisigThresholdPubkey,
  isMultisigThresholdPubkey,
  isSecp256k1Pubkey,
  type Pubkey,
  pubkeyToAddress,
} from "@cosmjs/amino";
import { normalizePubkey } from "./multisigAmino";

type MultisigIndexerImportSource =
  | "app_import"
  | "observed_tx"
  | "account_pubkey"
  | "contract_query"
  | "manual_admin";

type DiscoveryContext = {
  readonly chain: ChainInfo;
  readonly address: string;
  readonly pubkey: string;
};

type MultisigIndexerMember = {
  readonly address?: string;
  readonly pubkey?: string;
  readonly pubkeyFingerprint?: string;
  readonly weight: number;
  readonly position: number;
};

type MultisigIndexerImportPayload = {
  readonly chainId: string;
  readonly multisigAddress: string;
  readonly type: "native_amino";
  readonly threshold: number;
  readonly members: readonly MultisigIndexerMember[];
  readonly label?: string;
  readonly description?: string;
  readonly source: MultisigIndexerImportSource;
  readonly creator?: string;
  readonly rawMultisigPubkey: unknown;
};

type MultisigIndexerSyncOptions = {
  readonly source?: MultisigIndexerImportSource;
};

type MultisigIndexerSyncInput = {
  readonly chainId: string;
  readonly address: string;
  readonly pubkeyJSON: string;
  readonly name?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly creator?: string | null | undefined;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_BY_ADDRESS_PATH = "/v1/multisigs/by-address/:address";
const DEFAULT_BY_PUBKEY_PATH = "/v1/multisigs/by-pubkey/:pubkeyFingerprint";
const DEFAULT_IMPORT_PATH = "/v1/multisigs/import";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAminoPubkey = (value: unknown): value is Pubkey =>
  isRecord(value) && typeof value.type === "string" && "value" in value;

function getIndexerConfig() {
  const baseUrl = process.env.MULTISIG_INDEXER_URL?.trim();
  const timeoutMs = Number.parseInt(
    process.env.MULTISIG_INDEXER_TIMEOUT_MS?.trim() || String(DEFAULT_TIMEOUT_MS),
    10,
  );

  return {
    baseUrl,
    apiKey: process.env.MULTISIG_INDEXER_API_KEY?.trim(),
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    byAddressPath:
      process.env.MULTISIG_INDEXER_BY_ADDRESS_PATH?.trim() || DEFAULT_BY_ADDRESS_PATH,
    byPubkeyPath:
      process.env.MULTISIG_INDEXER_BY_PUBKEY_PATH?.trim() || DEFAULT_BY_PUBKEY_PATH,
    importPath: process.env.MULTISIG_INDEXER_IMPORT_PATH?.trim() || DEFAULT_IMPORT_PATH,
    legacyMembershipPath: process.env.MULTISIG_INDEXER_MEMBERSHIP_PATH?.trim(),
  };
}

export function isMultisigIndexerConfigured(): boolean {
  return Boolean(getIndexerConfig().baseUrl);
}

export function getPubkeyFingerprint(pubkey: string): string {
  const normalized = fromBase64(pubkey);
  return `sha256:${toHex(sha256(normalized))}`;
}

function buildIndexerHeaders(): Record<string, string> {
  const { apiKey } = getIndexerConfig();
  if (!apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

function buildIndexerUrl(
  pathTemplate: string,
  replacements: Record<string, string>,
  query: Record<string, string | undefined>,
): URL {
  const { baseUrl } = getIndexerConfig();
  if (!baseUrl) {
    throw new Error("MULTISIG_INDEXER_URL is not configured");
  }

  let resolvedPath = pathTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    resolvedPath = resolvedPath.replace(`:${key}`, encodeURIComponent(value));
  }

  const url = new URL(resolvedPath, baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function fetchIndexerJson(url: URL, init?: RequestInit): Promise<unknown> {
  const { timeoutMs } = getIndexerConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      ...init,
      signal: controller.signal,
      headers: {
        ...buildIndexerHeaders(),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Indexer responded with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function coerceThreshold(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function toSimpleSecp256k1Pubkey(
  value: unknown,
): { readonly type: "tendermint/PubKeySecp256k1"; readonly value: string } | null {
  if (typeof value === "string" && value) {
    return { type: "tendermint/PubKeySecp256k1", value };
  }

  if (!isRecord(value)) return null;

  const aminoType = typeof value.type === "string" ? value.type : null;
  const aminoValue = typeof value.value === "string" ? value.value : null;
  if (aminoType?.includes("Secp256k1") && aminoValue) {
    return { type: "tendermint/PubKeySecp256k1", value: aminoValue };
  }

  const protoType =
    typeof value["@type"] === "string"
      ? value["@type"]
      : typeof value.typeUrl === "string"
        ? value.typeUrl
        : null;
  const protoValue =
    typeof value.key === "string"
      ? value.key
      : typeof value.value === "string"
        ? value.value
        : null;

  if (protoType?.toLowerCase().includes("secp256k1") && protoValue) {
    return { type: "tendermint/PubKeySecp256k1", value: protoValue };
  }

  return null;
}

function tryBuildMultisigPubkey(value: unknown): string | null {
  const candidate = typeof value === "string" ? safeJsonParse(value) : value;
  if (!isRecord(candidate)) return null;

  if (isAminoPubkey(candidate) && isMultisigThresholdPubkey(candidate)) {
    return JSON.stringify(normalizePubkey(candidate));
  }

  const nestedValue = isRecord(candidate.value) ? candidate.value : candidate;
  const threshold = coerceThreshold(
    nestedValue.threshold ?? candidate.threshold,
  );
  const rawMembers =
    Array.isArray(nestedValue.pubkeys)
      ? nestedValue.pubkeys
      : Array.isArray(candidate.pubkeys)
        ? candidate.pubkeys
        : Array.isArray(nestedValue.public_keys)
          ? nestedValue.public_keys
          : Array.isArray(candidate.public_keys)
            ? candidate.public_keys
            : Array.isArray(candidate.members)
              ? candidate.members.map((member) =>
                  isRecord(member)
                    ? member.pubkey ?? member.rawMemberPubkey ?? member.publicKey
                    : null,
                )
              : null;

  if (!threshold || !rawMembers || rawMembers.length === 0) return null;

  const members = rawMembers.map((member) => toSimpleSecp256k1Pubkey(member));
  if (members.some((member) => member === null)) return null;

  const simpleMembers = members.filter(
    (
      member,
    ): member is { readonly type: "tendermint/PubKeySecp256k1"; readonly value: string } =>
      Boolean(member),
  );

  return JSON.stringify(normalizePubkey(createMultisigThresholdPubkey(simpleMembers, threshold)));
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractRawMultisigs(payload: unknown): readonly unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.multisigs)) {
    return payload.multisigs;
  }
  if (isRecord(payload)) return [payload];
  return [];
}

function normalizeDiscoveredMultisig(
  value: unknown,
  chainId: string,
  now: string,
): DbMultisig | null {
  if (!isRecord(value)) return null;

  const addressCandidate =
    typeof value.multisigAddress === "string"
      ? value.multisigAddress
      : typeof value.address === "string"
        ? value.address
        : null;
  if (!addressCandidate) return null;

  const pubkeyJSON =
    (typeof value.pubkeyJSON === "string" && value.pubkeyJSON) ||
    tryBuildMultisigPubkey(value.rawMultisigPubkey) ||
    tryBuildMultisigPubkey({
      threshold: value.threshold,
      members: value.members,
    });

  if (!pubkeyJSON) return null;

  return {
    id: typeof value.id === "string" ? value.id : `discovered-${addressCandidate}`,
    chainId:
      typeof value.chainId === "string"
        ? value.chainId
        : typeof value.chain === "string"
          ? value.chain
          : chainId,
    address: addressCandidate,
    creator: typeof value.creator === "string" ? value.creator : null,
    pubkeyJSON,
    name:
      typeof value.label === "string"
        ? value.label
        : typeof value.name === "string"
          ? value.name
          : null,
    description: typeof value.description === "string" ? value.description : null,
    version: typeof value.version === "number" ? value.version : 1,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function flattenMemberPubkeys(
  pubkey: unknown,
  addressPrefix: string,
  members: MultisigIndexerMember[],
): void {
  if (isAminoPubkey(pubkey) && isMultisigThresholdPubkey(pubkey)) {
    for (const nested of pubkey.value.pubkeys) {
      flattenMemberPubkeys(nested, addressPrefix, members);
    }
    return;
  }

  const simplePubkey = toSimpleSecp256k1Pubkey(pubkey);
  if (!simplePubkey || !isSecp256k1Pubkey(simplePubkey)) {
    return;
  }

  members.push({
    address: pubkeyToAddress(simplePubkey, addressPrefix),
    pubkey: simplePubkey.value,
    pubkeyFingerprint: getPubkeyFingerprint(simplePubkey.value),
    weight: 1,
    position: members.length,
  });
}

export function buildMultisigIndexerImportPayload(
  multisig: MultisigIndexerSyncInput,
  options: MultisigIndexerSyncOptions = {},
): MultisigIndexerImportPayload {
  const parsedPubkey = safeJsonParse(multisig.pubkeyJSON);
  if (!isAminoPubkey(parsedPubkey) || !isMultisigThresholdPubkey(parsedPubkey)) {
    throw new Error("Only native amino multisigs can be synced to the indexer.");
  }

  const normalizedPubkey = normalizePubkey(parsedPubkey);
  const addressPrefix = fromBech32(multisig.address).prefix;
  const members: MultisigIndexerMember[] = [];
  flattenMemberPubkeys(normalizedPubkey, addressPrefix, members);

  return {
    chainId: multisig.chainId,
    multisigAddress: multisig.address,
    type: "native_amino",
    threshold: Number(normalizedPubkey.value.threshold),
    members,
    label: multisig.name ?? undefined,
    description: multisig.description ?? undefined,
    source: options.source ?? "app_import",
    creator: multisig.creator ?? undefined,
    rawMultisigPubkey: normalizedPubkey,
  };
}

export async function syncMultisigToIndexer(
  multisig: MultisigIndexerSyncInput,
  options: MultisigIndexerSyncOptions = {},
): Promise<void> {
  const { baseUrl, importPath } = getIndexerConfig();
  if (!baseUrl) return;

  const payload = buildMultisigIndexerImportPayload(multisig, options);
  const url = buildIndexerUrl(importPath, {}, {});
  await fetchIndexerJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function discoverViaConfiguredEndpoints(context: DiscoveryContext): Promise<DbMultisig[]> {
  const config = getIndexerConfig();
  if (!config.baseUrl) return [];

  const now = new Date().toISOString();
  const pubkeyFingerprint = context.pubkey ? getPubkeyFingerprint(context.pubkey) : undefined;
  const commonQuery = {
    chain: context.chain.chainId,
    chainId: context.chain.chainId,
  };

  const requests: Promise<unknown>[] = [
    fetchIndexerJson(
      buildIndexerUrl(
        config.byAddressPath,
        { address: context.address },
        {
          ...commonQuery,
          pubkey: context.pubkey,
          pubkeyFingerprint,
        },
      ),
    ),
  ];

  if (pubkeyFingerprint) {
    requests.push(
      fetchIndexerJson(
        buildIndexerUrl(
          config.byPubkeyPath,
          { pubkeyFingerprint },
          {
            ...commonQuery,
            address: context.address,
            pubkey: context.pubkey,
          },
        ),
      ),
    );
  }

  const settled = await Promise.allSettled(requests);
  const values = settled.flatMap((result) =>
    result.status === "fulfilled" ? extractRawMultisigs(result.value) : [],
  );

  return values
    .map((value) => normalizeDiscoveredMultisig(value, context.chain.chainId, now))
    .filter((value): value is DbMultisig => Boolean(value));
}

async function discoverViaLegacyMembershipEndpoint(
  context: DiscoveryContext,
): Promise<DbMultisig[]> {
  const config = getIndexerConfig();
  if (!config.baseUrl || !config.legacyMembershipPath) return [];

  const now = new Date().toISOString();
  const pubkeyFingerprint = context.pubkey ? getPubkeyFingerprint(context.pubkey) : undefined;
  const payload = await fetchIndexerJson(
    buildIndexerUrl(
      config.legacyMembershipPath,
      {},
      {
        chain: context.chain.chainId,
        chainId: context.chain.chainId,
        address: context.address,
        pubkey: context.pubkey,
        pubkeyFingerprint,
      },
    ),
  );

  return extractRawMultisigs(payload)
    .map((value) => normalizeDiscoveredMultisig(value, context.chain.chainId, now))
    .filter((value): value is DbMultisig => Boolean(value));
}

export async function discoverMultisigsFromIndexer(
  context: DiscoveryContext,
): Promise<DbMultisig[]> {
  if (!isMultisigIndexerConfigured()) return [];

  const discovered = await discoverViaConfiguredEndpoints(context);
  if (discovered.length > 0) {
    return discovered;
  }

  return discoverViaLegacyMembershipEndpoint(context);
}

export async function discoverMultisigByAddress(
  chain: ChainInfo,
  address: string,
): Promise<DbMultisig | null> {
  if (!isMultisigIndexerConfigured()) return null;

  const { byAddressPath } = getIndexerConfig();
  const now = new Date().toISOString();
  const payload = await fetchIndexerJson(
    buildIndexerUrl(
      byAddressPath,
      { address },
      {
        chain: chain.chainId,
        chainId: chain.chainId,
      },
    ),
  );

  const matches = extractRawMultisigs(payload)
    .map((value) => normalizeDiscoveredMultisig(value, chain.chainId, now))
    .filter((value): value is DbMultisig => Boolean(value));

  return matches.find((multisig) => multisig.address === address) ?? matches[0] ?? null;
}
