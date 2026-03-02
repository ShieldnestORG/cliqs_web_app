/**
 * Transaction Export API
 *
 * POST /api/transaction/export
 *
 * Exports all transaction history for a multisig as JSON.
 * Users can download this before wiping their history.
 *
 * Body: { multisigAddress: string, chainId: string }
 */

import { getMultisig } from "@/graphql";
import * as db from "@/lib/db";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

interface ExportBody {
  multisigAddress: string;
  chainId: string;
}

async function apiExportTransactions(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: ExportBody = req.body;

  if (!body.multisigAddress || !body.chainId) {
    res.status(400).send("Missing required fields: multisigAddress, chainId");
    return;
  }

  try {
    const multisig = await getMultisig(body.chainId, body.multisigAddress);

    if (!multisig) {
      res.status(404).send("Multisig not found");
      return;
    }

    const history = await db.exportTransactionHistory(multisig.id);

    res.status(200).json({
      multisigAddress: body.multisigAddress,
      chainId: body.chainId,
      exportedAt: new Date().toISOString(),
      transactionCount: history.length,
      transactions: history,
    });

    console.log(`[Export] ${history.length} transactions exported for ${body.multisigAddress}`);
  } catch (err: unknown) {
    console.error("[Export] Error:", err);
    res.status(400).send(err instanceof Error ? `Export failed: ${err.message}` : "Export failed");
  }
}

export default withByodbMiddleware(apiExportTransactions);
