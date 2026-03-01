/**
 * Transaction Wipe API
 *
 * POST /api/transaction/wipe
 *
 * Allows users to delete their transaction history for privacy.
 * Supports two modes:
 * - "completed" : only wipe broadcast/completed transactions
 * - "all"       : wipe everything (nuclear option)
 *
 * Body: { multisigAddress: string, chainId: string, mode: "completed" | "all" }
 */

import { getMultisig } from "@/graphql";
import * as db from "@/lib/db";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

interface WipeBody {
  multisigAddress: string;
  chainId: string;
  mode: "completed" | "all";
}

async function apiWipeTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: WipeBody = req.body;

  if (!body.multisigAddress || !body.chainId || !body.mode) {
    res.status(400).send("Missing required fields: multisigAddress, chainId, mode");
    return;
  }

  try {
    const multisig = await getMultisig(body.chainId, body.multisigAddress);

    if (!multisig) {
      res.status(404).send("Multisig not found");
      return;
    }

    let result;
    if (body.mode === "all") {
      result = await db.wipeAllTransactions(multisig.id);
    } else {
      result = await db.wipeCompletedTransactions(multisig.id);
    }

    res.status(200).send({
      success: true,
      mode: body.mode,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[Wipe] Error:", err);
    res.status(400).send(
      err instanceof Error ? `Wipe failed: ${err.message}` : "Wipe failed",
    );
  }
}

export default withByodbMiddleware(apiWipeTransactions);
