/**
 * On-Chain Multisig Discovery
 *
 * Discovers multisigs (CLIQs) that operate as validators by querying the staking
 * module and checking which validator delegator accounts are multisigs where
 * the user's pubkey is a member. Works without the database.
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { createMultisig, DbMultisig } from "@/graphql";
import {
  discoverMultisigsFromIndexer,
  isMultisigIndexerConfigured,
  syncMultisigToIndexer,
} from "./multisigIndexer";

/** Cache TTL: 5 minutes — validator sets don't change frequently */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Server-side in-memory cache for chain multisig discovery results, keyed by chainId:pubkey */
const discoveryCache = new Map<string, { data: DbMultisig[]; expires: number }>();

type DiscoveryContext = {
  readonly chain: ChainInfo;
  readonly address: string;
  readonly pubkey: string;
};

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
  void chain;
  void address;
  void pubkey;

  // This implementation scans every validator and fetches each delegator account,
  // which is still too expensive for request-time discovery on public RPCs.
  return [];
}

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
  let combined: DbMultisig[] = [];

  if (isMultisigIndexerConfigured()) {
    try {
      combined = dedupeMultisigs(await discoverMultisigsFromIndexer(context));
    } catch (error) {
      console.log(
        "[chainMultisigDiscovery] indexer discovery failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (combined.length === 0) {
    try {
      combined = dedupeMultisigs(await discoverMultisigsFromRpcWhereMember(chain, address, pubkey));
    } catch (error) {
      console.log(
        "[chainMultisigDiscovery] rpc discovery failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  discoveryCache.set(cacheKey, { data: combined, expires: Date.now() + CACHE_TTL_MS });

  return combined;
}

export async function getMultisigsFromChainWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  // This function iterates over EVERY active validator on the network and fetches 
  // their account details to see if they are a multisig. This is incredibly slow 
  // and frequently causes API routes to hit the 30s timeout limit. 
  // For now, we disable this expensive fallback discovery mechanism.
  return [];
}
