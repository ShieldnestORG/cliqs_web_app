# Phase 2: Group-Backed Multisig Implementation PRD

## Executive Summary

Phase 2 introduces **CW3-Flex multisig support** with decoupled membership management via CW4-style group contracts. This enables teams to change members without changing the multisig address, solving a major limitation of traditional contract multisigs.

**Key Achievements:**
- ✅ **GroupProvider Abstraction**: Unified interface supporting CW4-groups now and custom modules later
- ✅ **Dual Snapshot Semantics**: Audit-grade tracking with proposal-time and vote-time snapshots  
- ✅ **CW3-Flex Engine Support**: Extended ContractMultisigEngine for flex-style multisigs
- ✅ **Membership Management UI**: Complete CRUD interface for group administration
- ✅ **3-Layer Indexer Extensions**: WebSocket and sync job support for CW4 group events
- ✅ **13 New Files, 7 Modified Files**: Complete implementation across all layers

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 2: Group-Backed Multisig                    │
├─────────────────────────────────────────────────────────────────────┤
│                           UI Layer                                   │
│  ┌─────────────────┐ ┌──────────────────┐ ┌───────────────────────┐ │
│  │CreateFlexCliqForm│ │MembershipPanel   │ │ ProposalAuditTrail   │ │
│  └────────┬────────┘ └────────┬─────────┘ └───────────┬───────────┘ │
├───────────┼───────────────────┼───────────────────────┼─────────────┤
│           │           Engine Layer                    │             │
│           ▼                   ▼                       │             │
│  ┌─────────────────────────────────────┐              │             │
│  │      ContractMultisigEngine         │◄─────────────┘             │
│  │  (multisigStyle: "fixed" | "flex")  │                            │
│  └───────────────┬─────────────────────┘                            │
│                  │                                                   │
│                  ▼                                                   │
│  ┌─────────────────────────────────────┐                            │
│  │        GroupProvider Interface       │                            │
│  │   ┌───────────────┐ ┌─────────────┐ │                            │
│  │   │CW4GroupProvider│ │CustomProvider│ │                          │
│  │   │   (Phase 2)   │ │  (Phase 3)  │ │                            │
│  │   └───────────────┘ └─────────────┘ │                            │
│  └───────────────┬─────────────────────┘                            │
├──────────────────┼──────────────────────────────────────────────────┤
│                  │         Contract Layer                           │
│                  ▼                                                   │
│  ┌──────────────────────┐    ┌──────────────────────┐              │
│  │   CW3-Flex Multisig  │───▶│   CW4-Group Contract │              │
│  │   (stable address)   │    │   (member registry)  │              │
│  └──────────────────────┘    └──────────────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│                        Storage Layer                                 │
│  ┌────────────┐ ┌─────────────────┐ ┌──────────────────┐            │
│  │   groups   │ │ memberSnapshots │ │  voteSnapshots   │            │
│  └────────────┘ └─────────────────┘ └──────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Group Integration | Both CW4 + custom module | CW4 now, custom module hooks for Phase 3 identity NFTs |
| Snapshot Semantics | Dual (proposal + vote time) | Proposal-time for eligibility, vote-time for weight correctness |
| Migration Fixed→Flex | Deferred | Keep Phase 2 focused, reduce custody risk |

---

## Implementation Details

### 1. GroupProvider Abstraction

**Location:** `lib/group/`

**Purpose:** Unified interface for group membership management, extensible to support future custom group modules.

**Files Created:**
- `lib/group/types.ts` - Type definitions
- `lib/group/provider.ts` - Interface and registry
- `lib/group/cw4-provider.ts` - CW4 implementation
- `lib/group/index.ts` - Module exports

**Key Interface (`lib/group/provider.ts`):**

```typescript
export interface GroupProvider {
  readonly providerType: GroupType;
  readonly groupAddress: string;
  readonly chainId: string;
  
  // Queries
  getConfig(): Promise<GroupConfig>;
  listMembers(startAfter?: string, limit?: number): Promise<readonly GroupMember[]>;
  getMember(address: string): Promise<GroupMemberInfo | null>;
  getTotalWeight(): Promise<number>;
  getAdmin(): Promise<string | null>;
  isMember(address: string): Promise<boolean>;
  getMemberCount(): Promise<number>;
  
  // Snapshots for audit
  snapshotMembers(): Promise<MemberSnapshot>;
  getMemberWeightAt(address: string, height: number): Promise<number>;
  wasMemberAt(address: string, height: number): Promise<boolean>;
  
  // Mutations (admin only)
  updateMembers(updates: readonly MemberUpdate[]): Promise<MemberUpdateResult>;
  applyMemberBatch(batch: MemberUpdateBatch): Promise<MemberUpdateResult>;
  addMember(address: string, weight: number): Promise<MemberUpdateResult>;
  removeMember(address: string): Promise<MemberUpdateResult>;
  updateMemberWeight(address: string, newWeight: number): Promise<MemberUpdateResult>;
  updateAdmin(newAdmin: string | null): Promise<GroupTxResult>;
  
  // Validation
  canAdminister(senderAddress: string): Promise<boolean>;
  validateUpdates(updates: readonly MemberUpdate[]): Promise<ValidationResult>;
}
```

**CW4 Implementation (`lib/group/cw4-provider.ts`):**

```typescript
export class CW4GroupProvider implements GroupProvider {
  readonly providerType: GroupType = "cw4";
  readonly groupAddress: string;
  readonly chainId: string;

  private readonly cw4Client: CW4Client;
  private readonly nodeAddress: string;

  constructor(groupAddress: string, chainId: string, nodeAddress: string) {
    this.groupAddress = groupAddress;
    this.chainId = chainId;
    this.nodeAddress = nodeAddress;
    this.cw4Client = createCW4Client(nodeAddress, groupAddress, chainId);
  }

  async listMembers(startAfter?: string, limit?: number): Promise<readonly GroupMember[]> {
    const members = limit
      ? await this.cw4Client.queryListMembers(startAfter, limit)
      : await this.cw4Client.queryAllMembers();

    return members.map(this.cw4MemberToGroupMember);
  }

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

  async updateMembers(updates: readonly MemberUpdate[]): Promise<MemberUpdateResult> {
    const validation = await this.validateUpdates(updates);
    if (!validation.valid) {
      return { success: false, error: validation.errors.map(e => e.message).join(", ") };
    }

    const batch = this.convertUpdatesToBatch(updates);
    return this.applyMemberBatch(batch);
  }
}
```

---

### 2. CW4 Client Implementation

**Location:** `lib/contract/cw4-client.ts`

**Purpose:** Low-level client for CW4-group contract interactions.

**Key Types:**

```typescript
export interface CW4Member {
  addr: string;
  weight: number;
}

export interface CW4MemberDiff {
  add?: CW4Member[];
  remove?: string[];
}

export interface CW4QueryMsg {
  admin?: Record<string, never>;
  total_weight?: { at_height?: number };
  member?: { addr: string; at_height?: number };
  list_members?: { start_after?: string; limit?: number };
  hooks?: Record<string, never>;
}

export interface CW4ExecuteResult {
  success: boolean;
  txHash: string;
  height?: number;
  gasUsed?: number;
  gasWanted?: number;
  error?: string;
  rawLog?: string;
}
```

**CW4Client Class:**

```typescript
export class CW4Client {
  private readonly nodeAddress: string;
  private readonly contractAddress: string;
  private readonly chainId: string;
  private client: CosmWasmClient | null = null;
  private signingClient: SigningCosmWasmClient | null = null;

  // Query methods
  async queryAdmin(): Promise<string | null>;
  async queryTotalWeight(atHeight?: number): Promise<number>;
  async queryMember(address: string, atHeight?: number): Promise<number | null>;
  async queryListMembers(startAfter?: string, limit?: number): Promise<CW4Member[]>;
  async queryAllMembers(): Promise<CW4Member[]>;
  async queryHooks(): Promise<string[]>;
  async getCurrentHeight(): Promise<number>;

  // Execute methods
  async updateMembers(diff: CW4MemberDiff): Promise<CW4ExecuteResult>;
  async addMembers(members: CW4Member[]): Promise<CW4ExecuteResult>;
  async removeMembers(addresses: string[]): Promise<CW4ExecuteResult>;
  async updateAdmin(newAdmin: string | null): Promise<CW4ExecuteResult>;
  async addHook(hookAddress: string): Promise<CW4ExecuteResult>;
  async removeHook(hookAddress: string): Promise<CW4ExecuteResult>;

  // Static instantiation
  static async instantiate(
    signingClient: SigningCosmWasmClient,
    senderAddress: string,
    codeId: number,
    members: CW4Member[],
    admin?: string,
    label?: string,
  ): Promise<CW4InstantiateResult>;
}
```

---

### 3. Dual Snapshot Semantics

**Location:** Database schema in `lib/localDb.ts`

**Purpose:** Audit-grade tracking ensuring historical accuracy even when membership changes.

**New Database Tables:**

```typescript
// Group - CW4-style group contract record
interface DbGroup {
  id: string;
  groupAddress: string;
  chainId: string;
  groupType: "cw4" | "custom";
  admin: string | null;
  multisigAddress: string | null;
  label: string | null;
  totalWeight: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  lastSyncHeight: number;
}

// Member Snapshot - captured at proposal creation for eligibility tracking
interface DbMemberSnapshot {
  id: string;
  contractAddress: string; // CW3-Flex multisig address
  proposalId: number;
  groupAddress: string; // CW4 or custom group address
  snapshotHeight: number;
  snapshotTime: string;
  membersJSON: string; // JSON array of { addr: string; weight: number }[]
  totalWeight: number;
  createdAt: string;
}

// Vote Snapshot - captured at vote time for weight correctness
interface DbVoteSnapshot {
  id: string;
  contractAddress: string; // CW3-Flex multisig address
  proposalId: number;
  voter: string;
  weightAtVote: number;
  credentialValid: boolean; // Prepared for Phase 3 identity NFTs
  voteHeight: number;
  voteTime: string;
  createdAt: string;
}

// Group Event - for indexer tracking
interface DbGroupEvent {
  id: string;
  groupAddress: string;
  chainId: string;
  eventType: "members_changed" | "admin_changed" | "hooks_changed";
  txHash: string;
  height: number;
  attributesJSON: string;
  receivedAt: string;
  processed: boolean;
}
```

**New CRUD Operations:**

```typescript
// Group operations
export const getGroup = (chainId: string, groupAddress: string): DbGroup | null;
export const getGroupByMultisig = (chainId: string, multisigAddress: string): DbGroup | null;
export const getGroups = (chainId: string): DbGroup[];
export const createGroup = (group: Omit<DbGroup, "id" | "createdAt" | "updatedAt">): string;
export const updateGroup = (chainId: string, groupAddress: string, updates: Partial<DbGroup>): void;

// Member snapshot operations
export const getMemberSnapshot = (contractAddress: string, proposalId: number): DbMemberSnapshot | null;
export const getMemberSnapshots = (contractAddress: string): DbMemberSnapshot[];
export const createMemberSnapshot = (snapshot: Omit<DbMemberSnapshot, "id" | "createdAt">): string;
export const parseMemberSnapshotMembers = (snapshot: DbMemberSnapshot): { addr: string; weight: number }[];

// Vote snapshot operations
export const getVoteSnapshot = (contractAddress: string, proposalId: number, voter: string): DbVoteSnapshot | null;
export const getVoteSnapshots = (contractAddress: string, proposalId: number): DbVoteSnapshot[];
export const createVoteSnapshot = (snapshot: Omit<DbVoteSnapshot, "id" | "createdAt">): string;
export const getProposalVoteWeightFromSnapshots = (contractAddress: string, proposalId: number): { yes, no, abstain, veto };

// Group event operations
export const recordGroupEvent = (event: Omit<DbGroupEvent, "id" | "receivedAt" | "processed">): string;
export const getUnprocessedGroupEvents = (groupAddress: string): DbGroupEvent[];
export const markGroupEventsProcessed = (eventIds: string[]): void;
export const getGroupEventsByType = (groupAddress: string, eventType: string): DbGroupEvent[];
```

---

### 4. CW3-Flex Engine Support

**Location:** `lib/multisig/contract-engine.ts`

**Purpose:** Extended ContractMultisigEngine to support CW3-Flex contracts backed by group providers.

**Key Changes:**

```typescript
// New type for multisig style
export type MultisigStyle = "fixed" | "flex";

// Extended config
export interface ContractEngineConfig extends EngineConfig {
  readonly codeId?: number;
  readonly label?: string;
  // Phase 2 additions
  readonly multisigStyle?: MultisigStyle;
  readonly groupAddress?: string;
  readonly groupProvider?: GroupProvider;
}

// Extended engine class
export class ContractMultisigEngine implements MultisigEngine {
  readonly engineType = "contract" as const;
  readonly chainId: string;
  readonly multisigAddress: string;

  private readonly nodeAddress: string;
  private readonly nodeAddresses: readonly string[];
  private readonly cw3Client: CW3Client;

  // Phase 2: Flex-style multisig support
  private readonly multisigStyle: MultisigStyle;
  private readonly groupAddress: string | null;
  private readonly groupProvider: GroupProvider | null;

  constructor(config: ContractEngineConfig) {
    this.chainId = config.chainId;
    this.multisigAddress = config.multisigAddress;
    this.nodeAddress = config.nodeAddress;
    this.nodeAddresses = config.nodeAddresses ?? [config.nodeAddress];
    this.cw3Client = new CW3Client(config.nodeAddress, config.multisigAddress, config.chainId);
    
    // Phase 2: Initialize flex-style support
    this.multisigStyle = config.multisigStyle ?? "fixed";
    this.groupAddress = config.groupAddress ?? null;
    this.groupProvider = config.groupProvider ?? null;
  }

  // New accessor methods
  getMultisigStyle(): MultisigStyle { return this.multisigStyle; }
  isFlexStyle(): boolean { return this.multisigStyle === "flex"; }
  getGroupAddress(): string | null { return this.groupAddress; }
  getGroupProvider(): GroupProvider | null { return this.groupProvider; }

  // Enhanced listMembers() - delegates to group provider for flex
  async listMembers(): Promise<readonly Member[]> {
    if (this.isFlexStyle() && this.groupProvider) {
      const groupMembers = await this.groupProvider.listMembers();
      return groupMembers.map((m: GroupMember) => ({
        address: m.address,
        pubkey: "",
        weight: m.weight,
      }));
    }
    const config = await this.getConfig();
    return config.voters.map((v) => ({
      address: v.addr,
      pubkey: "",
      weight: v.weight,
    }));
  }

  // Enhanced createProposal with snapshot capture
  async createProposal(input: ProposalInput): Promise<Proposal> {
    const contractMsgs = this.encodeObjectsToCosmosMsg(input.msgs);
    const result = await this.cw3Client.propose(...);

    // Phase 2: Capture member snapshot for flex-style multisigs
    if (this.isFlexStyle() && this.groupProvider) {
      await this.captureMemberSnapshot(result.proposalId);
    }

    return proposal;
  }

  // Enhanced approveProposal with vote snapshot
  async approveProposal(...): Promise<ApprovalReceipt> {
    const result = await this.cw3Client.vote(...);

    // Phase 2: Capture vote snapshot for audit trail
    await this.captureVoteSnapshot(proposalId, signer.address, result.height ?? 0);

    return receipt;
  }

  // New private snapshot methods
  private async captureMemberSnapshot(proposalId: number): Promise<void>;
  private async captureVoteSnapshot(proposalId: number, voterAddress: string, voteHeight: number): Promise<void>;

  // New public snapshot accessors
  async getMemberSnapshot(proposalId: number): Promise<MemberSnapshot | null>;
  async getVoteSnapshots(proposalId: number): Promise<VoteSnapshot[]>;
  async getVoteWeightFromSnapshots(proposalId: number): Promise<{ yes, no, abstain, veto }>;
}
```

---

### 5. Membership Management UI

**Location:** `components/dataViews/MembershipManagementPanel.tsx`

**Purpose:** Complete CRUD interface for group membership management.

**Component Interface:**

```typescript
interface MembershipManagementPanelProps {
  members: GroupMember[];
  totalWeight: number;
  adminAddress: string | null;
  userAddress: string | null;
  groupAddress: string;
  addressPrefix: string;
  hasOpenProposals?: boolean;
  openProposalCount?: number;
  onMembershipUpdate?: (updates: MemberUpdate[]) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isUpdating?: boolean;
}

interface PendingChange {
  type: "add" | "remove" | "update";
  address: string;
  weight?: number;
  originalWeight?: number;
}
```

**Key Features:**
- View current members with weights and voting power percentages
- Add new members with address validation
- Remove existing members with confirmation
- Update member weights with delta tracking
- Preview pending changes before submission
- Batch apply all changes atomically
- Admin-only operations with proper access control
- Warnings for changes affecting open proposals
- Real-time projected total weight calculation

---

### 6. Snapshot View Components

**Location:** `components/dataViews/`

**MemberSnapshotView (`MemberSnapshotView.tsx`):**

```typescript
interface MemberSnapshotViewProps {
  proposalId: number;
  members: { addr: string; weight: number }[];
  totalWeight: number;
  snapshotHeight: number;
  snapshotTime: string;
  currentMembers?: { addr: string; weight: number }[];
  currentTotalWeight?: number;
}
```

Features:
- Display member snapshot at proposal creation time
- Show changes since snapshot (added, removed, weight changed)
- Display voting power percentages
- Metadata display (block height, timestamp)

**ProposalAuditTrail (`ProposalAuditTrail.tsx`):**

```typescript
interface VoteRecord {
  voter: string;
  vote: "yes" | "no" | "abstain" | "veto";
  weightAtVote: number;
  credentialValid: boolean;
  voteHeight: number;
  voteTime: string;
  txHash?: string;
}

interface ProposalAuditTrailProps {
  proposalId: number;
  title?: string;
  status: string;
  threshold: number;
  votes: VoteRecord[];
  memberSnapshot?: MemberSnapshot;
  createdAt: string;
  executedAt?: string;
  executionTxHash?: string;
}
```

Features:
- Complete voting history timeline
- Vote breakdown by type (yes/no/abstain/veto)
- Weight at vote time display
- Credential validity indicator (Phase 3 ready)
- Member snapshot comparison
- Execution transaction details

---

### 7. CreateFlexCliqForm Component

**Location:** `components/forms/CreateFlexCliqForm/`

**Form Schema (`formSchema.ts`):**

```typescript
export const getCreateFlexCliqSchema = (chain: ChainInfo) =>
  z.object({
    // Cliq identity
    name: z.string().min(2).max(50),
    description: z.string().max(200).optional(),

    // Contract labels
    multisigLabel: z.string().min(3).max(128),
    groupLabel: z.string().min(3).max(128),

    // Code IDs
    cw3FlexCodeId: z.coerce.number().int().min(1),
    cw4GroupCodeId: z.coerce.number().int().min(1),

    // Members with weights
    members: z.array(z.object({
      address: z.string().superRefine(validateAddress),
      weight: z.coerce.number().int().min(1).max(1000),
    })),

    // Voting rules
    threshold: z.coerce.number().int().min(1),
    votingPeriodDays: z.coerce.number().min(0.01).max(365),

    // Group admin configuration
    groupAdminType: z.enum(["multisig", "custom", "none"]),
    customAdmin: z.string().optional(),
    multisigAdmin: z.string().optional(),
  });

export type GroupAdminType = "multisig" | "custom" | "none";
```

**Component Features:**
- 5-step wizard form
- Real-time validation
- Group admin type selection with descriptions
- Contract configuration (code IDs, labels)
- Deployment status tracking
- Integration with wallet for signing

---

### 8. API Endpoints

**Location:** `pages/api/chain/[chainId]/`

**Group API (`group/[address]/index.ts`):**

```typescript
// GET - Get group details
GET /api/chain/[chainId]/group/[address]
Response: {
  groupAddress: string;
  chainId: string;
  groupType: "cw4" | "custom";
  admin: string | null;
  multisigAddress: string | null;
  label: string | null;
  totalWeight: number;
  memberCount: number;
  lastSyncHeight: number;
  createdAt: string;
  updatedAt: string;
}

// POST - Register new group
POST /api/chain/[chainId]/group/[address]
Body: {
  groupType?: "cw4" | "custom";
  admin?: string | null;
  multisigAddress?: string;
  label?: string;
  totalWeight: number;
  memberCount: number;
}
Response: { message: "Group registered", groupAddress: string }
```

**Members API (`group/[address]/members.ts`):**

```typescript
// GET - Get group members
GET /api/chain/[chainId]/group/[address]/members
Response: {
  groupAddress: string;
  chainId: string;
  members: { address: string; weight: number }[];
  totalWeight: number;
  admin: string | null;
}

// PATCH - Update members (prepare transaction)
PATCH /api/chain/[chainId]/group/[address]/members
Body: {
  add?: { address: string; weight: number }[];
  remove?: string[];
  update?: { address: string; weight: number }[];
}
Response: {
  message: "Member update prepared";
  operations: { add, remove, update };
  note: "Submit a signed transaction to apply these changes";
}
```

**Snapshots API (`contract-multisig/[address]/snapshots.ts`):**

```typescript
// GET - Get snapshots for a proposal
GET /api/chain/[chainId]/contract-multisig/[address]/snapshots?proposalId=X
Response: {
  contractAddress: string;
  proposalId: number;
  memberSnapshot: {
    proposalId: number;
    members: { addr: string; weight: number }[];
    totalWeight: number;
    snapshotHeight: number;
    snapshotTime: string;
    groupAddress: string;
  } | null;
  voteSnapshots: {
    proposalId: number;
    votes: {
      voter: string;
      weightAtVote: number;
      credentialValid: boolean;
      voteHeight: number;
      voteTime: string;
    }[];
  } | null;
}

// GET - Get all snapshots for contract
GET /api/chain/[chainId]/contract-multisig/[address]/snapshots
Response: {
  contractAddress: string;
  memberSnapshots: {
    proposalId: number;
    totalWeight: number;
    snapshotHeight: number;
    snapshotTime: string;
    memberCount: number;
  }[];
}
```

---

### 9. Create Page Update

**Location:** `pages/[chainName]/create.tsx`

**Updated Tab Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Create Cliq                                         │
├────────────┬───────────────────┬────────────────────┤
│  PubKey    │  Contract (Fixed) │  Contract (Flex)   │
│  Multisig  │  Multisig         │  Multisig          │
└────────────┴───────────────────┴────────────────────┘
```

**Key Changes:**

```typescript
type MultisigType = "pubkey" | "contract" | "flex";

// Three-column comparison card showing:
// - PubKey: Maximum security, cold storage ready, address changes on rotation
// - Fixed: Stable address, weighted voting, fixed member set
// - Flex: Stable address, dynamic membership, audit-grade snapshots

// Form content based on selected type
<TabsContent value="pubkey"><CreateCliqForm /></TabsContent>
<TabsContent value="contract"><CreateContractCliqForm /></TabsContent>
<TabsContent value="flex"><CreateFlexCliqForm /></TabsContent>
```

---

### 10. Indexer Extensions

**Location:** `lib/indexer/`

**WebSocket Listener Updates (`websocket-listener.ts`):**

```typescript
// New CW4 event types
export type CW4EventType = 
  | "update_members"
  | "update_admin"
  | "add_hook"
  | "remove_hook";

export type ContractEventType = CW3EventType | CW4EventType;

// Extended config
export interface WebSocketConfig {
  wsEndpoint: string;
  chainId: string;
  contractAddresses: string[];
  groupAddresses?: string[]; // Phase 2: CW4 groups to watch
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

// Extended event parsing
export interface ParsedEvent {
  type: ContractEventType;
  contractAddress: string;
  proposalId: number | null;
  txHash: string;
  height: number;
  attributes: Record<string, string>;
  timestamp: string;
  isGroupEvent?: boolean; // Phase 2
}

// New CW4 event parser
private parseCW4Event(
  groupAddress: string,
  attributes: Record<string, string>,
  txHash: string,
  height: number,
): ParsedEvent | null {
  const action = attributes["action"] || attributes["method"];
  let eventType: CW4EventType | null = null;

  if (action === "update_members" || attributes["add"] || attributes["remove"]) {
    eventType = "update_members";
  } else if (action === "update_admin") {
    eventType = "update_admin";
  } else if (action === "add_hook") {
    eventType = "add_hook";
  } else if (action === "remove_hook") {
    eventType = "remove_hook";
  }

  return eventType ? {
    type: eventType,
    contractAddress: groupAddress,
    proposalId: null,
    txHash,
    height,
    attributes,
    timestamp: new Date().toISOString(),
    isGroupEvent: true,
  } : null;
}
```

**Group Sync Job (`sync-job.ts`):**

```typescript
export interface GroupSyncJobConfig {
  nodeAddress: string;
  chainId: string;
  groupAddress: string;
  multisigAddress?: string;
}

export interface GroupSyncResult {
  success: boolean;
  groupAddress: string;
  memberCount: number;
  totalWeight: number;
  admin: string | null;
  errorMessage?: string;
  duration: number;
}

export class GroupSyncJob {
  private readonly config: GroupSyncJobConfig;
  private readonly cw4Client: CW4Client;
  private isRunning: boolean = false;

  async run(): Promise<GroupSyncResult> {
    // Query group state from chain
    const [admin, totalWeight, members] = await Promise.all([
      this.cw4Client.queryAdmin(),
      this.cw4Client.queryTotalWeight(),
      this.cw4Client.queryAllMembers(),
    ]);

    // Update or create group in local DB
    const existingGroup = localDb.getGroup(chainId, groupAddress);
    if (existingGroup) {
      localDb.updateGroup(chainId, groupAddress, {
        admin,
        totalWeight,
        memberCount: members.length,
        lastSyncHeight: await this.cw4Client.getCurrentHeight(),
      });
    } else {
      localDb.createGroup({ ... });
    }

    // Process pending group events
    await this.processGroupEvents();

    return { success: true, ... };
  }
}

export class GroupSyncScheduler {
  addGroup(config: GroupSyncJobConfig, intervalMs?: number): void;
  removeGroup(chainId: string, groupAddress: string): void;
  syncNow(chainId: string, groupAddress: string): Promise<GroupSyncResult | null>;
  stopAll(): void;
}

export const groupSyncScheduler = new GroupSyncScheduler();
```

---

## File Summary

### New Files (13 files)

| File | Purpose | Lines |
|------|---------|-------|
| `lib/group/types.ts` | Group member types, snapshots, error types | 220+ |
| `lib/group/provider.ts` | GroupProvider interface and registry | 250+ |
| `lib/group/cw4-provider.ts` | CW4-group implementation | 300+ |
| `lib/group/index.ts` | Module exports | 25 |
| `lib/contract/cw4-client.ts` | CW4 contract client | 450+ |
| `components/forms/CreateFlexCliqForm/index.tsx` | Flex creation form | 400+ |
| `components/forms/CreateFlexCliqForm/formSchema.ts` | Validation schema | 200+ |
| `components/dataViews/MembershipManagementPanel.tsx` | Member CRUD UI | 500+ |
| `components/dataViews/MemberSnapshotView.tsx` | Snapshot viewer | 180+ |
| `components/dataViews/ProposalAuditTrail.tsx` | Audit trail component | 350+ |
| `pages/api/chain/[chainId]/group/[address]/index.ts` | Group API | 100+ |
| `pages/api/chain/[chainId]/group/[address]/members.ts` | Members API | 80+ |
| `pages/api/chain/[chainId]/contract-multisig/[address]/snapshots.ts` | Snapshots API | 100+ |

### Modified Files (7 files)

| File | Changes |
|------|---------|
| `lib/localDb.ts` | 4 new database tables, 20+ new CRUD operations |
| `lib/multisig/contract-engine.ts` | Flex-style support, GroupProvider integration, snapshot capture |
| `lib/contract/index.ts` | Added CW4 client exports |
| `lib/indexer/websocket-listener.ts` | CW4 event types, group event parsing |
| `lib/indexer/sync-job.ts` | GroupSyncJob, GroupSyncScheduler |
| `lib/indexer/index.ts` | Added group sync exports |
| `pages/[chainName]/create.tsx` | Added Flex tab with 3-column layout |

---

## Acceptance Criteria

### 1. Member changes do not break old proposals ✅
- Proposals store member snapshot at creation time
- Threshold evaluation uses vote-time weights
- Historical proposals show correct approval state

### 2. Audit shows which member set approved which proposal ✅
- Full member snapshot stored with each proposal
- Each vote records voter's weight at vote time
- UI displays "Approved by X with weight Y at height Z"

### 3. GroupProvider abstraction is extensible ✅
- CW4-group works out of the box with `CW4GroupProvider`
- Interface supports future custom group modules
- No hard dependencies on CW4 in engine layer

---

## Testing Strategy

### Unit Tests
- GroupProvider interface compliance
- CW4Client query/execute methods
- Snapshot capture logic
- Engine flex-style behavior

### Integration Tests
- Create Flex multisig end-to-end
- Member update flow with validation
- Proposal with member changes mid-flight
- Indexer sync for group events

### Edge Cases
- Member removed while proposal is open
- Weight changed after voting
- Admin transfer scenarios
- Concurrent update handling

---

## Future Considerations (Phase 3)

### Identity NFT Integration
- `credentialValid` field ready for Phase 3
- Hook system support in CW4Client
- GroupProvider interface extensible to custom modules

### Performance Optimizations
- Large member set handling
- Snapshot compression
- Batch transaction support

### Security Enhancements
- Multi-sig admin support
- Timelocked membership changes
- Enhanced audit logging

