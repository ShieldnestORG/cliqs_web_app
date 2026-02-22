/**
 * Pause API
 * 
 * File: pages/api/chain/[chainId]/[address]/emergency/pause.ts
 * 
 * POST: Pause or unpause operations
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { getPauseController } from "@/lib/emergency";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chain ID or address" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { action, actor, reason, durationSeconds } = req.body;

    if (!action || !actor) {
      return res.status(400).json({ error: "Missing required fields: action, actor" });
    }

    const pauseController = getPauseController();

    if (action === "pause") {
      if (!reason) {
        return res.status(400).json({ error: "Reason is required for pause" });
      }

      const result = await pauseController.pause(address, chainId, {
        actor,
        reason,
        durationSeconds,
      });

      return res.status(200).json({
        success: result.success,
        pausedAt: result.pausedAt,
        autoUnpauseAt: result.autoUnpauseAt,
      });
    } else if (action === "unpause") {
      const result = await pauseController.unpause(address, chainId, {
        actor,
      });

      return res.status(200).json({
        success: result.success,
        unpausedAt: result.unpausedAt,
      });
    } else {
      return res.status(400).json({ error: "Invalid action. Use 'pause' or 'unpause'" });
    }
  } catch (error) {
    console.error("Pause API error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}

