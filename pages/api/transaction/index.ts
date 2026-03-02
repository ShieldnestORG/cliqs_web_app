import { getMultisig } from "@/graphql/multisig";
import { createTransaction } from "@/graphql/transaction";
import { CreateDbTxBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to create transaction";

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

  // Log the transaction data
  try {
    console.log("🔍 DECIMAL DEBUG: transaction data");
    console.log("  - accountNumber:", body.dataJSON.accountNumber);
    console.log("  - sequence:", body.dataJSON.sequence);
    console.log("  - chainId:", body.dataJSON.chainId);
    console.log("  - msgs count:", body.dataJSON.msgs?.length || 0);

    if (body.dataJSON.msgs && body.dataJSON.msgs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body.dataJSON.msgs.forEach((msg: any, index: number) => {
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

    console.log("  - fee:", body.dataJSON.fee);
    console.log("  - memo:", body.dataJSON.memo);
  } catch (error) {
    console.error("🔍 DECIMAL DEBUG: Failed to log transaction data:", error);
  }

  try {
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
    const serializedDataJSON = JSON.stringify(body.dataJSON, (key, value) => {
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
    console.log("DEBUG: transaction created", txId);

    res.status(200).send({ txId });
    console.log("Create transaction success", JSON.stringify({ txId }, null, 2));
  } catch (err: unknown) {
    console.error("DEBUG: Error in apiCreateTransaction", err);
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiCreateTransaction);
