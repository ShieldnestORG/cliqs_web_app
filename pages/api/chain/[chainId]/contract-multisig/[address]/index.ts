/**
 * Contract Multisig API - Single Contract Operations
 * 
 * File: pages/api/chain/[chainId]/contract-multisig/[address]/index.ts
 * 
 * GET: Get contract config, proposals, and state
 * POST: Trigger sync or verify proposal
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";
import { CW3Client } from "@/lib/contract/cw3-client";
import { createSyncJob } from "@/lib/indexer/sync-job";
import { 
  verifyCanVote, 
  verifyCanExecute, 
  verifyAndReconcileProposal,
} from "@/lib/indexer/chain-verifier";

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chain ID or address" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(req, res, chainId, address);
    case "POST":
      return handlePost(req, res, chainId, address);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// ============================================================================
// GET: Get Contract Multisig State
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  contractAddress: string
) {
  try {
    const nodeAddress = req.query.nodeAddress as string;
    const includeProposals = req.query.proposals !== "false";
    const proposalStatus = req.query.status as string | undefined;

    if (!nodeAddress) {
      return res.status(400).json({ error: "nodeAddress query parameter required" });
    }

    // Ensure protocol prefix for RPC endpoint (inline to avoid browser-only imports)
    const rpcEndpoint = nodeAddress.startsWith("http") || nodeAddress.startsWith("ws")
      ? nodeAddress
      : `https://${nodeAddress}`;

    // Try to get from DB first
    let dbMultisig = localDb.getContractMultisig(chainId, contractAddress);
    
    // If not in DB, try to fetch from chain and cache
    if (!dbMultisig) {
      try {
        const client = new CW3Client(rpcEndpoint, contractAddress, chainId);
        const config = await client.queryConfig();

        // Extract threshold
        let threshold = 1;
        if (config.threshold.absolute_count) {
          threshold = config.threshold.absolute_count.weight;
        } else if (config.threshold.absolute_percentage) {
          threshold = Math.ceil(
            parseFloat(config.threshold.absolute_percentage.percentage) *
            config.threshold.absolute_percentage.total_weight
          );
        }

        // Create DB record
        localDb.createContractMultisig({
          chainId,
          contractAddress,
          codeId: 0, // Unknown
          creator: "",
          label: contractAddress.slice(0, 20),
          threshold,
          // Use time-based voting period from contract; height-based periods
          // are not supported in the DB schema and fall back to 7 days
          maxVotingPeriodSeconds: config.max_voting_period.time ?? 604800,
          members: config.voters,
          name: null,
          description: null,
          lastSyncHeight: 0,
          policyVersion: 1,
        });

        dbMultisig = localDb.getContractMultisig(chainId, contractAddress);
      } catch (error) {
        return res.status(404).json({
          error: "Contract not found or not a CW3 multisig",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    }

    // Get proposals from DB
    let proposals: localDb.DbContractProposal[] = [];
    if (includeProposals && dbMultisig) {
      proposals = localDb.getContractProposals(contractAddress, proposalStatus);
    }

    // Get sync state
    const syncState = localDb.getSyncState(chainId, contractAddress);

    return res.status(200).json({
      chainId,
      contractAddress,
      multisig: dbMultisig ? {
        label: dbMultisig.label,
        name: dbMultisig.name,
        description: dbMultisig.description,
        threshold: dbMultisig.threshold,
        maxVotingPeriodSeconds: dbMultisig.maxVotingPeriodSeconds,
        members: dbMultisig.members,
        creator: dbMultisig.creator,
        createdAt: dbMultisig.createdAt,
      } : null,
      proposals: proposals.map((p) => ({
        proposalId: p.proposalId,
        title: p.title,
        description: p.description,
        status: p.status,
        proposer: p.proposer,
        expiresAt: p.expiresAt,
        isConfirmed: p.isConfirmed,
        yesWeight: localDb.getProposalYesWeight(contractAddress, p.proposalId),
        createdAt: p.createdAt,
      })),
      syncState: syncState ? {
        lastFinalizedHeight: syncState.lastFinalizedHeight,
        lastSyncedAt: syncState.lastSyncedAt,
        status: syncState.status,
        errorMessage: syncState.errorMessage,
      } : null,
    });
  } catch (error) {
    console.error("Failed to get contract multisig:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get contract multisig",
    });
  }
}

// ============================================================================
// POST: Sync or Verify
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  chainId: string,
  contractAddress: string
) {
  try {
    const { action, nodeAddress: rawNodeAddress, proposalId, voterAddress } = req.body;

    if (!rawNodeAddress) {
      return res.status(400).json({ error: "nodeAddress required" });
    }

    const nodeAddress = rawNodeAddress.startsWith("http") || rawNodeAddress.startsWith("ws")
      ? rawNodeAddress
      : `https://${rawNodeAddress}`;

    switch (action) {
      case "sync":
        return handleSync(res, chainId, contractAddress, nodeAddress);
      case "verify-vote":
        return handleVerifyVote(res, chainId, contractAddress, nodeAddress, proposalId, voterAddress);
      case "verify-execute":
        return handleVerifyExecute(res, chainId, contractAddress, nodeAddress, proposalId);
      case "reconcile":
        return handleReconcile(res, chainId, contractAddress, nodeAddress, proposalId);
      default:
        return res.status(400).json({ error: "Invalid action. Use: sync, verify-vote, verify-execute, reconcile" });
    }
  } catch (error) {
    console.error("Failed to process action:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process action",
    });
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleSync(
  res: NextApiResponse,
  chainId: string,
  contractAddress: string,
  nodeAddress: string
) {
  const syncJob = createSyncJob({
    chainId,
    contractAddress,
    nodeAddress,
  });

  const result = await syncJob.run();

  return res.status(200).json({
    action: "sync",
    result,
  });
}

async function handleVerifyVote(
  res: NextApiResponse,
  chainId: string,
  contractAddress: string,
  nodeAddress: string,
  proposalId: number,
  voterAddress: string
) {
  if (!proposalId || !voterAddress) {
    return res.status(400).json({ error: "proposalId and voterAddress required for verify-vote" });
  }

  const result = await verifyCanVote({
    contractAddress,
    proposalId,
    voterAddress,
    chainId,
    nodeAddress,
  });

  return res.status(200).json({
    action: "verify-vote",
    proposalId,
    voterAddress,
    result,
  });
}

async function handleVerifyExecute(
  res: NextApiResponse,
  chainId: string,
  contractAddress: string,
  nodeAddress: string,
  proposalId: number
) {
  if (!proposalId) {
    return res.status(400).json({ error: "proposalId required for verify-execute" });
  }

  const result = await verifyCanExecute({
    contractAddress,
    proposalId,
    chainId,
    nodeAddress,
  });

  return res.status(200).json({
    action: "verify-execute",
    proposalId,
    result,
  });
}

async function handleReconcile(
  res: NextApiResponse,
  chainId: string,
  contractAddress: string,
  nodeAddress: string,
  proposalId: number
) {
  if (!proposalId) {
    return res.status(400).json({ error: "proposalId required for reconcile" });
  }

  const result = await verifyAndReconcileProposal(
    nodeAddress,
    contractAddress,
    chainId,
    proposalId
  );

  return res.status(200).json({
    action: "reconcile",
    proposalId,
    result,
  });
}

