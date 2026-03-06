/**
 * On-Chain Multisig Discovery
 *
 * Discovers multisigs (CLIQs) that operate as validators by querying the staking
 * module and checking which validator delegator accounts are multisigs where
 * the user's pubkey is a member. Works without the database.
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { createMultisig, DbMultisig } from "@/graphql";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";
import { StargateClient } from "@cosmjs/stargate";
import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import {
  discoverMultisigsFromIndexer,
  isMultisigIndexerConfigured,
  syncMultisigToIndexer,
} from "./multisigIndexer";
import { ensureProtocol } from "./utils";
import { getAllValidators } from "./staking";
import { validatorToDelegatorAddress } from "./validatorHelpers";

/** Number of validator accounts to query in parallel per batch */
const BATCH_SIZE = 20;

/** Cache TTL: 5 minutes — validator sets don't change frequently */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Server-side in-memory cache for chain multisig discovery results, keyed by chainId:pubkey */
const discoveryCache = new Map<string, { data: DbMultisig[]; expires: number }>();

type DiscoverySource = "indexer" | "rpc";

type DiscoveryContext = {
  readonly chain: ChainInfo;
  readonly address: string;
  readonly pubkey: string;
};

type DiscoveryProvider = {
  readonly source: DiscoverySource;
  readonly isConfigured: () => boolean;
  readonly discover: (context: DiscoveryContext) => Promise<DbMultisig[]>;
};

function pubkeyMatches(
  memberPubkey: string,
  pubkeys: ReadonlyArray<{ value?: string; key?: string }>,
): boolean {
  return pubkeys.some((pk) => pk.value === memberPubkey || pk.key === memberPubkey);
}

function dedupeMultisigs(multisigs: readonly DbMultisig[]): DbMultisig[] {
  return Array.from(new Map(multisigs.map((multisig) => [multisig.address, multisig])).values());
}

/**
 * Discover multisigs from chain where the user (address/pubkey) is a member.
 * Only checks validator delegator accounts to keep the lookup fast.
 * Results are cached for 5 minutes to avoid repeated RPC calls.
 */
async function discoverMultisigsFromRpcWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  if (!chain.nodeAddress || !chain.addressPrefix) return [];

  const rpcUrl = ensureProtocol(chain.nodeAddress);
  const now = new Date().toISOString();

  try {
    // Fetch all validator statuses in parallel so we catch UNBONDING and UNBONDED
    // validators as well. This is especially important on testnets where validators
    // are frequently not yet bonded or are in the process of unbonding.
    const [allValidators, stargateClient] = await Promise.all([
      getAllValidators(rpcUrl),
      StargateClient.connect(rpcUrl),
    ]);

    const validators: Validator[] = [
      ...allValidators.bonded,
      ...allValidators.unbonding,
      ...allValidators.unbonded,
    ];

    const results: DbMultisig[] = [];

    // Query validator delegator accounts in parallel batches instead of sequentially.
    // A chain like Cosmos Hub has 150+ validators; sequential calls would take 30+ seconds.
    for (let i = 0; i < validators.length; i += BATCH_SIZE) {
      const batch = validators.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (v) => {
          const delegatorAddr = validatorToDelegatorAddress(v.operatorAddress, chain.addressPrefix);
          const account = await stargateClient.getAccount(delegatorAddr);
          return { account, delegatorAddr };
        }),
      );

      for (const result of batchResults) {
        if (result.status !== "fulfilled") continue;
        const { account, delegatorAddr } = result.value;
        if (!account?.pubkey || !isMultisigThresholdPubkey(account.pubkey)) continue;

        const pubkeys = account.pubkey.value?.pubkeys ?? [];
        if (!pubkeyMatches(pubkey, pubkeys)) continue;

        results.push({
          id: `chain-${delegatorAddr}`,
          chainId: chain.chainId,
          address: delegatorAddr,
          creator: null,
          pubkeyJSON: JSON.stringify(account.pubkey),
          name: null,
          description: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await stargateClient.disconnect();

    return results;
  } catch (e) {
    console.log(
      "[chainMultisigDiscovery] Failed to discover from chain:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

const discoveryProviders: readonly DiscoveryProvider[] = [
  {
    source: "indexer",
    isConfigured: () => isMultisigIndexerConfigured(),
    discover: discoverMultisigsFromIndexer,
  },
  {
    source: "rpc",
    isConfigured: () => true,
    discover: ({ chain, address, pubkey }) => discoverMultisigsFromRpcWhereMember(chain, address, pubkey),
  },
];

export async function registerDiscoveredMultisigs(multisigs: readonly DbMultisig[]): Promise<void> {
  await Promise.all(
    multisigs.map(async (multisig) => {
      try {
        await createMultisig({
          chainId: multisig.chainId,
          address: multisig.address,
          creator: multisig.creator ?? null,
          pubkeyJSON: multisig.pubkeyJSON,
          name: multisig.name,
          description: multisig.description,
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("already exists")) {
          throw error;
        }
      }

      try {
        await syncMultisigToIndexer(multisig, { source: "account_pubkey" });
      } catch (error) {
        console.log(
          "[chainMultisigDiscovery] Failed to sync discovered multisig to indexer:",
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
}

export async function discoverMultisigsWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  const cacheKey = `${chain.chainId}:${pubkey}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[chainMultisigDiscovery] Cache hit for ${chain.chainId}`);
    return cached.data;
  }

  const context: DiscoveryContext = { chain, address, pubkey };
  const results: DbMultisig[] = [];

  for (const provider of discoveryProviders) {
    if (!provider.isConfigured()) continue;

    try {
      const multisigs = dedupeMultisigs(await provider.discover(context));
      if (multisigs.length > 0) {
        results.push(...multisigs);
      }
    } catch (error) {
      console.log(
        `[chainMultisigDiscovery] ${provider.source} discovery failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const combined = dedupeMultisigs(results);
  discoveryCache.set(cacheKey, { data: combined, expires: Date.now() + CACHE_TTL_MS });

  return combined;
}

export async function getMultisigsFromChainWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  return discoverMultisigsWhereMember(chain, address, pubkey);
}
