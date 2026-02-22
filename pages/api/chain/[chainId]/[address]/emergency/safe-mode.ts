/**
 * Safe Mode API
 * 
 * File: pages/api/chain/[chainId]/[address]/emergency/safe-mode.ts
 * 
 * POST: Activate or deactivate safe mode
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { getSafeModeController } from "@/lib/emergency/safe-mode";

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
    const { action, actor, threshold, normalThreshold, reason } = req.body;

    if (!action || !actor) {
      return res.status(400).json({ error: "Missing required fields: action, actor" });
    }

    const safeModeController = getSafeModeController();

    if (action === "activate") {
      if (typeof threshold !== "number" || typeof normalThreshold !== "number") {
        return res.status(400).json({ 
          error: "threshold and normalThreshold are required for activation" 
        });
      }

      const result = await safeModeController.activate(
        address,
        chainId,
        normalThreshold,
        {
          actor,
          trigger: "manual",
          elevatedThreshold: threshold,
          reason,
        },
      );

      return res.status(200).json({
        success: result.success,
        activatedAt: result.activatedAt,
        previousThreshold: result.previousThreshold,
        newThreshold: result.newThreshold,
        autoDisableAt: result.autoDisableAt,
      });
    } else if (action === "deactivate") {
      const normalThresholdValue = normalThreshold || 1;

      const result = await safeModeController.deactivate(
        address,
        chainId,
        normalThresholdValue,
        {
          actor,
          reason,
        },
      );

      return res.status(200).json({
        success: result.success,
        deactivatedAt: result.deactivatedAt,
        restoredThreshold: result.restoredThreshold,
      });
    } else {
      return res.status(400).json({ error: "Invalid action. Use 'activate' or 'deactivate'" });
    }
  } catch (error) {
    console.error("Safe mode API error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}

