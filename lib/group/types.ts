/**
 * Group Provider Types
 * 
 * File: lib/group/types.ts
 * 
 * Types for group membership management, supporting both CW4-group contracts
 * and future custom group modules. These types power the GroupProvider abstraction
 * that enables dynamic membership in CW3-Flex multisigs.
 * 
 * Phase 2: Group-Backed Multisig
 */

import { TxResult } from "../multisig/types";

// ============================================================================
// Group Member Types
// ============================================================================

/**
 * A member of a group with their voting weight
 */
export interface GroupMember {
  /** Bech32 address of the member */
  readonly address: string;
  /** Voting weight (must be >= 1) */
  readonly weight: number;
}

/**
 * Extended member info with metadata
 */
export interface GroupMemberInfo extends GroupMember {
  /** When the member was added (block height) */
  readonly addedHeight?: number;
  /** When the member was last updated (block height) */
  readonly updatedHeight?: number;
}

// ============================================================================
// Member Update Types
// ============================================================================

/**
 * Types of member updates that can be performed
 */
export type MemberUpdateType = "add" | "remove" | "update";

/**
 * A single member update operation
 */
export interface MemberUpdate {
  /** Type of update */
  readonly type: MemberUpdateType;
  /** Member address */
  readonly address: string;
  /** New weight (required for add/update, ignored for remove) */
  readonly weight?: number;
}

/**
 * Batch of member updates to apply atomically
 */
export interface MemberUpdateBatch {
  /** Members to add */
  readonly add: GroupMember[];
  /** Addresses to remove */
  readonly remove: string[];
  /** Members to update weight */
  readonly update: GroupMember[];
}

/**
 * Result of a member update operation
 */
export interface MemberUpdateResult {
  /** Whether the update succeeded */
  readonly success: boolean;
  /** Transaction hash if successful */
  readonly txHash?: string;
  /** Block height of the update */
  readonly height?: number;
  /** Error message if failed */
  readonly error?: string;
  /** Updated member list after the operation */
  readonly newMembers?: GroupMember[];
  /** New total weight after the operation */
  readonly newTotalWeight?: number;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * A snapshot of the member set at a specific point in time
 * 
 * Used for:
 * - Proposal-time snapshots (who was eligible when proposal was created)
 * - Audit trails (reconstruct authority state at any point)
 */
export interface MemberSnapshot {
  /** Unique snapshot ID */
  readonly id: string;
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Block height when snapshot was taken */
  readonly snapshotHeight: number;
  /** Timestamp when snapshot was taken */
  readonly snapshotTime: string;
  /** Full member set at this point */
  readonly members: readonly GroupMember[];
  /** Total weight at this point */
  readonly totalWeight: number;
}

/**
 * A snapshot of a single vote at the time it was cast
 * 
 * Used for:
 * - Vote-time weight tracking
 * - Credential validity at vote time (Phase 3)
 * - Audit trails
 */
export interface VoteSnapshot {
  /** Unique snapshot ID */
  readonly id: string;
  /** Contract multisig address */
  readonly contractAddress: string;
  /** Proposal ID this vote is for */
  readonly proposalId: number;
  /** Voter address */
  readonly voter: string;
  /** Voter's weight at the time of voting */
  readonly weightAtVote: number;
  /** Whether voter held valid credential at vote time (Phase 3) */
  readonly credentialValid: boolean;
  /** Block height when vote was cast */
  readonly voteHeight: number;
  /** Timestamp when vote was cast */
  readonly voteTime: string;
}

/**
 * Input for creating a member snapshot
 */
export interface MemberSnapshotInput {
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Block height to snapshot at */
  readonly height: number;
  /** Members to include in snapshot */
  readonly members: readonly GroupMember[];
  /** Total weight to record */
  readonly totalWeight: number;
}

/**
 * Input for creating a vote snapshot
 */
export interface VoteSnapshotInput {
  /** Contract multisig address */
  readonly contractAddress: string;
  /** Proposal ID */
  readonly proposalId: number;
  /** Voter address */
  readonly voter: string;
  /** Voter's weight at vote time */
  readonly weightAtVote: number;
  /** Whether credential was valid (defaults to true for Phase 2) */
  readonly credentialValid?: boolean;
  /** Block height of vote */
  readonly voteHeight: number;
}

// ============================================================================
// Group Configuration Types
// ============================================================================

/**
 * Configuration for a group contract
 */
export interface GroupConfig {
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Admin address (who can update members) */
  readonly admin: string | null;
  /** Total weight of all members */
  readonly totalWeight: number;
  /** Number of members */
  readonly memberCount: number;
  /** Registered hooks (for future identity NFT integration) */
  readonly hooks?: readonly string[];
}

/**
 * Group type identifier
 */
export type GroupType = "cw4" | "custom";

/**
 * Group metadata stored in local DB
 */
export interface GroupRecord {
  /** Unique ID */
  readonly id: string;
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Group type */
  readonly groupType: GroupType;
  /** Admin address */
  readonly admin: string | null;
  /** Associated multisig contract address (if any) */
  readonly multisigAddress?: string;
  /** Human-readable label */
  readonly label?: string;
  /** When the group was created */
  readonly createdAt: string;
  /** When the group was last updated */
  readonly updatedAt: string;
  /** Last sync height */
  readonly lastSyncHeight: number;
}

// ============================================================================
// Group Event Types (for indexer)
// ============================================================================

/**
 * Types of group events
 */
export type GroupEventType = 
  | "members_changed"
  | "admin_changed"
  | "hooks_changed";

/**
 * A group event from the chain
 */
export interface GroupEvent {
  /** Event type */
  readonly type: GroupEventType;
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Block height */
  readonly height: number;
  /** Transaction hash */
  readonly txHash: string;
  /** Event attributes */
  readonly attributes: Record<string, string>;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * Members changed event details
 */
export interface MembersChangedEvent extends GroupEvent {
  readonly type: "members_changed";
  /** Members that were added */
  readonly added: GroupMember[];
  /** Addresses that were removed */
  readonly removed: string[];
  /** Members that were updated */
  readonly updated: GroupMember[];
  /** New total weight after changes */
  readonly newTotalWeight: number;
}

/**
 * Admin changed event details
 */
export interface AdminChangedEvent extends GroupEvent {
  readonly type: "admin_changed";
  /** Previous admin address */
  readonly previousAdmin: string | null;
  /** New admin address */
  readonly newAdmin: string | null;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Group-specific error codes
 */
export type GroupErrorCode =
  | "GROUP_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "NOT_ADMIN"
  | "INVALID_WEIGHT"
  | "MEMBER_ALREADY_EXISTS"
  | "QUERY_FAILED"
  | "UPDATE_FAILED"
  | "SNAPSHOT_FAILED"
  | "INVALID_GROUP_TYPE";

/**
 * Group operation error
 */
export class GroupError extends Error {
  constructor(
    message: string,
    public readonly code: GroupErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GroupError";
  }
}

// ============================================================================
// Provider Factory Types
// ============================================================================

/**
 * Configuration for creating a group provider
 */
export interface GroupProviderConfig {
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** RPC node address */
  readonly nodeAddress: string;
  /** Group type (determines which provider to use) */
  readonly groupType: GroupType;
}

/**
 * Result of group provider operations that involve transactions
 */
export interface GroupTxResult extends TxResult {
  /** Updated group state after the transaction */
  readonly groupState?: {
    readonly members: GroupMember[];
    readonly totalWeight: number;
    readonly admin: string | null;
  };
}

