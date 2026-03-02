/**
 * Layer 3: On-Demand Chain Verification
 *
 * File: lib/indexer/chain-verifier.ts
 *
 * This layer provides on-demand verification against chain state
 * before security-critical operations. The DB is advisory;
 * chain state is authoritative.
 *
 * Called before:
 * - approve: verify proposal is open, signer is member
 * - execute: verify threshold met, proposal not expired
 * - rotate signer: verify caller has authority
 *
 * This is what makes the system:
 * - Attack-resistant
 * - DB-compromise-safe
 * - Correct under partial failure
 */

import { CW3Client } from "../contract/cw3-client";
import { CW3Proposal, VoteOption, ThresholdResponse } from "../multisig/contract-types";
import * as localDb from "../localDb";

// ============================================================================
// Types
// ============================================================================

export interface VerificationResult {
  verified: boolean;
  errorCode?: VerificationErrorCode;
  errorMessage?: string;
  chainData?: ChainVerificationData;
}

export type VerificationErrorCode =
  | "CONTRACT_NOT_FOUND"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_NOT_OPEN"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_NOT_PASSED"
  | "PROPOSAL_ALREADY_EXECUTED"
  | "NOT_A_MEMBER"
  | "ALREADY_VOTED"
  | "THRESHOLD_NOT_MET"
  | "INSUFFICIENT_WEIGHT"
  | "NETWORK_ERROR"
  | "VERIFICATION_FAILED";

export interface ChainVerificationData {
  /** Verified proposal state from chain */
  proposal?: CW3Proposal;
  /** Verified voter weight from chain */
  voterWeight?: number;
  /** Current yes weight from chain */
  currentYesWeight?: number;
  /** Threshold from chain */
  threshold?: number;
  /** Total weight from chain */
  totalWeight?: number;
  /** Is member verified from chain */
  isMember?: boolean;
  /** Has voted verified from chain */
  hasVoted?: boolean;
  /** Existing vote if any */
  existingVote?: VoteOption;
  /** Verification timestamp */
  verifiedAt: string;
}

export interface VerifyVoteParams {
  contractAddress: string;
  proposalId: number;
  voterAddress: string;
  chainId: string;
  nodeAddress: string;
}

export interface VerifyExecuteParams {
  contractAddress: string;
  proposalId: number;
  chainId: string;
  nodeAddress: string;
}

export interface VerifyMembershipParams {
  contractAddress: string;
  memberAddress: string;
  chainId: string;
  nodeAddress: string;
}

// ============================================================================
// ChainVerifier Class
// ============================================================================

export class ChainVerifier {
  private clientCache: Map<string, CW3Client> = new Map();
  private cacheTimeout = 60000; // 1 minute cache for clients

  // ============================================================================
  // Verification Methods
  // ============================================================================

  /**
   * Verify before voting on a proposal
   *
   * Checks:
   * 1. Contract exists and is a CW3 multisig
   * 2. Proposal exists and is open
   * 3. Proposal has not expired
   * 4. Voter is a member with weight > 0
   * 5. Voter has not already voted
   */
  async verifyCanVote(params: VerifyVoteParams): Promise<VerificationResult> {
    const { contractAddress, proposalId, voterAddress, chainId, nodeAddress } = params;

    try {
      const client = this.getClient(nodeAddress, contractAddress, chainId);
      const verifiedAt = new Date().toISOString();

      // 1. Check if voter is a member
      const voterInfo = await client.queryVoter(voterAddress);
      if (!voterInfo || voterInfo.weight === 0) {
        return {
          verified: false,
          errorCode: "NOT_A_MEMBER",
          errorMessage: `Address ${voterAddress} is not a member of this multisig`,
          chainData: { isMember: false, verifiedAt },
        };
      }

      // 2. Get proposal
      const proposal = await client.queryProposal(proposalId);
      if (!proposal) {
        return {
          verified: false,
          errorCode: "PROPOSAL_NOT_FOUND",
          errorMessage: `Proposal ${proposalId} not found on chain`,
          chainData: { verifiedAt },
        };
      }

      // 3. Check proposal is open
      if (proposal.status !== "pending" && proposal.status !== "open") {
        return {
          verified: false,
          errorCode: "PROPOSAL_NOT_OPEN",
          errorMessage: `Proposal ${proposalId} is not open for voting (status: ${proposal.status})`,
          chainData: { proposal, verifiedAt },
        };
      }

      // 4. Check expiration
      if (client.isProposalExpired(proposal.expires)) {
        return {
          verified: false,
          errorCode: "PROPOSAL_EXPIRED",
          errorMessage: `Proposal ${proposalId} has expired`,
          chainData: { proposal, verifiedAt },
        };
      }

      // 5. Check if already voted
      const votes = await client.queryVotes(proposalId);
      const existingVote = votes.find((v) => v.voter === voterAddress);
      if (existingVote) {
        return {
          verified: false,
          errorCode: "ALREADY_VOTED",
          errorMessage: `Address ${voterAddress} has already voted on proposal ${proposalId}`,
          chainData: {
            proposal,
            hasVoted: true,
            existingVote: existingVote.vote,
            verifiedAt,
          },
        };
      }

      // Calculate current yes weight
      const currentYesWeight = votes
        .filter((v) => v.vote === "yes")
        .reduce((sum, v) => sum + v.weight, 0);

      // Get threshold
      const config = await client.queryConfig();
      const threshold = this.extractThreshold(config.threshold);
      const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);

      // All checks passed
      return {
        verified: true,
        chainData: {
          proposal,
          voterWeight: voterInfo.weight,
          currentYesWeight,
          threshold,
          totalWeight,
          isMember: true,
          hasVoted: false,
          verifiedAt,
        },
      };
    } catch (error) {
      return {
        verified: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: error instanceof Error ? error.message : "Network error during verification",
        chainData: { verifiedAt: new Date().toISOString() },
      };
    }
  }

  /**
   * Verify before executing a proposal
   *
   * Checks:
   * 1. Proposal exists
   * 2. Proposal has passed (threshold met)
   * 3. Proposal has not been executed
   * 4. Proposal has not expired
   */
  async verifyCanExecute(params: VerifyExecuteParams): Promise<VerificationResult> {
    const { contractAddress, proposalId, chainId, nodeAddress } = params;

    try {
      const client = this.getClient(nodeAddress, contractAddress, chainId);
      const verifiedAt = new Date().toISOString();

      // 1. Get proposal
      const proposal = await client.queryProposal(proposalId);
      if (!proposal) {
        return {
          verified: false,
          errorCode: "PROPOSAL_NOT_FOUND",
          errorMessage: `Proposal ${proposalId} not found on chain`,
          chainData: { verifiedAt },
        };
      }

      // 2. Check if already executed
      if (proposal.status === "executed") {
        return {
          verified: false,
          errorCode: "PROPOSAL_ALREADY_EXECUTED",
          errorMessage: `Proposal ${proposalId} has already been executed`,
          chainData: { proposal, verifiedAt },
        };
      }

      // 3. Check if passed
      if (proposal.status !== "passed") {
        // For "open" proposals, we need to verify if threshold is actually met
        if (proposal.status === "pending" || proposal.status === "open") {
          const votes = await client.queryVotes(proposalId);
          const currentYesWeight = votes
            .filter((v) => v.vote === "yes")
            .reduce((sum, v) => sum + v.weight, 0);

          const config = await client.queryConfig();
          const threshold = this.extractThreshold(config.threshold);

          if (currentYesWeight < threshold) {
            return {
              verified: false,
              errorCode: "THRESHOLD_NOT_MET",
              errorMessage: `Proposal ${proposalId} has not met threshold (${currentYesWeight}/${threshold})`,
              chainData: {
                proposal,
                currentYesWeight,
                threshold,
                verifiedAt,
              },
            };
          }
          // Threshold is met but status hasn't been updated yet
          // This can happen - we can still try to execute
        } else {
          return {
            verified: false,
            errorCode: "PROPOSAL_NOT_PASSED",
            errorMessage: `Proposal ${proposalId} has not passed (status: ${proposal.status})`,
            chainData: { proposal, verifiedAt },
          };
        }
      }

      // 4. Check expiration (even passed proposals can expire in some implementations)
      if (client.isProposalExpired(proposal.expires)) {
        return {
          verified: false,
          errorCode: "PROPOSAL_EXPIRED",
          errorMessage: `Proposal ${proposalId} has expired`,
          chainData: { proposal, verifiedAt },
        };
      }

      // Get current vote state
      const votes = await client.queryVotes(proposalId);
      const currentYesWeight = votes
        .filter((v) => v.vote === "yes")
        .reduce((sum, v) => sum + v.weight, 0);

      const config = await client.queryConfig();
      const threshold = this.extractThreshold(config.threshold);
      const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);

      // All checks passed
      return {
        verified: true,
        chainData: {
          proposal,
          currentYesWeight,
          threshold,
          totalWeight,
          verifiedAt,
        },
      };
    } catch (error) {
      return {
        verified: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: error instanceof Error ? error.message : "Network error during verification",
        chainData: { verifiedAt: new Date().toISOString() },
      };
    }
  }

  /**
   * Verify membership in a multisig
   */
  async verifyMembership(params: VerifyMembershipParams): Promise<VerificationResult> {
    const { contractAddress, memberAddress, chainId, nodeAddress } = params;

    try {
      const client = this.getClient(nodeAddress, contractAddress, chainId);
      const verifiedAt = new Date().toISOString();

      const voterInfo = await client.queryVoter(memberAddress);

      if (!voterInfo || voterInfo.weight === 0) {
        return {
          verified: false,
          errorCode: "NOT_A_MEMBER",
          errorMessage: `Address ${memberAddress} is not a member of this multisig`,
          chainData: { isMember: false, voterWeight: 0, verifiedAt },
        };
      }

      return {
        verified: true,
        chainData: {
          isMember: true,
          voterWeight: voterInfo.weight,
          verifiedAt,
        },
      };
    } catch (error) {
      return {
        verified: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: error instanceof Error ? error.message : "Network error during verification",
        chainData: { verifiedAt: new Date().toISOString() },
      };
    }
  }

  /**
   * Verify a proposal exists and get its current state
   */
  async verifyProposal(
    nodeAddress: string,
    contractAddress: string,
    chainId: string,
    proposalId: number,
  ): Promise<VerificationResult> {
    try {
      const client = this.getClient(nodeAddress, contractAddress, chainId);
      const verifiedAt = new Date().toISOString();

      const proposal = await client.queryProposal(proposalId);
      if (!proposal) {
        return {
          verified: false,
          errorCode: "PROPOSAL_NOT_FOUND",
          errorMessage: `Proposal ${proposalId} not found on chain`,
          chainData: { verifiedAt },
        };
      }

      // Get votes
      const votes = await client.queryVotes(proposalId);
      const currentYesWeight = votes
        .filter((v) => v.vote === "yes")
        .reduce((sum, v) => sum + v.weight, 0);

      // Get config
      const config = await client.queryConfig();
      const threshold = this.extractThreshold(config.threshold);
      const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);

      return {
        verified: true,
        chainData: {
          proposal,
          currentYesWeight,
          threshold,
          totalWeight,
          verifiedAt,
        },
      };
    } catch (error) {
      return {
        verified: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: error instanceof Error ? error.message : "Network error during verification",
        chainData: { verifiedAt: new Date().toISOString() },
      };
    }
  }

  /**
   * Verify and reconcile DB state with chain state
   * Updates the local DB if discrepancies are found
   */
  async verifyAndReconcile(
    nodeAddress: string,
    contractAddress: string,
    chainId: string,
    proposalId: number,
  ): Promise<{ reconciled: boolean; changes: string[] }> {
    const changes: string[] = [];

    try {
      const client = this.getClient(nodeAddress, contractAddress, chainId);

      // Get chain state
      const chainProposal = await client.queryProposal(proposalId);
      if (!chainProposal) {
        // Proposal doesn't exist on chain but might be in DB
        const dbProposal = localDb.getContractProposal(contractAddress, proposalId);
        if (dbProposal) {
          localDb.updateContractProposalStatus(contractAddress, proposalId, "expired", true);
          changes.push(`Proposal ${proposalId}: Marked as expired (not found on chain)`);
        }
        return { reconciled: true, changes };
      }

      // Get DB state
      const dbProposal = localDb.getContractProposal(contractAddress, proposalId);

      // Compare and reconcile status
      if (dbProposal) {
        const chainStatus = this.mapChainStatus(chainProposal.status);
        if (dbProposal.status !== chainStatus) {
          localDb.updateContractProposalStatus(contractAddress, proposalId, chainStatus, true);
          changes.push(`Proposal ${proposalId}: Status ${dbProposal.status} -> ${chainStatus}`);
        }
      } else {
        // Create DB record from chain state
        localDb.upsertContractProposal({
          contractAddress,
          chainId,
          proposalId: chainProposal.id,
          title: chainProposal.title,
          description: chainProposal.description,
          msgsJSON: JSON.stringify(chainProposal.msgs),
          status: this.mapChainStatus(chainProposal.status),
          proposer: chainProposal.proposer,
          expiresAt: this.getExpiresAt(chainProposal.expires),
          createdHeight: null,
          lastVerifiedAt: new Date().toISOString(),
          isConfirmed: true,
        });
        changes.push(`Proposal ${proposalId}: Created from chain state`);
      }

      // Reconcile votes
      const chainVotes = await client.queryVotes(proposalId);
      const dbVotes = localDb.getContractVotes(contractAddress, proposalId);

      for (const chainVote of chainVotes) {
        const dbVote = dbVotes.find((v) => v.voter === chainVote.voter);
        if (!dbVote) {
          localDb.upsertContractVote({
            contractAddress,
            proposalId,
            voter: chainVote.voter,
            vote: chainVote.vote,
            weight: chainVote.weight,
            txHash: null,
            height: null,
            isConfirmed: true,
          });
          changes.push(`Vote: Added ${chainVote.voter} -> ${chainVote.vote}`);
        } else if (dbVote.vote !== chainVote.vote) {
          localDb.upsertContractVote({
            contractAddress,
            proposalId,
            voter: chainVote.voter,
            vote: chainVote.vote,
            weight: chainVote.weight,
            txHash: dbVote.txHash,
            height: dbVote.height,
            isConfirmed: true,
          });
          changes.push(`Vote: Updated ${chainVote.voter} ${dbVote.vote} -> ${chainVote.vote}`);
        }
      }

      return { reconciled: true, changes };
    } catch (error) {
      return {
        reconciled: false,
        changes: [`Error: ${error instanceof Error ? error.message : "Unknown error"}`],
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getClient(nodeAddress: string, contractAddress: string, chainId: string): CW3Client {
    const key = `${nodeAddress}:${contractAddress}`;

    let client = this.clientCache.get(key);
    if (!client) {
      client = new CW3Client(nodeAddress, contractAddress, chainId);
      this.clientCache.set(key, client);
    }

    return client;
  }

  private extractThreshold(threshold: ThresholdResponse): number {
    if (threshold.absolute_count) {
      return threshold.absolute_count.weight;
    }
    if (threshold.absolute_percentage) {
      return Math.ceil(
        parseFloat(threshold.absolute_percentage.percentage) *
          threshold.absolute_percentage.total_weight,
      );
    }
    if (threshold.threshold_quorum) {
      return Math.ceil(
        parseFloat(threshold.threshold_quorum.threshold) * threshold.threshold_quorum.total_weight,
      );
    }
    return 1;
  }

  private mapChainStatus(
    status: string,
  ): "pending" | "open" | "passed" | "rejected" | "executed" | "expired" {
    switch (status) {
      case "pending":
      case "open":
        return "pending";
      case "passed":
        return "passed";
      case "rejected":
        return "rejected";
      case "executed":
        return "executed";
      default:
        return "pending";
    }
  }

  private getExpiresAt(expires: { at_time?: string }): string | null {
    if (expires.at_time) {
      const expiresMs = parseInt(expires.at_time, 10) / 1_000_000;
      return new Date(expiresMs).toISOString();
    }
    return null;
  }

  /**
   * Clear the client cache
   */
  clearCache(): void {
    this.clientCache.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const chainVerifier = new ChainVerifier();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Verify a user can vote on a proposal
 */
export async function verifyCanVote(params: VerifyVoteParams): Promise<VerificationResult> {
  return chainVerifier.verifyCanVote(params);
}

/**
 * Verify a proposal can be executed
 */
export async function verifyCanExecute(params: VerifyExecuteParams): Promise<VerificationResult> {
  return chainVerifier.verifyCanExecute(params);
}

/**
 * Verify membership in a multisig
 */
export async function verifyMembership(
  params: VerifyMembershipParams,
): Promise<VerificationResult> {
  return chainVerifier.verifyMembership(params);
}

/**
 * Verify and reconcile a proposal's DB state with chain
 */
export async function verifyAndReconcileProposal(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
  proposalId: number,
): Promise<{ reconciled: boolean; changes: string[] }> {
  return chainVerifier.verifyAndReconcile(nodeAddress, contractAddress, chainId, proposalId);
}
