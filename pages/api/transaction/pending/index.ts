import { getMultisig } from "@/graphql";
import { getPendingTransactions } from "@/graphql/transaction";
import { GetPendingTxsBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to get pending transactions";

async function apiGetPendingTransactions(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: GetPendingTxsBody = req.body;

  try {
    // Find the multisig
    const multisig = await getMultisig(body.chainId, body.multisigAddress);

    if (!multisig) {
      res.status(200).send([]);
      return;
    }

    // Get pending transactions for this multisig
    const pendingTxs = await getPendingTransactions(multisig.id);
    res.status(200).send(pendingTxs);
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiGetPendingTransactions);
