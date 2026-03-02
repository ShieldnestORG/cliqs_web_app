/**
 * Metrics API
 *
 * File: pages/api/chain/[chainId]/[address]/monitoring/metrics.ts
 *
 * GET: Get metrics for a multisig
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { getMetricsRegistry } from "@/lib/monitoring/metrics";

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
    const registry = getMetricsRegistry();
    const metrics = registry.export();

    return res.status(200).json({ metrics });
  } catch (error) {
    console.error("Metrics API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
