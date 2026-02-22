/**
 * Group API - Index
 * 
 * File: pages/api/chain/[chainId]/group/[address]/index.ts
 * 
 * API endpoints for CW4 group contract operations.
 * 
 * GET - Get group details and members
 * POST - Register a new group in local DB
 * 
 * Phase 2: Group-Backed Multisig
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface GroupResponse {
  groupAddress: string;
  chainId: string;
  groupType: "cw4" | "custom";
  admin: string | null;
  multisigAddress: string | null;
  label: string | null;
  totalWeight: number;
  memberCount: number;
  lastSyncHeight: number;
  createdAt: string;
  updatedAt: string;
}

interface RegisterGroupBody {
  groupType?: "cw4" | "custom";
  admin?: string | null;
  multisigAddress?: string;
  label?: string;
  totalWeight: number;
  memberCount: number;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chainId or address" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(req, res, chainId, address);
    case "POST":
      return handlePost(req, res, chainId, address);
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// ============================================================================
// GET: Get Group Details
// ============================================================================

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  groupAddress: string
) {
  try {
    const group = localDb.getGroup(chainId, groupAddress);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const response: GroupResponse = {
      groupAddress: group.groupAddress,
      chainId: group.chainId,
      groupType: group.groupType,
      admin: group.admin,
      multisigAddress: group.multisigAddress,
      label: group.label,
      totalWeight: group.totalWeight,
      memberCount: group.memberCount,
      lastSyncHeight: group.lastSyncHeight,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching group:", error);
    return res.status(500).json({
      error: "Failed to fetch group",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================================================
// POST: Register Group
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  groupAddress: string
) {
  try {
    const body: RegisterGroupBody = req.body;

    // Validate required fields
    if (body.totalWeight === undefined || body.memberCount === undefined) {
      return res.status(400).json({
        error: "Missing required fields: totalWeight, memberCount",
      });
    }

    // Check if group already exists
    const existing = localDb.getGroup(chainId, groupAddress);
    if (existing) {
      // Update existing group
      localDb.updateGroup(chainId, groupAddress, {
        admin: body.admin,
        totalWeight: body.totalWeight,
        label: body.label,
      });

      return res.status(200).json({
        message: "Group updated",
        groupAddress,
      });
    }

    // Create new group record
    localDb.createGroup({
      groupAddress,
      chainId,
      groupType: body.groupType ?? "cw4",
      admin: body.admin ?? null,
      multisigAddress: body.multisigAddress ?? null,
      label: body.label ?? null,
      totalWeight: body.totalWeight,
      memberCount: body.memberCount,
      lastSyncHeight: 0,
    });

    return res.status(201).json({
      message: "Group registered",
      groupAddress,
    });
  } catch (error) {
    console.error("Error registering group:", error);
    return res.status(500).json({
      error: "Failed to register group",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

