/**
 * Transaction Wipe API
 *
 * POST /api/transaction/wipe
 *
 * Allows verified cliq members to delete their transaction history for privacy.
 * Supports three modes:
 * - "completed" : only wipe broadcast/completed transactions
 * - "all"       : wipe everything (nuclear option)
 * - "multisig"  : wipe everything AND delete the multisig record itself
 *
 * Body: {
 *   multisigAddress: string,
 *   chainId: string,
 *   mode: "completed" | "all" | "multisig",
 *   signature?: StdSignature, // ADR-36 membership proof; required unless BYODB
 *   chain?: ChainInfo,        // required unless BYODB
 * }
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { getMultisig } from "@/graphql";
import { getNonce, incrementNonce } from "@/graphql/nonce";
import { isUsingByodb, withByodbMiddleware } from "@/lib/byodb/middleware";
import * as db from "@/lib/db";
import { ensureDbReady } from "@/lib/dbInit";
import { verifyKeplrSignature } from "@/lib/keplr";
import { StdSignature, decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import type { NextApiRequest, NextApiResponse } from "next";

const WIPE_MODES = ["completed", "all", "multisig"] as const;

interface WipeBody {
  multisigAddress: string;
  chainId: string;
  mode: (typeof WIPE_MODES)[number];
  signature?: StdSignature;
  chain?: ChainInfo;
}

async function apiWipeTransactions(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: WipeBody = req.body;

  if (!body.multisigAddress || !body.chainId || !body.mode) {
    res.status(400).send("Missing required fields: multisigAddress, chainId, mode");
    return;
  }

  if (!WIPE_MODES.includes(body.mode)) {
    res.status(400).send(`Invalid mode: must be one of ${WIPE_MODES.join(", ")}`);
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
    //   purpose-scoped message ("I authorize wiping ...") is a follow-up.
    // - The on-chain StargateClient.getAccount check is intentionally dropped:
    //   membership + nonce replay protection suffice, and a deletion path should
    //   not depend on RPC availability.
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

      callerAddress = pubkeyToAddress(body.signature.pub_key, body.chain.addressPrefix);

      const dbNonce = await getNonce(body.chainId, callerAddress);
      const incrementedNonce = await incrementNonce(body.chainId, callerAddress);

      if (incrementedNonce !== dbNonce + 1) {
        res.status(401).send("Nonce increment failed");
        return;
      }

      if (!(await verifyKeplrSignature(body.signature, body.chain, dbNonce))) {
        res.status(401).send("Signature verification failed");
        return;
      }
    }

    // Shared-data guard: transactions are joint records of all members.
    // Destroying pending transactions would silently discard other members'
    // signatures, so "all" and "multisig" are refused while such transactions
    // exist. The caller must first cancel them via the regular cancel flow,
    // which stays visible to everyone.
    if ((body.mode === "all" || body.mode === "multisig") && callerAddress) {
      const pendingTxs = await db.getPendingTransactionsByCreator(multisig.id);
      let blockedCount = 0;
      for (const tx of pendingTxs) {
        const signatures = await db.getSignaturesByTransaction(tx.id);
        if (signatures.some((signature) => signature.address !== callerAddress)) {
          blockedCount++;
        }
      }
      if (blockedCount > 0) {
        res
          .status(409)
          .send(
            `Cannot wipe: ${blockedCount} pending transaction(s) carry signatures from other members. Cancel them first, then retry.`,
          );
        return;
      }
    }

    let result;
    if (body.mode === "multisig") {
      result = await db.deleteMultisig(multisig.id);
    } else if (body.mode === "all") {
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
    res.status(400).send(err instanceof Error ? `Wipe failed: ${err.message}` : "Wipe failed");
  }
}

export default withByodbMiddleware(apiWipeTransactions);
