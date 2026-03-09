import { cancelTransaction, getTransaction, updateTxHash } from "@/graphql/transaction";
import { UpdateDbTxHashBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to update transaction";

async function apiTransactionActions(req: NextApiRequest, res: NextApiResponse) {
  const txId = req.query.transactionID;

  if ((req.method !== "POST" && req.method !== "GET") || typeof txId !== "string" || !txId) {
    res.status(405).end();
    return;
  }

  try {
    if (req.method === "GET") {
      const tx = await getTransaction(txId);
      if (!tx) {
        res.status(404).send({ error: "Transaction not found" });
        return;
      }
      res.status(200).send(tx);
      return;
    }

    const body = req.body;

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
