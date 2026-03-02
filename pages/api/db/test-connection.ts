/**
 * BYODB Test Connection API
 *
 * File: pages/api/db/test-connection.ts
 *
 * POST /api/db/test-connection
 * Body: { connectionUri: string }
 *
 * Tests connectivity to a user-supplied MongoDB URI.
 * Returns latency, server version, and database name.
 *
 * The connection string is NOT stored server-side.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { testConnection } from "@/lib/byodb/dynamicMongo";

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

  // Basic validation
  if (!connectionUri.startsWith("mongodb://") && !connectionUri.startsWith("mongodb+srv://")) {
    res.status(400).json({
      error: "Invalid connection string",
      message: "Must start with mongodb:// or mongodb+srv://",
    });
    return;
  }

  if (connectionUri.length > 2048) {
    res.status(400).json({ error: "Connection string too long" });
    return;
  }

  try {
    const result = await testConnection(connectionUri);

    res.status(200).json({
      ok: result.ok,
      latencyMs: result.latencyMs,
      serverVersion: result.serverVersion,
      dbName: result.dbName,
    });
  } catch (err) {
    // Sanitize the error to avoid leaking credentials in error messages
    const message =
      err instanceof Error
        ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://***")
        : "Connection failed";

    res.status(400).json({
      ok: false,
      error: "Connection test failed",
      message,
    });
  }
}
