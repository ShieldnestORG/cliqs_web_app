/**
 * GroupProvider Interface
 * 
 * File: lib/group/provider.ts
 * 
 * Defines the abstract interface for group membership providers.
 * This abstraction allows the system to work with:
 * - CW4-group contracts (Phase 2)
 * - Custom group modules with identity NFT hooks (Phase 3+)
 * 
 * The interface mirrors MultisigEngine's design pattern for consistency.
 * 
 * Phase 2: Group-Backed Multisig
 */

import {
  GroupMember,
  GroupMemberInfo,
  GroupConfig,
  GroupType,
  MemberSnapshot,
  MemberSnapshotInput,
  MemberUpdate,
  MemberUpdateBatch,
  MemberUpdateResult,
  GroupTxResult,
} from "./types";

// ============================================================================
// GroupProvider Interface
// ============================================================================

/**
 * GroupProvider - Unified interface for group membership management
 * 
 * This interface supports multiple implementation types:
 * 
 * 1. CW4GroupProvider ("cw4")
 *    - Standard CW4-group contract
 *    - Battle-tested, ecosystem-standard
 *    - Compatible with cw3-flex-multisig
 * 
 * 2. CustomGroupProvider ("custom") - Future Phase 3+
 *    - TX-specific group module
 *    - Identity NFT hooks
 *    - Role-based authorization
 *    - Credential gating
 */
export interface GroupProvider {
  // ============================================================================
  // Provider Metadata
  // ============================================================================

  /** Type of group provider */
  readonly providerType: GroupType;

  /** Group contract address */
  readonly groupAddress: string;

  /** Chain ID */
  readonly chainId: string;

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get the group configuration
   * 
   * @returns Group configuration including admin, total weight, etc.
   */
  getConfig(): Promise<GroupConfig>;

  /**
   * List all members of the group
   * 
   * @param startAfter - Optional pagination cursor
   * @param limit - Maximum number of members to return
   * @returns List of members with their weights
   */
  listMembers(startAfter?: string, limit?: number): Promise<readonly GroupMember[]>;

  /**
   * Get a specific member's info
   * 
   * @param address - Member's bech32 address
   * @returns Member info or null if not a member
   */
  getMember(address: string): Promise<GroupMemberInfo | null>;

  /**
   * Get the total voting weight of all members
   * 
   * @returns Total weight
   */
  getTotalWeight(): Promise<number>;

  /**
   * Get the admin address
   * 
   * @returns Admin address or null if no admin
   */
  getAdmin(): Promise<string | null>;

  /**
   * Check if an address is a member
   * 
   * @param address - Address to check
   * @returns True if address is a member with weight > 0
   */
  isMember(address: string): Promise<boolean>;

  /**
   * Get the member count
   * 
   * @returns Number of members in the group
   */
  getMemberCount(): Promise<number>;

  // ============================================================================
  // Snapshot Methods
  // ============================================================================

  /**
   * Take a snapshot of the current member set
   * 
   * This captures the full member list at the current block height
   * for audit and eligibility tracking.
   * 
   * @returns Member snapshot with all members and total weight
   */
  snapshotMembers(): Promise<MemberSnapshot>;

  /**
   * Get a member's weight at a specific block height
   * 
   * Note: This may require archive node access for historical queries.
   * Falls back to current weight if historical data unavailable.
   * 
   * @param address - Member address
   * @param height - Block height to query
   * @returns Weight at that height (0 if not a member)
   */
  getMemberWeightAt(address: string, height: number): Promise<number>;

  /**
   * Check if a member was in the group at a specific height
   * 
   * @param address - Member address
   * @param height - Block height to check
   * @returns True if was a member at that height
   */
  wasMemberAt(address: string, height: number): Promise<boolean>;

  // ============================================================================
  // Mutation Methods (Admin Only)
  // ============================================================================

  /**
   * Update group members (add, remove, or update weights)
   * 
   * This is an admin-only operation. The provider will verify
   * the sender is the group admin before submitting.
   * 
   * @param updates - Array of member updates to apply
   * @returns Update result with tx hash and new state
   */
  updateMembers(updates: readonly MemberUpdate[]): Promise<MemberUpdateResult>;

  /**
   * Apply a batch of member updates atomically
   * 
   * @param batch - Batch of add/remove/update operations
   * @returns Update result
   */
  applyMemberBatch(batch: MemberUpdateBatch): Promise<MemberUpdateResult>;

  /**
   * Add a single member
   * 
   * @param address - New member's address
   * @param weight - Member's voting weight
   * @returns Update result
   */
  addMember(address: string, weight: number): Promise<MemberUpdateResult>;

  /**
   * Remove a single member
   * 
   * @param address - Member's address to remove
   * @returns Update result
   */
  removeMember(address: string): Promise<MemberUpdateResult>;

  /**
   * Update a member's weight
   * 
   * @param address - Member's address
   * @param newWeight - New voting weight
   * @returns Update result
   */
  updateMemberWeight(address: string, newWeight: number): Promise<MemberUpdateResult>;

  /**
   * Transfer admin rights to a new address
   * 
   * @param newAdmin - New admin address (or null to remove admin)
   * @returns Transaction result
   */
  updateAdmin(newAdmin: string | null): Promise<GroupTxResult>;

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validate that the sender can perform admin operations
   * 
   * @param senderAddress - Address attempting the operation
   * @returns True if sender is the admin
   */
  canAdminister(senderAddress: string): Promise<boolean>;

  /**
   * Validate a batch of member updates
   * 
   * Checks for:
   * - Valid addresses
   * - Valid weights (>= 1)
   * - No duplicate operations
   * 
   * @param updates - Updates to validate
   * @returns Validation result with any errors
   */
  validateUpdates(updates: readonly MemberUpdate[]): Promise<ValidationResult>;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of validating member updates
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly valid: boolean;
  /** List of validation errors */
  readonly errors: readonly ValidationError[];
}

/**
 * A single validation error
 */
export interface ValidationError {
  /** Field or operation that failed */
  readonly field: string;
  /** Error message */
  readonly message: string;
  /** The problematic value */
  readonly value?: unknown;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory function type for creating GroupProvider instances
 */
export type GroupProviderFactory = (config: GroupProviderFactoryConfig) => Promise<GroupProvider>;

/**
 * Configuration for creating a GroupProvider
 */
export interface GroupProviderFactoryConfig {
  /** Group contract address */
  readonly groupAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** RPC node address */
  readonly nodeAddress: string;
  /** Additional RPC endpoints for redundancy */
  readonly nodeAddresses?: readonly string[];
  /** Group type (determines implementation) */
  readonly groupType?: GroupType;
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Registry for group provider implementations
 * 
 * This allows dynamic registration of provider types,
 * supporting CW4 now and custom modules later.
 */
export interface GroupProviderRegistry {
  /**
   * Register a provider factory for a group type
   */
  register(type: GroupType, factory: GroupProviderFactory): void;

  /**
   * Create a provider for a group
   */
  create(config: GroupProviderFactoryConfig): Promise<GroupProvider>;

  /**
   * Check if a provider type is registered
   */
  isRegistered(type: GroupType): boolean;

  /**
   * Get all registered provider types
   */
  getRegisteredTypes(): readonly GroupType[];
}

// ============================================================================
// Default Registry Implementation
// ============================================================================

/**
 * Default implementation of GroupProviderRegistry
 */
export class DefaultGroupProviderRegistry implements GroupProviderRegistry {
  private readonly factories = new Map<GroupType, GroupProviderFactory>();

  register(type: GroupType, factory: GroupProviderFactory): void {
    this.factories.set(type, factory);
  }

  async create(config: GroupProviderFactoryConfig): Promise<GroupProvider> {
    const type = config.groupType || "cw4";
    const factory = this.factories.get(type);
    
    if (!factory) {
      throw new Error(`No provider registered for group type: ${type}`);
    }
    
    return factory(config);
  }

  isRegistered(type: GroupType): boolean {
    return this.factories.has(type);
  }

  getRegisteredTypes(): readonly GroupType[] {
    return Array.from(this.factories.keys());
  }
}

// Singleton registry instance
export const groupProviderRegistry = new DefaultGroupProviderRegistry();

