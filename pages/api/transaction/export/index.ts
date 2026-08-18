/**
 * Transaction Export API
 *
 * POST /api/transaction/export
 *
 * Exports all transaction history for a multisig as JSON.
 * Users can download this before wiping their history.
 * Restricted to verified cliq members: the history includes every member's
 * signatures and pending (not-yet-on-chain) transactions.
 *
 * Body: {
 *   multisigAddress: string,
 *   chainId: string,
 *   signature?: StdSignature, // ADR-36 membership proof; required unless BYODB
 *   chain?: ChainInfo,        // required unless BYODB
 * }
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { getMultisig } from "@/graphql";
import { getNonce, incrementNonce } from "@/graphql/nonce";
import { recordAuditEvent } from "@/lib/audit";
import { isUsingByodb, withByodbMiddleware } from "@/lib/byodb/middleware";
import * as db from "@/lib/db";
import { ensureDbReady } from "@/lib/dbInit";
import { verifyKeplrSignature } from "@/lib/keplr";
import { StdSignature, decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import type { NextApiRequest, NextApiResponse } from "next";

interface ExportBody {
  multisigAddress: string;
  chainId: string;
  signature?: StdSignature;
  chain?: ChainInfo;
}

async function apiExportTransactions(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();
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

    // Authorization (ADR-36, same recipe as /api/transaction/list): membership
    // check against the multisig's pubkeys + a nonce-bound Keplr signature.
    // Skipped for BYODB requests — the data lives in the user's own database.
    //
    // Deliberate deviations from list/index.ts:
    // - verifyKeplrSignature verifies the generic "Keplr Login" message, so this
    //   authorization is indistinguishable from a login signature. Hardening to a
    //   purpose-scoped message is a follow-up.
    // - The on-chain StargateClient.getAccount check is intentionally dropped:
    //   membership + nonce replay protection suffice, and this path should not
    //   depend on RPC availability.
    // Hoisted so the audit record below can name the caller. Stays null on the
    // BYODB path, where the request carries no wallet proof.
    let callerAddress: string | null = null;

    if (!isUsingByodb()) {
      if (!body.signature || !body.chain) {
        res.status(401).send("Authentication required: missing signature or chain");
        return;
      }

      if (body.chain.chainId !== body.chainId) {
        res.status(400).send("chainId mismatch between chainId and chain.chainId");
        return;
      }

      const { pubkey: decodedPubKey } = decodeSignature(body.signature);

      if (!multisig.pubkeyJSON.includes(toBase64(decodedPubKey))) {
        res.status(403).send("Your account does not belong to the multisig");
        return;
      }

      const address = pubkeyToAddress(body.signature.pub_key, body.chain.addressPrefix);
      callerAddress = address;

      const dbNonce = await getNonce(body.chainId, address);
      const incrementedNonce = await incrementNonce(body.chainId, address);

      if (incrementedNonce !== dbNonce + 1) {
        res.status(401).send("Nonce increment failed");
        return;
      }

      if (!(await verifyKeplrSignature(body.signature, body.chain, dbNonce))) {
        res.status(401).send("Signature verification failed");
        return;
      }
    }

    const history = await db.exportTransactionHistory(multisig.id);

    // A full history dump is a disclosure event: it is the whole record of a
    // cliq's activity leaving the system. Only the count is recorded — the
    // exported bodies carry amounts, recipients and memos and must not be
    // duplicated into the log.
    await recordAuditEvent({
      action: "HISTORY_EXPORTED",
      multisigAddress: body.multisigAddress,
      chainId: body.chainId,
      outcome: "allow",
      actorAddress: callerAddress,
      authMethod: callerAddress ? "adr36" : "byodb-header",
      targetId: multisig.id,
      payload: { transactionCount: history.length },
    });

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
