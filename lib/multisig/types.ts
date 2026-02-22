/**
 * Shared types for MultisigEngine abstraction
 * 
 * File: lib/multisig/types.ts
 * 
 * These types are used by both PubKeyMultisigEngine and ContractMultisigEngine
 * to provide a unified interface for multisig operations.
 */

import { EncodeObject } from "@cosmjs/proto-signing";
import { StdFee } from "@cosmjs/amino";

// ============================================================================
// Engine Types
// ============================================================================

export type MultisigEngineType = "pubkey" | "contract";

export type SignMode = "amino" | "direct";

// ============================================================================
// Member Types
// ============================================================================

export interface Member {
  /** Bech32 address of the member */
  readonly address: string;
  /** Base64-encoded compressed secp256k1 pubkey */
  readonly pubkey: string;
  /** Weight in threshold calculation (default 1 for pubkey multisig) */
  readonly weight: number;
}

// ============================================================================
// Policy Types
// ============================================================================

export interface MultisigPolicy {
  /** Number of signatures required to execute */
  readonly threshold: number;
  /** Total weight of all members */
  readonly totalWeight: number;
  /** Supported signing modes */
  readonly signModes: readonly SignMode[];
  /** Policy version for tracking changes */
  readonly version: number;
}

// ============================================================================
// Proposal Types
// ============================================================================

export type ProposalStatus = 
  | "draft"      // Created but not yet ready for signing
  | "pending"    // Ready for signatures
  | "signing"    // Actively collecting signatures
  | "ready"      // Threshold met, ready to broadcast
  | "broadcast"  // Sent to chain, awaiting confirmation
  | "confirmed"  // Successfully included in block
  | "failed"     // Broadcast failed or tx rejected
  | "cancelled"; // Manually cancelled

export interface ProposalInput {
  /** Transaction messages to execute */
  readonly msgs: readonly EncodeObject[];
  /** Fee configuration */
  readonly fee: StdFee;
  /** Optional memo */
  readonly memo?: string;
  /** Chain-specific account info */
  readonly accountNumber: number;
  readonly sequence: number;
}

export interface Proposal {
  /** Unique proposal identifier */
  readonly id: string;
  /** Multisig address that owns this proposal */
  readonly multisigAddress: string;
  /** Chain ID for replay protection */
  readonly chainId: string;
  /** SHA256 hash of canonical payload bytes */
  readonly payloadHash: string;
  /** Transaction content */
  readonly content: ProposalContent;
  /** Current status */
  readonly status: ProposalStatus;
  /** Timestamp of creation */
  readonly createdAt: string;
  /** Timestamp of last update */
  readonly updatedAt: string;
}

export interface ProposalContent {
  readonly msgs: readonly EncodeObject[];
  readonly fee: StdFee;
  readonly memo: string;
  readonly chainId: string;
  readonly accountNumber: number;
  readonly sequence: number;
}

export interface ProposalState extends Proposal {
  /** Current signatures */
  readonly signatures: readonly SignatureShare[];
  /** Current approval weight */
  readonly approvalWeight: number;
  /** Required threshold */
  readonly threshold: number;
  /** Whether threshold is met */
  readonly isReady: boolean;
}

// ============================================================================
// Signature Types
// ============================================================================

export interface SignerInfo {
  /** Signer's bech32 address */
  readonly address: string;
  /** Signer's base64-encoded pubkey */
  readonly pubkey: string;
}

export interface SignatureShare {
  /** Proposal this signature belongs to */
  readonly proposalId: string;
  /** Signer's address */
  readonly signerAddress: string;
  /** Sign mode used */
  readonly signMode: SignMode;
  /** Base64-encoded signature bytes */
  readonly signatureBytes: string;
  /** SHA256 hash of the sign doc that was signed */
  readonly signDocHash: string;
  /** Base64-encoded body bytes (for verification) */
  readonly bodyBytes: string;
  /** Timestamp of signature */
  readonly createdAt: string;
}

// ============================================================================
// Receipt Types (returned from operations)
// ============================================================================

export interface ApprovalReceipt {
  readonly proposalId: string;
  readonly signerAddress: string;
  readonly signDocHash: string;
  readonly signatureBytes: string;
  readonly timestamp: string;
  readonly newApprovalWeight: number;
  readonly isReady: boolean;
}

export interface RevokeReceipt {
  readonly proposalId: string;
  readonly signerAddress: string;
  readonly timestamp: string;
  readonly newApprovalWeight: number;
}

export interface TxResult {
  readonly proposalId: string;
  readonly txHash: string;
  readonly height: number;
  readonly gasUsed: number;
  readonly gasWanted: number;
  readonly success: boolean;
  readonly rawLog?: string;
  readonly timestamp: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class MultisigEngineError extends Error {
  constructor(
    message: string,
    public readonly code: MultisigErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MultisigEngineError";
  }
}

export type MultisigErrorCode =
  // Common errors
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_ALREADY_EXISTS"
  | "PROPOSAL_NOT_PENDING"
  | "PROPOSAL_ALREADY_EXECUTED"
  | "SIGNER_NOT_MEMBER"
  | "ALREADY_SIGNED"
  | "SIGNATURE_NOT_FOUND"
  | "THRESHOLD_NOT_MET"
  | "INVALID_SIGNATURE"
  | "INVALID_PAYLOAD_HASH"
  | "CHAIN_MISMATCH"
  | "SEQUENCE_MISMATCH"
  | "BROADCAST_FAILED"
  | "VERIFICATION_FAILED"
  // Contract-specific errors
  | "CONTRACT_NOT_FOUND"
  | "CONTRACT_QUERY_FAILED"
  | "CONTRACT_EXECUTE_FAILED"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_NOT_PASSED"
  | "ALREADY_VOTED"
  | "VOTING_CLOSED"
  | "INVALID_VOTE_OPTION"
  | "INDEXER_SYNC_FAILED"
  | "WEBSOCKET_CONNECTION_FAILED"
  // Phase 3: Credential-specific errors
  | "CREDENTIAL_REQUIRED"
  | "CREDENTIAL_INVALID"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_FROZEN";

