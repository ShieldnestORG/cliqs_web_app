/**
 * Snapshots API
 * 
 * File: pages/api/chain/[chainId]/contract-multisig/[address]/snapshots.ts
 * 
 * API endpoints for member and vote snapshots.
 * 
 * GET - Get snapshots for a proposal
 * 
 * Phase 2: Group-Backed Multisig
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface MemberSnapshotResponse {
  proposalId: number;
  members: Array<{ addr: string; weight: number }>;
  totalWeight: number;
  snapshotHeight: number;
  snapshotTime: string;
  groupAddress: string;
}

interface VoteSnapshotResponse {
  proposalId: number;
  votes: Array<{
    voter: string;
    weightAtVote: number;
    credentialValid: boolean;
    voteHeight: number;
    voteTime: string;
  }>;
}

interface SnapshotsResponse {
  contractAddress: string;
  proposalId: number;
  memberSnapshot: MemberSnapshotResponse | null;
  voteSnapshots: VoteSnapshotResponse | null;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { chainId, address, proposalId } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chainId or address" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(req, res, chainId, address, proposalId);
    default:
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// ============================================================================
// GET: Get Snapshots
// ============================================================================

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  _chainId: string,
  contractAddress: string,
  proposalIdParam: string | string[] | undefined
) {
  try {
    // If proposalId is provided, get snapshots for that proposal
    if (proposalIdParam) {
      const proposalId = parseInt(
        Array.isArray(proposalIdParam) ? proposalIdParam[0] : proposalIdParam,
        10
      );

      if (isNaN(proposalId)) {
        return res.status(400).json({ error: "Invalid proposalId" });
      }

      // Get member snapshot
      const memberSnapshot = localDb.getMemberSnapshot(contractAddress, proposalId);
      
      // Get vote snapshots
      const voteSnapshots = localDb.getVoteSnapshots(contractAddress, proposalId);

      const response: SnapshotsResponse = {
        contractAddress,
        proposalId,
        memberSnapshot: memberSnapshot ? {
          proposalId: memberSnapshot.proposalId,
          members: localDb.parseMemberSnapshotMembers(memberSnapshot),
          totalWeight: memberSnapshot.totalWeight,
          snapshotHeight: memberSnapshot.snapshotHeight,
          snapshotTime: memberSnapshot.snapshotTime,
          groupAddress: memberSnapshot.groupAddress,
        } : null,
        voteSnapshots: voteSnapshots.length > 0 ? {
          proposalId,
          votes: voteSnapshots.map((v) => ({
            voter: v.voter,
            weightAtVote: v.weightAtVote,
            credentialValid: v.credentialValid,
            voteHeight: v.voteHeight,
            voteTime: v.voteTime,
          })),
        } : null,
      };

      return res.status(200).json(response);
    }

    // If no proposalId, return all snapshots for the contract
    const memberSnapshots = localDb.getMemberSnapshots(contractAddress);

    const response = {
      contractAddress,
      memberSnapshots: memberSnapshots.map((s) => ({
        proposalId: s.proposalId,
        totalWeight: s.totalWeight,
        snapshotHeight: s.snapshotHeight,
        snapshotTime: s.snapshotTime,
        memberCount: localDb.parseMemberSnapshotMembers(s).length,
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return res.status(500).json({
      error: "Failed to fetch snapshots",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

