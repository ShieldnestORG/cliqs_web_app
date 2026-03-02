/**
 * BYODB Import API
 *
 * File: pages/api/db/import.ts
 *
 * POST /api/db/import
 * Header: x-byodb-uri (required – imports only into user's BYODB)
 * Body: ImportPayload JSON
 *
 * Validates, sanitizes, and imports data into the user's database.
 * Refuses to import into the default (shared) database for safety.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { withByodbMiddleware, getRequestByodbUri } from "@/lib/byodb/middleware";
import { getDynamicDb } from "@/lib/byodb/dynamicMongo";
import {
  validateImportData,
  sanitizeForInsert,
  type ImportPayload,
} from "@/lib/byodb/importValidator";

/** Max request body size for import (50MB) */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const byodbUri = getRequestByodbUri();
  if (!byodbUri) {
    res.status(403).json({
      error: "Import requires BYODB mode",
      message:
        "Data can only be imported into your own database. " +
        "Configure your database connection in Settings first.",
    });
    return;
  }

  try {
    // Step 1: Validate
    const rawSize = JSON.stringify(req.body).length;
    const validation = validateImportData(req.body, rawSize);

    if (!validation.valid || !validation.data) {
      res.status(400).json({
        ok: false,
        error: "Validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
        stats: validation.stats,
      });
      return;
    }

    const data: ImportPayload = validation.data;

    // Step 2: Connect to user's database
    const db = await getDynamicDb(byodbUri);

    // Step 3: Import in order (multisigs first, then transactions, etc.)
    const results = {
      multisigs: { inserted: 0, skipped: 0 },
      transactions: { inserted: 0, skipped: 0, idMap: new Map<string, string>() },
      signatures: { inserted: 0, skipped: 0 },
      nonces: { inserted: 0, skipped: 0 },
    };

    // 3a: Import multisigs
    const multisigCol = db.collection("multisigs");
    for (const m of data.multisigs) {
      const cleaned = sanitizeForInsert(m as Record<string, unknown>);
      const now = new Date().toISOString();

      try {
        const existing = await multisigCol.findOne({
          chainId: m.chainId,
          address: m.address,
        });

        if (existing) {
          results.multisigs.skipped++;
        } else {
          await multisigCol.insertOne({
            ...cleaned,
            createdAt: m.createdAt || now,
            updatedAt: now,
          });
          results.multisigs.inserted++;
        }
      } catch {
        results.multisigs.skipped++;
      }
    }

    // 3b: Import transactions (track old->new ID mapping for signatures)
    const txCol = db.collection("transactions");
    for (const tx of data.transactions) {
      const oldId = tx.id;
      const { id: _unusedId, ...txData } = sanitizeForInsert(tx as Record<string, unknown>);
      void _unusedId;
      const now = new Date().toISOString();

      try {
        const insertResult = await txCol.insertOne({
          ...txData,
          status: tx.status || "pending",
          createdAt: tx.createdAt || now,
          updatedAt: now,
        });
        const newId = insertResult.insertedId.toHexString();
        if (oldId) {
          results.transactions.idMap.set(oldId, newId);
        }
        results.transactions.inserted++;
      } catch {
        results.transactions.skipped++;
      }
    }

    // 3c: Import signatures (remap transaction IDs)
    const sigCol = db.collection("signatures");
    for (const sig of data.signatures) {
      const cleaned = sanitizeForInsert(sig as Record<string, unknown>);

      // Remap the transaction ID if we have a mapping
      const remappedTxId = results.transactions.idMap.get(sig.transactionId) || sig.transactionId;

      try {
        const existing = await sigCol.findOne({
          transactionId: remappedTxId,
          address: sig.address,
        });

        if (existing) {
          results.signatures.skipped++;
        } else {
          await sigCol.insertOne({
            ...cleaned,
            transactionId: remappedTxId,
            createdAt: sig.createdAt || new Date().toISOString(),
          });
          results.signatures.inserted++;
        }
      } catch {
        results.signatures.skipped++;
      }
    }

    // 3d: Import nonces (upsert)
    const nonceCol = db.collection("nonces");
    for (const n of data.nonces) {
      const cleaned = sanitizeForInsert(n as Record<string, unknown>);

      try {
        await nonceCol.updateOne(
          { chainId: n.chainId, address: n.address },
          { $set: cleaned },
          { upsert: true },
        );
        results.nonces.inserted++;
      } catch {
        results.nonces.skipped++;
      }
    }

    res.status(200).json({
      ok: true,
      imported: {
        multisigs: results.multisigs,
        transactions: {
          inserted: results.transactions.inserted,
          skipped: results.transactions.skipped,
        },
        signatures: results.signatures,
        nonces: results.nonces,
      },
      warnings: validation.warnings,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://***")
        : "Import failed";

    res.status(400).json({
      ok: false,
      error: "Import failed",
      message,
    });
  }
}

export default withByodbMiddleware(handler);
