import { cancelTransaction, updateTxHash } from "@/graphql/transaction";
import { UpdateDbTxHashBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to update transaction";

async function apiTransactionActions(req: NextApiRequest, res: NextApiResponse) {
  const txId = req.query.transactionID;

  if (req.method !== "POST" || typeof txId !== "string" || !txId) {
    res.status(405).end();
    return;
  }

  const body = req.body;

  try {
    // Handle cancel action
    if ("action" in body && body.action === "cancel") {
      await cancelTransaction(txId);
      res.status(200).send({ cancelled: true, txId });
      console.log("Cancel transaction success", JSON.stringify({ txId }, null, 2));
      return;
    }

    // Handle update txHash (default action)
    const updateBody: UpdateDbTxHashBody = body;
    const dbTxHash = await updateTxHash(txId, updateBody.txHash);
    res.status(200).send({ dbTxHash });
    console.log("Update txHash success", JSON.stringify({ dbTxHash }, null, 2));
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiTransactionActions);
