/**
 * BYODB Setup (Provision) API
 *
 * File: pages/api/db/setup.ts
 *
 * POST /api/db/setup
 * Body: { connectionUri: string }
 *
 * Creates all required collections and indexes on the user's MongoDB database.
 * Safe to call multiple times (indexes are idempotent).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { provisionDatabase, getDynamicDbStats } from "@/lib/byodb/dynamicMongo";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { connectionUri } = req.body;

  if (!connectionUri || typeof connectionUri !== "string") {
    res.status(400).json({ error: "connectionUri is required" });
    return;
  }

  if (!connectionUri.startsWith("mongodb://") && !connectionUri.startsWith("mongodb+srv://")) {
    res.status(400).json({ error: "Invalid connection string" });
    return;
  }

  try {
    const result = await provisionDatabase(connectionUri);
    const stats = await getDynamicDbStats(connectionUri);

    res.status(200).json({
      ok: true,
      collectionsCreated: result.collectionsCreated,
      indexesCreated: result.indexesCreated,
      stats,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://***")
        : "Setup failed";

    res.status(400).json({
      ok: false,
      error: "Database setup failed",
      message,
    });
  }
}
