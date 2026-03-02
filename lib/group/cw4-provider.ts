/**
 * CW4 Group Provider Implementation
 *
 * File: lib/group/cw4-provider.ts
 *
 * Implements the GroupProvider interface for CW4-group contracts.
 * This is the default implementation used in Phase 2 for CW3-Flex multisigs.
 *
 * Features:
 * - Full member management (add, remove, update weights)
 * - Snapshot capture for audit trails
 * - Historical weight queries (when archive node available)
 * - Admin validation
 *
 * Phase 2: Group-Backed Multisig
 */

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { CW4Client, CW4Member, createCW4Client } from "../contract/cw4-client";
import {
  GroupProvider,
  ValidationResult,
  ValidationError,
  GroupProviderFactoryConfig,
  groupProviderRegistry,
} from "./provider";
import {
  GroupMember,
  GroupMemberInfo,
  GroupConfig,
  GroupType,
  MemberSnapshot,
  MemberUpdate,
  MemberUpdateBatch,
  MemberUpdateResult,
  GroupTxResult,
} from "./types";

// ============================================================================
// CW4GroupProvider
// ============================================================================

/**
 * GroupProvider implementation backed by a CW4-group contract
 */
export class CW4GroupProvider implements GroupProvider {
  readonly providerType: GroupType = "cw4";
  readonly groupAddress: string;
  readonly chainId: string;

  private readonly cw4Client: CW4Client;
  private readonly nodeAddress: string;

  // Cached state
  private cachedAdmin: string | null = null;
  private adminCacheTime: number = 0;
  private readonly adminCacheTTL = 60000; // 1 minute

  constructor(groupAddress: string, chainId: string, nodeAddress: string) {
    this.groupAddress = groupAddress;
    this.chainId = chainId;
    this.nodeAddress = nodeAddress;
    this.cw4Client = createCW4Client(nodeAddress, groupAddress, chainId);
  }

  /**
   * Set a signing client for execute operations
   */
  setSigningClient(client: SigningCosmWasmClient): void {
    this.cw4Client.setSigningClient(client);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async getConfig(): Promise<GroupConfig> {
    const [admin, totalWeight, members, hooks] = await Promise.all([
      this.getAdmin(),
      this.getTotalWeight(),
      this.listMembers(),
      this.cw4Client.queryHooks(),
    ]);

    return {
      groupAddress: this.groupAddress,
      chainId: this.chainId,
      admin,
      totalWeight,
      memberCount: members.length,
      hooks,
    };
  }

  async listMembers(startAfter?: string, limit?: number): Promise<readonly GroupMember[]> {
    const members = limit
      ? await this.cw4Client.queryListMembers(startAfter, limit)
      : await this.cw4Client.queryAllMembers();

    return members.map(this.cw4MemberToGroupMember);
  }

  async getMember(address: string): Promise<GroupMemberInfo | null> {
    const weight = await this.cw4Client.queryMember(address);

    if (weight === null || weight === 0) {
      return null;
    }

    return {
      address,
      weight,
    };
  }

  async getTotalWeight(): Promise<number> {
    return this.cw4Client.queryTotalWeight();
  }

  async getAdmin(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedAdmin !== null && now - this.adminCacheTime < this.adminCacheTTL) {
      return this.cachedAdmin;
    }

    const admin = await this.cw4Client.queryAdmin();
    this.cachedAdmin = admin;
    this.adminCacheTime = now;
    return admin;
  }

  async isMember(address: string): Promise<boolean> {
    return this.cw4Client.isMember(address);
  }

  async getMemberCount(): Promise<number> {
    return this.cw4Client.getMemberCount();
  }

  // ============================================================================
  // Snapshot Methods
  // ============================================================================

  async snapshotMembers(): Promise<MemberSnapshot> {
    const [members, totalWeight, height] = await Promise.all([
      this.listMembers(),
      this.getTotalWeight(),
      this.cw4Client.getCurrentHeight(),
    ]);

    return {
      id: `${this.groupAddress}-${height}-${Date.now()}`,
      groupAddress: this.groupAddress,
      chainId: this.chainId,
      snapshotHeight: height,
      snapshotTime: new Date().toISOString(),
      members,
      totalWeight,
    };
  }

  async getMemberWeightAt(address: string, height: number): Promise<number> {
    // CW4 supports at_height queries
    const weight = await this.cw4Client.queryMember(address, height);
    return weight ?? 0;
  }

  async wasMemberAt(address: string, height: number): Promise<boolean> {
    const weight = await this.getMemberWeightAt(address, height);
    return weight > 0;
  }

  // ============================================================================
  // Mutation Methods
  // ============================================================================

  async updateMembers(updates: readonly MemberUpdate[]): Promise<MemberUpdateResult> {
    // Validate updates first
    const validation = await this.validateUpdates(updates);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
      };
    }

    // Convert to CW4 format
    const batch = this.convertUpdatesToBatch(updates);
    return this.applyMemberBatch(batch);
  }

  async applyMemberBatch(batch: MemberUpdateBatch): Promise<MemberUpdateResult> {
    const diff = {
      add: [
        ...batch.add.map(this.groupMemberToCW4Member),
        ...batch.update.map(this.groupMemberToCW4Member),
      ],
      remove: batch.remove,
    };

    const result = await this.cw4Client.updateMembers(diff);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Fetch updated state
    const [newMembers, newTotalWeight] = await Promise.all([
      this.listMembers(),
      this.getTotalWeight(),
    ]);

    return {
      success: true,
      txHash: result.txHash,
      height: result.height,
      newMembers: [...newMembers],
      newTotalWeight,
    };
  }

  async addMember(address: string, weight: number): Promise<MemberUpdateResult> {
    return this.updateMembers([{ type: "add", address, weight }]);
  }

  async removeMember(address: string): Promise<MemberUpdateResult> {
    return this.updateMembers([{ type: "remove", address }]);
  }

  async updateMemberWeight(address: string, newWeight: number): Promise<MemberUpdateResult> {
    return this.updateMembers([{ type: "update", address, weight: newWeight }]);
  }

  async updateAdmin(newAdmin: string | null): Promise<GroupTxResult> {
    const result = await this.cw4Client.updateAdmin(newAdmin);

    if (!result.success) {
      return {
        proposalId: "",
        txHash: "",
        height: 0,
        gasUsed: 0,
        gasWanted: 0,
        success: false,
        rawLog: result.error,
        timestamp: new Date().toISOString(),
      };
    }

    // Invalidate admin cache
    this.cachedAdmin = null;
    this.adminCacheTime = 0;

    // Fetch updated state
    const [members, totalWeight, admin] = await Promise.all([
      this.listMembers(),
      this.getTotalWeight(),
      this.getAdmin(),
    ]);

    return {
      proposalId: "",
      txHash: result.txHash,
      height: result.height ?? 0,
      gasUsed: result.gasUsed ?? 0,
      gasWanted: result.gasWanted ?? 0,
      success: true,
      timestamp: new Date().toISOString(),
      groupState: {
        members: [...members],
        totalWeight,
        admin,
      },
    };
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  async canAdminister(senderAddress: string): Promise<boolean> {
    return this.cw4Client.isAdmin(senderAddress);
  }

  async validateUpdates(updates: readonly MemberUpdate[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const seenAddresses = new Set<string>();

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      // Check for duplicate addresses in same batch
      if (seenAddresses.has(update.address)) {
        errors.push({
          field: `updates[${i}].address`,
          message: `Duplicate address in batch: ${update.address}`,
          value: update.address,
        });
      }
      seenAddresses.add(update.address);

      // Validate address format (basic check)
      if (!update.address || update.address.length < 10) {
        errors.push({
          field: `updates[${i}].address`,
          message: "Invalid address format",
          value: update.address,
        });
      }

      // Validate weight for add/update
      if (update.type === "add" || update.type === "update") {
        if (update.weight === undefined || update.weight < 1) {
          errors.push({
            field: `updates[${i}].weight`,
            message: "Weight must be >= 1",
            value: update.weight,
          });
        }
      }

      // For removes, check if member exists
      if (update.type === "remove") {
        const exists = await this.isMember(update.address);
        if (!exists) {
          errors.push({
            field: `updates[${i}].address`,
            message: `Cannot remove non-member: ${update.address}`,
            value: update.address,
          });
        }
      }

      // For adds, check if member already exists
      if (update.type === "add") {
        const exists = await this.isMember(update.address);
        if (exists) {
          errors.push({
            field: `updates[${i}].address`,
            message: `Member already exists: ${update.address}. Use 'update' to change weight.`,
            value: update.address,
          });
        }
      }

      // For updates, check if member exists
      if (update.type === "update") {
        const exists = await this.isMember(update.address);
        if (!exists) {
          errors.push({
            field: `updates[${i}].address`,
            message: `Cannot update non-member: ${update.address}. Use 'add' to add new member.`,
            value: update.address,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private cw4MemberToGroupMember = (member: CW4Member): GroupMember => ({
    address: member.addr,
    weight: member.weight,
  });

  private groupMemberToCW4Member = (member: GroupMember): CW4Member => ({
    addr: member.address,
    weight: member.weight,
  });

  private convertUpdatesToBatch(updates: readonly MemberUpdate[]): MemberUpdateBatch {
    const add: GroupMember[] = [];
    const remove: string[] = [];
    const update: GroupMember[] = [];

    for (const u of updates) {
      switch (u.type) {
        case "add":
          if (u.weight !== undefined) {
            add.push({ address: u.address, weight: u.weight });
          }
          break;
        case "remove":
          remove.push(u.address);
          break;
        case "update":
          if (u.weight !== undefined) {
            update.push({ address: u.address, weight: u.weight });
          }
          break;
      }
    }

    return { add, remove, update };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CW4GroupProvider instance
 */
export async function createCW4GroupProvider(
  config: GroupProviderFactoryConfig,
): Promise<CW4GroupProvider> {
  const provider = new CW4GroupProvider(config.groupAddress, config.chainId, config.nodeAddress);

  // Validate the contract exists by fetching admin
  await provider.getAdmin();

  return provider;
}

/**
 * Create a CW4GroupProvider with signing capabilities from a pre-built client.
 * Important: The signingClient must have been created with a gasPrice option
 * if you intend to use "auto" gas estimation.
 */
export async function createSigningCW4GroupProvider(
  config: GroupProviderFactoryConfig,
  signingClient: SigningCosmWasmClient,
): Promise<CW4GroupProvider> {
  const provider = await createCW4GroupProvider(config);
  provider.setSigningClient(signingClient);
  return provider;
}

/**
 * Create a CW4GroupProvider with signing capabilities from a signer and gas price.
 * This is the preferred factory function as it ensures gasPrice is properly
 * configured for "auto" gas estimation.
 */
export async function createSigningCW4GroupProviderFromSigner(
  config: GroupProviderFactoryConfig,
  signer: OfflineSigner,
  gasPrice: string,
): Promise<CW4GroupProvider> {
  const signingClient = await SigningCosmWasmClient.connectWithSigner(config.nodeAddress, signer, {
    gasPrice: GasPrice.fromString(gasPrice),
  });
  const provider = await createCW4GroupProvider(config);
  provider.setSigningClient(signingClient);
  return provider;
}

// ============================================================================
// Register with Provider Registry
// ============================================================================

// Register CW4 provider factory
groupProviderRegistry.register("cw4", createCW4GroupProvider);
