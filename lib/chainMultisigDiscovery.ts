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

function pubkeyMatches(
  memberPubkey: string,
  pubkeys: ReadonlyArray<{ value?: string; key?: string }>,
): boolean {
  return pubkeys.some((pk) => pk.value === memberPubkey || pk.key === memberPubkey);
}

/**
 * Discover multisigs from chain where the user (address/pubkey) is a member.
 * Only checks validator delegator accounts to keep the lookup fast.
 */
export async function getMultisigsFromChainWhereMember(
  chain: ChainInfo,
  address: string,
  pubkey: string,
): Promise<DbMultisig[]> {
  if (!chain.nodeAddress || !chain.addressPrefix) return [];

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

    for (const v of validators) {
      try {
        const delegatorAddr = validatorToDelegatorAddress(v.operatorAddress, chain.addressPrefix);
        const account = await stargateClient.getAccount(delegatorAddr);
        if (!account?.pubkey || !isMultisigThresholdPubkey(account.pubkey)) {
          continue;
        }

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
      } catch {
        // Skip individual failures (e.g. account not found)
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
