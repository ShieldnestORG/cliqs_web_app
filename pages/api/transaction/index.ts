import { getMultisig } from "@/graphql/multisig";
import { createSignature } from "@/graphql/signature";
import { createTransaction } from "@/graphql/transaction";
import { CreateDbTxBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import { normalizeDbTransactionJson } from "@/lib/transactionJson";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to create transaction";

const parseImportedSignatures = (value: CreateDbTxBody["importedSignatures"]) => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Field "importedSignatures" must be an array when provided.');
  }

  return value.map((signature, index) => {
    if (!signature || typeof signature !== "object") {
      throw new Error(`importedSignatures[${index}] must be an object.`);
    }
    if (typeof signature.address !== "string" || !signature.address) {
      throw new Error(`importedSignatures[${index}].address must be a non-empty string.`);
    }
    if (typeof signature.signature !== "string" || !signature.signature) {
      throw new Error(`importedSignatures[${index}].signature must be a non-empty string.`);
    }
    if (typeof signature.bodyBytes !== "string" || !signature.bodyBytes) {
      throw new Error(`importedSignatures[${index}].bodyBytes must be a non-empty string.`);
    }

    return signature;
  });
};

async function apiCreateTransaction(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();
  console.log("DEBUG: apiCreateTransaction called");
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: CreateDbTxBody = req.body;
  console.log("🔍 DECIMAL DEBUG: apiCreateTransaction - received body");
  console.log("  - body.dataJSON type:", typeof body.dataJSON);

  try {
    const importedSignatures = parseImportedSignatures(body.importedSignatures);
    const normalizedDataJSON = normalizeDbTransactionJson(body.dataJSON, {
      expectedChainId: body.chainId,
      requireNonEmptyMsgs: true,
    });

    // Log the transaction data
    console.log("🔍 DECIMAL DEBUG: transaction data");
    console.log("  - accountNumber:", normalizedDataJSON.accountNumber);
    console.log("  - sequence:", normalizedDataJSON.sequence);
    console.log("  - chainId:", normalizedDataJSON.chainId);
    console.log("  - msgs count:", normalizedDataJSON.msgs?.length || 0);

    if (normalizedDataJSON.msgs && normalizedDataJSON.msgs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizedDataJSON.msgs.forEach((msg: any, index: number) => {
        console.log(`🔍 DECIMAL DEBUG: msg[${index}]`);
        console.log(`  - typeUrl:`, msg.typeUrl);
        console.log(`  - value:`, msg.value);

        // Specifically check for Send messages and log amounts
        if (msg.typeUrl === "/cosmos.bank.v1beta1.MsgSend" && msg.value?.amount) {
          console.log(`  - SEND amounts:`, msg.value.amount);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          msg.value.amount.forEach((coin: any, coinIndex: number) => {
            console.log(`    - coin[${coinIndex}]:`, coin);
            console.log(`      - denom:`, coin.denom);
            console.log(`      - amount:`, coin.amount);
            console.log(`      - amount type:`, typeof coin.amount);
          });
        }
      });
    }

    console.log("  - fee:", normalizedDataJSON.fee);
    console.log("  - memo:", normalizedDataJSON.memo);
    console.log("DEBUG: fetching multisig", body.chainId, body.creator);
    const multisig = await getMultisig(body.chainId, body.creator);
    if (!multisig) {
      console.error(
        `DEBUG: multisig not found with address ${body.creator} on chain ${body.chainId}`,
      );
      throw new Error(`multisig not found with address ${body.creator} on chain ${body.chainId}`);
    }
    console.log("DEBUG: multisig found", multisig.id);

    // Safely serialize dataJSON, handling BigInt values
    console.log("🔍 DECIMAL DEBUG: serializing dataJSON for DB storage");
    const serializedDataJSON = JSON.stringify(normalizedDataJSON, (key, value) => {
      if (typeof value === "bigint") {
        console.log(`🔍 DECIMAL DEBUG: converting BigInt to string:`, value.toString());
        return value.toString();
      }
      return value;
    });
    console.log("🔍 DECIMAL DEBUG: serializedDataJSON length:", serializedDataJSON.length);

    const txId = await createTransaction({
      dataJSON: serializedDataJSON,
      creator: { id: multisig.id },
    });

    for (const importedSignature of importedSignatures) {
      await createSignature({
        ...importedSignature,
        transaction: { id: txId },
      });
    }
    console.log("DEBUG: transaction created", txId);

    res.status(200).send({ txId });
    console.log("Create transaction success", JSON.stringify({ txId }, null, 2));
  } catch (err: unknown) {
    console.error("DEBUG: Error in apiCreateTransaction", err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiCreateTransaction);
