/**
 * TX AssetNFT Client
 * 
 * File: lib/coreum/assetnft-client.ts
 * 
 * Client for interacting with TX's assetnft module.
 * This module provides NFT functionality with advanced features like:
 * - Soulbound tokens (issuer-only transfer)
 * - Burning (for credential revocation)
 * - Freezing (pause functionality)
 * - Whitelisting (restrict recipients)
 * 
 * Used for identity/credential NFTs in the multisig system.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { GasPrice, SigningStargateClient, StargateClient } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { toBase64, fromBase64, toUtf8, fromUtf8 } from "@cosmjs/encoding";
import { sha256 } from "@cosmjs/crypto";

import {
  CredentialData,
  CredentialClassConfig,
  CredentialClassFeature,
  CredentialError,
} from "../credentials/types";

// ============================================================================
// TX AssetNFT Types
// ============================================================================

/**
 * TX assetnft class features (bit flags)
 * See: https://docs.coreum.dev/modules/assetnft.html
 */
export enum AssetNFTFeature {
  burning = 0,
  freezing = 1,
  whitelisting = 2,
  disable_sending = 3,
  soulbound = 4,
}

/**
 * Data entry for dynamic NFT data
 */
export interface DataDynamicItem {
  /** List of editors who can update this item */
  editors: DataEditor[];
  /** The data value */
  data: string; // base64 encoded
}

/**
 * Editors for dynamic data
 */
export type DataEditor = "admin" | "owner";

/**
 * NFT data structure
 */
export interface NFTData {
  /** Immutable data bytes (base64 encoded) */
  data?: string;
  /** Dynamic data items (can be updated) */
  dataItems?: DataDynamicItem[];
}

/**
 * Response from querying an NFT class
 */
export interface AssetNFTClassResponse {
  id: string;
  issuer: string;
  name: string;
  symbol: string;
  description?: string;
  uri?: string;
  uriHash?: string;
  data?: NFTData;
  features: number[];
  royaltyRate?: string;
}

/**
 * Response from querying an NFT
 */
export interface AssetNFTResponse {
  classId: string;
  id: string;
  uri?: string;
  uriHash?: string;
  data?: NFTData;
}

/**
 * Response from querying NFT owner
 */
export interface NFTOwnerResponse {
  owner: string;
}

/**
 * Response from querying frozen status
 */
export interface FrozenResponse {
  frozen: boolean;
}

/**
 * Response from querying whitelisted status
 */
export interface WhitelistedResponse {
  whitelisted: boolean;
}

/**
 * Result of an assetnft operation
 */
export interface AssetNFTOperationResult {
  success: boolean;
  txHash: string;
  height?: number;
  gasUsed?: number;
  gasWanted?: number;
  error?: string;
  rawLog?: string;
}

// ============================================================================
// Message Types for TX AssetNFT Module
// ============================================================================

/**
 * Type URLs for TX assetnft messages
 */
export const ASSETNFT_TYPE_URLS = {
  IssueClass: "/coreum.asset.nft.v1.MsgIssueClass",
  Mint: "/coreum.asset.nft.v1.MsgMint",
  Burn: "/coreum.asset.nft.v1.MsgBurn",
  Freeze: "/coreum.asset.nft.v1.MsgFreeze",
  Unfreeze: "/coreum.asset.nft.v1.MsgUnfreeze",
  ClassFreeze: "/coreum.asset.nft.v1.MsgClassFreeze",
  ClassUnfreeze: "/coreum.asset.nft.v1.MsgClassUnfreeze",
  AddToWhitelist: "/coreum.asset.nft.v1.MsgAddToWhitelist",
  RemoveFromWhitelist: "/coreum.asset.nft.v1.MsgRemoveFromWhitelist",
  AddToClassWhitelist: "/coreum.asset.nft.v1.MsgAddToClassWhitelist",
  RemoveFromClassWhitelist: "/coreum.asset.nft.v1.MsgRemoveFromClassWhitelist",
  UpdateData: "/coreum.asset.nft.v1.MsgUpdateData",
} as const;

/**
 * Query paths for TX assetnft module
 */
export const ASSETNFT_QUERY_PATHS = {
  Class: "/coreum.asset.nft.v1.Query/Class",
  Classes: "/coreum.asset.nft.v1.Query/Classes",
  Frozen: "/coreum.asset.nft.v1.Query/Frozen",
  ClassFrozen: "/coreum.asset.nft.v1.Query/ClassFrozen",
  Whitelisted: "/coreum.asset.nft.v1.Query/Whitelisted",
  WhitelistedAccountsForNFT: "/coreum.asset.nft.v1.Query/WhitelistedAccountsForNFT",
  ClassWhitelistedAccounts: "/coreum.asset.nft.v1.Query/ClassWhitelistedAccounts",
  BurntNFT: "/coreum.asset.nft.v1.Query/BurntNFT",
  BurntNFTsInClass: "/coreum.asset.nft.v1.Query/BurntNFTsInClass",
} as const;

/**
 * NFT module query paths (standard cosmos NFT)
 */
export const NFT_QUERY_PATHS = {
  NFT: "/cosmos.nft.v1beta1.Query/NFT",
  NFTs: "/cosmos.nft.v1beta1.Query/NFTs",
  Owner: "/cosmos.nft.v1beta1.Query/Owner",
  Supply: "/cosmos.nft.v1beta1.Query/Supply",
  Balance: "/cosmos.nft.v1beta1.Query/Balance",
} as const;

// ============================================================================
// AssetNFTClient Class
// ============================================================================

/**
 * Client for interacting with TX's assetnft module
 */
export class AssetNFTClient {
  private readonly nodeAddress: string;
  private readonly chainId: string;
  private client: StargateClient | null = null;
  private signingClient: SigningStargateClient | null = null;

  constructor(nodeAddress: string, chainId: string) {
    this.nodeAddress = nodeAddress;
    this.chainId = chainId;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Get or create a Stargate client for queries
   */
  private async getClient(): Promise<StargateClient> {
    if (!this.client) {
      this.client = await StargateClient.connect(this.nodeAddress);
    }
    return this.client;
  }

  /**
   * Set a signing client for execute operations
   */
  setSigningClient(client: SigningStargateClient): void {
    this.signingClient = client;
  }

  /**
   * Get the signing client (throws if not set)
   */
  private getSigningClient(): SigningStargateClient {
    if (!this.signingClient) {
      throw new CredentialError(
        "Signing client not set. Call setSigningClient() before executing transactions.",
        "CHAIN_ERROR",
      );
    }
    return this.signingClient;
  }

  // ============================================================================
  // Class Operations
  // ============================================================================

  /**
   * Create an assetnft class for credentials
   * 
   * @param senderAddress - Address that will be the issuer
   * @param config - Class configuration
   * @returns Operation result with class ID
   */
  async issueClass(
    senderAddress: string,
    config: CredentialClassConfig,
  ): Promise<AssetNFTOperationResult & { classId?: string }> {
    try {
      const client = this.getSigningClient();
      
      // Convert features to bit flags
      const features = config.features.map((f) => this.featureToNumber(f));

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.IssueClass,
        value: {
          issuer: senderAddress,
          symbol: config.symbol,
          name: config.name,
          description: config.description || "",
          uri: config.uri || "",
          uriHash: config.uriHash || "",
          features,
          royaltyRate: config.royaltyRate || "0",
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      if (result.code !== 0) {
        return {
          success: false,
          txHash: result.transactionHash,
          error: result.rawLog || "Failed to issue class",
          rawLog: result.rawLog,
        };
      }

      // Class ID is derived from issuer + symbol
      const classId = `${config.symbol}-${senderAddress}`;

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        classId,
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
   * Query a class by ID
   * 
   * Note: This uses REST API for TX-specific queries.
   * In production, integrate with @coreum/coreum-js SDK for proper module queries.
   */
  async queryClass(classId: string): Promise<AssetNFTClassResponse | null> {
    try {
      // Use REST endpoint for TX assetnft queries
      // The actual endpoint depends on the TX node configuration
      const restEndpoint = this.nodeAddress.replace(/:\d+$/, ":1317");
      const response = await fetch(
        `${restEndpoint}/coreum/asset/nft/v1/classes/${encodeURIComponent(classId)}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.class as AssetNFTClassResponse;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Token Operations
  // ============================================================================

  /**
   * Mint a credential NFT
   * 
   * @param senderAddress - Issuer address
   * @param classId - Class ID
   * @param tokenId - Unique token ID
   * @param recipientAddress - Who will receive the token (must be same as sender for soulbound)
   * @param data - Credential data to store
   */
  async mint(
    senderAddress: string,
    classId: string,
    tokenId: string,
    recipientAddress: string,
    data: CredentialData,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      // Encode credential data as base64
      const dataBytes = toBase64(toUtf8(JSON.stringify(data)));

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.Mint,
        value: {
          sender: senderAddress,
          classId,
          id: tokenId,
          uri: "",
          uriHash: "",
          data: {
            data: dataBytes,
          },
          recipient: recipientAddress,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      if (result.code !== 0) {
        return {
          success: false,
          txHash: result.transactionHash,
          error: result.rawLog || "Failed to mint",
          rawLog: result.rawLog,
        };
      }

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
   * Burn a credential NFT (revocation)
   * 
   * @param senderAddress - Token owner or issuer (for soulbound)
   * @param classId - Class ID
   * @param tokenId - Token ID to burn
   */
  async burn(
    senderAddress: string,
    classId: string,
    tokenId: string,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.Burn,
        value: {
          sender: senderAddress,
          classId,
          id: tokenId,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      if (result.code !== 0) {
        return {
          success: false,
          txHash: result.transactionHash,
          error: result.rawLog || "Failed to burn",
          rawLog: result.rawLog,
        };
      }

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
   * Freeze a token (prevents transfers and burns)
   */
  async freeze(
    senderAddress: string,
    classId: string,
    tokenId: string,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.Freeze,
        value: {
          sender: senderAddress,
          classId,
          id: tokenId,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      return {
        success: result.code === 0,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        error: result.code !== 0 ? result.rawLog : undefined,
        rawLog: result.rawLog,
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
   * Unfreeze a token
   */
  async unfreeze(
    senderAddress: string,
    classId: string,
    tokenId: string,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.Unfreeze,
        value: {
          sender: senderAddress,
          classId,
          id: tokenId,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      return {
        success: result.code === 0,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        error: result.code !== 0 ? result.rawLog : undefined,
        rawLog: result.rawLog,
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
  // Query Operations
  // ============================================================================

  /**
   * Get REST endpoint from node address
   */
  private getRestEndpoint(): string {
    // Convert RPC endpoint to REST endpoint (typically port 1317)
    return this.nodeAddress.replace(/:\d+$/, ":1317").replace(/^ws/, "http");
  }

  /**
   * Query an NFT by class ID and token ID
   */
  async queryNFT(classId: string, tokenId: string): Promise<AssetNFTResponse | null> {
    try {
      const restEndpoint = this.getRestEndpoint();
      const response = await fetch(
        `${restEndpoint}/cosmos/nft/v1beta1/nfts/${encodeURIComponent(classId)}/${encodeURIComponent(tokenId)}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.nft as AssetNFTResponse;
    } catch {
      return null;
    }
  }

  /**
   * Query the owner of an NFT
   */
  async queryOwner(classId: string, tokenId: string): Promise<string | null> {
    try {
      const restEndpoint = this.getRestEndpoint();
      const response = await fetch(
        `${restEndpoint}/cosmos/nft/v1beta1/owner/${encodeURIComponent(classId)}/${encodeURIComponent(tokenId)}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as NFTOwnerResponse;
      return data.owner;
    } catch {
      return null;
    }
  }

  /**
   * Query if a token is frozen
   */
  async queryFrozen(classId: string, tokenId: string): Promise<boolean> {
    try {
      const restEndpoint = this.getRestEndpoint();
      const response = await fetch(
        `${restEndpoint}/coreum/asset/nft/v1/frozen/${encodeURIComponent(classId)}/${encodeURIComponent(tokenId)}`,
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as FrozenResponse;
      return data.frozen;
    } catch {
      return false;
    }
  }

  /**
   * Query NFTs owned by an address in a specific class
   */
  async queryNFTsByOwner(
    classId: string,
    ownerAddress: string,
  ): Promise<AssetNFTResponse[]> {
    try {
      const restEndpoint = this.getRestEndpoint();
      const response = await fetch(
        `${restEndpoint}/cosmos/nft/v1beta1/nfts?class_id=${encodeURIComponent(classId)}&owner=${encodeURIComponent(ownerAddress)}`,
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.nfts || []) as AssetNFTResponse[];
    } catch {
      return [];
    }
  }

  /**
   * Check if an address is whitelisted for an NFT
   */
  async queryWhitelisted(
    classId: string,
    tokenId: string,
    accountAddress: string,
  ): Promise<boolean> {
    try {
      const restEndpoint = this.getRestEndpoint();
      const response = await fetch(
        `${restEndpoint}/coreum/asset/nft/v1/whitelisted/${encodeURIComponent(classId)}/${encodeURIComponent(tokenId)}/${encodeURIComponent(accountAddress)}`,
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as WhitelistedResponse;
      return data.whitelisted;
    } catch {
      return false;
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
  // Whitelist Operations
  // ============================================================================

  /**
   * Add an account to the class whitelist
   */
  async addToClassWhitelist(
    senderAddress: string,
    classId: string,
    accountAddress: string,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.AddToClassWhitelist,
        value: {
          sender: senderAddress,
          classId,
          account: accountAddress,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      return {
        success: result.code === 0,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        error: result.code !== 0 ? result.rawLog : undefined,
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
   * Remove an account from the class whitelist
   */
  async removeFromClassWhitelist(
    senderAddress: string,
    classId: string,
    accountAddress: string,
  ): Promise<AssetNFTOperationResult> {
    try {
      const client = this.getSigningClient();

      const msg = {
        typeUrl: ASSETNFT_TYPE_URLS.RemoveFromClassWhitelist,
        value: {
          sender: senderAddress,
          classId,
          account: accountAddress,
        },
      };

      const result = await client.signAndBroadcast(
        senderAddress,
        [msg],
        "auto",
      );

      return {
        success: result.code === 0,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        error: result.code !== 0 ? result.rawLog : undefined,
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
  // Helper Methods
  // ============================================================================

  /**
   * Convert feature string to TX feature number
   */
  private featureToNumber(feature: CredentialClassFeature): number {
    const mapping: Record<CredentialClassFeature, number> = {
      burning: AssetNFTFeature.burning,
      freezing: AssetNFTFeature.freezing,
      whitelisting: AssetNFTFeature.whitelisting,
      disable_sending: AssetNFTFeature.disable_sending,
      soulbound: AssetNFTFeature.soulbound,
    };
    return mapping[feature];
  }

  /**
   * Convert TX feature number to string
   */
  featureToString(feature: number): CredentialClassFeature | null {
    const mapping: Record<number, CredentialClassFeature> = {
      [AssetNFTFeature.burning]: "burning",
      [AssetNFTFeature.freezing]: "freezing",
      [AssetNFTFeature.whitelisting]: "whitelisting",
      [AssetNFTFeature.disable_sending]: "disable_sending",
      [AssetNFTFeature.soulbound]: "soulbound",
    };
    return mapping[feature] || null;
  }

  /**
   * Parse credential data from NFT data bytes
   */
  parseCredentialData(nft: AssetNFTResponse): CredentialData | null {
    if (!nft.data?.data) {
      return null;
    }

    try {
      const decoded = fromUtf8(fromBase64(nft.data.data));
      return JSON.parse(decoded) as CredentialData;
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique token ID for a credential
   */
  static generateTokenId(teamAddress: string, recipientAddress: string): string {
    const input = `${teamAddress}-${recipientAddress}-${Date.now()}`;
    const hash = sha256(toUtf8(input));
    return toBase64(hash).slice(0, 16).replace(/[+/=]/g, "");
  }

  /**
   * Get the chain ID
   */
  getChainId(): string {
    return this.chainId;
  }

  /**
   * Disconnect clients
   */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    // SigningStargateClient doesn't have disconnect
    this.signingClient = null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AssetNFT client for queries only
 */
export function createAssetNFTClient(
  nodeAddress: string,
  chainId: string,
): AssetNFTClient {
  return new AssetNFTClient(nodeAddress, chainId);
}

/**
 * Create an AssetNFT client with signing capabilities from a pre-built client.
 * Important: The signingClient must have been created with a gasPrice option
 * if you intend to use "auto" gas estimation.
 */
export function createSigningAssetNFTClient(
  nodeAddress: string,
  chainId: string,
  signingClient: SigningStargateClient,
): AssetNFTClient {
  const client = new AssetNFTClient(nodeAddress, chainId);
  client.setSigningClient(signingClient);
  return client;
}

/**
 * Create an AssetNFT client with signing capabilities from a signer and gas price.
 * This is the preferred factory function as it ensures gasPrice is properly
 * configured for "auto" gas estimation.
 */
export async function createSigningAssetNFTClientFromSigner(
  nodeAddress: string,
  chainId: string,
  signer: OfflineSigner,
  gasPrice: string,
): Promise<AssetNFTClient> {
  const signingClient = await SigningStargateClient.connectWithSigner(
    nodeAddress,
    signer,
    { gasPrice: GasPrice.fromString(gasPrice) },
  );
  const client = new AssetNFTClient(nodeAddress, chainId);
  client.setSigningClient(signingClient);
  return client;
}

