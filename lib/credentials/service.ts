/**
 * Credential Service
 * 
 * File: lib/credentials/service.ts
 * 
 * Service for managing identity NFT credentials on TX.
 * Handles credential class creation, issuance, revocation, and verification.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";

import {
  AssetNFTClient,
  createAssetNFTClient,
} from "../coreum/assetnft-client";
import {
  Credential,
  CredentialClass,
  CredentialClassConfig,
  CredentialClassFeature,
  CredentialData,
  CredentialError,
  CredentialOperationResult,
  CredentialRole,
  CredentialStatus,
  CredentialVerificationResult,
  IssueCredentialInput,
  ListCredentialsOptions,
  RevokeCredentialInput,
  RotateCredentialInput,
  RotationResult,
} from "./types";
import * as localDb from "../localDb";

// ============================================================================
// Credential Service Configuration
// ============================================================================

export interface CredentialServiceConfig {
  /** RPC node address */
  readonly nodeAddress: string;
  /** Chain ID */
  readonly chainId: string;
}

// ============================================================================
// CredentialService Class
// ============================================================================

/**
 * Service for managing identity NFT credentials
 */
export class CredentialService {
  private readonly config: CredentialServiceConfig;
  private readonly assetNFTClient: AssetNFTClient;

  constructor(config: CredentialServiceConfig) {
    this.config = config;
    this.assetNFTClient = createAssetNFTClient(config.nodeAddress, config.chainId);
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Set signing client for write operations
   */
  setSigningClient(client: SigningStargateClient): void {
    this.assetNFTClient.setSigningClient(client);
  }

  /**
   * Disconnect the service
   */
  disconnect(): void {
    this.assetNFTClient.disconnect();
  }

  // ============================================================================
  // Class Operations
  // ============================================================================

  /**
   * Create a credential class for a team/multisig
   * 
   * @param senderAddress - Address that will be the issuer (usually the multisig admin)
   * @param teamAddress - The multisig contract address this class is for
   * @param config - Class configuration
   */
  async createCredentialClass(
    senderAddress: string,
    teamAddress: string,
    config: CredentialClassConfig,
  ): Promise<CredentialOperationResult & { credentialClass?: CredentialClass }> {
    try {
      // Ensure required features are enabled
      const features = new Set(config.features);
      if (!features.has("soulbound") && !features.has("disable_sending")) {
        // Credentials should be soulbound by default
        features.add("soulbound");
      }
      if (!features.has("burning")) {
        // Burning is required for revocation
        features.add("burning");
      }

      const result = await this.assetNFTClient.issueClass(senderAddress, {
        ...config,
        features: Array.from(features),
      });

      if (!result.success || !result.classId) {
        return {
          success: false,
          error: result.error || "Failed to create credential class",
        };
      }

      // Store in local database
      const credentialClass: CredentialClass = {
        classId: result.classId,
        issuer: senderAddress,
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        features: Array.from(features),
        teamAddress,
        chainId: this.config.chainId,
        createdAt: new Date().toISOString(),
      };

      localDb.createCredentialClass({
        teamAddress,
        chainId: this.config.chainId,
        classId: result.classId,
        issuer: senderAddress,
        features: Array.from(features),
      });

      return {
        success: true,
        txHash: result.txHash,
        height: result.height,
        gasUsed: result.gasUsed,
        credentialClass,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get credential class for a team
   */
  async getCredentialClass(teamAddress: string): Promise<CredentialClass | null> {
    // First check local DB
    const dbClass = localDb.getCredentialClass(this.config.chainId, teamAddress);
    
    if (!dbClass) {
      return null;
    }

    // Optionally verify on chain
    const chainClass = await this.assetNFTClient.queryClass(dbClass.classId);
    
    if (!chainClass) {
      return null;
    }

    return {
      classId: dbClass.classId,
      issuer: dbClass.issuer,
      name: chainClass.name,
      symbol: chainClass.symbol,
      description: chainClass.description,
      features: chainClass.features
        .map((f) => this.assetNFTClient.featureToString(f))
        .filter((f): f is CredentialClassFeature => f !== null),
      teamAddress: dbClass.teamAddress,
      chainId: dbClass.chainId,
      createdAt: dbClass.createdAt,
    };
  }

  // ============================================================================
  // Credential Issuance
  // ============================================================================

  /**
   * Issue a credential to a team member
   */
  async issueCredential(
    senderAddress: string,
    input: IssueCredentialInput,
  ): Promise<CredentialOperationResult> {
    try {
      // Generate token ID if not provided
      const tokenId = input.tokenId || AssetNFTClient.generateTokenId(
        input.teamAddress,
        input.recipientAddress,
      );

      // Create credential data
      const credentialData: CredentialData = {
        teamId: input.teamAddress,
        role: input.role,
        version: 1,
        issuedAt: new Date().toISOString(),
        expiry: input.expiry,
      };

      // Mint the NFT
      const result = await this.assetNFTClient.mint(
        senderAddress,
        input.classId,
        tokenId,
        input.recipientAddress,
        credentialData,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to mint credential",
        };
      }

      // Store in local database
      const credential: Credential = {
        id: `${input.classId}:${tokenId}`,
        classId: input.classId,
        tokenId,
        ownerAddress: input.recipientAddress,
        teamAddress: input.teamAddress,
        role: input.role,
        version: 1,
        status: "active",
        isFrozen: false,
        issuedAt: credentialData.issuedAt,
        expiry: input.expiry,
      };

      localDb.createCredential({
        classId: input.classId,
        tokenId,
        ownerAddress: input.recipientAddress,
        teamAddress: input.teamAddress,
        role: input.role,
        version: 1,
        status: "active",
        issuedAt: credentialData.issuedAt,
        expiry: input.expiry ?? null,
        chainId: this.config.chainId,
      });

      // Record event
      localDb.recordCredentialEvent({
        classId: input.classId,
        tokenId,
        eventType: "issued",
        actor: senderAddress,
        targetAddress: input.recipientAddress,
        txHash: result.txHash,
        height: result.height || 0,
        chainId: this.config.chainId,
      });

      return {
        success: true,
        txHash: result.txHash,
        height: result.height,
        gasUsed: result.gasUsed,
        credential,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Credential Revocation
  // ============================================================================

  /**
   * Revoke a credential by burning the NFT
   * 
   * CRITICAL: Frozen tokens cannot be burned. Check frozen status first.
   */
  async revokeCredential(
    senderAddress: string,
    input: RevokeCredentialInput,
  ): Promise<CredentialOperationResult> {
    try {
      // Check if token is frozen
      const isFrozen = await this.assetNFTClient.queryFrozen(
        input.classId,
        input.tokenId,
      );

      if (isFrozen) {
        throw new CredentialError(
          "Cannot revoke credential: token is frozen. Unfreeze first or use contract-side revocation.",
          "CANNOT_BURN_FROZEN",
          { classId: input.classId, tokenId: input.tokenId },
        );
      }

      // Burn the NFT
      const result = await this.assetNFTClient.burn(
        senderAddress,
        input.classId,
        input.tokenId,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to burn credential",
        };
      }

      // Update local database
      localDb.updateCredentialStatus(
        input.classId,
        input.tokenId,
        "revoked",
        new Date().toISOString(),
      );

      // Record event
      localDb.recordCredentialEvent({
        classId: input.classId,
        tokenId: input.tokenId,
        eventType: "revoked",
        actor: senderAddress,
        targetAddress: null,
        txHash: result.txHash,
        height: result.height || 0,
        chainId: this.config.chainId,
      });

      return {
        success: true,
        txHash: result.txHash,
        height: result.height,
        gasUsed: result.gasUsed,
      };
    } catch (error) {
      if (error instanceof CredentialError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Credential Verification
  // ============================================================================

  /**
   * Verify if an address holds a valid credential for a team
   * 
   * This performs on-chain verification for critical operations.
   */
  async verifyCredential(
    teamAddress: string,
    signerAddress: string,
    requiredRole?: CredentialRole,
  ): Promise<CredentialVerificationResult> {
    const height = await this.assetNFTClient.getCurrentHeight();
    const verifiedAt = new Date().toISOString();

    try {
      // Get the credential class for this team
      const credentialClass = await this.getCredentialClass(teamAddress);
      
      if (!credentialClass) {
        return {
          isValid: false,
          reason: "not_found",
          verifiedAtHeight: height,
          verifiedAt,
        };
      }

      // Query NFTs owned by this address in the credential class
      const nfts = await this.assetNFTClient.queryNFTsByOwner(
        credentialClass.classId,
        signerAddress,
      );

      if (nfts.length === 0) {
        return {
          isValid: false,
          reason: "not_found",
          verifiedAtHeight: height,
          verifiedAt,
        };
      }

      // Check each NFT for validity
      for (const nft of nfts) {
        // Parse credential data
        const data = this.assetNFTClient.parseCredentialData(nft);
        
        if (!data) {
          continue;
        }

        // Check if it's for the right team
        if (data.teamId !== teamAddress) {
          continue;
        }

        // Check if frozen
        const isFrozen = await this.assetNFTClient.queryFrozen(
          credentialClass.classId,
          nft.id,
        );

        if (isFrozen) {
          return {
            isValid: false,
            reason: "frozen",
            verifiedAtHeight: height,
            verifiedAt,
          };
        }

        // Check expiry
        if (data.expiry && new Date(data.expiry) < new Date()) {
          return {
            isValid: false,
            reason: "expired",
            verifiedAtHeight: height,
            verifiedAt,
          };
        }

        // Check role if required
        if (requiredRole && data.role !== requiredRole && data.role !== "admin") {
          return {
            isValid: false,
            reason: "wrong_role",
            verifiedAtHeight: height,
            verifiedAt,
          };
        }

        // Build credential object
        const credential: Credential = {
          id: `${credentialClass.classId}:${nft.id}`,
          classId: credentialClass.classId,
          tokenId: nft.id,
          ownerAddress: signerAddress,
          teamAddress,
          role: data.role,
          version: data.version,
          status: "active",
          isFrozen: false,
          issuedAt: data.issuedAt,
          expiry: data.expiry,
        };

        return {
          isValid: true,
          credential,
          verifiedAtHeight: height,
          verifiedAt,
        };
      }

      return {
        isValid: false,
        reason: "wrong_team",
        verifiedAtHeight: height,
        verifiedAt,
      };
    } catch (_error) {
      return {
        isValid: false,
        reason: "query_failed",
        verifiedAtHeight: height,
        verifiedAt,
      };
    }
  }

  /**
   * Quick check if an address has a valid credential (uses cache first)
   */
  async hasValidCredential(
    teamAddress: string,
    signerAddress: string,
  ): Promise<boolean> {
    // Check local DB first for quick response
    const dbCredential = localDb.getCredentialByOwner(
      this.config.chainId,
      teamAddress,
      signerAddress,
    );

    if (!dbCredential || dbCredential.status !== "active") {
      return false;
    }

    // Check expiry
    if (dbCredential.expiry && new Date(dbCredential.expiry) < new Date()) {
      return false;
    }

    // For critical operations, call verifyCredential() instead
    return true;
  }

  // ============================================================================
  // Signer Rotation
  // ============================================================================

  /**
   * Rotate a signer's credential
   * 
   * This performs:
   * 1. Burns the old signer's credential
   * 2. Issues a new credential to the new signer
   * 3. Optionally updates group membership
   */
  async rotateSignerCredential(
    senderAddress: string,
    input: RotateCredentialInput,
  ): Promise<RotationResult> {
    try {
      // Get the old signer's credential
      const oldCredential = localDb.getCredentialByOwner(
        this.config.chainId,
        input.teamAddress,
        input.oldSignerAddress,
      );

      if (!oldCredential) {
        throw new CredentialError(
          "No credential found for old signer",
          "CREDENTIAL_NOT_FOUND",
          { address: input.oldSignerAddress },
        );
      }

      // Check if token is frozen
      const isFrozen = await this.assetNFTClient.queryFrozen(
        input.classId,
        oldCredential.tokenId,
      );

      if (isFrozen) {
        throw new CredentialError(
          "Cannot rotate: old credential is frozen",
          "CANNOT_BURN_FROZEN",
          { tokenId: oldCredential.tokenId },
        );
      }

      // Step 1: Burn old credential
      const burnResult = await this.assetNFTClient.burn(
        senderAddress,
        input.classId,
        oldCredential.tokenId,
      );

      if (!burnResult.success) {
        return {
          success: false,
          error: `Failed to burn old credential: ${burnResult.error}`,
        };
      }

      // Update old credential status
      localDb.updateCredentialStatus(
        input.classId,
        oldCredential.tokenId,
        "revoked",
        new Date().toISOString(),
      );

      // Step 2: Issue new credential
      const newTokenId = AssetNFTClient.generateTokenId(
        input.teamAddress,
        input.newSignerAddress,
      );

      const credentialData: CredentialData = {
        teamId: input.teamAddress,
        role: input.role,
        version: oldCredential.version + 1,
        issuedAt: new Date().toISOString(),
      };

      const mintResult = await this.assetNFTClient.mint(
        senderAddress,
        input.classId,
        newTokenId,
        input.newSignerAddress,
        credentialData,
      );

      if (!mintResult.success) {
        return {
          success: false,
          burnTxHash: burnResult.txHash,
          error: `Burned old credential but failed to mint new: ${mintResult.error}`,
        };
      }

      // Store new credential
      const newCredential: Credential = {
        id: `${input.classId}:${newTokenId}`,
        classId: input.classId,
        tokenId: newTokenId,
        ownerAddress: input.newSignerAddress,
        teamAddress: input.teamAddress,
        role: input.role,
        version: oldCredential.version + 1,
        status: "active",
        isFrozen: false,
        issuedAt: credentialData.issuedAt,
      };

      localDb.createCredential({
        classId: input.classId,
        tokenId: newTokenId,
        ownerAddress: input.newSignerAddress,
        teamAddress: input.teamAddress,
        role: input.role,
        version: newCredential.version,
        status: "active",
        issuedAt: credentialData.issuedAt,
        expiry: null,
        chainId: this.config.chainId,
      });

      // Record rotation event
      localDb.recordCredentialEvent({
        classId: input.classId,
        tokenId: oldCredential.tokenId,
        eventType: "rotated",
        actor: senderAddress,
        targetAddress: input.newSignerAddress,
        txHash: mintResult.txHash,
        height: mintResult.height || 0,
        chainId: this.config.chainId,
      });

      // Step 3: Update group membership if requested
      let groupUpdateTxHash: string | undefined;
      if (input.updateGroupMembership && input.groupAddress) {
        // This would integrate with the CW4 client from Phase 2
        // For now, we return the info needed for the caller to handle it
        // The actual group update should be done via a separate transaction
      }

      return {
        success: true,
        txHash: mintResult.txHash,
        height: mintResult.height,
        burnTxHash: burnResult.txHash,
        mintTxHash: mintResult.txHash,
        groupUpdateTxHash,
        revokedCredential: {
          id: `${oldCredential.classId}:${oldCredential.tokenId}`,
          classId: oldCredential.classId,
          tokenId: oldCredential.tokenId,
          ownerAddress: oldCredential.ownerAddress,
          teamAddress: oldCredential.teamAddress,
          role: oldCredential.role as CredentialRole,
          version: oldCredential.version,
          status: "revoked" as CredentialStatus,
          isFrozen: false,
          issuedAt: oldCredential.issuedAt,
          expiry: oldCredential.expiry ?? undefined,
          revokedAt: new Date().toISOString(),
        },
        newCredential,
      };
    } catch (error) {
      if (error instanceof CredentialError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * List credentials based on filter options
   */
  async listCredentials(options: ListCredentialsOptions): Promise<Credential[]> {
    const dbCredentials = localDb.listCredentials({
      chainId: this.config.chainId,
      classId: options.classId,
      ownerAddress: options.ownerAddress,
      teamAddress: options.teamAddress,
      status: options.status,
      role: options.role,
      limit: options.limit,
    });

    return dbCredentials.map((db) => ({
      id: `${db.classId}:${db.tokenId}`,
      classId: db.classId,
      tokenId: db.tokenId,
      ownerAddress: db.ownerAddress,
      teamAddress: db.teamAddress,
      role: db.role as CredentialRole,
      version: db.version,
      status: db.status as CredentialStatus,
      isFrozen: false, // Would need to query chain for accurate value
      issuedAt: db.issuedAt,
      expiry: db.expiry ?? undefined,
      revokedAt: db.revokedAt ?? undefined,
    }));
  }

  /**
   * Get credentials for a team member
   */
  async getCredentialsForMember(
    teamAddress: string,
    memberAddress: string,
  ): Promise<Credential[]> {
    return this.listCredentials({
      teamAddress,
      ownerAddress: memberAddress,
      status: "active",
    });
  }

  /**
   * Get all active credentials for a team
   */
  async getTeamCredentials(teamAddress: string): Promise<Credential[]> {
    return this.listCredentials({
      teamAddress,
      status: "active",
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a credential service for queries only
 */
export function createCredentialService(
  nodeAddress: string,
  chainId: string,
): CredentialService {
  return new CredentialService({ nodeAddress, chainId });
}

/**
 * Create a credential service with signing capabilities from a pre-built client.
 * Important: The signingClient must have been created with a gasPrice option
 * if you intend to use "auto" gas estimation.
 */
export function createSigningCredentialService(
  nodeAddress: string,
  chainId: string,
  signingClient: SigningStargateClient,
): CredentialService {
  const service = new CredentialService({ nodeAddress, chainId });
  service.setSigningClient(signingClient);
  return service;
}

/**
 * Create a credential service with signing capabilities from a signer and gas price.
 * This is the preferred factory function as it ensures gasPrice is properly
 * configured for "auto" gas estimation.
 */
export async function createSigningCredentialServiceFromSigner(
  nodeAddress: string,
  chainId: string,
  signer: OfflineSigner,
  gasPrice: string,
): Promise<CredentialService> {
  const signingClient = await SigningStargateClient.connectWithSigner(
    nodeAddress,
    signer,
    { gasPrice: GasPrice.fromString(gasPrice) },
  );
  const service = new CredentialService({ nodeAddress, chainId });
  service.setSigningClient(signingClient);
  return service;
}

