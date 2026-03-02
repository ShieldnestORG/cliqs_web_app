/**
 * Database Stats API
 *
 * GET /api/db/stats
 *
 * Returns storage usage stats for the database.
 * Useful for monitoring the 512 MB free-tier limit.
 */

import * as db from "@/lib/db";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

async function apiDbStats(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  try {
    const stats = await db.getStorageStats();

    if (!stats) {
      res.status(200).json({
        backend: "localDb",
        message: "Stats not available for local JSON database",
      });
      return;
    }

    const limitMB = 512;
    const usagePercent = Math.round((stats.estimatedSizeMB / limitMB) * 10000) / 100;

    res.status(200).json({
      backend: "mongodb",
      ...stats,
      limitMB,
      usagePercent: `${usagePercent}%`,
      healthy: stats.estimatedSizeMB < limitMB * 0.8,
    });
  } catch (err: unknown) {
    console.error("[DB Stats] Error:", err);
    res.status(500).send(err instanceof Error ? err.message : "Failed to get stats");
  }
}

export default withByodbMiddleware(apiDbStats);
