/**
 * Emergency Status API
 *
 * File: pages/api/chain/[chainId]/[address]/emergency/status.ts
 *
 * GET: Get current emergency state
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { getPauseController } from "@/lib/emergency";
import { getSafeModeController } from "@/lib/emergency/safe-mode";

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
    const pauseController = getPauseController();
    const safeModeController = getSafeModeController();

    const pauseState = pauseController.getState(address, chainId);
    const safeModeState = safeModeController.getState(address, chainId);

    return res.status(200).json({
      isPaused: pauseState.isPaused,
      pausedAt: pauseState.pausedAt,
      pausedBy: pauseState.pausedBy,
      pauseReason: pauseState.pauseReason,
      autoUnpauseAt: pauseState.autoUnpauseAt,
      isSafeMode: safeModeState.isSafeMode,
      safeModeThreshold: safeModeState.threshold,
      safeModeActivatedAt: safeModeState.activatedAt,
    });
  } catch (error) {
    console.error("Emergency status API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
