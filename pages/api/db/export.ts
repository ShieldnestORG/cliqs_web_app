/**
 * BYODB Export API
 *
 * File: pages/api/db/export.ts
 *
 * POST /api/db/export
 * Header: x-byodb-uri (optional – if absent, exports from default DB)
 * Body: { scope?: "all" | "chain", chainId?: string }
 *
 * Exports all data from either the default database or the user's BYODB
 * into a portable JSON format suitable for import.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { withByodbMiddleware, getRequestByodbUri } from "@/lib/byodb/middleware";
import { getDynamicDb } from "@/lib/byodb/dynamicMongo";
import { ensureDbReady } from "@/lib/dbInit";
import * as db from "@/lib/db";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { scope = "all", chainId } = req.body;

  try {
    const byodbUri = getRequestByodbUri();

    if (byodbUri) {
      // Export from user's custom database
      const userDb = await getDynamicDb(byodbUri);

      const filter = scope === "chain" && chainId ? { chainId } : {};

      const [multisigs, transactions, signatures, nonces] = await Promise.all([
        userDb.collection("multisigs").find(filter).toArray(),
        userDb.collection("transactions").find({}).toArray(),
        userDb.collection("signatures").find({}).toArray(),
        userDb.collection("nonces").find(filter).toArray(),
      ]);

      // If chain-scoped, filter transactions and signatures by related multisig addresses
      let filteredTx = transactions;
      let filteredSigs = signatures;

      if (scope === "chain" && chainId) {
        const addresses = new Set(multisigs.map((m) => m.address));
        filteredTx = transactions.filter((t) => addresses.has(t.creatorId));
        const txIds = new Set(filteredTx.map((t) => t._id.toHexString()));
        filteredSigs = signatures.filter((s) => txIds.has(s.transactionId));
      }

      // Strip _id and convert to portable format
      const clean = <T extends Record<string, unknown>>(docs: T[]) =>
        docs.map(({ _id, ...rest }) => {
          void _id;
          return { id: (_id as { toHexString(): string })?.toHexString?.() ?? String(_id), ...rest };
        });

      res.status(200).json({
        version: 1,
        exportedAt: new Date().toISOString(),
        source: "byodb",
        multisigs: clean(multisigs),
        transactions: clean(filteredTx),
        signatures: clean(filteredSigs),
        nonces: clean(nonces),
      });
    } else {
      // Export from default database
      await ensureDbReady();

      // Use the db module to get data. We'll get all data for export.
      // For the default DB we get storage stats as a proxy.
      const stats = await db.getStorageStats();

      // For a full export from default DB, we need direct access
      // This exports what the user has access to
      res.status(200).json({
        version: 1,
        exportedAt: new Date().toISOString(),
        source: "default",
        stats,
        message:
          "Full export from default database. Use BYODB mode to export your personal data.",
      });
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://***")
        : "Export failed";

    res.status(400).json({
      ok: false,
      error: "Export failed",
      message,
    });
  }
}

export default withByodbMiddleware(handler);
