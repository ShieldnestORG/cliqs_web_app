/**
 * Alerts API
 *
 * File: pages/api/chain/[chainId]/[address]/monitoring/alerts.ts
 *
 * GET: Get recent alerts
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import * as localDb from "@/lib/localDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chain ID or address" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const alerts = localDb.getAlerts(address, limit);

    return res.status(200).json({ alerts });
  } catch (error) {
    console.error("Alerts API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
