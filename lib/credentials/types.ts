/**
 * Credential Types
 * 
 * File: lib/credentials/types.ts
 * 
 * Type definitions for TX assetnft-based credentials.
 * These credentials are soulbound NFTs that gate access to multisig operations.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

// ============================================================================
// Credential Data Types
// ============================================================================

/**
 * Roles that can be assigned to credential holders
 */
export type CredentialRole = "member" | "admin" | "proposer" | "executor";

/**
 * Status of a credential
 */
export type CredentialStatus = "active" | "revoked" | "expired" | "frozen";

/**
 * Data stored in the credential NFT (DataBytes payload)
 */
export interface CredentialData {
  /** Contract address or team identifier */
  readonly teamId: string;
  /** Role assigned to this credential holder */
  readonly role: CredentialRole;
  /** Credential version for rotation tracking */
  readonly version: number;
  /** ISO timestamp when credential was issued */
  readonly issuedAt: string;
  /** Optional: ISO timestamp when credential expires */
  readonly expiry?: string;
}

/**
 * Extended credential info with chain state
 */
export interface Credential {
  /** Unique credential ID (classId + tokenId) */
  readonly id: string;
  /** TX assetnft class ID */
  readonly classId: string;
  /** Token ID within the class */
  readonly tokenId: string;
  /** Current owner address */
  readonly ownerAddress: string;
  /** Team/multisig address this credential is for */
  readonly teamAddress: string;
  /** Assigned role */
  readonly role: CredentialRole;
  /** Version number */
  readonly version: number;
  /** Current status */
  readonly status: CredentialStatus;
  /** Whether the token is frozen on-chain */
  readonly isFrozen: boolean;
  /** When the credential was issued */
  readonly issuedAt: string;
  /** When the credential expires (if applicable) */
  readonly expiry?: string;
  /** When the credential was revoked (if applicable) */
  readonly revokedAt?: string;
}

// ============================================================================
// Credential Class Types
// ============================================================================

/**
 * Features that can be enabled on a credential class
 * Based on TX assetnft module features
 */
export type CredentialClassFeature =
  | "burning"      // Allows credential revocation via burn
  | "freezing"     // Allows freezing (not recommended for revocation)
  | "whitelisting" // Restricts who can receive credentials
  | "soulbound"    // Issuer-only transfer (required for credentials)
  | "disable_sending"; // Prevents transfers (alternative to soulbound)

/**
 * Configuration for creating a credential class
 */
export interface CredentialClassConfig {
  /** Human-readable name for the class */
  readonly name: string;
  /** Symbol for the class */
  readonly symbol: string;
  /** Description of the credential class */
  readonly description?: string;
  /** Features to enable (soulbound + burning recommended) */
  readonly features: readonly CredentialClassFeature[];
  /** URI for class metadata */
  readonly uri?: string;
  /** URI hash for verification */
  readonly uriHash?: string;
  /** Royalty rate (typically 0 for credentials) */
  readonly royaltyRate?: string;
}

/**
 * Credential class on-chain state
 */
export interface CredentialClass {
  /** Class ID (unique identifier on TX) */
  readonly classId: string;
  /** Issuer address (has authority to mint/burn) */
  readonly issuer: string;
  /** Class name */
  readonly name: string;
  /** Class symbol */
  readonly symbol: string;
  /** Description */
  readonly description?: string;
  /** Enabled features */
  readonly features: readonly CredentialClassFeature[];
  /** Associated team/multisig address */
  readonly teamAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** When the class was created */
  readonly createdAt: string;
}

// ============================================================================
// Verification Types
// ============================================================================

/**
 * Result of credential verification
 */
export interface CredentialVerificationResult {
  /** Whether the credential is valid */
  readonly isValid: boolean;
  /** The credential if found */
  readonly credential?: Credential;
  /** Reason if invalid */
  readonly reason?: CredentialInvalidReason;
  /** Block height at verification */
  readonly verifiedAtHeight: number;
  /** Timestamp of verification */
  readonly verifiedAt: string;
}

/**
 * Reasons a credential may be invalid
 */
export type CredentialInvalidReason =
  | "not_found"        // No credential exists for this address
  | "wrong_team"       // Credential is for a different team
  | "frozen"           // Credential is frozen
  | "expired"          // Credential has expired
  | "revoked"          // Credential was burned/revoked
  | "wrong_role"       // Credential doesn't have required role
  | "query_failed";    // Chain query failed

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Input for issuing a new credential
 */
export interface IssueCredentialInput {
  /** Team/multisig address */
  readonly teamAddress: string;
  /** Credential class ID */
  readonly classId: string;
  /** Recipient address */
  readonly recipientAddress: string;
  /** Role to assign */
  readonly role: CredentialRole;
  /** Optional: custom token ID (auto-generated if not provided) */
  readonly tokenId?: string;
  /** Optional: expiry timestamp */
  readonly expiry?: string;
}

/**
 * Input for revoking a credential
 */
export interface RevokeCredentialInput {
  /** Credential class ID */
  readonly classId: string;
  /** Token ID to revoke */
  readonly tokenId: string;
  /** Reason for revocation */
  readonly reason?: string;
}

/**
 * Input for rotating a signer's credential
 */
export interface RotateCredentialInput {
  /** Team/multisig address */
  readonly teamAddress: string;
  /** Credential class ID */
  readonly classId: string;
  /** Address of old signer (credential will be burned) */
  readonly oldSignerAddress: string;
  /** Address of new signer (will receive credential) */
  readonly newSignerAddress: string;
  /** Role to assign to new credential */
  readonly role: CredentialRole;
  /** Whether to also update group membership */
  readonly updateGroupMembership: boolean;
  /** Group address (required if updateGroupMembership is true) */
  readonly groupAddress?: string;
}

/**
 * Result of a credential operation
 */
export interface CredentialOperationResult {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Transaction hash if successful */
  readonly txHash?: string;
  /** Block height */
  readonly height?: number;
  /** Gas used */
  readonly gasUsed?: number;
  /** Error message if failed */
  readonly error?: string;
  /** The credential affected (if applicable) */
  readonly credential?: Credential;
}

/**
 * Result of a rotation operation
 */
export interface RotationResult extends CredentialOperationResult {
  /** Transaction hash for burn operation */
  readonly burnTxHash?: string;
  /** Transaction hash for mint operation */
  readonly mintTxHash?: string;
  /** Transaction hash for group update (if applicable) */
  readonly groupUpdateTxHash?: string;
  /** The revoked credential */
  readonly revokedCredential?: Credential;
  /** The new credential */
  readonly newCredential?: Credential;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Types of credential events
 */
export type CredentialEventType =
  | "class_created"
  | "issued"
  | "revoked"
  | "frozen"
  | "unfrozen"
  | "rotated"
  | "expired";

/**
 * A credential event from the chain
 */
export interface CredentialEvent {
  /** Event type */
  readonly type: CredentialEventType;
  /** Credential class ID */
  readonly classId: string;
  /** Token ID (if applicable) */
  readonly tokenId?: string;
  /** Actor who triggered the event */
  readonly actor: string;
  /** Target address (recipient or owner) */
  readonly targetAddress?: string;
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

// ============================================================================
// Query Types
// ============================================================================

/**
 * Options for listing credentials
 */
export interface ListCredentialsOptions {
  /** Filter by class ID */
  readonly classId?: string;
  /** Filter by owner address */
  readonly ownerAddress?: string;
  /** Filter by team address */
  readonly teamAddress?: string;
  /** Filter by status */
  readonly status?: CredentialStatus;
  /** Filter by role */
  readonly role?: CredentialRole;
  /** Pagination: start after this token ID */
  readonly startAfter?: string;
  /** Pagination: maximum results */
  readonly limit?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Credential-specific error codes
 */
export type CredentialErrorCode =
  | "CLASS_NOT_FOUND"
  | "CREDENTIAL_NOT_FOUND"
  | "NOT_ISSUER"
  | "ALREADY_EXISTS"
  | "CANNOT_BURN_FROZEN"
  | "EXPIRED"
  | "INVALID_RECIPIENT"
  | "MINT_FAILED"
  | "BURN_FAILED"
  | "QUERY_FAILED"
  | "ROTATION_FAILED"
  | "CHAIN_ERROR";

/**
 * Credential operation error
 */
export class CredentialError extends Error {
  constructor(
    message: string,
    public readonly code: CredentialErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CredentialError";
  }
}

