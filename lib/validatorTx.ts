/**
 * Validator Transaction Utilities
 *
 * File: lib/validatorTx.ts
 *
 * Utilities for creating CLIQ (multisig) transactions directly from the validator dashboard.
 * This allows validator actions to create proposals without redirecting to a form.
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { DbTransactionParsedDataJson } from "@/graphql";
import { createDbTx } from "@/lib/api";
import { ensureChainMultisigInDb } from "@/lib/multisigHelpers";
import { exportMsgToJson, gasOfTx } from "@/lib/txMsgHelpers";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { EncodeObject } from "@cosmjs/proto-signing";
import { StargateClient, calculateFee } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";

export interface CreateCliqTxParams {
  chain: ChainInfo;
  cliqAddress: string;
  messages: EncodeObject[];
  memo?: string;
}

export interface CreateCliqTxResult {
  success: boolean;
  txId?: string;
  error?: string;
  warning?: string;
}

/**
 * Creates a CLIQ transaction proposal directly without requiring form input.
 * Used by validator dashboard to create commission claims, withdraw address changes, etc.
 */
export async function createCliqTransaction(
  params: CreateCliqTxParams,
): Promise<CreateCliqTxResult> {
  const { chain, cliqAddress, messages, memo = "" } = params;

  try {
    // Get account info for the CLIQ address
    const client = await StargateClient.connect(chain.nodeAddress);
    try {
      const account = await client.getAccount(cliqAddress);

      if (!account) {
        return {
          success: false,
          error: `CLIQ account not found on chain: ${cliqAddress}`,
        };
      }

      // Calculate gas based on message types
      const msgTypeUrls = messages.map((m) => m.typeUrl) as MsgTypeUrl[];
      const gasLimit = gasOfTx(msgTypeUrls);

      // Calculate fee
      const fee = calculateFee(gasLimit, chain.gasPrice);

      // The CLIQ account itself pays the fee at broadcast time, so warn (without
      // blocking creation) when its balance cannot cover it.
      let warning: string | undefined;
      const feeCoin = fee.amount[0];
      if (feeCoin) {
        try {
          const balance = await client.getBalance(cliqAddress, feeCoin.denom);
          if (BigInt(balance.amount) < BigInt(feeCoin.amount)) {
            warning = `Heads up: this transaction's fee is ${feeCoin.amount} ${feeCoin.denom} but the CLIQ account ${cliqAddress} only holds ${balance.amount} ${feeCoin.denom}. The CLIQ account itself pays the fee - fund it before broadcasting or the broadcast will fail.`;
          }
        } catch (balanceError) {
          // The warning is best-effort; a failed balance query must not block creation
          console.warn("Could not check CLIQ balance for fee warning:", balanceError);
        }
      }

      // Export messages to JSON format
      const exportedMsgs = messages.map((msg) => exportMsgToJson(msg));

      // Build transaction data
      const txData: DbTransactionParsedDataJson = {
        accountNumber: account.accountNumber,
        sequence: account.sequence,
        chainId: chain.chainId,
        msgs: exportedMsgs,
        fee,
        memo,
      };

      // Ensure chain-only multisig is registered in DB before creating tx (handles race with
      // validator view useEffect and direct navigations that skip the CLIQ page)
      const resolved = await ensureChainMultisigInDb(cliqAddress, chain);
      if (!resolved.multisig) {
        return {
          success: false,
          error: resolved.reason ?? `CLIQ address could not be resolved: ${cliqAddress}`,
        };
      }

      // Create the transaction in the database
      const txId = await createDbTx(cliqAddress, chain.chainId, txData);

      return {
        success: true,
        txId,
        warning,
      };
    } finally {
      client.disconnect();
    }
  } catch (e) {
    console.error("Failed to create CLIQ transaction:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error creating transaction",
    };
  }
}

/**
 * Build message for claiming validator commission
 */
export function buildClaimCommissionMsg(
  validatorAddress: string,
  delegatorAddress: string,
  includeRewards: boolean,
): EncodeObject[] {
  const messages: EncodeObject[] = [];

  // Include self-delegation rewards if requested
  if (includeRewards) {
    messages.push({
      typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
      value: {
        delegatorAddress,
        validatorAddress,
      },
    });
  }

  // Commission withdrawal
  messages.push({
    typeUrl: MsgTypeUrls.WithdrawValidatorCommission,
    value: {
      validatorAddress,
    },
  });

  return messages;
}

/**
 * Build message for claiming only staking rewards
 */
export function buildClaimRewardsMsg(
  validatorAddress: string,
  delegatorAddress: string,
): EncodeObject[] {
  return [
    {
      typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
      value: {
        delegatorAddress,
        validatorAddress,
      },
    },
  ];
}

/**
 * Build message for setting withdraw address
 */
export function buildSetWithdrawAddressMsg(
  delegatorAddress: string,
  withdrawAddress: string,
): EncodeObject[] {
  return [
    {
      typeUrl: MsgTypeUrls.SetWithdrawAddress,
      value: {
        delegatorAddress,
        withdrawAddress,
      },
    },
  ];
}

/**
 * Build message for voting on a proposal
 */
export function buildVoteMsg(voter: string, proposalId: number, option: number): EncodeObject[] {
  return [
    {
      typeUrl: MsgTypeUrls.Vote,
      value: {
        proposalId,
        voter,
        option,
      },
    },
  ];
}

/**
 * Sentinel value for MsgEditValidator - indicates field should not be modified.
 * This is required by the Cosmos SDK for any description fields that shouldn't change.
 */
const DO_NOT_MODIFY = "[do-not-modify]";

/**
 * Build message for editing validator
 *
 * IMPORTANT: MsgEditValidator requires ALL description fields to be present.
 * Fields that should NOT change must use the sentinel value "[do-not-modify]".
 */
export function buildEditValidatorMsg(
  validatorAddress: string,
  enabledFields: Record<string, boolean>,
  description: {
    moniker?: string;
    identity?: string;
    website?: string;
    securityContact?: string;
    details?: string;
  },
  commissionRate?: string,
  minSelfDelegation?: string,
): EncodeObject[] {
  // Build description with ALL fields - use [do-not-modify] for unchanged ones
  // The Cosmos SDK requires this sentinel value for fields that shouldn't change
  const descriptionValue = {
    moniker: enabledFields.moniker ? description.moniker || "" : DO_NOT_MODIFY,
    identity: enabledFields.identity ? description.identity || "" : DO_NOT_MODIFY,
    website: enabledFields.website ? description.website || "" : DO_NOT_MODIFY,
    securityContact: enabledFields.securityContact
      ? description.securityContact || ""
      : DO_NOT_MODIFY,
    details: enabledFields.details ? description.details || "" : DO_NOT_MODIFY,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageValue: any = {
    validatorAddress,
    description: descriptionValue,
  };

  // Add commission rate if enabled and provided
  // Empty string means "do not modify" for commission rate
  if (enabledFields.commissionRate && commissionRate) {
    messageValue.commissionRate = Decimal.fromUserInput(commissionRate, 18).atomics;
  }

  // Add min self delegation if enabled and provided
  // Empty string means "do not modify" for min self delegation
  if (enabledFields.minSelfDelegation && minSelfDelegation) {
    messageValue.minSelfDelegation = minSelfDelegation;
  }

  return [
    {
      typeUrl: MsgTypeUrls.EditValidator,
      value: messageValue,
    },
  ];
}
