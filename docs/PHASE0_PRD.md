# Phase 0: PubKey Multisig Production Hardening

**Status:** Complete  
**Date:** December 18, 2025  
**Version:** 1.0.0

---

## Table of Contents
Every phase I broke down into a different level. I think I was TLSA not Tesla where is the fucking test fix applied public results so test every para
1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [New File Structure](#3-new-file-structure)
4. [MultisigEngine Interface](#4-multisigengine-interface)
5. [Canonical Transaction Builder](#5-canonical-transaction-builder)
6. [Proposal Hashing](#6-proposal-hashing)
7. [Multi-RPC Broadcast Verification](#7-multi-rpc-broadcast-verification)
8. [Signer Intent Verification UI](#8-signer-intent-verification-ui)
9. [Modified Files](#9-modified-files)
10. [Security Enhancements](#10-security-enhancements)
11. [Usage Examples](#11-usage-examples)
12. [Future Phases Enablement](#12-future-phases-enablement)

---

## 1. Executive Summary

Phase 0 introduces a **MultisigEngine abstraction layer** that establishes the architectural foundation for supporting both PubKey multisig and Contract multisig in parallel. This phase focuses on hardening the existing PubKey multisig with production-grade security features.

### Key Deliverables

- **MultisigEngine Interface** - Unified abstraction for multisig operations
- **CanonicalTxBuilder** - Deterministic transaction construction
- **ProposalHasher** - Content-addressed integrity verification
- **MultiRpcVerifier** - Hardened broadcast with cross-endpoint confirmation
- **ProposalIntentView** - Mandatory signer intent verification UI

### Acceptance Criteria

- [x] Any signer can independently reproduce sign bytes from proposal data
- [x] Broadcast confirmation requires 2+ independent endpoint confirmations
- [x] All proposals have content-addressed hashes stored
- [x] Signers must view intent summary before signing is enabled
- [x] Existing functionality remains working (no breaking changes)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  CreateTxForm  │  TransactionSigning  │  BroadcastButton        │
│                │  + ProposalIntentView│                          │
└───────┬────────┴──────────┬───────────┴────────┬────────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MultisigEngine Interface                        │
├─────────────────────────────────────────────────────────────────┤
│  PubKeyMultisigEngine     │    ContractMultisigEngine (Future)  │
│  - createProposal()       │    - On-chain proposals              │
│  - approveProposal()      │    - CW3-style voting                │
│  - executeProposal()      │    - Identity NFT gating             │
└───────┬───────────────────┴─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Services                               │
├─────────────────────────────────────────────────────────────────┤
│  CanonicalTxBuilder  │  ProposalHasher  │  MultiRpcVerifier     │
│  - Deterministic     │  - SHA256 hash   │  - Multi-endpoint     │
│  - Immutable         │  - Verification  │  - Cross-check        │
└───────┬──────────────┴────────┬─────────┴────────┬──────────────┘
        │                       │                  │
        ▼                       ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  LocalDb (Current)  │  Supabase (Future)  │  Jackal (Future)    │
│  + payloadHash      │                     │                      │
│  + signDocHash      │                     │                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. New File Structure

```
lib/
├── multisig/                          # NEW FOLDER
│   ├── index.ts                       # Module exports
│   ├── types.ts                       # Shared types for engine
│   ├── engine.ts                      # MultisigEngine interface
│   └── pubkey-engine.ts               # PubKey implementation
│
├── tx/                                # NEW FOLDER
│   ├── index.ts                       # Module exports
│   ├── canonical-builder.ts           # Deterministic tx construction
│   └── proposal-hasher.ts             # Content-addressed hashing
│
├── rpc/                               # NEW FOLDER
│   ├── index.ts                       # Module exports
│   ├── endpoint-manager.ts            # RPC endpoint configuration
│   └── multi-rpc-verifier.ts          # Multi-endpoint verification
│
└── localDb.ts                         # MODIFIED - Added payloadHash fields

components/
└── dataViews/
    └── ProposalIntentView.tsx         # NEW - Intent verification UI

pages/
└── [chainName]/[address]/transaction/
    └── [transactionID].tsx            # MODIFIED - Multi-RPC integration
```

---

## 4. MultisigEngine Interface

### Location: `lib/multisig/`

The MultisigEngine provides a unified interface for multisig operations, allowing seamless switching between PubKey and Contract implementations.

### Types (`lib/multisig/types.ts`)

```typescript
// Engine type discriminator
export type MultisigEngineType = "pubkey" | "contract";

// Sign mode support
export type SignMode = "amino" | "direct";

// Member definition
export interface Member {
  readonly address: string;      // Bech32 address
  readonly pubkey: string;       // Base64-encoded pubkey
  readonly weight: number;       // Voting weight (1 for pubkey multisig)
}

// Multisig policy configuration
export interface MultisigPolicy {
  readonly threshold: number;
  readonly totalWeight: number;
  readonly signModes: readonly SignMode[];
  readonly version: number;
}

// Proposal status lifecycle
export type ProposalStatus = 
  | "draft"      // Created but not ready
  | "pending"    // Ready for signatures
  | "signing"    // Collecting signatures
  | "ready"      // Threshold met
  | "broadcast"  // Sent to chain
  | "confirmed"  // Successfully included
  | "failed"     // Broadcast failed
  | "cancelled"; // Manually cancelled

// Proposal content
export interface ProposalContent {
  readonly msgs: readonly EncodeObject[];
  readonly fee: StdFee;
  readonly memo: string;
  readonly chainId: string;
  readonly accountNumber: number;
  readonly sequence: number;
}

// Full proposal state
export interface ProposalState extends Proposal {
  readonly signatures: readonly SignatureShare[];
  readonly approvalWeight: number;
  readonly threshold: number;
  readonly isReady: boolean;
}

// Signature share from individual signer
export interface SignatureShare {
  readonly proposalId: string;
  readonly signerAddress: string;
  readonly signMode: SignMode;
  readonly signatureBytes: string;     // Base64
  readonly signDocHash: string;        // For verification
  readonly bodyBytes: string;          // Base64
  readonly createdAt: string;
}

// Error handling
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
  | "SIGNER_NOT_MEMBER"
  | "ALREADY_SIGNED"
  | "THRESHOLD_NOT_MET"
  | "INVALID_SIGNATURE"
  // Contract-specific errors (future)
  | "CONTRACT_NOT_FOUND"
  | "PROPOSAL_EXPIRED"
  | "VOTING_CLOSED";
```

### Interface (`lib/multisig/engine.ts`)

```typescript
export interface MultisigEngine {
  // Engine metadata
  readonly engineType: MultisigEngineType;
  readonly chainId: string;
  readonly multisigAddress: string;

  // Proposal lifecycle
  createProposal(input: ProposalInput): Promise<Proposal>;
  approveProposal(
    proposalId: string,
    signer: SignerInfo,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<ApprovalReceipt>;
  revokeApproval(proposalId: string, signer: SignerInfo): Promise<RevokeReceipt>;
  executeProposal(proposalId: string): Promise<TxResult>;
  cancelProposal(proposalId: string): Promise<void>;

  // Queries
  getProposal(proposalId: string): Promise<ProposalState>;
  listProposals(status?: string): Promise<readonly ProposalState[]>;
  getPolicy(): Promise<MultisigPolicy>;
  listMembers(): Promise<readonly Member[]>;

  // Signing helpers
  getSignBytes(
    proposalId: string,
    signMode: "amino" | "direct",
  ): Promise<SignBytesResult>;
  verifySignature(
    proposalId: string,
    signerAddress: string,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<boolean>;
}
```

### PubKey Implementation (`lib/multisig/pubkey-engine.ts`)

```typescript
export class PubKeyMultisigEngine implements MultisigEngine {
  readonly engineType = "pubkey" as const;
  readonly chainId: string;
  readonly multisigAddress: string;

  private readonly multisigPubkey: MultisigThresholdPubkey;
  private readonly registry: Registry;
  private proposals: Map<string, ProposalState> = new Map();

  constructor(config: EngineConfig, multisigPubkey: MultisigThresholdPubkey) {
    this.chainId = config.chainId;
    this.multisigAddress = config.multisigAddress;
    this.multisigPubkey = multisigPubkey;
    this.registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  }

  async createProposal(input: ProposalInput): Promise<Proposal> {
    const proposalId = this.generateProposalId();
    const payloadHash = this.computePayloadHash(input);
    
    const proposal: Proposal = {
      id: proposalId,
      multisigAddress: this.multisigAddress,
      chainId: this.chainId,
      payloadHash,
      content: { ...input, chainId: this.chainId },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store and return
    this.proposals.set(proposalId, { ...proposal, signatures: [], ... });
    return proposal;
  }

  async executeProposal(proposalId: string): Promise<TxResult> {
    const proposal = await this.getProposal(proposalId);
    
    if (!proposal.isReady) {
      throw new MultisigEngineError(
        `Threshold not met (${proposal.approvalWeight}/${proposal.threshold})`,
        "THRESHOLD_NOT_MET",
      );
    }

    // Assemble multisig transaction
    const txBytes = this.assembleMultisigTx(proposal);

    // Broadcast via StargateClient
    const client = await StargateClient.connect(this.nodeAddress);
    const result = await client.broadcastTx(txBytes);

    return {
      proposalId,
      txHash: result.transactionHash,
      height: result.height,
      success: result.code === 0,
    };
  }
}

// Factory function
export async function createPubKeyMultisigEngine(
  config: EngineConfig,
  multisigPubkey: MultisigThresholdPubkey,
): Promise<PubKeyMultisigEngine> {
  return new PubKeyMultisigEngine(config, multisigPubkey);
}
```

---

## 5. Canonical Transaction Builder

### Location: `lib/tx/canonical-builder.ts`

The CanonicalTxBuilder enforces deterministic transaction construction with strict ordering and immutable fee policy.

### Key Features

- **Deterministic ordering** - Messages sorted by typeUrl + content hash
- **Immutable construction** - No modification after creation
- **Payload hash** - SHA256 of canonical payload bytes
- **Replay protection** - Binds chainId, accountNumber, sequence

### Implementation

```typescript
export class CanonicalTxBuilder {
  private readonly msgs: readonly EncodeObject[];
  private readonly options: TxOptions;
  private readonly registry: Registry;
  private readonly aminoTypes: AminoTypes;
  
  // Cached values
  private _bodyBytes?: Uint8Array;
  private _payloadHash?: Uint8Array;

  private constructor(msgs: readonly EncodeObject[], options: TxOptions) {
    // Freeze inputs for immutability
    this.msgs = Object.freeze([...msgs]);
    this.options = Object.freeze({ ...options });
    this.registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
    this.aminoTypes = new AminoTypes(aminoConverters);
  }

  // Factory with deterministic sorting
  static fromMessages(
    msgs: readonly EncodeObject[],
    options: TxOptions,
  ): CanonicalTxBuilder {
    const sortedMsgs = CanonicalTxBuilder.sortMessages(msgs);
    return new CanonicalTxBuilder(sortedMsgs, options);
  }

  // Deterministic message sorting
  private static sortMessages(msgs: readonly EncodeObject[]): EncodeObject[] {
    return [...msgs].sort((a, b) => {
      // First by typeUrl
      const typeCompare = a.typeUrl.localeCompare(b.typeUrl);
      if (typeCompare !== 0) return typeCompare;

      // Then by content hash
      const hashA = sha256(new TextEncoder().encode(JSON.stringify(a.value)));
      const hashB = sha256(new TextEncoder().encode(JSON.stringify(b.value)));
      return toBase64(hashA).localeCompare(toBase64(hashB));
    });
  }

  // Compute payload hash
  getPayloadHash(): Uint8Array {
    if (this._payloadHash) return this._payloadHash;

    const payload = this.getCanonicalPayload();
    const canonical = this.serializeCanonical(payload);
    this._payloadHash = sha256(canonical);

    return this._payloadHash;
  }

  getPayloadHashBase64(): string {
    return toBase64(this.getPayloadHash());
  }

  // Get sign bytes for Direct mode
  getDirectSignDoc(multisigPubkey: MultisigThresholdPubkey): SignDocBytes {
    const bodyBytes = this.getBodyBytes();
    const { authInfoBytes } = makeDirectModeAuthInfo(
      multisigPubkey,
      this.options.sequence,
      this.options.fee,
    );
    const { signDocBytes, signDocHash } = makeDirectSignDoc(
      bodyBytes,
      authInfoBytes,
      this.options.chainId,
      this.options.accountNumber,
    );

    return {
      bytes: signDocBytes,
      hash: signDocHash,
      hashBase64: toBase64(signDocHash),
    };
  }

  // Validation
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.options.chainId) errors.push("Chain ID is required");
    if (!this.msgs.length) errors.push("At least one message is required");
    if (!this.options.fee?.gas) errors.push("Invalid gas amount");
    if (this.options.memo?.length > 256) warnings.push("Memo exceeds 256 chars");

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Verify payload hash
  verifyPayloadHash(expectedHash: string): boolean {
    return this.getPayloadHashBase64() === expectedHash;
  }
}

// Convenience functions
export function computePayloadHash(data: {...}): string {
  const builder = CanonicalTxBuilder.fromTransactionData(data);
  return builder.getPayloadHashBase64();
}

export function verifyPayloadHash(data: {...}, expectedHash: string): boolean {
  const builder = CanonicalTxBuilder.fromTransactionData(data);
  return builder.verifyPayloadHash(expectedHash);
}
```

---

## 6. Proposal Hashing

### Location: `lib/tx/proposal-hasher.ts`

Content-addressed hashing for proposal integrity verification.

### Implementation

```typescript
export interface ProposalHashInput {
  readonly chainId: string;
  readonly accountNumber: number;
  readonly sequence: number;
  readonly msgs: readonly EncodeObject[];
  readonly fee: StdFee;
  readonly memo: string;
}

export class ProposalHasher {
  // Compute deterministic hash
  static hash(input: ProposalHashInput): ProposalHashResult {
    const canonical = ProposalHasher.toCanonicalJson(input);
    const bytes = new TextEncoder().encode(canonical);
    const hash = sha256(bytes);

    return {
      hash,
      hashBase64: toBase64(hash),
      hashHex: ProposalHasher.toHex(hash),
      canonicalJson: canonical,
    };
  }

  // Verify against expected hash
  static verify(input: ProposalHashInput, expectedHash: string): boolean {
    const result = ProposalHasher.hash(input);
    // Support both base64 and hex
    if (expectedHash.length === 64) {
      return result.hashHex === expectedHash.toLowerCase();
    }
    return result.hashBase64 === expectedHash;
  }

  // Convert to canonical JSON (sorted keys)
  static toCanonicalJson(input: ProposalHashInput): string {
    const canonical = {
      accountNumber: input.accountNumber,
      chainId: input.chainId,
      fee: ProposalHasher.normalizeFee(input.fee),
      memo: input.memo,
      msgs: input.msgs.map((m) => ProposalHasher.normalizeMessage(m)),
      sequence: input.sequence,
    };
    return ProposalHasher.sortedStringify(canonical);
  }

  // Normalize values (BigInt -> string, Uint8Array -> base64)
  private static normalizeValue(value: any): any {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Uint8Array) return toBase64(value);
    if (Array.isArray(value)) return value.map((v) => this.normalizeValue(v));
    if (typeof value === "object" && value !== null) {
      const normalized: Record<string, any> = {};
      for (const key of Object.keys(value).sort()) {
        normalized[key] = this.normalizeValue(value[key]);
      }
      return normalized;
    }
    return value;
  }
}

// Convenience functions
export function computeProposalHash(input: ProposalHashInput): string {
  return ProposalHasher.hash(input).hashBase64;
}

export function verifyProposalHash(
  input: ProposalHashInput,
  expectedHash: string,
): boolean {
  return ProposalHasher.verify(input, expectedHash);
}
```

### Database Schema Update (`lib/localDb.ts`)

```typescript
interface DbTransaction {
  id: string;
  txHash: string | null;
  creatorId: string;
  dataJSON: string;
  status?: "pending" | "broadcast" | "cancelled";
  // Phase 0 additions for proposal integrity
  payloadHash?: string;      // SHA256 of canonical payload (base64)
  signDocHash?: string;      // SHA256 of signDoc for verification (base64)
}

// New function for updating hashes
export const updateTransactionPayloadHash = (
  transactionId: string,
  payloadHash: string,
  signDocHash?: string,
): void => {
  const db = readDb();
  const transaction = db.transactions.find((t) => t.id === transactionId);
  
  if (!transaction) {
    throw new Error(`Transaction with id ${transactionId} not found`);
  }
  
  transaction.payloadHash = payloadHash;
  if (signDocHash) {
    transaction.signDocHash = signDocHash;
  }
  writeDb(db);
};
```

---

## 7. Multi-RPC Broadcast Verification

### Location: `lib/rpc/`

Implements hardened broadcast with cross-endpoint confirmation.

### Broadcast Policy

1. **Primary:** Send tx to trusted/private RPC endpoint
2. **Secondary:** Verify on 1-2 additional public endpoints
3. **Never** trust success from a single RPC as final

### Endpoint Manager (`lib/rpc/endpoint-manager.ts`)

```typescript
export type EndpointPriority = "primary" | "secondary" | "witness";
export type EndpointType = "private" | "public";

export interface RpcEndpoint {
  readonly url: string;
  readonly priority: EndpointPriority;
  readonly type: EndpointType;
  readonly label?: string;
  healthy?: boolean;
  lastResponseTime?: number;
}

export interface EndpointConfig {
  readonly chainId: string;
  readonly endpoints: RpcEndpoint[];
  readonly minConfirmations: number;
  readonly timeoutMs: number;
}

export class EndpointManager {
  private configs: Map<string, EndpointConfig> = new Map();

  // Create from chain info
  static fromChainInfo(
    chainId: string,
    nodeAddress: string,
    nodeAddresses?: readonly string[],
  ): EndpointConfig {
    const endpoints: RpcEndpoint[] = [
      { url: nodeAddress, priority: "primary", type: "private" },
    ];

    nodeAddresses?.forEach((url, i) => {
      if (url !== nodeAddress) {
        endpoints.push({
          url,
          priority: i === 0 ? "secondary" : "witness",
          type: "public",
        });
      }
    });

    return {
      chainId,
      endpoints,
      minConfirmations: Math.min(2, endpoints.length),
      timeoutMs: 30000,
    };
  }

  // Health check endpoints
  async healthCheck(chainId: string): Promise<void> {
    const config = this.configs.get(chainId);
    if (!config) return;

    for (const endpoint of config.endpoints) {
      const start = Date.now();
      try {
        const response = await fetch(`${endpoint.url}/status`);
        endpoint.healthy = response.ok;
        endpoint.lastResponseTime = Date.now() - start;
      } catch {
        endpoint.healthy = false;
      }
    }
  }
}
```

### Multi-RPC Verifier (`lib/rpc/multi-rpc-verifier.ts`)

```typescript
export interface BroadcastResult {
  readonly txHash: string;
  readonly success: boolean;
  readonly height?: number;
  readonly gasUsed?: number;
  readonly gasWanted?: number;
  readonly error?: string;
  readonly broadcastEndpoint: string;
  readonly verifications: readonly VerificationResult[];
}

export interface VerificationResult {
  readonly endpoint: string;
  readonly verified: boolean;
  readonly height?: number;
  readonly error?: string;
  readonly responseTimeMs: number;
}

export class MultiRpcVerifier {
  private readonly config: EndpointConfig;
  private clients: Map<string, StargateClient> = new Map();

  constructor(config: EndpointConfig) {
    this.config = config;
  }

  // Broadcast with multi-endpoint verification
  async broadcastAndVerify(txBytes: Uint8Array): Promise<BroadcastResult> {
    const txHash = toHex(sha256(txBytes)).toUpperCase();
    console.log(`📡 Broadcasting transaction: ${txHash}`);

    const primaryEndpoint = this.getPrimaryEndpoint();
    if (!primaryEndpoint) {
      return {
        txHash,
        success: false,
        error: "No primary endpoint configured",
        broadcastEndpoint: "",
        verifications: [],
      };
    }

    // Step 1: Broadcast to primary
    let broadcastResponse: DeliverTxResponse;
    try {
      const client = await this.getClient(primaryEndpoint.url);
      broadcastResponse = await client.broadcastTx(txBytes);
    } catch (error) {
      return {
        txHash,
        success: false,
        error: error instanceof Error ? error.message : "Broadcast failed",
        broadcastEndpoint: primaryEndpoint.url,
        verifications: [],
      };
    }

    if (broadcastResponse.code !== 0) {
      return {
        txHash: broadcastResponse.transactionHash,
        success: false,
        error: broadcastResponse.rawLog,
        height: broadcastResponse.height,
        broadcastEndpoint: primaryEndpoint.url,
        verifications: [],
      };
    }

    // Step 2: Verify on secondary endpoints
    const verifications = await this.verifyInclusion(
      broadcastResponse.transactionHash,
      this.config.minConfirmations,
    );

    const confirmedCount = verifications.filter((v) => v.verified).length + 1;
    const isFullyVerified = confirmedCount >= this.config.minConfirmations;

    return {
      txHash: broadcastResponse.transactionHash,
      success: isFullyVerified,
      height: broadcastResponse.height,
      gasUsed: Number(broadcastResponse.gasUsed),
      gasWanted: Number(broadcastResponse.gasWanted),
      broadcastEndpoint: primaryEndpoint.url,
      verifications,
    };
  }

  // Verify inclusion on secondary endpoints
  async verifyInclusion(
    txHash: string,
    minConfirmations: number,
  ): Promise<readonly VerificationResult[]> {
    const witnessEndpoints = this.getWitnessEndpoints();
    const results: VerificationResult[] = [];

    for (const endpoint of witnessEndpoints) {
      const start = Date.now();
      try {
        const client = await this.getClient(endpoint.url);
        const tx = await client.getTx(txHash);
        results.push({
          endpoint: endpoint.url,
          verified: !!tx,
          height: tx?.height,
          responseTimeMs: Date.now() - start,
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.url,
          verified: false,
          error: error instanceof Error ? error.message : "Unknown",
          responseTimeMs: Date.now() - start,
        });
      }

      // Early exit if enough confirmations
      if (results.filter((r) => r.verified).length >= minConfirmations - 1) {
        break;
      }
    }

    return results;
  }
}

// Factory function
export function createMultiRpcVerifier(
  chainId: string,
  nodeAddress: string,
  nodeAddresses?: readonly string[],
): MultiRpcVerifier {
  const config = EndpointManager.fromChainInfo(chainId, nodeAddress, nodeAddresses);
  return new MultiRpcVerifier(config);
}
```

---

## 8. Signer Intent Verification UI

### Location: `components/dataViews/ProposalIntentView.tsx`

Mandatory intent review before signing to prevent payload deception attacks.

### Features

- Human-readable transaction summary with icons
- Risk assessment (low/medium/high) with visual indicators
- Payload hash display for independent verification
- "I have verified this transaction" checkbox gate
- Raw JSON preview toggle
- Compact and full display modes

### Props Interface

```typescript
export interface ProposalIntentViewProps {
  msgs: readonly EncodeObject[];
  fee: StdFee;
  memo: string;
  chainId: string;
  accountNumber: number;
  sequence: number;
  onVerified: (verified: boolean) => void;
  requireVerification?: boolean;
  compact?: boolean;
  signMode?: "amino" | "direct";
}
```

### Message Parsing

```typescript
interface MessageSummary {
  type: string;
  description: string;
  icon: React.ReactNode;
  details: Record<string, string>;
  risk: "low" | "medium" | "high";
}

function parseMessage(msg: EncodeObject): MessageSummary {
  const { typeUrl, value } = msg;
  
  switch (typeUrl) {
    case "/cosmos.bank.v1beta1.MsgSend":
      return {
        type: "Send",
        description: `Send tokens to ${truncateAddress(value.toAddress)}`,
        icon: <SendIcon />,
        details: {
          From: truncateAddress(value.fromAddress),
          To: truncateAddress(value.toAddress),
          Amount: formatCoins(value.amount),
        },
        risk: "low",
      };
      
    case "/cosmwasm.wasm.v1.MsgExecuteContract":
      return {
        type: "Execute Contract",
        description: `Execute contract ${truncateAddress(value.contract)}`,
        icon: <ContractIcon />,
        details: {
          Contract: truncateAddress(value.contract),
          Funds: formatCoins(value.funds),
        },
        risk: "high",  // Contract execution is high risk
      };
      
    // ... other message types
  }
}
```

### Component Usage

```tsx
// Compact mode (for bento grid)
<ProposalIntentView
  msgs={tx.msgs}
  fee={tx.fee}
  memo={tx.memo}
  chainId={tx.chainId}
  accountNumber={tx.accountNumber}
  sequence={tx.sequence}
  onVerified={setIntentVerified}
  requireVerification={true}
  compact={true}
  signMode="amino"
/>

// Full mode (standalone)
<ProposalIntentView
  msgs={tx.msgs}
  fee={tx.fee}
  memo={tx.memo}
  chainId={tx.chainId}
  accountNumber={tx.accountNumber}
  sequence={tx.sequence}
  onVerified={setIntentVerified}
  requireVerification={true}
  compact={false}
  signMode="direct"
/>
```

---

## 9. Modified Files

### TransactionSigning.tsx

**Location:** `components/forms/TransactionSigning.tsx`

**Changes:**
1. Added ProposalIntentView import
2. Added intent verification state management
3. Integrated mandatory verification before signing
4. Sign button disabled until verification completes

```typescript
// New imports
import { ProposalIntentView } from "../dataViews/ProposalIntentView";
import { Shield } from "lucide-react";

// New state
const [intentVerified, setIntentVerified] = useState(false);
const [showIntentView, setShowIntentView] = useState(false);

// In render - compact mode
{!intentVerified && (
  <ProposalIntentView
    msgs={props.tx.msgs}
    fee={props.tx.fee}
    memo={props.tx.memo}
    chainId={props.tx.chainId}
    accountNumber={props.tx.accountNumber}
    sequence={props.tx.sequence}
    onVerified={setIntentVerified}
    requireVerification={true}
    compact={true}
    signMode={signMode}
  />
)}

<Button
  label="Sign transaction"
  onClick={() => signTransaction(signMode)}
  loading={signingInProgress}
  disabled={!intentVerified}  // Disabled until verified
/>
```

### [transactionID].tsx

**Location:** `pages/[chainName]/[address]/transaction/[transactionID].tsx`

**Changes:**
1. Added MultiRpcVerifier import
2. Added verification state management
3. Replaced single RPC broadcast with multi-endpoint verification
4. Added verification status UI display

```typescript
// New imports
import { createMultiRpcVerifier, BroadcastResult } from "@/lib/rpc";
import { CheckCircle2 } from "lucide-react";

// New state
const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);
const [verificationStatus, setVerificationStatus] = useState<
  "idle" | "verifying" | "verified" | "failed"
>("idle");

// In broadcastTx function
setVerificationStatus("verifying");

const verifier = createMultiRpcVerifier(
  chain.chainId,
  chain.nodeAddress,
  chain.nodeAddresses,
);

const verifiedResult = await verifier.broadcastAndVerify(signedTxBytes);
setBroadcastResult(verifiedResult);

if (!verifiedResult.success) {
  setVerificationStatus("failed");
  throw new Error(verifiedResult.error || "Verification failed");
}

setVerificationStatus("verified");
await verifier.disconnect();

// In render - verification status display
{broadcastResult && (
  <Card className="mt-4">
    <CardContent className="pt-4">
      <div className="flex items-center gap-2 mb-3">
        {verificationStatus === "verified" ? (
          <CheckCircle2 className="h-5 w-5 text-green-accent" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        )}
        <CardLabel comment>Multi-Endpoint Verification</CardLabel>
      </div>
      
      <div className="space-y-2 text-sm">
        <div>Primary: {broadcastResult.broadcastEndpoint}</div>
        {broadcastResult.verifications.map((v, i) => (
          <div key={i}>
            {v.verified ? "✅" : "❌"} {new URL(v.endpoint).hostname}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

---

## 10. Security Enhancements

### Threat: UI Payload Deception

**Risk:** User signs something different than they think

**Mitigation:**
- Mandatory ProposalIntentView with human-readable summaries
- Payload hash display for independent verification
- Checkbox gate prevents accidental signing
- Raw JSON preview for advanced users

### Threat: RPC Tampering / Eclipse

**Risk:** Single RPC lies about state or tx inclusion

**Mitigation:**
- MultiRpcVerifier with cross-endpoint confirmation
- Require 2+ independent confirmations
- Primary (trusted) + secondary (public) endpoint architecture
- Never trust single RPC response

### Threat: Replay Attacks

**Risk:** Signature reused on different chain or tx

**Mitigation:**
- CanonicalTxBuilder binds to chainId, accountNumber, sequence
- Deterministic message ordering
- Payload hash verification before signing

### Threat: Proposal Integrity

**Risk:** Proposal content modified after creation

**Mitigation:**
- Content-addressed SHA256 hashing
- Hash stored in database
- Verification before signing

---

## 11. Usage Examples

### Creating a Proposal with Engine

```typescript
import { createPubKeyMultisigEngine } from "@/lib/multisig";

// Create engine
const engine = await createPubKeyMultisigEngine(
  {
    chainId: "coreum-mainnet-1",
    multisigAddress: "core1abc...",
    nodeAddress: "https://rpc.coreum.com",
  },
  multisigPubkey,
);

// Create proposal
const proposal = await engine.createProposal({
  msgs: [
    {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: { fromAddress: "...", toAddress: "...", amount: [...] },
    },
  ],
  fee: { amount: [{ denom: "ucore", amount: "5000" }], gas: "200000" },
  memo: "Treasury payment",
  accountNumber: 123,
  sequence: 5,
});

console.log("Proposal ID:", proposal.id);
console.log("Payload Hash:", proposal.payloadHash);
```

### Building Canonical Transaction

```typescript
import { CanonicalTxBuilder } from "@/lib/tx";

// Create builder
const builder = CanonicalTxBuilder.fromMessages(msgs, {
  chainId: "coreum-mainnet-1",
  accountNumber: 123,
  sequence: 5,
  fee: { amount: [{ denom: "ucore", amount: "5000" }], gas: "200000" },
  memo: "Payment",
});

// Validate
const validation = builder.validate();
if (!validation.isValid) {
  console.error("Errors:", validation.errors);
  return;
}

// Get payload hash
const payloadHash = builder.getPayloadHashBase64();
console.log("Payload Hash:", payloadHash);

// Get sign bytes
const signDoc = builder.getDirectSignDoc(multisigPubkey);
console.log("Sign Doc Hash:", signDoc.hashBase64);
```

### Verifying Proposal Hash

```typescript
import { computeProposalHash, verifyProposalHash } from "@/lib/tx";

// Compute hash
const hash = computeProposalHash({
  chainId: "coreum-mainnet-1",
  accountNumber: 123,
  sequence: 5,
  msgs: [...],
  fee: { amount: [...], gas: "200000" },
  memo: "Payment",
});

// Verify hash
const isValid = verifyProposalHash(proposalData, expectedHash);
console.log("Hash valid:", isValid);
```

### Broadcasting with Multi-RPC Verification

```typescript
import { createMultiRpcVerifier } from "@/lib/rpc";

// Create verifier
const verifier = createMultiRpcVerifier(
  "coreum-mainnet-1",
  "https://rpc.coreum.com",
  ["https://rpc2.coreum.com", "https://rpc3.coreum.com"],
);

// Broadcast and verify
const result = await verifier.broadcastAndVerify(signedTxBytes);

if (result.success) {
  console.log("Transaction confirmed:", result.txHash);
  console.log("Height:", result.height);
  console.log("Verifications:", result.verifications);
} else {
  console.error("Broadcast failed:", result.error);
}

// Cleanup
await verifier.disconnect();
```

---

## 12. Future Phases Enablement

Phase 0 establishes the architectural foundation for the complete dual multisig system:

### Phase 1: Contract Multisig (CW3-Fixed)

The MultisigEngine interface enables drop-in Contract multisig:

```typescript
class ContractMultisigEngine implements MultisigEngine {
  readonly engineType = "contract" as const;
  
  async createProposal(input: ProposalInput): Promise<Proposal> {
    // Submit proposal to CW3 contract
    const msg = {
      propose: {
        title: "...",
        msgs: input.msgs,
      },
    };
    // Execute contract
  }
  
  async approveProposal(proposalId: string, ...): Promise<ApprovalReceipt> {
    // Submit vote to contract
    const msg = {
      vote: {
        proposal_id: parseInt(proposalId),
        vote: "yes",
      },
    };
    // Execute contract
  }
}
```

### Phase 2: Membership Management (CW3-Flex + CW4)

- CW4 group contract for dynamic membership
- Member addition/removal without address change
- Weight-based voting

### Phase 3: Identity NFTs

- Coreum assetnft class for credentials
- Soulbound tokens for role verification
- Burn-based revocation

### Phase 4: Advanced Policies

- Spend limits and timelocks
- Message-type restrictions
- Two-step execution for high-value ops

---

## Appendix: Module Exports

### lib/multisig/index.ts

```typescript
export * from "./types";
export * from "./engine";
export { PubKeyMultisigEngine, createPubKeyMultisigEngine } from "./pubkey-engine";
```

### lib/tx/index.ts

```typescript
export {
  CanonicalTxBuilder,
  verifyPayloadHash,
  computePayloadHash,
  type TxOptions,
  type ValidationResult,
  type SignDocBytes,
} from "./canonical-builder";

export {
  computeProposalHash,
  verifyProposalHash,
  ProposalHasher,
  type ProposalHashInput,
} from "./proposal-hasher";
```

### lib/rpc/index.ts

```typescript
export {
  EndpointManager,
  getEndpointManager,
  type RpcEndpoint,
  type EndpointConfig,
} from "./endpoint-manager";

export {
  MultiRpcVerifier,
  createMultiRpcVerifier,
  createMultiRpcVerifierWithConfig,
  type BroadcastResult,
  type VerificationResult,
} from "./multi-rpc-verifier";
```

---

**Phase 0 Complete** - The MultisigEngine abstraction, CanonicalTxBuilder, ProposalHasher, MultiRpcVerifier, and ProposalIntentView provide a production-hardened foundation for the dual multisig system.

