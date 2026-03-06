/**
 * On-Chain Multisig Discovery
 *
 * Discovers multisigs (CLIQs) that operate as validators by querying the staking
 * module and checking which validator delegator accounts are multisigs where
 * the user's pubkey is a member. Works without the database.
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { DbMultisig } from "@/graphql";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";
import { StargateClient } from "@cosmjs/stargate";
import { QueryClient, setupStakingExtension } from "@cosmjs/stargate";
import { connectComet } from "@cosmjs/tendermint-rpc";
import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { ensureProtocol } from "./utils";
import { validatorToDelegatorAddress } from "./validatorHelpers";

/** Number of validator accounts to query in parallel per batch */
const BATCH_SIZE = 20;

/** Cache TTL: 5 minutes — validator sets don't change frequently */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Server-side in-memory cache for chain multisig discovery results, keyed by chainId:pubkey */
const discoveryCache = new Map<string, { data: DbMultisig[]; expires: number }>();

function pubkeyMatches(
  memberPubkey: string,
  pubkeys: ReadonlyArray<{ value?: string; key?: string }>,
): boolean {
  return pubkeys.some((pk) => pk.value === memberPubkey || pk.key === memberPubkey);
}

/**
 * Discover multisigs from chain where the user (address/pubkey) is a member.
 * Only checks validator delegator accounts to keep the lookup fast.
 * Results are cached for 5 minutes to avoid repeated RPC calls.
 */
export async function getMultisigsFromChainWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  if (!chain.nodeAddress || !chain.addressPrefix) return [];

  const cacheKey = `${chain.chainId}:${pubkey}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[chainMultisigDiscovery] Cache hit for ${chain.chainId}`);
    return cached.data;
  }

  const rpcUrl = ensureProtocol(chain.nodeAddress);
  const now = new Date().toISOString();

  try {
    const cometClient = await connectComet(rpcUrl);
    const queryClient = QueryClient.withExtensions(cometClient, setupStakingExtension);

    const stargateClient = await StargateClient.connect(rpcUrl);

    const validators: Validator[] = [];
    let paginationKey: Uint8Array | undefined;

    do {
      const response = await queryClient.staking.validators("BOND_STATUS_BONDED", paginationKey);
      validators.push(...response.validators);
      paginationKey = response.pagination?.nextKey;
    } while (paginationKey?.length);

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

    discoveryCache.set(cacheKey, { data: results, expires: Date.now() + CACHE_TTL_MS });

    return results;
  } catch (e) {
    console.log(
      "[chainMultisigDiscovery] Failed to discover from chain:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}
