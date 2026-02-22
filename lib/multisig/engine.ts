/**
 * MultisigEngine Interface
 * 
 * File: lib/multisig/engine.ts
 * 
 * This interface defines the contract for multisig operations.
 * It abstracts the differences between PubKey multisig and Contract multisig,
 * allowing the UI to work with either implementation seamlessly.
 */

import {
  ApprovalReceipt,
  Member,
  MultisigEngineType,
  MultisigPolicy,
  Proposal,
  ProposalInput,
  ProposalState,
  RevokeReceipt,
  SignerInfo,
  TxResult,
} from "./types";

/**
 * MultisigEngine - Unified interface for multisig operations
 * 
 * This interface supports two implementation types:
 * 
 * 1. PubKeyMultisigEngine ("pubkey")
 *    - Native Cosmos SDK multisig
 *    - Address derived from member pubkeys
 *    - Off-chain signature coordination
 *    - Maximum self-custody security
 * 
 * 2. ContractMultisigEngine ("contract") - Future
 *    - CW3-style on-chain multisig
 *    - Stable address (key rotation doesn't change address)
 *    - On-chain proposal/approval state
 *    - Supports credential gating (Identity NFTs)
 */
export interface MultisigEngine {
  // ============================================================================
  // Engine Metadata
  // ============================================================================

  /** Type of multisig engine */
  readonly engineType: MultisigEngineType;

  /** Chain ID this engine operates on */
  readonly chainId: string;

  /** Multisig account address */
  readonly multisigAddress: string;

  // ============================================================================
  // Proposal Lifecycle
  // ============================================================================

  /**
   * Create a new proposal for the multisig to execute
   * 
   * For PubKey multisig: Creates off-chain proposal record
   * For Contract multisig: Submits proposal to contract
   * 
   * @param input - Transaction content and metadata
   * @returns Created proposal with unique ID and payload hash
   */
  createProposal(input: ProposalInput): Promise<Proposal>;

  /**
   * Add approval (signature) to a proposal
   * 
   * For PubKey multisig: Records signature share off-chain
   * For Contract multisig: Submits approval tx to contract
   * 
   * @param proposalId - ID of proposal to approve
   * @param signer - Signer information
   * @param signatureBytes - Base64-encoded signature
   * @param signDocHash - Hash of signed document for verification
   * @returns Receipt with updated approval state
   */
  approveProposal(
    proposalId: string,
    signer: SignerInfo,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<ApprovalReceipt>;

  /**
   * Revoke approval from a proposal (if supported)
   * 
   * For PubKey multisig: Removes signature share
   * For Contract multisig: Submits revoke tx to contract
   * 
   * @param proposalId - ID of proposal
   * @param signer - Signer revoking approval
   * @returns Receipt with updated approval state
   */
  revokeApproval(proposalId: string, signer: SignerInfo): Promise<RevokeReceipt>;

  /**
   * Execute a proposal that has met threshold
   * 
   * For PubKey multisig: Assembles multisig tx and broadcasts
   * For Contract multisig: Submits execute tx to contract
   * 
   * @param proposalId - ID of proposal to execute
   * @returns Transaction result with hash and confirmation
   */
  executeProposal(proposalId: string): Promise<TxResult>;

  /**
   * Cancel a pending proposal
   * 
   * @param proposalId - ID of proposal to cancel
   */
  cancelProposal(proposalId: string): Promise<void>;

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get proposal by ID with current state
   * 
   * @param proposalId - Proposal identifier
   * @returns Full proposal state including signatures
   */
  getProposal(proposalId: string): Promise<ProposalState>;

  /**
   * Get all proposals for this multisig
   * 
   * @param status - Optional filter by status
   * @returns List of proposals
   */
  listProposals(status?: string): Promise<readonly ProposalState[]>;

  /**
   * Get the multisig policy (threshold, weights, etc.)
   * 
   * @returns Current policy configuration
   */
  getPolicy(): Promise<MultisigPolicy>;

  /**
   * Get all members of the multisig
   * 
   * @returns List of members with addresses, pubkeys, and weights
   */
  listMembers(): Promise<readonly Member[]>;

  // ============================================================================
  // Signing Helpers
  // ============================================================================

  /**
   * Get the canonical sign bytes for a proposal
   * 
   * This is what signers should sign. The engine ensures
   * deterministic byte generation for reproducibility.
   * 
   * @param proposalId - Proposal to get sign bytes for
   * @param signMode - Amino or Direct signing mode
   * @returns Sign bytes and metadata for signing
   */
  getSignBytes(
    proposalId: string,
    signMode: "amino" | "direct",
  ): Promise<SignBytesResult>;

  /**
   * Verify a signature against a proposal
   * 
   * @param proposalId - Proposal the signature is for
   * @param signerAddress - Address of signer
   * @param signatureBytes - Base64-encoded signature
   * @param signDocHash - Hash that was signed
   * @returns Whether signature is valid
   */
  verifySignature(
    proposalId: string,
    signerAddress: string,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<boolean>;
}

/**
 * Result of getSignBytes - contains everything needed for signing
 */
export interface SignBytesResult {
  /** Raw bytes to sign */
  readonly signBytes: Uint8Array;
  /** SHA256 hash of sign bytes */
  readonly signDocHash: string;
  /** Body bytes (for signature storage) */
  readonly bodyBytes: Uint8Array;
  /** Sign mode used */
  readonly signMode: "amino" | "direct";
  /** Human-readable summary for display */
  readonly summary: TransactionSummary;
}

/**
 * Human-readable transaction summary for intent verification
 */
export interface TransactionSummary {
  /** List of actions in human-readable form */
  readonly actions: readonly ActionSummary[];
  /** Total fee */
  readonly fee: string;
  /** Memo if present */
  readonly memo?: string;
}

export interface ActionSummary {
  /** Action type (e.g., "Send", "Delegate", "Vote") */
  readonly type: string;
  /** Human-readable description */
  readonly description: string;
  /** Key-value details */
  readonly details: Record<string, string>;
}

// ============================================================================
// Factory Function Type
// ============================================================================

/**
 * Factory for creating MultisigEngine instances
 */
export type MultisigEngineFactory = (config: EngineConfig) => Promise<MultisigEngine>;

export interface EngineConfig {
  readonly chainId: string;
  readonly multisigAddress: string;
  readonly nodeAddress: string;
  readonly nodeAddresses?: readonly string[];
}

