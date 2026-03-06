import { DbTransactionParsedDataJson } from "@/graphql";
import { parseDbTransactionJson } from "@/lib/transactionJson";
import { MsgCodecs, MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { encodePubkey, EncodeObject } from "@cosmjs/proto-signing";

export const gasOfMsg = (msgType: MsgTypeUrl): number => {
  switch (msgType) {
    // Bank
    case MsgTypeUrls.Send:
      return 100_000;
    // Staking
    case MsgTypeUrls.Delegate:
      // This is enough for 1 delegation and 1 autoclaim. But it is probably too low for
      // a lot of auto-claims. See https://github.com/cosmos/cosmos-multisig-ui/issues/177.
      return 400_000;
    case MsgTypeUrls.Undelegate:
      return 600_000;
    case MsgTypeUrls.BeginRedelegate:
      return 600_000;
    case MsgTypeUrls.CreateValidator:
      return 500_000;
    case MsgTypeUrls.EditValidator:
      return 500_000;
    // Distribution
    case MsgTypeUrls.FundCommunityPool:
      return 100_000;
    case MsgTypeUrls.SetWithdrawAddress:
      return 100_000;
    case MsgTypeUrls.WithdrawDelegatorReward:
      // On the Hub we now claim so many coins at once that this operation can become gas expensive.
      // See e.g. https://www.mintscan.io/cosmos/tx/EA7EC3F6F08DA4E6D419359F264B34AB27D2AAE7FF40267E7E760927475157B3
      return 500_000;
    case MsgTypeUrls.WithdrawValidatorCommission:
      // This now bundles both MsgWithdrawDelegatorReward + MsgWithdrawValidatorCommission
      // like the CLI does with --commission flag. Gas accounts for both messages.
      return 1_000_000;
    // Vesting
    case MsgTypeUrls.CreateVestingAccount:
      return 100_000;
    // Governance
    case MsgTypeUrls.Vote:
      return 100_000;
    // IBC
    case MsgTypeUrls.Transfer:
      return 180_000;
    // CosmWasm
    case MsgTypeUrls.InstantiateContract:
      return 150_000;
    case MsgTypeUrls.InstantiateContract2:
      return 150_000;
    case MsgTypeUrls.UpdateAdmin:
      return 150_000;
    case MsgTypeUrls.ExecuteContract:
      return 150_000;
    case MsgTypeUrls.MigrateContract:
      return 150_000;
    default:
      throw new Error("Unknown msg type");
  }
};

export const gasOfTx = (msgTypes: readonly MsgTypeUrl[]): number => {
  const txFlatGas = 100_000;
  const totalTxGas = msgTypes.reduce((acc, msgType) => acc + gasOfMsg(msgType), txFlatGas);
  return totalTxGas;
};

export const isKnownMsgTypeUrl = (typeUrl: string): typeUrl is MsgTypeUrl =>
  Object.values(MsgTypeUrls).includes(typeUrl as MsgTypeUrl);

export const exportMsgToJson = (msg: EncodeObject): EncodeObject => {
  console.log("🔍 DECIMAL DEBUG: exportMsgToJson - exporting message");
  console.log("  - msg.typeUrl:", msg.typeUrl);

  if (msg.typeUrl === MsgTypeUrls.CreateValidator) {
    console.log("  - original msg.value:", msg.value);
    console.log("  - original msg.value.commission:", msg.value.commission);
  }

  if (isKnownMsgTypeUrl(msg.typeUrl)) {
    const exportedValue = MsgCodecs[msg.typeUrl].toJSON(msg.value);

    if (msg.typeUrl === MsgTypeUrls.CreateValidator) {
      console.log("  - exported value:", exportedValue);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log("  - exported value.commission:", (exportedValue as any).commission);
    }

    // Note: toJSON already outputs in camelCase format, which is correct for the database
    return { ...msg, value: exportedValue };
  }

  throw new Error("Unknown msg type");
};

const importMsgFromJson = (msg: EncodeObject): EncodeObject => {
  console.log("🔍 DECIMAL DEBUG: importMsgFromJson - importing message");
  console.log("  - msg.typeUrl:", msg.typeUrl);

  if (msg.typeUrl === MsgTypeUrls.CreateValidator) {
    console.log("  - JSON msg.value:", msg.value);
    console.log("  - JSON msg.value.commission:", msg.value.commission);
    console.log("  - JSON msg.value.pubkey:", msg.value.pubkey);
  }

  if (isKnownMsgTypeUrl(msg.typeUrl)) {
    // Handle legacy pubkey format for CreateValidator messages
    let processedValue = msg.value;
    if (msg.typeUrl === MsgTypeUrls.CreateValidator && msg.value?.pubkey) {
      console.log("🔍 DECIMAL DEBUG: processing pubkey format");
      console.log("  - original pubkey:", msg.value.pubkey);

      // Handle legacy format: { type: "/cosmos.crypto.ed25519.PubKey", key: "base64..." }
      if (msg.value.pubkey.type && msg.value.pubkey.key) {
        console.log("🔍 DECIMAL DEBUG: converting legacy pubkey format");
        // Convert legacy format to the format expected by fromJSON
        // fromJSON expects: { typeUrl: string, value: base64string }
        processedValue = {
          ...msg.value,
          pubkey: {
            typeUrl: msg.value.pubkey.type,
            // Keep as base64 string - fromJSON will decode it
            value: msg.value.pubkey.key,
          },
        };
        console.log("  - converted pubkey structure:", processedValue.pubkey);
      }
      // If already in new format { typeUrl, value }, leave as-is
    }

    // Normalize MsgCreateValidator commission field names from snake_case to camelCase
    let normalizedValue = processedValue;
    if (msg.typeUrl === MsgTypeUrls.CreateValidator && processedValue.commission) {
      const commission = processedValue.commission;
      normalizedValue = {
        ...processedValue,
        commission: {
          rate: commission.rate || "",
          maxRate: commission.maxRate || commission.max_rate || "",
          maxChangeRate: commission.maxChangeRate || commission.max_change_rate || "",
        },
      };
      console.log("  - normalized commission:", normalizedValue.commission);
    }

    console.log("🔍 DECIMAL DEBUG: about to call fromJSON with normalizedValue:", normalizedValue);

    const parsedValue = MsgCodecs[msg.typeUrl].fromJSON(normalizedValue);

    if (msg.typeUrl === MsgTypeUrls.CreateValidator) {
      const validatorValue = parsedValue as {
        commission?: unknown;
        pubkey?: { typeUrl: string; value: Uint8Array };
      };
      console.log("  - parsed value after fromJSON:", parsedValue);
      console.log("  - parsed value.commission:", validatorValue.commission);
      console.log("  - parsed value.pubkey:", validatorValue.pubkey);
      console.log("  - parsed value.pubkey.value length:", validatorValue.pubkey?.value?.length);

      // Critical fix: fromJSON returns a 32-byte raw pubkey, but amino converter needs
      // the full protobuf-encoded format (34 bytes with wrapper).
      // We need to re-encode it using encodePubkey to add the protobuf wrapper.
      if (validatorValue.pubkey && validatorValue.pubkey.value.length === 32) {
        console.log(
          "🔍 DECIMAL DEBUG: Re-encoding pubkey with protobuf wrapper for amino compatibility",
        );
        const rawPubkeyBytes = validatorValue.pubkey.value;
        const pubkeyType = validatorValue.pubkey.typeUrl;

        // Determine the amino type based on the typeUrl
        let aminoType = "tendermint/PubKeyEd25519";
        if (pubkeyType.includes("secp256k1")) {
          aminoType = "tendermint/PubKeySecp256k1";
        }

        // Re-encode with protobuf wrapper by converting bytes back to base64
        // and using encodePubkey which adds the wrapper
        const base64Pubkey = Buffer.from(rawPubkeyBytes).toString("base64");
        const reEncodedPubkey = encodePubkey({
          type: aminoType,
          value: base64Pubkey,
        });

        console.log(
          "  - re-encoded pubkey.value length:",
          reEncodedPubkey.value.length,
          "(should be 34)",
        );

        return {
          ...msg,
          value: {
            ...parsedValue,
            pubkey: reEncodedPubkey,
          },
        };
      }
    }

    return { ...msg, value: parsedValue };
  }

  throw new Error("Unknown msg type");
};

export const msgsFromJson = (msgs: readonly EncodeObject[]): EncodeObject[] =>
  msgs.map((msg) => importMsgFromJson(msg));

export const parseDbTxFromJson = (
  txJson: string,
): { tx: DbTransactionParsedDataJson; error?: never } | { tx?: never; error: string } => {
  console.log("🔍 DECIMAL DEBUG: dbTxFromJson - parsing transaction from DB");
  console.log("  - txJson length:", txJson.length);

  try {
    const normalizedResult = parseDbTransactionJson(txJson);
    if (normalizedResult.error || !normalizedResult.tx) {
      return { error: normalizedResult.error ?? "Failed to normalize transaction JSON." };
    }

    const parsedDbTx = normalizedResult.tx;
    console.log("🔍 DECIMAL DEBUG: parsed transaction data");
    console.log("  - accountNumber:", parsedDbTx.accountNumber);
    console.log("  - sequence:", parsedDbTx.sequence);
    console.log("  - chainId:", parsedDbTx.chainId);
    console.log("  - msgs count:", parsedDbTx.msgs?.length || 0);

    if (parsedDbTx.msgs && parsedDbTx.msgs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsedDbTx.msgs.forEach((msg: any, index: number) => {
        console.log(`🔍 DECIMAL DEBUG: parsed msg[${index}]`);
        console.log(`  - typeUrl:`, msg.typeUrl);

        // Specifically check for CreateValidator messages and log commission
        if (msg.typeUrl === "/cosmos.staking.v1beta1.MsgCreateValidator" && msg.value?.commission) {
          console.log(`  - CREATE_VALIDATOR commission:`, msg.value.commission);
          console.log(`    - rate:`, msg.value.commission.rate, typeof msg.value.commission.rate);
          console.log(
            `    - maxRate:`,
            msg.value.commission.maxRate,
            typeof msg.value.commission.maxRate,
          );
          console.log(
            `    - maxChangeRate:`,
            msg.value.commission.maxChangeRate,
            typeof msg.value.commission.maxChangeRate,
          );
        }
      });
    }

    console.log("  - fee:", parsedDbTx.fee);
    console.log("  - memo:", parsedDbTx.memo);

    const dbTx: DbTransactionParsedDataJson = {
      ...parsedDbTx,
      msgs: msgsFromJson(parsedDbTx.msgs),
    };

    console.log("🔍 DECIMAL DEBUG: dbTx after importMsgFromJson");
    console.log("  - dbTx.msgs count:", dbTx.msgs?.length || 0);

    if (dbTx.msgs && dbTx.msgs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbTx.msgs.forEach((msg: any, index: number) => {
        console.log(`🔍 DECIMAL DEBUG: imported msg[${index}]`);
        console.log(`  - typeUrl:`, msg.typeUrl);

        // Specifically check for CreateValidator messages and log commission after import
        if (msg.typeUrl === "/cosmos.staking.v1beta1.MsgCreateValidator" && msg.value?.commission) {
          console.log(`  - CREATE_VALIDATOR commission after import:`, msg.value.commission);
          console.log(`    - rate:`, msg.value.commission.rate, typeof msg.value.commission.rate);
          console.log(
            `    - maxRate:`,
            msg.value.commission.maxRate,
            typeof msg.value.commission.maxRate,
          );
          console.log(
            `    - maxChangeRate:`,
            msg.value.commission.maxChangeRate,
            typeof msg.value.commission.maxChangeRate,
          );
        }
      });
    }

    return { tx: dbTx };
  } catch (error) {
    console.error("🔍 DECIMAL DEBUG: Error when parsing tx JSON from DB:", error);
    if (error instanceof Error) {
      console.error("🔍 DECIMAL DEBUG:", error.message);
      return { error: error.message };
    } else {
      console.error("🔍 DECIMAL DEBUG: Error when parsing tx JSON from DB");
      return { error: "Failed to parse transaction JSON from storage." };
    }
  }
};

export const dbTxFromJson = (txJson: string): DbTransactionParsedDataJson | null => {
  const result = parseDbTxFromJson(txJson);
  return result.error || !result.tx ? null : result.tx;
};

interface MsgTypeCount {
  readonly msgType: string;
  readonly count: number;
}

export const msgTypeCountsFromJson = (txJson: string): readonly MsgTypeCount[] => {
  const tx = dbTxFromJson(txJson);
  if (!tx) {
    return [];
  }

  const msgTypeCounts: { msgType: string; count: number }[] = [];

  const msgTypes = tx.msgs.map(({ typeUrl }) => typeUrl.split(".Msg")[1]);

  for (const msgType of msgTypes) {
    const foundIndex = msgTypeCounts.findIndex((msgTypeCount) => msgTypeCount.msgType === msgType);

    if (foundIndex !== -1) {
      msgTypeCounts[foundIndex].count++;
    } else {
      msgTypeCounts.push({ msgType, count: 1 });
    }
  }

  return msgTypeCounts;
};

export type TransactionCategory = "developer" | "validator" | "standard";

/**
 * Categorizes a transaction based on its message types
 * - Developer: Contract-related messages (CosmWasm)
 * - Validator: Validator, staking, and distribution messages
 * - Standard: All other messages (Send, Transfer, Vote, etc.)
 */
export const categorizeTransaction = (txJson: string): TransactionCategory => {
  const tx = dbTxFromJson(txJson);
  if (!tx || !tx.msgs || tx.msgs.length === 0) {
    return "standard";
  }

  // Check for developer/contract messages
  const hasContractMsg = tx.msgs.some((msg) => {
    const typeUrl = msg.typeUrl;
    return (
      typeUrl === MsgTypeUrls.InstantiateContract ||
      typeUrl === MsgTypeUrls.InstantiateContract2 ||
      typeUrl === MsgTypeUrls.ExecuteContract ||
      typeUrl === MsgTypeUrls.MigrateContract ||
      typeUrl === MsgTypeUrls.UpdateAdmin
    );
  });

  if (hasContractMsg) {
    return "developer";
  }

  // Check for validator/staking/distribution messages
  const hasValidatorMsg = tx.msgs.some((msg) => {
    const typeUrl = msg.typeUrl;
    return (
      typeUrl === MsgTypeUrls.CreateValidator ||
      typeUrl === MsgTypeUrls.EditValidator ||
      typeUrl === MsgTypeUrls.Delegate ||
      typeUrl === MsgTypeUrls.Undelegate ||
      typeUrl === MsgTypeUrls.BeginRedelegate ||
      typeUrl === MsgTypeUrls.WithdrawValidatorCommission ||
      typeUrl === MsgTypeUrls.WithdrawDelegatorReward ||
      typeUrl === MsgTypeUrls.FundCommunityPool ||
      typeUrl === MsgTypeUrls.SetWithdrawAddress
    );
  });

  if (hasValidatorMsg) {
    return "validator";
  }

  // Default to standard for all other messages
  return "standard";
};
