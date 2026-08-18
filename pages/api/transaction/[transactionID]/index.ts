import { cancelTransaction, getTransaction, updateTxHash } from "@/graphql/transaction";
import { UpdateDbTxHashBody } from "@/lib/api";
import { recordAuditEvent } from "@/lib/audit";
import * as db from "@/lib/db";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import {
  TRANSACTION_READ_LIMIT,
  TRANSACTION_READ_ROUTE,
  checkRateLimit,
  getClientIdentifier,
  rateLimitKey,
} from "@/lib/rateLimit";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to update transaction";

/**
 * Audit a transaction action. Deliberately called AFTER the response has been
 * sent, and wrapped in its own try/catch, because this route carries the
 * post-broadcast hash write: by the time it runs the funds have already moved,
 * and nothing here may turn a completed broadcast into an error. The outer
 * handler's catch would try to respond a second time on an already-sent
 * response, so this must never throw into it.
 *
 * The audit chain is partitioned by multisig address, which the request body
 * does not carry — only a transaction id. `creatorId` on the stored transaction
 * IS the multisig address (see MongoTransaction in lib/mongodb.ts), so one
 * cheap lookup resolves it without a join.
 */
async function auditTxAction(
  action: "TX_CANCELLED" | "TX_BROADCAST",
  txId: string,
  payload?: unknown,
): Promise<void> {
  try {
    const tx = await db.getTransaction(txId);
    const multisigAddress = tx?.creatorId;

    if (typeof multisigAddress !== "string" || !multisigAddress) {
      // Same class of gap recordAuditEvent reports, logged in the same shape so
      // one alert can match both.
      console.error(
        `[Audit] CONTROL GAP: ${action} not recorded, could not resolve the multisig for transaction ${txId}`,
      );
      return;
    }

    await recordAuditEvent({
      action,
      multisigAddress,
      outcome: "allow",
      // This route has no caller proof — see docs/security/AUTH-REWORK-PLAN.md.
      // The action is evidenced; the actor is not.
      authMethod: "none",
      targetId: txId,
      payload,
    });
  } catch (err: unknown) {
    console.error(
      `[Audit] CONTROL GAP: ${action} not recorded for transaction ${txId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function apiTransactionActions(req: NextApiRequest, res: NextApiResponse) {
  const txId = req.query.transactionID;

  if ((req.method !== "POST" && req.method !== "GET") || typeof txId !== "string" || !txId) {
    res.status(405).end();
    return;
  }

  // READS ARE LIMITED. WRITES ARE NOT. Do not "simplify" this by hoisting the
  // limit above the method branch — that is what an earlier revision did, and it
  // is a funds bug, not a style nit.
  //
  // POST on this route carries updateDbTxHash, which runs immediately AFTER a
  // transaction has been broadcast and is already on chain
  // (pages/[chainName]/[address]/transaction/[transactionID].tsx records the
  // hash first, for the reason stated in the comment there). lib/request.ts
  // turns any non-2xx into a rejected promise, so a 429 here throws past
  // setTransactionHash / setTransactionStatus("broadcast") and the row stays
  // status=pending with an empty txHash while the funds have already moved. The
  // operator then sees a generic broadcast failure and is steered toward
  // cancel-and-recreate — a double-execution risk for a MsgSend. A shared
  // budget made that reachable from nothing worse than several CLIQ members
  // sitting behind one office NAT or mobile CGNAT egress IP.
  //
  // The write path is authenticated only by knowing the transaction id, exactly
  // as before; declining to rate limit it does not widen access.
  try {
    if (req.method === "GET") {
      // The GET is unauthenticated and returns the full transaction — dataJSON
      // (messages, amounts, recipients, memo) plus every collected signature.
      // With no limit, an attacker holding or guessing transaction ids can sweep
      // them for free. A limit does not make the read private; it makes bulk
      // harvesting cost something. The same budget is charged in the transaction
      // page's getServerSideProps, which returns the identical payload — without
      // that, this limit was bypassable by requesting the page instead.
      //
      // Still NOT a fix for the disclosure itself: anyone with a transaction id
      // can read it. Closing that changes who can open a transaction link, which
      // is a product decision, and it must not land before Ledger holders can
      // authenticate at all.
      const limit = checkRateLimit(
        rateLimitKey(TRANSACTION_READ_ROUTE, getClientIdentifier(req)),
        TRANSACTION_READ_LIMIT,
      );
      if (!limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfterSeconds));
        res.status(429).send("Too many requests");
        return;
      }

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
      await auditTxAction("TX_CANCELLED", txId);
      return;
    }

    // Handle update txHash (default action)
    const updateBody: UpdateDbTxHashBody = body;
    const dbTxHash = await updateTxHash(txId, updateBody.txHash);
    res.status(200).send({ dbTxHash });
    console.log("Update txHash success", JSON.stringify({ dbTxHash }, null, 2));
    await auditTxAction("TX_BROADCAST", txId, { txHash: updateBody.txHash });
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiTransactionActions);
