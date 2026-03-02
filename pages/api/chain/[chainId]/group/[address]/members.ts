/**
 * Group Members API
 *
 * File: pages/api/chain/[chainId]/group/[address]/members.ts
 *
 * API endpoints for group member operations.
 *
 * GET - Get group members
 * PATCH - Update members (admin only - requires wallet signature)
 *
 * Phase 2: Group-Backed Multisig
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface MembersResponse {
  groupAddress: string;
  chainId: string;
  members: Array<{
    address: string;
    weight: number;
  }>;
  totalWeight: number;
  admin: string | null;
}

interface UpdateMembersBody {
  add?: Array<{ address: string; weight: number }>;
  remove?: string[];
  update?: Array<{ address: string; weight: number }>;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chainId or address" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(req, res, chainId, address);
    case "PATCH":
      return handlePatch(req, res, chainId, address);
    default:
      res.setHeader("Allow", ["GET", "PATCH"]);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// ============================================================================
// GET: Get Members
// ============================================================================

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  groupAddress: string,
) {
  try {
    const group = localDb.getGroup(chainId, groupAddress);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Note: In a production system, we would fetch members from chain
    // via CW4Client.queryAllMembers(). For now, return cached info.
    const response: MembersResponse = {
      groupAddress: group.groupAddress,
      chainId: group.chainId,
      members: [], // Would be populated from chain query
      totalWeight: group.totalWeight,
      admin: group.admin,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching members:", error);
    return res.status(500).json({
      error: "Failed to fetch members",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================================================
// PATCH: Update Members (requires chain interaction)
// ============================================================================

async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  groupAddress: string,
) {
  try {
    const body: UpdateMembersBody = req.body;

    const group = localDb.getGroup(chainId, groupAddress);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Validate that at least one operation is specified
    const hasOperations =
      (body.add && body.add.length > 0) ||
      (body.remove && body.remove.length > 0) ||
      (body.update && body.update.length > 0);

    if (!hasOperations) {
      return res.status(400).json({
        error: "No operations specified. Provide add, remove, or update arrays.",
      });
    }

    // Note: Actual member updates require a signed transaction
    // This endpoint would typically:
    // 1. Build the update_members message
    // 2. Return it for the client to sign
    // 3. Or accept a signed transaction to broadcast

    // For now, return the operations to be performed
    return res.status(200).json({
      message: "Member update prepared",
      groupAddress,
      operations: {
        add: body.add ?? [],
        remove: body.remove ?? [],
        update: body.update ?? [],
      },
      note: "Submit a signed transaction to apply these changes",
    });
  } catch (error) {
    console.error("Error updating members:", error);
    return res.status(500).json({
      error: "Failed to update members",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
