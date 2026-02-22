# Phase 3: Identity NFTs (Credential-Gated Multisig)

## Product Requirements Document

**Version:** 1.0  
**Date:** December 2025  
**Status:** Implemented  
**Prerequisites:** Phase 0 (Proposal Integrity), Phase 1 (Contract Multisig), Phase 2 (Group-Backed Multisig)

---

## 1. Executive Summary

Phase 3 introduces **Identity NFT Credentials** for Coreum-based multisigs. This feature enables credential-gated access control where team members must hold a soulbound NFT to participate in multisig operations (voting, executing proposals).

### Key Benefits

- **Immediate Revocation**: Burn a credential NFT to instantly revoke access
- **Stable Team Address**: Key rotation doesn't change the multisig address
- **Audit Trail**: Every vote records credential validity for compliance
- **Flexible Roles**: Assign member, admin, proposer, or executor roles

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                                │
├─────────────────────────────────────────────────────────────────────────┤
│  CredentialBadge  │  CredentialManagerPanel  │  SignerRotationForm     │
│  ContractVotePanel (enhanced)  │  CreateCliqForm (enhanced)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Layer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/chain/[chainId]/credentials/                                      │
│    ├── class.ts     (Create/Get credential class)                       │
│    ├── issue.ts     (Issue credential to member)                        │
│    ├── revoke.ts    (Burn/revoke credential)                            │
│    ├── verify.ts    (Check credential validity)                         │
│    ├── rotate.ts    (Rotate signer credentials)                         │
│    └── [address].ts (List credentials by address)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Engine Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ContractMultisigEngine                                                 │
│    ├── isCredentialGated()      - Check if multisig requires creds     │
│    ├── verifySignerCredential() - Verify signer holds valid cred       │
│    ├── approveProposal()        - Enhanced with credential check       │
│    └── executeProposal()        - Enhanced with credential check       │
│                                                                         │
│  CredentialService                                                      │
│    ├── createCredentialClass()  - Create assetnft class for team       │
│    ├── issueCredential()        - Mint soulbound credential            │
│    ├── revokeCredential()       - Burn credential (revocation)         │
│    ├── verifyCredential()       - On-chain verification                │
│    └── rotateSignerCredential() - Atomic burn + mint                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Coreum Chain Layer                              │
├─────────────────────────────────────────────────────────────────────────┤
│  AssetNFTClient                                                         │
│    ├── issueClass()   - Create NFT class with soulbound + burning      │
│    ├── mint()         - Mint credential NFT to recipient               │
│    ├── burn()         - Burn credential (revocation)                   │
│    ├── queryNFT()     - Query NFT by class/token ID                    │
│    ├── queryOwner()   - Get owner of NFT                               │
│    └── queryFrozen()  - Check if NFT is frozen                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

### New Files Created

```
lib/
├── coreum/
│   ├── assetnft-client.ts    # Coreum assetnft module client
│   └── index.ts              # Module exports
│
├── credentials/
│   ├── types.ts              # TypeScript type definitions
│   ├── service.ts            # CredentialService implementation
│   └── index.ts              # Module exports

pages/api/chain/[chainId]/credentials/
├── class.ts                  # POST: Create class, GET: Get class
├── issue.ts                  # POST: Issue credential
├── revoke.ts                 # POST: Revoke credential
├── verify.ts                 # GET: Verify credential
├── rotate.ts                 # POST: Rotate signer
└── [address].ts              # GET: List credentials

components/
├── ui/
│   └── credential-badge.tsx          # Status badge component
│
├── dataViews/
│   └── CredentialManagerPanel.tsx    # Credential management UI
│
└── forms/
    └── SignerRotationForm/
        └── index.tsx                 # Signer rotation wizard
```

### Modified Files

```
lib/
├── localDb.ts                    # Added credential tables
├── multisig/
│   ├── contract-engine.ts        # Added credential verification
│   └── types.ts                  # Added credential error codes
└── indexer/
    └── websocket-listener.ts     # Added assetnft event handling

components/
├── dataViews/
│   ├── ContractVotePanel.tsx         # Added credential check
│   └── ContractMultisigDashboard.tsx # Added Credentials tab
└── forms/
    └── CreateCliqForm/
        ├── index.tsx                 # Added credential setup UI
        └── formSchema.ts             # Added credential config schema
```

---

## 4. Core Components

### 4.1 Credential Types (`lib/credentials/types.ts`)

Defines all TypeScript types for the credential system.

```typescript
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
  readonly teamId: string;       // Contract address or team identifier
  readonly role: CredentialRole; // Role assigned to this credential holder
  readonly version: number;      // Credential version for rotation tracking
  readonly issuedAt: string;     // ISO timestamp when credential was issued
  readonly expiry?: string;      // Optional: ISO timestamp when credential expires
}

/**
 * Extended credential info with chain state
 */
export interface Credential {
  readonly id: string;
  readonly classId: string;
  readonly tokenId: string;
  readonly ownerAddress: string;
  readonly teamAddress: string;
  readonly role: CredentialRole;
  readonly version: number;
  readonly status: CredentialStatus;
  readonly isFrozen: boolean;
  readonly issuedAt: string;
  readonly expiry?: string;
  readonly revokedAt?: string;
}

/**
 * Result of credential verification
 */
export interface CredentialVerificationResult {
  readonly isValid: boolean;
  readonly credential?: Credential;
  readonly reason?: CredentialInvalidReason;
  readonly verifiedAtHeight: number;
  readonly verifiedAt: string;
}

export type CredentialInvalidReason =
  | "not_found"
  | "wrong_team"
  | "frozen"
  | "expired"
  | "revoked"
  | "wrong_role"
  | "query_failed";
```

### 4.2 Coreum AssetNFT Client (`lib/coreum/assetnft-client.ts`)

Client for interacting with Coreum's assetnft module.

```typescript
export class AssetNFTClient {
  private readonly nodeAddress: string;
  private readonly chainId: string;
  private client: StargateClient | null = null;
  private signingClient: SigningStargateClient | null = null;

  constructor(nodeAddress: string, chainId: string) {
    this.nodeAddress = nodeAddress;
    this.chainId = chainId;
  }

  /**
   * Create an assetnft class for credentials
   */
  async issueClass(
    senderAddress: string,
    config: CredentialClassConfig,
  ): Promise<AssetNFTOperationResult & { classId?: string }> {
    const client = this.getSigningClient();
    
    // Convert features to bit flags
    const features = config.features.map((f) => this.featureToNumber(f));

    const msg = {
      typeUrl: "/coreum.asset.nft.v1.MsgIssueClass",
      value: {
        issuer: senderAddress,
        symbol: config.symbol,
        name: config.name,
        description: config.description || "",
        features, // [soulbound, burning]
      },
    };

    const result = await client.signAndBroadcast(senderAddress, [msg], "auto");
    
    // Class ID is derived from issuer + symbol
    const classId = `${config.symbol}-${senderAddress}`;

    return {
      success: result.code === 0,
      txHash: result.transactionHash,
      classId,
    };
  }

  /**
   * Mint a credential NFT
   */
  async mint(
    senderAddress: string,
    classId: string,
    tokenId: string,
    recipientAddress: string,
    data: CredentialData,
  ): Promise<AssetNFTOperationResult> {
    const client = this.getSigningClient();

    // Encode credential data as base64
    const dataBytes = toBase64(toUtf8(JSON.stringify(data)));

    const msg = {
      typeUrl: "/coreum.asset.nft.v1.MsgMint",
      value: {
        sender: senderAddress,
        classId,
        id: tokenId,
        data: { data: dataBytes },
        recipient: recipientAddress,
      },
    };

    const result = await client.signAndBroadcast(senderAddress, [msg], "auto");
    return { success: result.code === 0, txHash: result.transactionHash };
  }

  /**
   * Burn a credential NFT (revocation)
   */
  async burn(
    senderAddress: string,
    classId: string,
    tokenId: string,
  ): Promise<AssetNFTOperationResult> {
    const msg = {
      typeUrl: "/coreum.asset.nft.v1.MsgBurn",
      value: { sender: senderAddress, classId, id: tokenId },
    };

    const result = await this.getSigningClient()
      .signAndBroadcast(senderAddress, [msg], "auto");
    
    return { success: result.code === 0, txHash: result.transactionHash };
  }

  /**
   * Query if a token is frozen
   */
  async queryFrozen(classId: string, tokenId: string): Promise<boolean> {
    const restEndpoint = this.getRestEndpoint();
    const response = await fetch(
      `${restEndpoint}/coreum/asset/nft/v1/frozen/${classId}/${tokenId}`
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.frozen;
  }
}
```

### 4.3 Credential Service (`lib/credentials/service.ts`)

Service for managing identity NFT credentials.

```typescript
export class CredentialService {
  private readonly config: CredentialServiceConfig;
  private readonly assetNFTClient: AssetNFTClient;

  constructor(config: CredentialServiceConfig) {
    this.config = config;
    this.assetNFTClient = createAssetNFTClient(config.nodeAddress, config.chainId);
  }

  /**
   * Create a credential class for a team/multisig
   */
  async createCredentialClass(
    senderAddress: string,
    teamAddress: string,
    config: CredentialClassConfig,
  ): Promise<CredentialOperationResult & { credentialClass?: CredentialClass }> {
    // Ensure required features are enabled
    const features = new Set(config.features);
    features.add("soulbound");  // Required for credentials
    features.add("burning");    // Required for revocation

    const result = await this.assetNFTClient.issueClass(senderAddress, {
      ...config,
      features: Array.from(features),
    });

    if (!result.success || !result.classId) {
      return { success: false, error: result.error };
    }

    // Store in local database
    localDb.createCredentialClass({
      teamAddress,
      chainId: this.config.chainId,
      classId: result.classId,
      issuer: senderAddress,
      features: Array.from(features),
    });

    return { success: true, txHash: result.txHash, credentialClass: {...} };
  }

  /**
   * Verify if an address holds a valid credential for a team
   */
  async verifyCredential(
    teamAddress: string,
    signerAddress: string,
    requiredRole?: CredentialRole,
  ): Promise<CredentialVerificationResult> {
    const height = await this.assetNFTClient.getCurrentHeight();

    // Get the credential class for this team
    const credentialClass = await this.getCredentialClass(teamAddress);
    if (!credentialClass) {
      return { isValid: false, reason: "not_found", verifiedAtHeight: height };
    }

    // Query NFTs owned by this address in the credential class
    const nfts = await this.assetNFTClient.queryNFTsByOwner(
      credentialClass.classId,
      signerAddress,
    );

    if (nfts.length === 0) {
      return { isValid: false, reason: "not_found", verifiedAtHeight: height };
    }

    // Check each NFT for validity
    for (const nft of nfts) {
      const data = this.assetNFTClient.parseCredentialData(nft);
      if (!data || data.teamId !== teamAddress) continue;

      // Check if frozen
      const isFrozen = await this.assetNFTClient.queryFrozen(
        credentialClass.classId,
        nft.id,
      );
      if (isFrozen) {
        return { isValid: false, reason: "frozen", verifiedAtHeight: height };
      }

      // Check expiry
      if (data.expiry && new Date(data.expiry) < new Date()) {
        return { isValid: false, reason: "expired", verifiedAtHeight: height };
      }

      // Check role
      if (requiredRole && data.role !== requiredRole && data.role !== "admin") {
        return { isValid: false, reason: "wrong_role", verifiedAtHeight: height };
      }

      // Valid!
      return { isValid: true, credential: {...}, verifiedAtHeight: height };
    }

    return { isValid: false, reason: "wrong_team", verifiedAtHeight: height };
  }

  /**
   * Rotate a signer's credential (burn old + mint new)
   */
  async rotateSignerCredential(
    senderAddress: string,
    input: RotateCredentialInput,
  ): Promise<RotationResult> {
    // Step 1: Burn old credential
    const burnResult = await this.assetNFTClient.burn(
      senderAddress,
      input.classId,
      oldCredential.tokenId,
    );

    // Step 2: Mint new credential with incremented version
    const mintResult = await this.assetNFTClient.mint(
      senderAddress,
      input.classId,
      newTokenId,
      input.newSignerAddress,
      { ...credentialData, version: oldCredential.version + 1 },
    );

    return {
      success: true,
      burnTxHash: burnResult.txHash,
      mintTxHash: mintResult.txHash,
      revokedCredential: oldCredential,
      newCredential: newCredential,
    };
  }
}
```

### 4.4 Database Schema (`lib/localDb.ts`)

Added three new tables for credential management.

```typescript
/**
 * Credential Class - Coreum assetnft class for team credentials
 */
interface DbCredentialClass {
  id: string;
  teamAddress: string;        // Contract multisig address
  chainId: string;
  classId: string;            // Coreum assetnft class ID
  issuer: string;             // Class issuer (admin)
  features: string[];         // ["soulbound", "burning", ...]
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential - Individual credential token
 */
interface DbCredential {
  id: string;
  classId: string;
  tokenId: string;
  ownerAddress: string;
  teamAddress: string;
  chainId: string;
  role: string;               // "member" | "admin" | "proposer" | "executor"
  version: number;
  status: "active" | "revoked" | "expired";
  issuedAt: string;
  expiry: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential Event - Audit trail for credential operations
 */
interface DbCredentialEvent {
  id: string;
  classId: string;
  tokenId: string;
  eventType: "class_created" | "issued" | "revoked" | "frozen" | "unfrozen" | "rotated" | "expired";
  actor: string;
  targetAddress: string | null;
  txHash: string;
  height: number;
  chainId: string;
  createdAt: string;
}

// Database interface updated
interface Database {
  // ... existing tables ...
  // Phase 3 additions
  credentialClasses: DbCredentialClass[];
  credentials: DbCredential[];
  credentialEvents: DbCredentialEvent[];
}
```

**CRUD Operations Added:**

```typescript
// Credential Class Operations
export const getCredentialClass = (chainId: string, teamAddress: string): DbCredentialClass | null;
export const getCredentialClassById = (chainId: string, classId: string): DbCredentialClass | null;
export const createCredentialClass = (data: Omit<DbCredentialClass, "id" | "createdAt" | "updatedAt">): string;

// Credential Operations
export const getCredential = (classId: string, tokenId: string): DbCredential | null;
export const getCredentialByOwner = (chainId: string, teamAddress: string, ownerAddress: string): DbCredential | null;
export const getCredentialsByTeam = (chainId: string, teamAddress: string): DbCredential[];
export const createCredential = (data: Omit<DbCredential, "id" | "revokedAt" | "createdAt" | "updatedAt">): string;
export const updateCredentialStatus = (classId: string, tokenId: string, status: string, revokedAt?: string): void;
export const listCredentials = (options: ListOptions): DbCredential[];

// Event Operations
export const recordCredentialEvent = (event: Omit<DbCredentialEvent, "id" | "createdAt">): string;
export const getCredentialEventsByClass = (classId: string): DbCredentialEvent[];
export const getCredentialEventsByToken = (classId: string, tokenId: string): DbCredentialEvent[];
```

---

## 5. Engine Integration

### 5.1 ContractMultisigEngine Enhancement (`lib/multisig/contract-engine.ts`)

Added credential-gated multisig style and verification.

```typescript
/**
 * Multisig style:
 * - fixed: CW3-Fixed (Phase 1)
 * - flex: CW3-Flex with CW4 group (Phase 2)
 * - credential-gated: CW3-Flex with credential verification (Phase 3)
 */
export type MultisigStyle = "fixed" | "flex" | "credential-gated";

/**
 * Credential verifier interface for dependency injection
 */
export interface CredentialVerifier {
  verifyCredential(
    teamAddress: string,
    signerAddress: string,
    requiredRole?: string,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    verifiedAtHeight: number;
    verifiedAt: string;
  }>;
}

export interface ContractEngineConfig extends EngineConfig {
  // ... existing config ...
  /** Multisig style: fixed, flex, or credential-gated */
  readonly multisigStyle?: MultisigStyle;
  /** Credential class ID for credential-gated multisigs */
  readonly credentialClassId?: string;
  /** Credential verifier for credential-gated multisigs */
  readonly credentialVerifier?: CredentialVerifier;
}

export class ContractMultisigEngine implements MultisigEngine {
  // Phase 3: Credential-gated multisig support
  private readonly credentialClassId: string | null;
  private readonly credentialVerifier: CredentialVerifier | null;

  /**
   * Check if this is a credential-gated multisig
   */
  isCredentialGated(): boolean {
    return this.multisigStyle === "credential-gated";
  }

  /**
   * Vote on a proposal (approve = vote yes)
   * 
   * Phase 3: For credential-gated multisigs, verifies credential before voting
   */
  async approveProposal(
    proposalId: string,
    signer: SignerInfo,
    _signatureBytes: string,
    _signDocHash: string,
  ): Promise<ApprovalReceipt> {
    // Phase 3: Verify credential for credential-gated multisigs
    if (this.isCredentialGated() && this.credentialVerifier) {
      const credentialResult = await this.credentialVerifier.verifyCredential(
        this.multisigAddress,
        signer.address,
        "member",
      );

      if (!credentialResult.isValid) {
        throw new MultisigEngineError(
          `Signer ${signer.address} does not hold a valid credential: ${credentialResult.reason}`,
          "CREDENTIAL_REQUIRED",
        );
      }
    }
    
    // ... rest of voting logic ...
  }

  /**
   * Execute a passed proposal
   * 
   * Phase 3: For credential-gated multisigs, verifies executor credential
   */
  async executeProposal(proposalId: string, executorAddress?: string): Promise<TxResult> {
    // Phase 3: Verify credential for credential-gated multisigs
    if (this.isCredentialGated() && this.credentialVerifier && executorAddress) {
      const credentialResult = await this.credentialVerifier.verifyCredential(
        this.multisigAddress,
        executorAddress,
        "executor",
      );

      if (!credentialResult.isValid) {
        throw new MultisigEngineError(
          `Executor does not hold a valid credential`,
          "CREDENTIAL_REQUIRED",
        );
      }
    }

    // ... rest of execution logic ...
  }

  /**
   * Capture vote snapshot at vote time
   * 
   * Phase 3: Records credential validity at vote time for audit trail.
   */
  private async captureVoteSnapshot(
    proposalId: number,
    voterAddress: string,
    voteHeight: number,
  ): Promise<void> {
    let credentialValid = true;

    // Phase 3: Check credential validity for credential-gated multisigs
    if (this.isCredentialGated() && this.credentialVerifier) {
      const credResult = await this.credentialVerifier.verifyCredential(
        this.multisigAddress,
        voterAddress,
      );
      credentialValid = credResult.isValid;
    }

    localDb.createVoteSnapshot({
      contractAddress: this.multisigAddress,
      proposalId,
      voter: voterAddress,
      weightAtVote,
      credentialValid, // <-- Records credential validity
      voteHeight,
      voteTime: new Date().toISOString(),
    });
  }
}
```

### 5.2 Error Codes (`lib/multisig/types.ts`)

```typescript
export type MultisigErrorCode =
  // ... existing errors ...
  // Phase 3: Credential-specific errors
  | "CREDENTIAL_REQUIRED"
  | "CREDENTIAL_INVALID"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_FROZEN";
```

---

## 6. Indexer Integration

### 6.1 WebSocket Listener (`lib/indexer/websocket-listener.ts`)

Added Coreum assetnft event handling for real-time credential updates.

```typescript
/**
 * Types of Coreum assetnft events for credentials
 */
export type CredentialEventType =
  | "credential_mint"
  | "credential_burn"
  | "credential_freeze"
  | "credential_unfreeze";

export interface WebSocketConfig {
  // ... existing config ...
  /** Credential class IDs to watch (Phase 3) */
  credentialClassIds?: string[];
}

export interface ParsedEvent {
  // ... existing fields ...
  /** Whether this is a credential event (Phase 3) */
  isCredentialEvent?: boolean;
  /** Credential class ID for credential events */
  credentialClassId?: string;
  /** Token ID for credential events */
  tokenId?: string;
}

// Event processing
private processTxResult(txResult: TxResult): void {
  for (const event of result.events) {
    // Phase 3: Handle Coreum assetnft events for credentials
    if (event.type === "coreum.asset.nft.v1.EventMinted" ||
        event.type === "coreum.asset.nft.v1.EventBurnt" ||
        event.type === "coreum.asset.nft.v1.EventFrozen" ||
        event.type === "coreum.asset.nft.v1.EventUnfrozen") {
      
      const classId = attributes["class_id"];
      
      if (classId && this.config.credentialClassIds?.includes(classId)) {
        const parsedEvent = this.parseCredentialEvent(event.type, classId, attributes, txHash, height);
        if (parsedEvent) {
          this.handleParsedEvent(parsedEvent);
        }
      }
    }
  }
}

// State updates for credential events
private updateCachedState(event: ParsedEvent): void {
  switch (event.type) {
    case "credential_mint":
      console.log(`[WS] Credential minted: ${event.credentialClassId}:${event.tokenId}`);
      break;

    case "credential_burn":
      // Update status to revoked
      localDb.updateCredentialStatus(
        event.credentialClassId,
        event.tokenId,
        "revoked",
        new Date().toISOString(),
      );
      break;

    case "credential_freeze":
      console.log(`[WS] Credential frozen: ${event.credentialClassId}:${event.tokenId}`);
      break;

    case "credential_unfreeze":
      console.log(`[WS] Credential unfrozen`);
      break;
  }
}
```

---

## 7. API Endpoints

### 7.1 Create/Get Credential Class

**Endpoint:** `POST/GET /api/chain/[chainId]/credentials/class`

```typescript
// POST - Create a new credential class
interface CreateClassRequest {
  teamAddress: string;
  classId: string;
  issuer: string;
  name: string;
  symbol: string;
  description?: string;
  features: string[];
}

// Response
{
  "success": true,
  "id": "class-id-123"
}

// GET - Get credential class
// ?teamAddress=core1... or ?classId=CLIQ1-core1...
interface CredentialClassResponse {
  id: string;
  teamAddress: string;
  chainId: string;
  classId: string;
  issuer: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 Issue Credential

**Endpoint:** `POST /api/chain/[chainId]/credentials/issue`

```typescript
interface IssueCredentialRequest {
  classId: string;
  tokenId: string;
  ownerAddress: string;
  teamAddress: string;
  role: "member" | "admin" | "proposer" | "executor";
  expiry?: string;
  txHash: string;
  height: number;
  issuer: string;
}

// Response
{
  "id": "cred-123",
  "classId": "CLIQ1-core1...",
  "tokenId": "cred-1702...",
  "ownerAddress": "core1member...",
  "teamAddress": "core1multisig...",
  "role": "member",
  "version": 1,
  "status": "active",
  "issuedAt": "2025-12-18T10:00:00Z",
  "expiry": null
}
```

### 7.3 Revoke Credential

**Endpoint:** `POST /api/chain/[chainId]/credentials/revoke`

```typescript
interface RevokeCredentialRequest {
  classId: string;
  tokenId: string;
  actor: string;
  reason?: string;
  txHash: string;
  height: number;
}

// Response
{
  "success": true,
  "revokedAt": "2025-12-18T12:00:00Z"
}
```

### 7.4 Verify Credential

**Endpoint:** `GET /api/chain/[chainId]/credentials/verify`

```
?teamAddress=core1multisig...&signerAddress=core1member...&role=member
```

```typescript
// Response
{
  "isValid": true,
  "credential": {
    "classId": "CLIQ1-core1...",
    "tokenId": "cred-1702...",
    "role": "member",
    "version": 1,
    "status": "active",
    "issuedAt": "2025-12-18T10:00:00Z",
    "expiry": null
  },
  "verifiedAt": "2025-12-18T14:00:00Z"
}

// Or if invalid
{
  "isValid": false,
  "reason": "not_found",
  "verifiedAt": "2025-12-18T14:00:00Z"
}
```

### 7.5 Rotate Signer

**Endpoint:** `POST /api/chain/[chainId]/credentials/rotate`

```typescript
interface RotateSignerRequest {
  classId: string;
  oldSignerAddress: string;
  newSignerAddress: string;
  newTokenId: string;
  role: "member" | "admin" | "proposer" | "executor";
  teamAddress: string;
  actor: string;
  burnTxHash: string;
  mintTxHash: string;
  burnHeight: number;
  mintHeight: number;
  expiry?: string;
}

// Response
{
  "success": true,
  "revokedCredential": {
    "classId": "CLIQ1-core1...",
    "tokenId": "old-token-id",
    "ownerAddress": "core1old...",
    "revokedAt": "2025-12-18T14:00:00Z"
  },
  "newCredential": {
    "classId": "CLIQ1-core1...",
    "tokenId": "new-token-id",
    "ownerAddress": "core1new...",
    "role": "member",
    "version": 2,
    "issuedAt": "2025-12-18T14:00:00Z"
  }
}
```

### 7.6 List Credentials

**Endpoint:** `GET /api/chain/[chainId]/credentials/[address]`

```
?type=team&status=active&role=member
```

```typescript
// Response
{
  "credentials": [
    {
      "id": "cred-123",
      "classId": "CLIQ1-core1...",
      "tokenId": "cred-1702...",
      "ownerAddress": "core1member...",
      "teamAddress": "core1multisig...",
      "role": "member",
      "version": 1,
      "status": "active",
      "issuedAt": "2025-12-18T10:00:00Z",
      "expiry": null,
      "revokedAt": null
    }
  ],
  "count": 1
}
```

---

## 8. UI Components

### 8.1 Credential Badge (`components/ui/credential-badge.tsx`)

Visual indicator for credential status.

```tsx
export type CredentialStatusType =
  | "valid"
  | "missing"
  | "expired"
  | "frozen"
  | "revoked"
  | "wrong_role"
  | "loading"
  | "not_required";

export interface CredentialBadgeProps {
  status: CredentialStatusType;
  role?: string;
  compact?: boolean;
  className?: string;
  showTooltip?: boolean;
}

// Usage
<CredentialBadge status="valid" role="member" />
<CredentialBadge status="missing" showTooltip />
<CredentialBadge status="expired" compact />
```

**Visual States:**

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| valid | ✓ | Green | Valid credential |
| missing | ✗ | Red | No credential found |
| expired | ⏰ | Amber | Credential expired |
| frozen | ⏸ | Orange | Credential frozen |
| revoked | ✗ | Red | Credential revoked |
| wrong_role | ⚠ | Amber | Wrong role |
| loading | ⟳ | Gray | Checking... |
| not_required | 🛡 | Gray | Not required |

### 8.2 Credential Manager Panel (`components/dataViews/CredentialManagerPanel.tsx`)

Panel for viewing and managing team credentials.

```tsx
interface CredentialManagerPanelProps {
  teamAddress: string;
  chainId: string;
  isAdmin?: boolean;
  className?: string;
}

// Features:
// - Display credential class info (class ID, features, issuer)
// - List all issued credentials with status
// - Issue new credential form (admin only)
// - Revoke credential action with confirmation
// - Show credential verification status for each member
```

### 8.3 Signer Rotation Wizard (`components/forms/SignerRotationForm/index.tsx`)

Step-by-step wizard for rotating signers.

```tsx
interface SignerRotationFormProps {
  teamAddress: string;
  chainId: string;
  classId: string;
  groupAddress?: string;
  currentMembers: Array<{ address: string; role: string }>;
  onComplete?: () => void;
  onCancel?: () => void;
}

// Steps:
// 1. Select signer to rotate
// 2. Enter new signer address + role
// 3. Review and confirm
// 4. Executing (burn + mint)
// 5. Complete summary
```

### 8.4 Enhanced Vote Panel (`components/dataViews/ContractVotePanel.tsx`)

Added credential verification to the voting panel.

```tsx
interface ContractVotePanelProps {
  // ... existing props ...
  /** Whether this multisig requires credential verification */
  isCredentialGated?: boolean;
}

// New features:
// - Credential status display before vote buttons
// - Warning alert if credential is missing/invalid
// - Vote buttons disabled when credential check fails
```

### 8.5 Enhanced Contract Dashboard (`components/dataViews/ContractMultisigDashboard.tsx`)

Added Credentials tab to the dashboard.

```tsx
interface ContractMultisigDashboardProps {
  // ... existing props ...
  /** Whether this multisig uses credential gating */
  isCredentialGated?: boolean;
}

// New Credentials tab (only shown if isCredentialGated)
<TabsTrigger value="credentials">
  <Key className="h-4 w-4" />
  Credentials
</TabsTrigger>

<TabsContent value="credentials">
  <CredentialManagerPanel
    teamAddress={contractAddress}
    chainId={chainId}
    isAdmin={isMember}
  />
</TabsContent>
```

### 8.6 Enhanced Create Cliq Form (`components/forms/CreateCliqForm/index.tsx`)

Added credential gating configuration to the form.

```tsx
// New form fields in formSchema.ts
enableCredentialGating: z.boolean().optional().default(false),
credentialConfig: z.object({
  classSymbol: z.string().max(16).regex(/^[A-Z0-9]+$/),
  className: z.string().max(50),
  autoIssueCredentials: z.boolean().default(true),
}).optional(),

// UI section in approval step
<FormField
  name="enableCredentialGating"
  render={({ field }) => (
    <FormItem>
      <div className="flex items-center justify-between">
        <div>
          <FormLabel>Credential Gating</FormLabel>
          <FormDescription>
            Require members to hold an identity NFT to vote
          </FormDescription>
        </div>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </div>
    </FormItem>
  )}
/>

{enableCredentialGating && (
  // Symbol and class name inputs
  // Auto-issue credentials toggle
)}
```

---

## 9. Data Flow

### 9.1 Creating a Credential-Gated Multisig

```
User fills CreateCliqForm with credential gating enabled
    │
    ▼
Form validates: members, threshold, credential config
    │
    ▼
Submit creates:
    1. CW3-Flex contract (multisig)
    2. CW4-group contract (membership)
    3. Coreum assetnft class (credentials)
    │
    ▼
If autoIssueCredentials:
    For each initial member:
        Issue credential NFT via CredentialService
    │
    ▼
Store credential class in localDb
    │
    ▼
Redirect to new multisig dashboard
```

### 9.2 Voting with Credential Verification

```
User clicks "Vote Yes" on proposal
    │
    ▼
ContractVotePanel checks isCredentialGated
    │
    ▼
If credential-gated:
    API call: GET /credentials/verify?teamAddress=X&signerAddress=Y
    │
    ├── isValid: true  → Enable vote button
    │
    └── isValid: false → Show warning, disable vote button
    │
    ▼
User submits vote
    │
    ▼
ContractMultisigEngine.approveProposal()
    │
    ├── credentialVerifier.verifyCredential()
    │   └── If invalid → throw CREDENTIAL_REQUIRED
    │
    ├── cw3Client.vote()
    │
    └── captureVoteSnapshot() with credentialValid flag
```

### 9.3 Rotating a Signer

```
Admin opens SignerRotationForm
    │
    ▼
Step 1: Select signer to rotate
    │
    ▼
Step 2: Enter new signer address + role
    │
    ▼
Step 3: Review changes
    │
    ▼
Step 4: Execute rotation
    │
    ├── CredentialService.rotateSignerCredential()
    │   │
    │   ├── 1. assetNFTClient.burn() old credential
    │   ├── 2. assetNFTClient.mint() new credential
    │   └── 3. (Optional) CW4Client.updateMembers()
    │
    ├── localDb.updateCredentialStatus() → revoked
    ├── localDb.createCredential() → new
    └── localDb.recordCredentialEvent() → rotated
    │
    ▼
Step 5: Complete summary with transaction hashes
    │
    ▼
Team address unchanged, new signer can now vote
```

---

## 10. Security Considerations

### 10.1 Revocation Path

**CRITICAL**: Frozen tokens cannot be burned in Coreum.

```
Revocation Preference Order:
    1. burn()     - Primary method, immediate revocation
    2. CW4 update - Fallback, remove from group
    3. UI warning - Show if credential is frozen
```

### 10.2 Credential Verification Timing

```
Operation           | Verification Point                  | Source
--------------------|-------------------------------------|--------
Vote (UI)           | Before showing vote button          | API cache
Vote (Engine)       | In approveProposal()                | Chain
Execute (Engine)    | In executeProposal()                | Chain
Snapshot            | At captureVoteSnapshot()            | Chain
```

### 10.3 Audit Trail

Every vote snapshot includes:

```typescript
interface DbVoteSnapshot {
  voter: string;
  weightAtVote: number;
  credentialValid: boolean;  // ← Recorded at exact vote time
  voteHeight: number;
  voteTime: string;
}
```

---

## 11. Acceptance Criteria

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Removing a signer is immediate via credential burn + group update | ✅ | `CredentialService.revokeCredential()` |
| Key rotation does not change team account address | ✅ | `rotateSignerCredential()` burns/mints without touching CW3 |
| All votes record credential validity in snapshot for audit | ✅ | `captureVoteSnapshot()` with `credentialValid` flag |
| Frozen credentials show warning in UI | ✅ | `CredentialBadge` with "frozen" status |
| Credential-gated multisigs enforce credential ownership for approve/execute | ✅ | `approveProposal()` and `executeProposal()` checks |

---

## 12. Testing Checklist

- [ ] Create credential class for new multisig
- [ ] Issue credentials to all initial members
- [ ] Verify member can vote with valid credential
- [ ] Verify vote blocked without credential
- [ ] Verify execution blocked without credential
- [ ] Revoke credential and verify immediate access loss
- [ ] Rotate signer and verify:
  - Old signer cannot vote
  - New signer can vote
  - Team address unchanged
- [ ] Check credential status in dashboard
- [ ] Verify vote snapshots record credential validity
- [ ] Test WebSocket events for mint/burn

---

## 13. Future Enhancements

- **Credential Expiry UI**: Calendar picker for setting expiry dates
- **Batch Issuance**: Issue credentials to multiple members at once
- **Role-Based Permissions**: Different actions require different roles
- **Credential Delegation**: Allow temporary delegation of voting power
- **Integration with CW4 Hooks**: Automatic credential revocation on group removal

