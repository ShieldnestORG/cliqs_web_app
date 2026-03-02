/**
 * Contract Multisig API - Create/List
 *
 * File: pages/api/chain/[chainId]/contract-multisig/index.ts
 *
 * POST: Instantiate a new CW3 contract multisig
 * GET: List contract multisigs for a user
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface CreateContractMultisigBody {
  /** Code ID for CW3-Fixed contract */
  codeId: number;
  /** Members with weights */
  members: { addr: string; weight: number }[];
  /** Threshold weight for passing proposals */
  threshold: number;
  /** Maximum voting period in seconds */
  maxVotingPeriodSeconds: number;
  /** Label for the contract */
  label: string;
  /** Creator address */
  creator: string;
  /** RPC node address */
  nodeAddress: string;
  /** Optional admin address */
  admin?: string;
  /** Optional name for the cliq */
  name?: string;
  /** Optional description */
  description?: string;
  /** Real contract address from on-chain instantiation */
  contractAddress?: string;
  /** Group contract address (for CW3-Flex multisigs) */
  groupContractAddress?: string;
}

interface _ListContractMultisigsBody {
  /** User address to find multisigs for */
  address: string;
  /** RPC node address */
  nodeAddress: string;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chainId = req.query.chainId;

  if (typeof chainId !== "string" || !chainId) {
    return res.status(400).json({ error: "Invalid chain ID" });
  }

  switch (req.method) {
    case "POST":
      return handleCreate(req, res, chainId);
    case "GET":
      return handleList(req, res, chainId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// ============================================================================
// POST: Create Contract Multisig
// ============================================================================

async function handleCreate(req: NextApiRequest, res: NextApiResponse, chainId: string) {
  try {
    const body: CreateContractMultisigBody = req.body;

    // Validate required fields
    if (!body.codeId || !body.members || !body.threshold || !body.label || !body.creator) {
      return res.status(400).json({
        error: "Missing required fields: codeId, members, threshold, label, creator",
      });
    }

    if (body.members.length === 0) {
      return res.status(400).json({ error: "At least one member is required" });
    }

    // Validate threshold
    const totalWeight = body.members.reduce((sum, m) => sum + m.weight, 0);
    if (body.threshold > totalWeight) {
      return res.status(400).json({
        error: `Threshold (${body.threshold}) cannot exceed total weight (${totalWeight})`,
      });
    }

    // Use the real contract address from client-side instantiation,
    // or fall back to a placeholder if not provided
    const contractAddress = body.contractAddress || `placeholder-${Date.now()}`;

    localDb.createContractMultisig({
      chainId,
      contractAddress,
      codeId: body.codeId,
      creator: body.creator,
      label: body.label,
      threshold: body.threshold,
      maxVotingPeriodSeconds: body.maxVotingPeriodSeconds || 604800, // Default 7 days
      members: body.members,
      name: body.name || null,
      description: body.description || null,
      lastSyncHeight: 0,
      policyVersion: 1,
    });

    return res.status(200).json({
      success: true,
      message: body.contractAddress
        ? "Contract multisig registered successfully."
        : "Contract multisig record created with placeholder address.",
      contractAddress,
      groupContractAddress: body.groupContractAddress || null,
      chainId,
      codeId: body.codeId,
      threshold: body.threshold,
      members: body.members,
    });
  } catch (error) {
    console.error("Failed to create contract multisig:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create contract multisig",
    });
  }
}

// ============================================================================
// GET: List Contract Multisigs
// ============================================================================

async function handleList(req: NextApiRequest, res: NextApiResponse, chainId: string) {
  try {
    const address = req.query.address as string;

    if (!address) {
      return res.status(400).json({ error: "Address query parameter required" });
    }

    // Get multisigs where user is a member
    const memberMultisigs = localDb.getContractMultisigsByMember(chainId, address);

    // Get multisigs created by user
    const createdMultisigs = localDb.getContractMultisigsByCreator(chainId, address);

    // Merge and dedupe
    const allMultisigs = [...memberMultisigs];
    for (const created of createdMultisigs) {
      if (!allMultisigs.some((m) => m.contractAddress === created.contractAddress)) {
        allMultisigs.push(created);
      }
    }

    return res.status(200).json({
      chainId,
      address,
      multisigs: allMultisigs.map((m) => ({
        contractAddress: m.contractAddress,
        label: m.label,
        name: m.name,
        description: m.description,
        threshold: m.threshold,
        memberCount: m.members.length,
        isCreator: m.creator === address,
        isMember: m.members.some((member) => member.addr === address),
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to list contract multisigs:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list contract multisigs",
    });
  }
}
