import { ChainInfo } from "@/context/ChainsContext/types";
import { DbMultisigDraft } from "@/graphql";
import { getKeplrKey } from "./keplr";
import {
  MultisigThresholdPubkey,
  createMultisigThresholdPubkey,
  pubkeyToAddress,
} from "@cosmjs/amino";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";
import { assert } from "@cosmjs/utils";
import { Account, StargateClient } from "@cosmjs/stargate";
import { createDbMultisig, getDbMultisig } from "./api";
import { checkAddress, explorerLinkAccount } from "./displayHelpers";
import { ensureProtocol } from "./utils";

/**
 * Turns array of compressed Secp256k1 pubkeys
 * into a multisig (Cliq) using comsjs
 *
 * @param {array} compressedPubkeys Must be an array of compressed Secp256k1 pubkeys (e.g 'A8B5KVhRz1oQuV1dguzFdGBhHrIU/I+R/QfBZcbZFWVG').
 * @param {number} threshold the number of signers required to sign messages from this multisig
 * @param {string} addressPrefix chain based prefix for the address (e.g. 'cosmos')
 * @param {string} chainId chain-id for the multisig (e.g. 'cosmoshub-4')
 * @param {string} creator address of the wallet creating this cliq
 * @param {string} name optional human-readable name for the cliq
 * @param {string} description optional description of the cliq's purpose
 * @return {string} The multisig (cliq) address.
 */
export const createMultisigFromCompressedSecp256k1Pubkeys = async (
  compressedPubkeys: string[],
  threshold: number,
  addressPrefix: string,
  chainId: string,
  creator: string,
  name?: string,
  description?: string,
): Promise<string> => {
  const pubkeys = compressedPubkeys.map((compressedPubkey) => {
    return {
      type: "tendermint/PubKeySecp256k1",
      value: compressedPubkey,
    };
  });
  const multisigPubkey = createMultisigThresholdPubkey(pubkeys, threshold);
  const multisigAddress = pubkeyToAddress(multisigPubkey, addressPrefix);

  // save multisig (cliq) to relational offchain database
  const multisig: DbMultisigDraft = {
    address: multisigAddress,
    pubkeyJSON: JSON.stringify(multisigPubkey),
    creator,
    chainId,
    name: name || null,
    description: description || null,
  };

  const dbMultisigAddress = await createDbMultisig(multisig, chainId);

  return dbMultisigAddress;
};

export type HostedMultisig =
  | {
      readonly hosted: "nowhere";
    }
  | {
      readonly hosted: "db";
      readonly pubkeyOnDb: MultisigThresholdPubkey;
    }
  | {
      readonly hosted: "chain";
      readonly accountOnChain: Partial<Account> | null;
      readonly explorerLink: string | null;
    }
  | {
      readonly hosted: "db+chain";
      readonly pubkeyOnDb: MultisigThresholdPubkey;
      readonly accountOnChain: Partial<Account> | null;
      readonly explorerLink: string | null;
    };

export const getHostedMultisig = async (
  multisigAddress: string,
  { addressPrefix, chainId, nodeAddress, explorerLinks }: ChainInfo,
  providedClient?: StargateClient,
): Promise<HostedMultisig> => {
  const addressError = checkAddress(multisigAddress, addressPrefix);
  if (addressError) {
    throw new Error(addressError);
  }

  let hostedMultisig: HostedMultisig = { hosted: "nowhere" };

  hostedMultisig = await (async () => {
    try {
      const { pubkeyJSON } = await getDbMultisig(multisigAddress, chainId);

      const pubkeyOnDb = JSON.parse(pubkeyJSON);
      return { hosted: "db", pubkeyOnDb };
    } catch {
      return hostedMultisig;
    }
  })();

  hostedMultisig = await (async () => {
    try {
      const client = providedClient ?? (await StargateClient.connect(ensureProtocol(nodeAddress)));
      const accountOnChain = await client.getAccount(multisigAddress);

      if (!accountOnChain) {
        return hostedMultisig;
      }

      const explorerLink = explorerLinkAccount(explorerLinks.account, multisigAddress);

      if (hostedMultisig.hosted === "db") {
        return {
          hosted: "db+chain",
          pubkeyOnDb: hostedMultisig.pubkeyOnDb,
          accountOnChain,
          explorerLink,
        };
      }

      return { hosted: "chain", accountOnChain, explorerLink };
    } catch {
      return hostedMultisig;
    }
  })();

  return hostedMultisig;
};

/**
 * Ensures a chain-only multisig is registered in the DB.
 * Call before createDbTx when the multisig might have been discovered from chain only.
 * No-op if already in DB.
 */
export async function ensureChainMultisigInDb(
  multisigAddress: string,
  chain: ChainInfo,
): Promise<void> {
  if (!chain.nodeAddress || !chain.addressPrefix) return;

  const hosted = await getHostedMultisig(multisigAddress, chain);
  if (hosted.hosted !== "chain" || !hosted.accountOnChain?.pubkey) return;

  assert(
    isMultisigThresholdPubkey(hosted.accountOnChain.pubkey),
    "Pubkey on chain is not of type MultisigThreshold",
  );

  const { bech32Address: creatorAddress } = await getKeplrKey(chain.chainId);
  try {
    await createMultisigFromCompressedSecp256k1Pubkeys(
      hosted.accountOnChain.pubkey.value.pubkeys.map((p) => p.value),
      Number(hosted.accountOnChain.pubkey.value.threshold),
      chain.addressPrefix,
      chain.chainId,
      creatorAddress,
    );
  } catch (e) {
    // Already exists (e.g. race with validator view useEffect) - treat as success
    if (e instanceof Error && e.message.includes("already exists")) return;
    throw e;
  }
}

export const isAccount = (account: Partial<Account> | null): account is Account =>
  Boolean(
    account?.address &&
      typeof account.accountNumber === "number" &&
      typeof account.sequence === "number",
  );
