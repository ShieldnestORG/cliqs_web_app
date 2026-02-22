# Phase 1 PRD: Contract Multisig Implementation

## Overview

Phase 1 introduces **Contract-Based Multisig** support to the Cosmos Multisig UI, enabling CW3-Fixed style smart contract multisigs alongside the existing PubKey multisigs. This creates a **Dual Multisig System** where users can choose between:

- **PubKey Multisig**: Traditional Cosmos SDK native multisig (existing)
- **Contract Multisig**: CW3-style on-chain contract multisig (new in Phase 1)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Dual Multisig System                         │
├──────────────────────────────┬──────────────────────────────────────┤
│     PubKey Multisig          │        Contract Multisig             │
│     (Phase 0 - Existing)     │        (Phase 1 - New)               │
├──────────────────────────────┼──────────────────────────────────────┤
│  PubKeyMultisigEngine        │  ContractMultisigEngine              │
│  lib/multisig/pubkey-engine  │  lib/multisig/contract-engine        │
├──────────────────────────────┼──────────────────────────────────────┤
│  Off-chain signatures        │  On-chain votes                      │
│  Address changes on rotation │  Stable contract address             │
│  Local DB storage            │  DB cache + Chain state              │
└──────────────────────────────┴──────────────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────┐
                    │         3-Layer Indexer           │
                    ├───────────────────────────────────┤
                    │ L1: WebSocket (Real-time)         │
                    │ L2: Sync Job (Authoritative)      │
                    │ L3: Chain Verifier (On-demand)    │
                    └───────────────────────────────────┘
```

---

## File Structure

### New Files Created

```
lib/
├── contract/
│   ├── cw3-client.ts          # CW3 contract query/execute wrapper
│   └── index.ts               # Module exports
├── indexer/
│   ├── websocket-listener.ts  # Layer 1: Real-time events
│   ├── sync-job.ts            # Layer 2: Authoritative sync
│   ├── chain-verifier.ts      # Layer 3: On-demand verification
│   └── index.ts               # Module exports
├── multisig/
│   ├── contract-types.ts      # CW3 type definitions
│   └── contract-engine.ts     # ContractMultisigEngine implementation
├── hooks/
│   └── useMultisigType.ts     # Detects PubKey vs Contract multisig
│
components/
├── dataViews/
│   ├── ContractMultisigDashboard.tsx  # Contract multisig dashboard
│   ├── ContractProposalList.tsx       # Proposal listing component
│   └── ContractVotePanel.tsx          # Voting interface
├── forms/
│   └── CreateContractCliqForm/
│       ├── index.tsx          # Main form component
│       └── formSchema.ts      # Zod validation schema
│
pages/
├── api/chain/[chainId]/contract-multisig/
│   ├── index.ts               # Create/List contract multisigs
│   └── [address]/
│       └── index.ts           # Get/Sync contract multisig details
```

### Modified Files

```
lib/
├── localDb.ts                 # Extended with contract multisig tables
├── multisig/
│   └── index.ts               # Added contract engine exports
│
pages/
├── [chainName]/
│   ├── create.tsx             # Added tabbed UI for PubKey vs Contract
│   └── [address]/
│       └── index.tsx          # Added contract multisig detection
```

---

## Core Components

### 1. Contract Types (`lib/multisig/contract-types.ts`)

Defines TypeScript types for CW3-Fixed contract interactions:

```typescript
/**
 * CW3-Fixed multisig configuration
 */
export interface CW3Config {
  /** Threshold required for proposal to pass */
  threshold: ThresholdResponse;
  /** Maximum voting period for proposals */
  max_voting_period: Duration;
  /** List of voters with their weights */
  voters: CW3Voter[];
}

/**
 * Voter in the multisig with weight
 */
export interface CW3Voter {
  /** Bech32 address of voter */
  addr: string;
  /** Voting weight */
  weight: number;
}

/**
 * Proposal status on-chain
 */
export type CW3ProposalStatus = 
  | "pending"   // Voting is still open
  | "open"      // Alias for pending
  | "passed"    // Threshold met, ready to execute
  | "rejected"  // Voting closed, threshold not met
  | "executed"; // Successfully executed

/**
 * Vote options
 */
export type VoteOption = "yes" | "no" | "abstain" | "veto";

/**
 * CW3 Proposal structure
 */
export interface CW3Proposal {
  id: number;
  title: string;
  description: string;
  msgs: CosmosMsg[];
  status: CW3ProposalStatus;
  expires: Expiration;
  threshold: ThresholdResponse;
  proposer: string;
  deposit?: Coin[];
}
```

---

### 2. Contract Engine (`lib/multisig/contract-engine.ts`)

Implements the `MultisigEngine` interface for contract-based multisigs:

```typescript
export class ContractMultisigEngine implements MultisigEngine {
  readonly engineType = "contract" as const;
  readonly chainId: string;
  readonly multisigAddress: string;

  private readonly cw3Client: CW3Client;

  constructor(config: ContractEngineConfig) {
    this.chainId = config.chainId;
    this.multisigAddress = config.multisigAddress;
    this.cw3Client = new CW3Client(
      config.nodeAddress,
      config.multisigAddress,
      config.chainId,
    );
  }

  // ============================================================================
  // Proposal Lifecycle
  // ============================================================================

  async createProposal(input: ProposalInput): Promise<Proposal> {
    // Creates on-chain proposal via contract execute
  }

  async approveProposal(
    proposalId: string,
    signer: SignerInfo,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<ApprovalReceipt> {
    // Submits on-chain vote
  }

  async executeProposal(proposalId: string): Promise<TxResult> {
    // Executes passed proposal on-chain
  }

  // ============================================================================
  // Queries
  // ============================================================================

  async getProposal(proposalId: string): Promise<ProposalState> {
    // Queries contract for proposal state
  }

  async listProposals(status?: string): Promise<readonly ProposalState[]> {
    // Lists all proposals from contract
  }

  async getPolicy(): Promise<MultisigPolicy> {
    // Returns threshold and member configuration
  }

  async listMembers(): Promise<readonly Member[]> {
    // Returns list of members with weights
  }
}
```

**Key Differences from PubKeyMultisigEngine:**

| Aspect | PubKey Engine | Contract Engine |
|--------|--------------|-----------------|
| Approval | Off-chain signatures | On-chain votes |
| Storage | Local DB primary | Chain state primary |
| Address | Changes on key rotation | Stable forever |
| Execution | Combines signatures | Contract execute |

---

### 3. CW3 Client (`lib/contract/cw3-client.ts`)

Low-level wrapper for CW3 contract queries and executes:

```typescript
export class CW3Client {
  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Query the contract's configuration
   */
  async queryConfig(): Promise<CW3Config> {
    const client = await this.getClient();
    const threshold = await client.queryContractSmart(
      this.contractAddress,
      { threshold: {} }
    );
    const voters = await client.queryContractSmart(
      this.contractAddress,
      { list_voters: {} }
    );
    return { threshold, voters: voters.voters, max_voting_period: threshold };
  }

  /**
   * Query a specific proposal
   */
  async queryProposal(proposalId: number): Promise<CW3Proposal | null> {
    const client = await this.getClient();
    return client.queryContractSmart(
      this.contractAddress,
      { proposal: { proposal_id: proposalId } }
    );
  }

  /**
   * List proposals with pagination
   */
  async queryProposals(
    startAfter?: number,
    limit?: number,
    reverse?: boolean
  ): Promise<CW3Proposal[]> {
    const client = await this.getClient();
    const query = reverse
      ? { reverse_proposals: { start_before: startAfter, limit } }
      : { list_proposals: { start_after: startAfter, limit } };
    const result = await client.queryContractSmart(this.contractAddress, query);
    return result.proposals;
  }

  // ============================================================================
  // Execute Methods
  // ============================================================================

  /**
   * Create a new proposal
   */
  async propose(
    senderAddress: string,
    title: string,
    description: string,
    msgs: CosmosMsg[],
    latest?: Expiration
  ): Promise<CW3ExecuteResult> {
    const client = this.getSigningClient();
    const executeMsg: CW3ExecuteMsg = {
      propose: { title, description, msgs, latest }
    };
    return client.execute(senderAddress, this.contractAddress, executeMsg, "auto");
  }

  /**
   * Vote on a proposal
   */
  async vote(
    senderAddress: string,
    proposalId: number,
    vote: VoteOption
  ): Promise<CW3ExecuteResult> {
    const executeMsg: CW3ExecuteMsg = {
      vote: { proposal_id: proposalId, vote }
    };
    return this.getSigningClient().execute(
      senderAddress, 
      this.contractAddress, 
      executeMsg, 
      "auto"
    );
  }

  /**
   * Execute a passed proposal
   */
  async execute(
    senderAddress: string,
    proposalId: number
  ): Promise<CW3ExecuteResult> {
    const executeMsg: CW3ExecuteMsg = {
      execute: { proposal_id: proposalId }
    };
    return this.getSigningClient().execute(
      senderAddress, 
      this.contractAddress, 
      executeMsg, 
      "auto"
    );
  }
}
```

---

### 4. Database Schema (`lib/localDb.ts`)

Extended with contract multisig tables:

```typescript
// ============================================================================
// Contract Multisig Types (Phase 1)
// ============================================================================

/**
 * Contract Multisig - CW3-style on-chain multisig
 */
interface DbContractMultisig {
  id: string;
  chainId: string;
  contractAddress: string;
  codeId: number;
  creator: string;
  label: string;
  threshold: number;
  maxVotingPeriodSeconds: number;
  members: { addr: string; weight: number }[];
  name: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncHeight: number;
}

/**
 * Contract Proposal - cached from on-chain state
 */
interface DbContractProposal {
  id: string;
  contractAddress: string;
  chainId: string;
  proposalId: number;
  title: string;
  description: string;
  msgsJSON: string;
  status: "pending" | "open" | "passed" | "rejected" | "executed" | "expired";
  proposer: string;
  expiresAt: string | null;
  createdHeight: number | null;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
  isConfirmed: boolean; // Layer 2 confirmed vs Layer 1 unconfirmed
}

/**
 * Contract Vote - cached vote records
 */
interface DbContractVote {
  id: string;
  contractAddress: string;
  proposalId: number;
  voter: string;
  vote: "yes" | "no" | "abstain" | "veto";
  weight: number;
  txHash: string | null;
  height: number | null;
  createdAt: string;
  isConfirmed: boolean;
}

/**
 * Sync State - for Layer 2 indexer tracking
 */
interface DbSyncState {
  id: string;
  contractAddress: string;
  chainId: string;
  lastFinalizedHeight: number;
  lastSyncedAt: string;
  status: "synced" | "syncing" | "error";
  errorMessage: string | null;
}
```

**New CRUD Operations:**

```typescript
// Contract Multisig
export function createContractMultisig(data: CreateContractMultisigData): string
export function getContractMultisig(chainId: string, address: string): DbContractMultisig | null
export function getContractMultisigsForMember(chainId: string, addr: string): DbContractMultisig[]

// Contract Proposals
export function upsertContractProposal(data: UpsertContractProposalData): void
export function getContractProposal(addr: string, proposalId: number): DbContractProposal | null
export function getContractProposals(addr: string, status?: string): DbContractProposal[]

// Contract Votes
export function upsertContractVote(data: UpsertContractVoteData): void
export function getContractVotes(addr: string, proposalId: number): DbContractVote[]

// Sync State
export function getSyncState(chainId: string, addr: string): DbSyncState | null
export function upsertSyncState(data: UpsertSyncStateData): void
```

---

### 5. Three-Layer Indexer

#### Layer 1: WebSocket Listener (`lib/indexer/websocket-listener.ts`)

Real-time event listener for fast UX updates:

```typescript
export class WebSocketListener {
  private readonly config: WebSocketConfig;
  private ws: WebSocket | null = null;
  private eventCallbacks: Set<EventCallback> = new Set();

  /**
   * Start listening for events
   */
  async start(): Promise<void> {
    this.shouldReconnect = true;
    await this.connect();
  }

  /**
   * Subscribe to contract events
   */
  private async subscribeToEvents(): Promise<void> {
    const contracts = this.config.contractAddresses;
    const contractFilter = contracts.map(c => 
      `wasm._contract_address = '${c}'`
    ).join(" OR ");
    
    const query = `tm.event = 'Tx' AND (${contractFilter})`;
    
    this.send({
      jsonrpc: "2.0",
      method: "subscribe",
      id: "cw3-events",
      params: { query }
    });
  }

  /**
   * Handle incoming events
   */
  private handleEvent(event: TendermintEvent): void {
    const parsed = this.parseEvent(event);
    if (!parsed) return;

    // Write unconfirmed record to DB
    localDb.upsertContractProposal({
      ...parsed,
      isConfirmed: false // UNCONFIRMED until Layer 2 validates
    });

    // Notify UI callbacks
    this.eventCallbacks.forEach(cb => cb(parsed));
  }
}
```

**Key Point:** Events from Layer 1 are UNCONFIRMED. They provide fast UX but must be validated by Layer 2.

---

#### Layer 2: Sync Job (`lib/indexer/sync-job.ts`)

Authoritative height-based sync:

```typescript
export class SyncJob {
  private readonly config: SyncJobConfig;
  private readonly cw3Client: CW3Client;

  /**
   * Run a sync cycle
   */
  async run(): Promise<SyncResult> {
    const startTime = Date.now();
    const syncState = localDb.getSyncState(
      this.config.chainId, 
      this.config.contractAddress
    );
    
    const client = await CosmWasmClient.connect(this.config.nodeAddress);
    const currentHeight = await client.getHeight();
    const lastHeight = syncState?.lastFinalizedHeight || 0;
    
    // Sync proposals from contract
    const proposals = await this.cw3Client.queryProposals();
    
    for (const proposal of proposals) {
      // Re-derive state from chain
      const votes = await this.cw3Client.queryVotes(proposal.id);
      
      // Upsert with isConfirmed = true
      localDb.upsertContractProposal({
        contractAddress: this.config.contractAddress,
        proposalId: proposal.id,
        ...proposal,
        isConfirmed: true // CONFIRMED by authoritative sync
      });
      
      for (const vote of votes) {
        localDb.upsertContractVote({
          contractAddress: this.config.contractAddress,
          proposalId: proposal.id,
          ...vote,
          isConfirmed: true
        });
      }
    }
    
    // Update sync state
    localDb.upsertSyncState({
      chainId: this.config.chainId,
      contractAddress: this.config.contractAddress,
      lastFinalizedHeight: currentHeight - this.config.finalityDepth,
      status: "synced"
    });
    
    return {
      success: true,
      proposalsSynced: proposals.length,
      duration: Date.now() - startTime
    };
  }
}
```

**Key Properties:**
- Height-based and deterministic
- Idempotent (can re-run safely)
- Reorg-aware (tracks finality depth)
- Corrects missed WebSocket events

---

#### Layer 3: Chain Verifier (`lib/indexer/chain-verifier.ts`)

On-demand verification for critical operations:

```typescript
export class ChainVerifier {
  private readonly cw3Client: CW3Client;

  /**
   * Verify a proposal's state before execution
   */
  async verifyProposal(proposalId: number): Promise<VerifyResult> {
    const onChain = await this.cw3Client.queryProposal(proposalId);
    const cached = localDb.getContractProposal(
      this.config.contractAddress, 
      proposalId
    );
    
    if (!onChain) {
      return { valid: false, error: "Proposal not found on chain" };
    }
    
    if (cached?.status !== onChain.status) {
      // Update cache with authoritative state
      localDb.upsertContractProposal({
        ...cached,
        status: onChain.status,
        isConfirmed: true
      });
    }
    
    return {
      valid: true,
      proposal: onChain,
      isStale: cached?.status !== onChain.status
    };
  }
}
```

**Use Cases:**
- Before executing a proposal
- When displaying critical state to user
- When DB might be stale

---

### 6. API Routes

#### Create/List Contract Multisigs

`pages/api/chain/[chainId]/contract-multisig/index.ts`

```typescript
// POST: Create a new contract multisig
interface CreateContractMultisigBody {
  codeId: number;
  members: { addr: string; weight: number }[];
  threshold: number;
  maxVotingPeriodSeconds: number;
  label: string;
  creator: string;
  nodeAddress: string;
  admin?: string;
  name?: string;
  description?: string;
}

// GET: List contract multisigs for a user
// Query params: ?address=<user_address>
```

#### Get/Sync Contract Multisig Details

`pages/api/chain/[chainId]/contract-multisig/[address]/index.ts`

```typescript
// GET: Get contract multisig details with proposals
// Query params: ?includeProposals=true&status=open

// POST: Trigger sync for a contract
interface SyncContractBody {
  action: "sync";
  nodeAddress: string;
}
```

---

### 7. UI Components

#### Multisig Type Detection Hook

`lib/hooks/useMultisigType.ts`

```typescript
export type MultisigType = "pubkey" | "contract" | "unknown" | "loading";

export function useMultisigType(
  address: string | null,
  nodeAddress: string | null,
  chainId: string | null,
): MultisigTypeResult {
  // 1. Try to query as contract
  const contractInfo = await cosmWasmClient.getContract(address);
  
  if (contractInfo?.codeId) {
    // 2. Verify it's a CW3 multisig by querying threshold
    await cosmWasmClient.queryContractSmart(address, { threshold: {} });
    return { type: "contract", contractInfo };
  }
  
  // 3. Fall back to checking for PubKey multisig
  const account = await stargateClient.getAccount(address);
  if (isMultisigThresholdPubkey(account?.pubkey)) {
    return { type: "pubkey", pubkeyInfo };
  }
  
  return { type: "unknown" };
}
```

#### Contract Multisig Dashboard

`components/dataViews/ContractMultisigDashboard.tsx`

Features:
- Quick stats (members, threshold, voting period, user weight)
- Proposals tab with status filtering
- Members tab with weight display
- Balances tab (contract balances)
- Vote dialog for casting votes
- Execute button for passed proposals

#### Create Contract Cliq Form

`components/forms/CreateContractCliqForm/index.tsx`

Features:
- Step-by-step wizard (Name → Members → Settings)
- Member management with weights
- Threshold configuration
- Voting period selection (hours/days)
- Form validation with Zod
- Real-time weight calculation

#### Tabbed Create Page

`pages/[chainName]/create.tsx`

```tsx
<Tabs defaultValue="pubkey">
  <TabsList>
    <TabsTrigger value="pubkey">
      <Key className="h-4 w-4 mr-2" />
      PubKey Multisig
    </TabsTrigger>
    <TabsTrigger value="contract">
      <FileCode2 className="h-4 w-4 mr-2" />
      Contract Multisig
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="pubkey">
    <CreateTxForm />
  </TabsContent>
  
  <TabsContent value="contract">
    <CreateContractCliqForm />
  </TabsContent>
</Tabs>
```

---

## Data Flow

### Creating a Contract Multisig

```
User fills form → API POST /contract-multisig
                        │
                        ▼
              Build MsgInstantiateContract
                        │
                        ▼
              Sign & Broadcast via Wallet
                        │
                        ▼
              Extract contract address from logs
                        │
                        ▼
              Store in localDb.contractMultisigs
                        │
                        ▼
              Redirect to contract dashboard
```

### Creating a Proposal

```
User selects messages → ContractMultisigEngine.createProposal()
                                    │
                                    ▼
                        CW3Client.propose()
                                    │
                                    ▼
                        Sign MsgExecuteContract
                                    │
                                    ▼
                        Broadcast transaction
                                    │
                                    ▼
                        WebSocket Layer 1 receives event
                                    │
                                    ▼
                        localDb.upsertContractProposal(isConfirmed: false)
                                    │
                                    ▼
                        UI updates immediately
                                    │
                                    ▼
                        SyncJob Layer 2 confirms
                                    │
                                    ▼
                        localDb.upsertContractProposal(isConfirmed: true)
```

### Voting on a Proposal

```
User clicks vote → ContractVotePanel
                        │
                        ▼
              CW3Client.vote(proposalId, "yes")
                        │
                        ▼
              Sign MsgExecuteContract
                        │
                        ▼
              Broadcast transaction
                        │
                        ▼
              WebSocket updates UI (unconfirmed)
                        │
                        ▼
              SyncJob confirms vote
```

### Executing a Proposal

```
User clicks execute → ChainVerifier.verifyProposal()
                                │
                                ▼
                    Check proposal.status === "passed"
                                │
                                ▼
                    CW3Client.execute(proposalId)
                                │
                                ▼
                    Sign MsgExecuteContract
                                │
                                ▼
                    Broadcast transaction
                                │
                                ▼
                    Contract executes inner messages
```

---

## Key Design Decisions

### 1. Two-Engine Architecture

Both `PubKeyMultisigEngine` and `ContractMultisigEngine` implement the same `MultisigEngine` interface:

```typescript
interface MultisigEngine {
  readonly engineType: "pubkey" | "contract";
  
  // Proposal lifecycle
  createProposal(input: ProposalInput): Promise<Proposal>;
  approveProposal(...): Promise<ApprovalReceipt>;
  executeProposal(proposalId: string): Promise<TxResult>;
  
  // Queries
  getProposal(proposalId: string): Promise<ProposalState>;
  listProposals(status?: string): Promise<readonly ProposalState[]>;
  getPolicy(): Promise<MultisigPolicy>;
  listMembers(): Promise<readonly Member[]>;
}
```

This allows the UI to work with either engine type transparently.

### 2. Three-Layer Indexer

| Layer | Purpose | Latency | Reliability |
|-------|---------|---------|-------------|
| L1 WebSocket | Fast UX | ~1-2s | Low (can miss events) |
| L2 Sync Job | Authoritative | ~30s | High (deterministic) |
| L3 Verifier | On-demand | ~200ms | Highest (direct chain) |

### 3. Confirmed vs Unconfirmed Records

All DB records have an `isConfirmed` flag:
- `false`: From Layer 1, not yet validated
- `true`: From Layer 2, authoritative

UI shows both but marks unconfirmed records visually.

### 4. Stable Contract Addresses

Unlike PubKey multisigs where the address changes when members rotate keys, contract multisigs have stable addresses. This is crucial for:
- Long-term fund storage
- Integration with other protocols
- Consistent identity

---

## Testing

### Manual Testing Steps

1. **Create Contract Multisig**
   - Go to `/coreum/create`
   - Select "Contract Multisig" tab
   - Add 3 members with weights
   - Set threshold
   - Submit and sign

2. **View Contract Dashboard**
   - Navigate to contract address
   - Verify members list
   - Check threshold display

3. **Create Proposal**
   - Click "New Proposal"
   - Add send message
   - Submit and sign

4. **Vote on Proposal**
   - Click vote button
   - Select "Yes"
   - Sign vote transaction

5. **Execute Proposal**
   - After threshold met
   - Click "Execute"
   - Sign execution transaction

---

## Future Phases

### Phase 2: Custom Contract
- Custom CW3 contract with Smart NFT credentials
- Role-based permissions
- Delegate voting

### Phase 3: Smart NFT Integration
- NFT-gated membership
- Transferable credentials
- On-chain identity

---

## Dependencies

### NPM Packages Used

```json
{
  "@cosmjs/cosmwasm-stargate": "^0.32.x",
  "@cosmjs/stargate": "^0.32.x",
  "@cosmjs/amino": "^0.32.x",
  "@cosmjs/proto-signing": "^0.32.x",
  "@cosmjs/crypto": "^0.32.x",
  "@cosmjs/encoding": "^0.32.x"
}
```

### Required Environment

- Node.js 18+
- Next.js 15.x
- Coreum/Cosmos chain with CosmWasm enabled
- CW3-Fixed contract code deployed

---

## Summary

Phase 1 successfully implements:

✅ `ContractMultisigEngine` with full `MultisigEngine` interface  
✅ `CW3Client` for contract queries and executes  
✅ Extended `localDb` with contract multisig tables  
✅ Three-layer indexer (WebSocket + Sync + Verifier)  
✅ API routes for contract multisig operations  
✅ `useMultisigType` hook for automatic detection  
✅ `ContractMultisigDashboard` with proposals/voting  
✅ `CreateContractCliqForm` for creating new contract multisigs  
✅ Tabbed UI on create page for PubKey vs Contract selection  
✅ All lint errors fixed, build passing  

