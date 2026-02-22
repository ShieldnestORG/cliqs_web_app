/**
 * CW4 Group Contract Client
 * 
 * File: lib/contract/cw4-client.ts
 * 
 * Wrapper for CW4-group contract queries and executes.
 * This client handles all interactions with CW4-group style contracts
 * for managing group membership in CW3-Flex multisigs.
 * 
 * CW4 is the standard CosmWasm group contract that provides:
 * - Member management with weights
 * - Admin-controlled updates
 * - Hook system for extensions
 * 
 * Phase 2: Group-Backed Multisig
 */

import { CosmWasmClient, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";

// ============================================================================
// CW4 Types
// ============================================================================

/**
 * A member in the CW4 group
 */
export interface CW4Member {
  /** Bech32 address */
  addr: string;
  /** Voting weight */
  weight: number;
}

/**
 * Member diff for batch updates
 */
export interface CW4MemberDiff {
  /** Members to add or update */
  add?: CW4Member[];
  /** Addresses to remove */
  remove?: string[];
}

/**
 * CW4 group configuration from contract state
 */
export interface CW4Config {
  /** Admin address (can be null) */
  admin: string | null;
}

/**
 * Response from total weight query
 */
export interface TotalWeightResponse {
  weight: number;
}

/**
 * Response from member query
 */
export interface MemberResponse {
  weight: number | null;
}

/**
 * Response from list members query
 */
export interface MemberListResponse {
  members: CW4Member[];
}

/**
 * Response from hooks query
 */
export interface HooksResponse {
  hooks: string[];
}

/**
 * Execute message types for CW4
 */
export interface CW4ExecuteMsg {
  /** Update members (admin only) */
  update_members?: CW4MemberDiff;
  /** Update admin (admin only) */
  update_admin?: {
    admin: string | null;
  };
  /** Add hook (admin only) */
  add_hook?: {
    addr: string;
  };
  /** Remove hook (admin only) */
  remove_hook?: {
    addr: string;
  };
}

/**
 * Query message types for CW4
 */
export interface CW4QueryMsg {
  /** Query admin */
  admin?: Record<string, never>;
  /** Query total weight */
  total_weight?: {
    at_height?: number;
  };
  /** Query member weight */
  member?: {
    addr: string;
    at_height?: number;
  };
  /** List members with pagination */
  list_members?: {
    start_after?: string;
    limit?: number;
  };
  /** Query hooks */
  hooks?: Record<string, never>;
}

/**
 * Result of executing a CW4 transaction
 */
export interface CW4ExecuteResult {
  success: boolean;
  txHash: string;
  height?: number;
  gasUsed?: number;
  gasWanted?: number;
  error?: string;
  rawLog?: string;
}

/**
 * Instantiate message for CW4-group
 */
export interface CW4GroupInstantiateMsg {
  /** Admin address (can update members) */
  admin?: string;
  /** Initial members */
  members: CW4Member[];
}

/**
 * Result of instantiating a CW4 contract
 */
export interface CW4InstantiateResult {
  success: boolean;
  contractAddress?: string;
  txHash: string;
  error?: string;
}

// ============================================================================
// CW4Client
// ============================================================================

/**
 * Client for interacting with CW4-group contracts
 */
export class CW4Client {
  private readonly nodeAddress: string;
  private readonly contractAddress: string;
  private readonly chainId: string;
  private client: CosmWasmClient | null = null;
  private signingClient: SigningCosmWasmClient | null = null;
  private _senderAddress: string | null = null;
  private _gasMultiplier: "auto" | number = "auto";

  constructor(
    nodeAddress: string,
    contractAddress: string,
    chainId: string,
  ) {
    this.nodeAddress = nodeAddress;
    this.contractAddress = contractAddress;
    this.chainId = chainId;
  }

  /**
   * Get the fee parameter for gas estimation.
   * When a numeric multiplier is set, it overrides the default 1.4x.
   */
  private get fee(): "auto" | number {
    return this._gasMultiplier;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Get or create a CosmWasm client for queries
   */
  private async getClient(): Promise<CosmWasmClient> {
    if (!this.client) {
      this.client = await CosmWasmClient.connect(this.nodeAddress);
    }
    return this.client;
  }

  /**
   * Set a signing client for execute operations.
   * @param client - The signing client
   * @param senderAddress - Explicit sender address (avoids fragile signer extraction)
   * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Default: "auto" (1.4x)
   */
  setSigningClient(
    client: SigningCosmWasmClient,
    senderAddress?: string,
    gasMultiplier?: number,
  ): void {
    this.signingClient = client;
    if (senderAddress) {
      this._senderAddress = senderAddress;
    }
    if (gasMultiplier !== undefined) {
      this._gasMultiplier = gasMultiplier;
    }
  }

  /**
   * Get the signing client (throws if not set)
   */
  private getSigningClient(): SigningCosmWasmClient {
    if (!this.signingClient) {
      throw new Error(
        "Signing client not set. Call setSigningClient() before executing transactions.",
      );
    }
    return this.signingClient;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Query the admin address
   */
  async queryAdmin(): Promise<string | null> {
    try {
      const client = await this.getClient();
      const response = await client.queryContractSmart(
        this.contractAddress,
        { admin: {} },
      ) as { admin: string | null };
      return response.admin;
    } catch {
      return null;
    }
  }

  /**
   * Query total weight of all members
   * 
   * @param atHeight - Optional: query at specific block height
   */
  async queryTotalWeight(atHeight?: number): Promise<number> {
    const client = await this.getClient();
    const query: CW4QueryMsg = {
      total_weight: atHeight ? { at_height: atHeight } : {},
    };
    
    const response = await client.queryContractSmart(
      this.contractAddress,
      query,
    ) as TotalWeightResponse;
    
    return response.weight;
  }

  /**
   * Query a specific member's weight
   * 
   * @param address - Member address
   * @param atHeight - Optional: query at specific block height
   */
  async queryMember(address: string, atHeight?: number): Promise<number | null> {
    try {
      const client = await this.getClient();
      const query: CW4QueryMsg = {
        member: {
          addr: address,
          at_height: atHeight,
        },
      };
      
      const response = await client.queryContractSmart(
        this.contractAddress,
        query,
      ) as MemberResponse;
      
      return response.weight;
    } catch {
      return null;
    }
  }

  /**
   * List all members with pagination
   * 
   * @param startAfter - Optional: start after this address
   * @param limit - Maximum number to return (default 30)
   */
  async queryListMembers(
    startAfter?: string,
    limit: number = 30,
  ): Promise<CW4Member[]> {
    const client = await this.getClient();
    const query: CW4QueryMsg = {
      list_members: {
        start_after: startAfter,
        limit,
      },
    };

    const response = await client.queryContractSmart(
      this.contractAddress,
      query,
    ) as MemberListResponse;

    return response.members;
  }

  /**
   * Get all members (handles pagination internally)
   */
  async queryAllMembers(): Promise<CW4Member[]> {
    const allMembers: CW4Member[] = [];
    let startAfter: string | undefined;
    const limit = 100;

    while (true) {
      const batch = await this.queryListMembers(startAfter, limit);
      
      if (batch.length === 0) {
        break;
      }
      
      allMembers.push(...batch);
      
      if (batch.length < limit) {
        break;
      }
      
      startAfter = batch[batch.length - 1].addr;
    }

    return allMembers;
  }

  /**
   * Query registered hooks
   */
  async queryHooks(): Promise<string[]> {
    try {
      const client = await this.getClient();
      const response = await client.queryContractSmart(
        this.contractAddress,
        { hooks: {} },
      ) as HooksResponse;
      return response.hooks;
    } catch {
      return [];
    }
  }

  /**
   * Get the current block height
   */
  async getCurrentHeight(): Promise<number> {
    const client = await this.getClient();
    return client.getHeight();
  }

  // ============================================================================
  // Execute Methods
  // ============================================================================

  /**
   * Update members (add, remove, or change weights)
   * 
   * @param diff - Members to add/update and addresses to remove
   */
  async updateMembers(diff: CW4MemberDiff): Promise<CW4ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW4ExecuteMsg = {
        update_members: diff,
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Add members
   * 
   * @param members - Members to add
   */
  async addMembers(members: CW4Member[]): Promise<CW4ExecuteResult> {
    return this.updateMembers({ add: members });
  }

  /**
   * Remove members
   * 
   * @param addresses - Addresses to remove
   */
  async removeMembers(addresses: string[]): Promise<CW4ExecuteResult> {
    return this.updateMembers({ remove: addresses });
  }

  /**
   * Update admin
   * 
   * @param newAdmin - New admin address (or null to remove)
   */
  async updateAdmin(newAdmin: string | null): Promise<CW4ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW4ExecuteMsg = {
        update_admin: { admin: newAdmin },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Add a hook
   * 
   * @param hookAddress - Hook contract address
   */
  async addHook(hookAddress: string): Promise<CW4ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW4ExecuteMsg = {
        add_hook: { addr: hookAddress },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Remove a hook
   * 
   * @param hookAddress - Hook contract address
   */
  async removeHook(hookAddress: string): Promise<CW4ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW4ExecuteMsg = {
        remove_hook: { addr: hookAddress },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Message Builders (for external signing flows)
  // ============================================================================

  /**
   * Build update_members message
   */
  buildUpdateMembersMsg(diff: CW4MemberDiff): CW4ExecuteMsg {
    return { update_members: diff };
  }

  /**
   * Build update_admin message
   */
  buildUpdateAdminMsg(newAdmin: string | null): CW4ExecuteMsg {
    return { update_admin: { admin: newAdmin } };
  }

  /**
   * Build add_hook message
   */
  buildAddHookMsg(hookAddress: string): CW4ExecuteMsg {
    return { add_hook: { addr: hookAddress } };
  }

  /**
   * Build remove_hook message
   */
  buildRemoveHookMsg(hookAddress: string): CW4ExecuteMsg {
    return { remove_hook: { addr: hookAddress } };
  }

  // ============================================================================
  // Instantiation (Static)
  // ============================================================================

  /**
   * Instantiate a new CW4-group contract
   * @param gasMultiplier - Chain-specific gas multiplier. Default: "auto" (1.4x)
   */
  static async instantiate(
    signingClient: SigningCosmWasmClient,
    senderAddress: string,
    codeId: number,
    members: CW4Member[],
    admin?: string,
    label: string = "CW4 Group",
    gasMultiplier: "auto" | number = "auto",
  ): Promise<CW4InstantiateResult> {
    try {
      const instantiateMsg: CW4GroupInstantiateMsg = {
        admin,
        members,
      };

      const result = await signingClient.instantiate(
        senderAddress,
        codeId,
        instantiateMsg,
        label,
        gasMultiplier,
        { admin },
      );

      return {
        success: true,
        contractAddress: result.contractAddress,
        txHash: result.transactionHash,
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get the sender address.
   * Uses the explicitly set address first, then falls back to extracting
   * from the signing client's signer.
   */
  private async getSenderAddress(): Promise<string> {
    if (this._senderAddress) {
      return this._senderAddress;
    }

    // Fallback: try to extract from the signing client's internal signer
    const client = this.getSigningClient();
    try {
      const accounts = await (
        client as unknown as {
          signer?: { getAccounts(): Promise<{ address: string }[]> };
        }
      ).signer?.getAccounts();
      if (accounts && accounts.length > 0) {
        this._senderAddress = accounts[0].address;
        return accounts[0].address;
      }
    } catch {
      // Signer extraction failed
    }

    throw new Error(
      "No sender address available. Call setSigningClient(client, senderAddress) or use a factory function.",
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Get the chain ID
   */
  getChainId(): string {
    return this.chainId;
  }

  /**
   * Check if an address is the admin
   */
  async isAdmin(address: string): Promise<boolean> {
    const admin = await this.queryAdmin();
    return admin === address;
  }

  /**
   * Check if an address is a member
   */
  async isMember(address: string): Promise<boolean> {
    const weight = await this.queryMember(address);
    return weight !== null && weight > 0;
  }

  /**
   * Get member count
   */
  async getMemberCount(): Promise<number> {
    const members = await this.queryAllMembers();
    return members.length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CW4 client for queries only
 */
export function createCW4Client(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
): CW4Client {
  return new CW4Client(nodeAddress, contractAddress, chainId);
}

/**
 * Create a CW4 client with signing capabilities from a pre-built client.
 * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Omit for default 1.4x.
 */
export async function createSigningCW4Client(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
  signingClient: SigningCosmWasmClient,
  senderAddress?: string,
  gasMultiplier?: number,
): Promise<CW4Client> {
  const client = new CW4Client(nodeAddress, contractAddress, chainId);
  client.setSigningClient(signingClient, senderAddress, gasMultiplier);
  return client;
}

/**
 * Create a CW4 client with signing capabilities from a signer and gas price.
 * This is the preferred factory function as it ensures gasPrice is properly
 * configured for gas estimation.
 * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Omit for default 1.4x.
 */
export async function createSigningCW4ClientFromSigner(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
  signer: OfflineSigner,
  gasPrice: string,
  gasMultiplier?: number,
): Promise<CW4Client> {
  // Extract sender address from signer before connecting
  const accounts = await signer.getAccounts();
  const senderAddress = accounts[0]?.address;
  if (!senderAddress) {
    throw new Error("Signer has no accounts");
  }

  const signingClient = await SigningCosmWasmClient.connectWithSigner(
    nodeAddress,
    signer,
    { gasPrice: GasPrice.fromString(gasPrice) },
  );
  const client = new CW4Client(nodeAddress, contractAddress, chainId);
  client.setSigningClient(signingClient, senderAddress, gasMultiplier);
  return client;
}

/**
 * Check if an address is a CW4 group contract
 */
export async function isCW4GroupContract(
  nodeAddress: string,
  contractAddress: string,
): Promise<boolean> {
  try {
    const client = new CW4Client(nodeAddress, contractAddress, "");
    
    // Try to query total_weight - this is a CW4-specific query
    await client.queryTotalWeight();
    
    // Try to list members
    const members = await client.queryListMembers(undefined, 1);
    
    // If both succeed, it's likely a CW4 contract
    return members !== undefined;
  } catch {
    return false;
  }
}

