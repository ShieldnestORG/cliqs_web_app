import { ChainInfo } from "@/context/ChainsContext/types";
import { DbMultisig, createMultisig, getMultisig } from "@/graphql/multisig";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";
import { StargateClient } from "@cosmjs/stargate";
import { checkAddress } from "./displayHelpers";
import { normalizePubkey } from "./multisigAmino";
import { discoverMultisigByAddress, syncMultisigToIndexer } from "./multisigIndexer";
import { ensureProtocol } from "./utils";

type RegisteredSource = "db" | "chain" | "indexer" | "unresolved";

export type EnsureMultisigRegistrationResult = {
  readonly multisig: DbMultisig | null;
  readonly source: RegisteredSource;
  readonly reason?: string;
};

async function persistMultisig(
  multisig: Pick<DbMultisig, "chainId" | "address" | "creator" | "pubkeyJSON" | "name" | "description">,
  source: "account_pubkey" | "manual_admin",
): Promise<DbMultisig | null> {
  try {
    await createMultisig(multisig);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("already exists")) {
      throw error;
    }
  }

  try {
    await syncMultisigToIndexer(multisig, { source });
  } catch (error) {
    console.log(
      "[multisigRegistry] Failed to sync resolved multisig to indexer:",
      error instanceof Error ? error.message : error,
    );
  }

  return getMultisig(multisig.chainId, multisig.address);
}

export async function ensureMultisigRegistered(
  multisigAddress: string,
  chain: ChainInfo,
): Promise<EnsureMultisigRegistrationResult> {
  const addressError = checkAddress(multisigAddress, chain.addressPrefix);
  if (addressError) {
    throw new Error(addressError);
  }

  const existing = await getMultisig(chain.chainId, multisigAddress);
  if (existing) {
    return { multisig: existing, source: "db" };
  }

  let accountOnChain: Awaited<ReturnType<StargateClient["getAccount"]>> | null = null;
  let client: StargateClient | null = null;
  try {
    client = await StargateClient.connect(ensureProtocol(chain.nodeAddress));
    accountOnChain = await client.getAccount(multisigAddress);
  } catch (error) {
    console.log(
      "[multisigRegistry] Failed to query multisig account from chain:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await client?.disconnect().catch(() => undefined);
  }

  if (accountOnChain?.pubkey && isMultisigThresholdPubkey(accountOnChain.pubkey)) {
    const multisig = await persistMultisig(
      {
        chainId: chain.chainId,
        address: multisigAddress,
        creator: null,
        pubkeyJSON: JSON.stringify(normalizePubkey(accountOnChain.pubkey)),
        name: null,
        description: null,
      },
      "account_pubkey",
    );
    return { multisig, source: "chain" };
  }

  try {
    const discovered = await discoverMultisigByAddress(chain, multisigAddress);
    if (discovered) {
      const multisig = await persistMultisig(
        {
          chainId: discovered.chainId,
          address: discovered.address,
          creator: discovered.creator ?? null,
          pubkeyJSON: discovered.pubkeyJSON,
          name: discovered.name ?? null,
          description: discovered.description ?? null,
        },
        "manual_admin",
      );
      return { multisig, source: "indexer" };
    }
  } catch (error) {
    console.log(
      "[multisigRegistry] Failed to discover multisig by address:",
      error instanceof Error ? error.message : error,
    );
  }

  if (accountOnChain) {
    return {
      multisig: null,
      source: "unresolved",
      reason:
        "The account exists on chain, but its multisig public keys could not be recovered from the chain or indexer yet.",
    };
  }

  return {
    multisig: null,
    source: "unresolved",
    reason: "That address was not found in the database or on the active chain.",
  };
}
