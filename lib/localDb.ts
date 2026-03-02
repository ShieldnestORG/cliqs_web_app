/**
 * Local JSON file-based database replacement for DGraph
 * This stores data in a local JSON file for development purposes
 * 
 * File: lib/localDb.ts
 * 
 * Supports Cliq (multisig) storage with name, description, and versioning.
 */

import fs from "fs";
import path from "path";

/**
 * Database schema for a Cliq (multisig)
 * A Cliq is a multisig group that lets multiple people manage shared funds.
 */
interface DbMultisig {
  id: string;
  chainId: string;
  address: string;
  creator: string | null;
  pubkeyJSON: string;
  // Cliq-specific fields
  name: string | null;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface DbTransaction {
  id: string;
  txHash: string | null;
  creatorId: string; // References Multisig.id
  dataJSON: string;
  status?: "pending" | "broadcast" | "cancelled"; // Added for transaction lifecycle
  // Phase 0 additions for proposal integrity
  payloadHash?: string; // SHA256 hash of canonical payload (base64)
  signDocHash?: string; // SHA256 hash of signDoc for verification (base64)
}

interface DbSignature {
  id: string;
  transactionId: string; // References Transaction.id
  bodyBytes: string;
  signature: string;
  address: string;
}

interface DbNonce {
  id: string;
  chainId: string;
  address: string;
  nonce: number;
}

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
  // Phase 4: Policy version for tracking policy upgrades
  policyVersion: number;
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

/**
 * WebSocket Event - for Layer 1 real-time events
 */
interface DbWebSocketEvent {
  id: string;
  contractAddress: string;
  chainId: string;
  eventType: "propose" | "vote" | "execute" | "close";
  proposalId: number | null;
  txHash: string;
  height: number;
  attributes: string; // JSON stringified
  receivedAt: string;
  processed: boolean;
}

// ============================================================================
// Phase 2: Group-Backed Multisig Types
// ============================================================================

/**
 * Group - CW4-style group contract record
 */
interface DbGroup {
  id: string;
  groupAddress: string;
  chainId: string;
  groupType: "cw4" | "custom";
  admin: string | null;
  multisigAddress: string | null; // Associated CW3-Flex multisig (if any)
  label: string | null;
  totalWeight: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  lastSyncHeight: number;
}

/**
 * Member Snapshot - captured at proposal creation for eligibility tracking
 */
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

/**
 * Vote Snapshot - captured at vote time for weight correctness
 */
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

/**
 * Group Event - for indexer tracking
 */
interface DbGroupEvent {
  id: string;
  groupAddress: string;
  chainId: string;
  eventType: "members_changed" | "admin_changed" | "hooks_changed";
  txHash: string;
  height: number;
  attributesJSON: string; // JSON stringified event attributes
  receivedAt: string;
  processed: boolean;
}

// ============================================================================
// Phase 3: Credential NFT Types
// ============================================================================

/**
 * Credential Class - TX assetnft class for team credentials
 */
interface DbCredentialClass {
  id: string;
  teamAddress: string;        // Contract multisig address
  chainId: string;
  classId: string;            // TX assetnft class ID
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

// ============================================================================
// Phase 4: Policy and Emergency Types
// ============================================================================

/**
 * Policy - Stored policy configuration
 */
interface DbPolicy {
  id: string;
  multisigAddress: string;
  chainId: string;
  type: "timelock" | "spend_limit" | "allowlist" | "denylist" | "msg_type" | "emergency" | "custom";
  name: string;
  configJSON: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Policy Violation - Record of policy violations
 */
interface DbPolicyViolation {
  id: string;
  multisigAddress: string;
  proposalId: string;
  policyId: string;
  policyType: string;
  violationCode: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  detailsJSON: string;
  timestamp: string;
}

/**
 * Emergency Event - Pause/unpause/safe-mode events
 */
interface DbEmergencyEvent {
  id: string;
  multisigAddress: string;
  chainId: string;
  eventType: "pause" | "unpause" | "safe_mode_on" | "safe_mode_off";
  actor: string;
  reason: string | null;
  txHash: string | null;
  height: number | null;
  autoUnpauseAt: string | null;
  timestamp: string;
}

/**
 * Emergency State - Current emergency state for a multisig
 */
interface DbEmergencyState {
  id: string;
  multisigAddress: string;
  chainId: string;
  isPaused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  pauseReason: string | null;
  autoUnpauseAt: string | null;
  isSafeMode: boolean;
  safeModeThreshold: number | null;
  safeModeActivatedAt: string | null;
  updatedAt: string;
}

/**
 * Incident - Tracked security incidents
 */
interface DbIncident {
  id: string;
  multisigAddress: string;
  chainId: string;
  type: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  title: string;
  description: string;
  playbookId: string | null;
  playbookStatus: "pending" | "running" | "completed" | "failed" | null;
  triggeredBy: string; // Event or anomaly that triggered
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/**
 * Alert Rule - Configuration for alerting
 */
interface DbAlertRule {
  id: string;
  multisigAddress: string;
  chainId: string;
  name: string;
  description: string | null;
  conditionJSON: string;
  channelsJSON: string;
  enabled: boolean;
  severity: "info" | "warning" | "critical";
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Alert - Sent alert record
 */
interface DbAlert {
  id: string;
  ruleId: string;
  multisigAddress: string;
  chainId: string;
  eventType: string;
  eventId: string | null;
  severity: "info" | "warning" | "critical";
  message: string;
  channelsSentJSON: string;
  sentAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

/**
 * Spend Record - Track spending for limit enforcement
 */
interface DbSpendRecord {
  id: string;
  multisigAddress: string;
  chainId: string;
  proposalId: string;
  denom: string;
  amount: string;
  recipientAddress: string;
  executedAt: string;
  height: number;
}

interface Database {
  multisigs: DbMultisig[];
  transactions: DbTransaction[];
  signatures: DbSignature[];
  nonces: DbNonce[];
  // Phase 1 additions
  contractMultisigs: DbContractMultisig[];
  contractProposals: DbContractProposal[];
  contractVotes: DbContractVote[];
  syncStates: DbSyncState[];
  websocketEvents: DbWebSocketEvent[];
  // Phase 2 additions
  groups: DbGroup[];
  memberSnapshots: DbMemberSnapshot[];
  voteSnapshots: DbVoteSnapshot[];
  groupEvents: DbGroupEvent[];
  // Phase 3 additions
  credentialClasses: DbCredentialClass[];
  credentials: DbCredential[];
  credentialEvents: DbCredentialEvent[];
  // Phase 4 additions
  policies: DbPolicy[];
  policyViolations: DbPolicyViolation[];
  emergencyEvents: DbEmergencyEvent[];
  emergencyStates: DbEmergencyState[];
  incidents: DbIncident[];
  alertRules: DbAlertRule[];
  alerts: DbAlert[];
  spendRecords: DbSpendRecord[];
}

// On Vercel/serverless, process.cwd() is /var/task (read-only). Use /tmp instead.
const getDataDir = (): string =>
  process.env.VERCEL ? path.join("/tmp", "cliq-data") : path.join(process.cwd(), "data");

let _dbFilePath: string | null = null;
let _useMemoryDb = false;
let _memoryDb: Database | null = null;

const getDbFilePath = (): string => {
  if (_dbFilePath) return _dbFilePath;
  _dbFilePath = path.join(getDataDir(), "local-db.json");
  return _dbFilePath;
};

const createEmptyDb = (): Database => ({
  multisigs: [],
  transactions: [],
  signatures: [],
  nonces: [],
  contractMultisigs: [],
  contractProposals: [],
  contractVotes: [],
  syncStates: [],
  websocketEvents: [],
  groups: [],
  memberSnapshots: [],
  voteSnapshots: [],
  groupEvents: [],
  credentialClasses: [],
  credentials: [],
  credentialEvents: [],
  policies: [],
  policyViolations: [],
  emergencyEvents: [],
  emergencyStates: [],
  incidents: [],
  alertRules: [],
  alerts: [],
  spendRecords: [],
});

// Initialize database file if it doesn't exist. Falls back to in-memory on serverless ENOENT.
const initDb = (): void => {
  if (_useMemoryDb && _memoryDb) return;

  const dataDir = getDataDir();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT" || err?.code === "EROFS" || err?.code === "EACCES") {
      _useMemoryDb = true;
      _memoryDb = createEmptyDb();
      return;
    }
    throw e;
  }

  const dbFilePath = getDbFilePath();
  if (!fs.existsSync(dbFilePath)) {
    const initialDb = createEmptyDb();
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify(initialDb, null, 2));
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err?.code === "ENOENT" || err?.code === "EROFS" || err?.code === "EACCES") {
        _useMemoryDb = true;
        _memoryDb = initialDb;
        return;
      }
      throw e;
    }
  } else {
    // Migrate existing database to include new tables
    const data = fs.readFileSync(dbFilePath, "utf-8");
    const db = JSON.parse(data);
    let needsWrite = false;
    
    // Phase 1 migrations
    if (!db.contractMultisigs) {
      db.contractMultisigs = [];
      needsWrite = true;
    }
    if (!db.contractProposals) {
      db.contractProposals = [];
      needsWrite = true;
    }
    if (!db.contractVotes) {
      db.contractVotes = [];
      needsWrite = true;
    }
    if (!db.syncStates) {
      db.syncStates = [];
      needsWrite = true;
    }
    if (!db.websocketEvents) {
      db.websocketEvents = [];
      needsWrite = true;
    }
    
    // Phase 2 migrations
    if (!db.groups) {
      db.groups = [];
      needsWrite = true;
    }
    if (!db.memberSnapshots) {
      db.memberSnapshots = [];
      needsWrite = true;
    }
    if (!db.voteSnapshots) {
      db.voteSnapshots = [];
      needsWrite = true;
    }
    if (!db.groupEvents) {
      db.groupEvents = [];
      needsWrite = true;
    }
    
    // Phase 3 migrations
    if (!db.credentialClasses) {
      db.credentialClasses = [];
      needsWrite = true;
    }
    if (!db.credentials) {
      db.credentials = [];
      needsWrite = true;
    }
    if (!db.credentialEvents) {
      db.credentialEvents = [];
      needsWrite = true;
    }

    // Phase 4 migrations
    if (!db.policies) {
      db.policies = [];
      needsWrite = true;
    }
    if (!db.policyViolations) {
      db.policyViolations = [];
      needsWrite = true;
    }
    if (!db.emergencyEvents) {
      db.emergencyEvents = [];
      needsWrite = true;
    }
    if (!db.emergencyStates) {
      db.emergencyStates = [];
      needsWrite = true;
    }
    if (!db.incidents) {
      db.incidents = [];
      needsWrite = true;
    }
    if (!db.alertRules) {
      db.alertRules = [];
      needsWrite = true;
    }
    if (!db.alerts) {
      db.alerts = [];
      needsWrite = true;
    }
    if (!db.spendRecords) {
      db.spendRecords = [];
      needsWrite = true;
    }

    // Migrate existing contractMultisigs to include policyVersion
    for (const multisig of db.contractMultisigs || []) {
      if (multisig.policyVersion === undefined) {
        multisig.policyVersion = 1;
        needsWrite = true;
      }
    }
    
    if (needsWrite) {
      fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
    }
  }
};

// Read database
const readDb = (): Database => {
  initDb();
  if (_useMemoryDb && _memoryDb) return _memoryDb;
  const data = fs.readFileSync(getDbFilePath(), "utf-8");
  return JSON.parse(data);
};

// Write database
const writeDb = (db: Database): void => {
  if (_useMemoryDb) {
    _memoryDb = db;
    return;
  }
  fs.writeFileSync(getDbFilePath(), JSON.stringify(db, null, 2));
};

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Multisig operations
export const getMultisig = (chainId: string, address: string): DbMultisig | null => {
  const db = readDb();
  const results = db.multisigs.filter(
    (m) => m.chainId === chainId && m.address === address
  );
  
  if (results.length === 0) return null;
  
  // Prefer multisig with creator
  const withCreator = results.find((m) => m.creator);
  return withCreator || results[0];
};

export const getMultisigById = (id: string): DbMultisig | null => {
  const db = readDb();
  return db.multisigs.find((m) => m.id === id) || null;
};

export const getCreatedMultisigs = (chainId: string, creatorAddress: string): DbMultisig[] => {
  const db = readDb();
  const results = db.multisigs.filter(
    (m) => m.chainId === chainId && m.creator === creatorAddress
  );
  
  // Remove duplicates, prefer with creator
  const uniqueMap = new Map<string, DbMultisig>();
  for (const multisig of results) {
    if (multisig.creator) {
      uniqueMap.set(multisig.address, multisig);
    } else if (!uniqueMap.has(multisig.address)) {
      uniqueMap.set(multisig.address, multisig);
    }
  }
  
  return Array.from(uniqueMap.values());
};

export const getBelongedMultisigs = (chainId: string, memberPubkey: string): DbMultisig[] => {
  const db = readDb();
  const results = db.multisigs.filter((m) => {
    if (m.chainId !== chainId) return false;

    // Parse the pubkeyJSON and check for exact pubkey match instead of
    // fragile string .includes() which can produce false positives/negatives
    try {
      const parsed = JSON.parse(m.pubkeyJSON);
      const pubkeys: { value?: string; key?: string }[] =
        parsed?.value?.pubkeys || parsed?.pubkeys || [];
      return pubkeys.some(
        (pk) => pk.value === memberPubkey || pk.key === memberPubkey,
      );
    } catch {
      // Fallback to string search if JSON parsing fails
      return m.pubkeyJSON.includes(memberPubkey);
    }
  });
  
  // Remove duplicates, prefer with creator
  const uniqueMap = new Map<string, DbMultisig>();
  for (const multisig of results) {
    if (multisig.creator) {
      uniqueMap.set(multisig.address, multisig);
    } else if (!uniqueMap.has(multisig.address)) {
      uniqueMap.set(multisig.address, multisig);
    }
  }
  
  return Array.from(uniqueMap.values());
};

/**
 * Create a new Cliq (multisig)
 */
export const createMultisig = (multisig: {
  chainId: string;
  address: string;
  creator: string | null;
  pubkeyJSON: string;
  name?: string | null | undefined;
  description?: string | null | undefined;
}): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  // Check if multisig exists
  const existing = db.multisigs.find(
    (m) => m.chainId === multisig.chainId && m.address === multisig.address
  );
  
  if (existing) {
    // If provided multisig has creator and existing doesn't, update it
    if (multisig.creator && !existing.creator) {
      existing.creator = multisig.creator;
      // Also update name and description if provided
      if (multisig.name) existing.name = multisig.name;
      if (multisig.description) existing.description = multisig.description;
      existing.updatedAt = now;
      writeDb(db);
      return existing.address;
    }
    throw new Error(
      `Cliq already exists on ${multisig.chainId} with address ${multisig.address}`
    );
  }
  
  // Create new cliq (multisig)
  const newMultisig: DbMultisig = {
    id: generateId(),
    chainId: multisig.chainId,
    address: multisig.address,
    creator: multisig.creator,
    pubkeyJSON: multisig.pubkeyJSON,
    name: multisig.name || null,
    description: multisig.description || null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  
  db.multisigs.push(newMultisig);
  writeDb(db);
  
  return newMultisig.address;
};

// Transaction operations
export const getTransaction = (transactionId: string): DbTransaction | null => {
  const db = readDb();
  return db.transactions.find((t) => t.id === transactionId) || null;
};

export const getTransactionsByCreator = (creatorId: string): DbTransaction[] => {
  const db = readDb();
  return db.transactions.filter((t) => t.creatorId === creatorId);
};

export const createTransaction = (
  transaction: Omit<DbTransaction, "id">
): string => {
  console.log("DEBUG: localDb.createTransaction called", {
    dataJSON: transaction.dataJSON.substring(0, 100) + "...",
    creatorId: transaction.creatorId,
    txHash: transaction.txHash,
    payloadHash: transaction.payloadHash,
  });

  const db = readDb();

  const newTransaction: DbTransaction = {
    id: generateId(),
    ...transaction,
  };

  console.log("DEBUG: creating transaction with id", newTransaction.id);
  db.transactions.push(newTransaction);
  writeDb(db);
  console.log("DEBUG: transaction written to db, returning id", newTransaction.id);

  return newTransaction.id;
};

/**
 * Update payload hash for a transaction
 */
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

export const updateTransactionHash = (
  transactionId: string,
  txHash: string
): void => {
  const db = readDb();
  const transaction = db.transactions.find((t) => t.id === transactionId);
  
  if (!transaction) {
    throw new Error(`Transaction with id ${transactionId} not found`);
  }
  
  transaction.txHash = txHash;
  transaction.status = "broadcast";
  writeDb(db);
};

export const cancelTransaction = (transactionId: string): void => {
  const db = readDb();
  const transaction = db.transactions.find((t) => t.id === transactionId);
  
  if (!transaction) {
    throw new Error(`Transaction with id ${transactionId} not found`);
  }
  
  if (transaction.txHash) {
    throw new Error(`Cannot cancel a transaction that has already been broadcast`);
  }
  
  transaction.status = "cancelled";
  writeDb(db);
};

export const getPendingTransactionsByCreator = (creatorId: string): DbTransaction[] => {
  const db = readDb();
  return db.transactions.filter(
    (t) => t.creatorId === creatorId && !t.txHash && t.status !== "cancelled"
  );
};

// Signature operations
export const getSignaturesByTransaction = (
  transactionId: string
): DbSignature[] => {
  const db = readDb();
  return db.signatures.filter((s) => s.transactionId === transactionId);
};

export const createSignature = (
  signature: Omit<DbSignature, "id">
): string => {
  const db = readDb();
  
  // Check if signature already exists for this transaction and address
  const existing = db.signatures.find(
    (s) =>
      s.transactionId === signature.transactionId &&
      s.address === signature.address
  );
  
  if (existing) {
    throw new Error(
      `Signature already exists for transaction ${signature.transactionId} and address ${signature.address}`
    );
  }
  
  const newSignature: DbSignature = {
    id: generateId(),
    ...signature,
  };
  
  db.signatures.push(newSignature);
  writeDb(db);
  
  return newSignature.id;
};

// Nonce operations
export const getNonce = (chainId: string, address: string): DbNonce | null => {
  const db = readDb();
  return (
    db.nonces.find(
      (n) => n.chainId === chainId && n.address === address
    ) || null
  );
};

export const createOrUpdateNonce = (
  chainId: string,
  address: string,
  nonce: number
): void => {
  const db = readDb();
  const existing = db.nonces.find(
    (n) => n.chainId === chainId && n.address === address
  );
  
  if (existing) {
    existing.nonce = nonce;
  } else {
    db.nonces.push({
      id: generateId(),
      chainId,
      address,
      nonce,
    });
  }
  
  writeDb(db);
};

// ============================================================================
// Contract Multisig Operations (Phase 1)
// ============================================================================

/**
 * Get a contract multisig by address
 */
export const getContractMultisig = (
  chainId: string,
  contractAddress: string
): DbContractMultisig | null => {
  const db = readDb();
  return db.contractMultisigs.find(
    (m) => m.chainId === chainId && m.contractAddress === contractAddress
  ) || null;
};

/**
 * Get all contract multisigs for a chain where user is a member
 */
export const getContractMultisigsByMember = (
  chainId: string,
  memberAddress: string
): DbContractMultisig[] => {
  const db = readDb();
  return db.contractMultisigs.filter(
    (m) => m.chainId === chainId && 
           m.members.some((member) => member.addr === memberAddress)
  );
};

/**
 * Get all contract multisigs created by a user
 */
export const getContractMultisigsByCreator = (
  chainId: string,
  creatorAddress: string
): DbContractMultisig[] => {
  const db = readDb();
  return db.contractMultisigs.filter(
    (m) => m.chainId === chainId && m.creator === creatorAddress
  );
};

/**
 * Create a new contract multisig record
 */
export const createContractMultisig = (
  multisig: Omit<DbContractMultisig, "id" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.contractMultisigs.find(
    (m) => m.chainId === multisig.chainId && 
           m.contractAddress === multisig.contractAddress
  );
  
  if (existing) {
    throw new Error(
      `Contract multisig already exists on ${multisig.chainId} with address ${multisig.contractAddress}`
    );
  }
  
  const newMultisig: DbContractMultisig = {
    id: generateId(),
    ...multisig,
    createdAt: now,
    updatedAt: now,
  };
  
  db.contractMultisigs.push(newMultisig);
  writeDb(db);
  
  return newMultisig.contractAddress;
};

/**
 * Update a contract multisig (for sync job)
 */
export const updateContractMultisig = (
  chainId: string,
  contractAddress: string,
  updates: Partial<Pick<DbContractMultisig, "threshold" | "maxVotingPeriodSeconds" | "members" | "lastSyncHeight" | "name" | "description">>
): void => {
  const db = readDb();
  const multisig = db.contractMultisigs.find(
    (m) => m.chainId === chainId && m.contractAddress === contractAddress
  );
  
  if (!multisig) {
    throw new Error(`Contract multisig not found: ${contractAddress}`);
  }
  
  Object.assign(multisig, updates, { updatedAt: new Date().toISOString() });
  writeDb(db);
};

// ============================================================================
// Contract Proposal Operations
// ============================================================================

/**
 * Get a contract proposal by ID
 */
export const getContractProposal = (
  contractAddress: string,
  proposalId: number
): DbContractProposal | null => {
  const db = readDb();
  return db.contractProposals.find(
    (p) => p.contractAddress === contractAddress && p.proposalId === proposalId
  ) || null;
};

/**
 * Get all proposals for a contract
 */
export const getContractProposals = (
  contractAddress: string,
  status?: string
): DbContractProposal[] => {
  const db = readDb();
  let proposals = db.contractProposals.filter(
    (p) => p.contractAddress === contractAddress
  );
  
  if (status) {
    proposals = proposals.filter((p) => p.status === status);
  }
  
  return proposals.sort((a, b) => b.proposalId - a.proposalId);
};

/**
 * Create or update a contract proposal (for indexer)
 */
export const upsertContractProposal = (
  proposal: Omit<DbContractProposal, "id" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.contractProposals.find(
    (p) => p.contractAddress === proposal.contractAddress && 
           p.proposalId === proposal.proposalId
  );
  
  if (existing) {
    // Update existing
    Object.assign(existing, proposal, { updatedAt: now });
    writeDb(db);
    return existing.id;
  }
  
  // Create new
  const newProposal: DbContractProposal = {
    id: generateId(),
    ...proposal,
    createdAt: now,
    updatedAt: now,
  };
  
  db.contractProposals.push(newProposal);
  writeDb(db);
  
  return newProposal.id;
};

/**
 * Update proposal status
 */
export const updateContractProposalStatus = (
  contractAddress: string,
  proposalId: number,
  status: DbContractProposal["status"],
  isConfirmed: boolean = true
): void => {
  const db = readDb();
  const proposal = db.contractProposals.find(
    (p) => p.contractAddress === contractAddress && p.proposalId === proposalId
  );
  
  if (!proposal) {
    throw new Error(`Contract proposal not found: ${proposalId}`);
  }
  
  proposal.status = status;
  proposal.isConfirmed = isConfirmed;
  proposal.updatedAt = new Date().toISOString();
  proposal.lastVerifiedAt = new Date().toISOString();
  writeDb(db);
};

// ============================================================================
// Contract Vote Operations
// ============================================================================

/**
 * Get votes for a proposal
 */
export const getContractVotes = (
  contractAddress: string,
  proposalId: number
): DbContractVote[] => {
  const db = readDb();
  return db.contractVotes.filter(
    (v) => v.contractAddress === contractAddress && v.proposalId === proposalId
  );
};

/**
 * Create or update a vote (for indexer)
 */
export const upsertContractVote = (
  vote: Omit<DbContractVote, "id" | "createdAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.contractVotes.find(
    (v) => v.contractAddress === vote.contractAddress && 
           v.proposalId === vote.proposalId &&
           v.voter === vote.voter
  );
  
  if (existing) {
    Object.assign(existing, vote);
    writeDb(db);
    return existing.id;
  }
  
  const newVote: DbContractVote = {
    id: generateId(),
    ...vote,
    createdAt: now,
  };
  
  db.contractVotes.push(newVote);
  writeDb(db);
  
  return newVote.id;
};

/**
 * Get total yes weight for a proposal
 */
export const getProposalYesWeight = (
  contractAddress: string,
  proposalId: number
): number => {
  const votes = getContractVotes(contractAddress, proposalId);
  return votes
    .filter((v) => v.vote === "yes")
    .reduce((sum, v) => sum + v.weight, 0);
};

// ============================================================================
// Sync State Operations (Layer 2)
// ============================================================================

/**
 * Get sync state for a contract
 */
export const getSyncState = (
  chainId: string,
  contractAddress: string
): DbSyncState | null => {
  const db = readDb();
  return db.syncStates.find(
    (s) => s.chainId === chainId && s.contractAddress === contractAddress
  ) || null;
};

/**
 * Update sync state (for sync job)
 */
export const updateSyncState = (
  chainId: string,
  contractAddress: string,
  height: number,
  status: DbSyncState["status"] = "synced",
  errorMessage: string | null = null
): void => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.syncStates.find(
    (s) => s.chainId === chainId && s.contractAddress === contractAddress
  );
  
  if (existing) {
    existing.lastFinalizedHeight = height;
    existing.lastSyncedAt = now;
    existing.status = status;
    existing.errorMessage = errorMessage;
  } else {
    db.syncStates.push({
      id: generateId(),
      chainId,
      contractAddress,
      lastFinalizedHeight: height,
      lastSyncedAt: now,
      status,
      errorMessage,
    });
  }
  
  writeDb(db);
};

// ============================================================================
// WebSocket Event Operations (Layer 1)
// ============================================================================

/**
 * Record a websocket event
 */
export const recordWebSocketEvent = (
  event: Omit<DbWebSocketEvent, "id" | "receivedAt" | "processed">
): string => {
  const db = readDb();
  
  const newEvent: DbWebSocketEvent = {
    id: generateId(),
    ...event,
    receivedAt: new Date().toISOString(),
    processed: false,
  };
  
  db.websocketEvents.push(newEvent);
  writeDb(db);
  
  return newEvent.id;
};

/**
 * Get unprocessed websocket events for a contract
 */
export const getUnprocessedEvents = (
  contractAddress: string
): DbWebSocketEvent[] => {
  const db = readDb();
  return db.websocketEvents.filter(
    (e) => e.contractAddress === contractAddress && !e.processed
  );
};

/**
 * Mark events as processed
 */
export const markEventsProcessed = (eventIds: string[]): void => {
  const db = readDb();
  
  for (const event of db.websocketEvents) {
    if (eventIds.includes(event.id)) {
      event.processed = true;
    }
  }
  
  writeDb(db);
};

/**
 * Clean up old processed events (older than 7 days)
 */
export const cleanupOldEvents = (): number => {
  const db = readDb();
  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
  
  const initialCount = db.websocketEvents.length;
  db.websocketEvents = db.websocketEvents.filter((e) => {
    if (!e.processed) return true;
    const eventTime = new Date(e.receivedAt).getTime();
    return eventTime > cutoffTime;
  });
  
  const removedCount = initialCount - db.websocketEvents.length;
  if (removedCount > 0) {
    writeDb(db);
  }
  
  return removedCount;
};

// ============================================================================
// Phase 2: Group Operations
// ============================================================================

/**
 * Get a group by address
 */
export const getGroup = (
  chainId: string,
  groupAddress: string
): DbGroup | null => {
  const db = readDb();
  return db.groups.find(
    (g) => g.chainId === chainId && g.groupAddress === groupAddress
  ) || null;
};

/**
 * Get groups by multisig address
 */
export const getGroupByMultisig = (
  chainId: string,
  multisigAddress: string
): DbGroup | null => {
  const db = readDb();
  return db.groups.find(
    (g) => g.chainId === chainId && g.multisigAddress === multisigAddress
  ) || null;
};

/**
 * Get all groups for a chain
 */
export const getGroups = (chainId: string): DbGroup[] => {
  const db = readDb();
  return db.groups.filter((g) => g.chainId === chainId);
};

/**
 * Create a new group record
 */
export const createGroup = (
  group: Omit<DbGroup, "id" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.groups.find(
    (g) => g.chainId === group.chainId && g.groupAddress === group.groupAddress
  );
  
  if (existing) {
    throw new Error(
      `Group already exists on ${group.chainId} with address ${group.groupAddress}`
    );
  }
  
  const newGroup: DbGroup = {
    id: generateId(),
    ...group,
    createdAt: now,
    updatedAt: now,
  };
  
  db.groups.push(newGroup);
  writeDb(db);
  
  return newGroup.groupAddress;
};

/**
 * Update a group record
 */
export const updateGroup = (
  chainId: string,
  groupAddress: string,
  updates: Partial<Pick<DbGroup, "admin" | "totalWeight" | "memberCount" | "lastSyncHeight" | "label">>
): void => {
  const db = readDb();
  const group = db.groups.find(
    (g) => g.chainId === chainId && g.groupAddress === groupAddress
  );
  
  if (!group) {
    throw new Error(`Group not found: ${groupAddress}`);
  }
  
  Object.assign(group, updates, { updatedAt: new Date().toISOString() });
  writeDb(db);
};

// ============================================================================
// Phase 2: Member Snapshot Operations
// ============================================================================

/**
 * Get member snapshot for a proposal
 */
export const getMemberSnapshot = (
  contractAddress: string,
  proposalId: number
): DbMemberSnapshot | null => {
  const db = readDb();
  return db.memberSnapshots.find(
    (s) => s.contractAddress === contractAddress && s.proposalId === proposalId
  ) || null;
};

/**
 * Get all member snapshots for a contract
 */
export const getMemberSnapshots = (
  contractAddress: string
): DbMemberSnapshot[] => {
  const db = readDb();
  return db.memberSnapshots.filter(
    (s) => s.contractAddress === contractAddress
  );
};

/**
 * Create a member snapshot
 */
export const createMemberSnapshot = (
  snapshot: Omit<DbMemberSnapshot, "id" | "createdAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  // Check if snapshot already exists for this proposal
  const existing = db.memberSnapshots.find(
    (s) => s.contractAddress === snapshot.contractAddress && 
           s.proposalId === snapshot.proposalId
  );
  
  if (existing) {
    // Update existing snapshot
    Object.assign(existing, snapshot);
    writeDb(db);
    return existing.id;
  }
  
  const newSnapshot: DbMemberSnapshot = {
    id: generateId(),
    ...snapshot,
    createdAt: now,
  };
  
  db.memberSnapshots.push(newSnapshot);
  writeDb(db);
  
  return newSnapshot.id;
};

/**
 * Parse members from a snapshot
 */
export const parseMemberSnapshotMembers = (
  snapshot: DbMemberSnapshot
): { addr: string; weight: number }[] => {
  try {
    return JSON.parse(snapshot.membersJSON);
  } catch {
    return [];
  }
};

// ============================================================================
// Phase 2: Vote Snapshot Operations
// ============================================================================

/**
 * Get vote snapshot for a specific vote
 */
export const getVoteSnapshot = (
  contractAddress: string,
  proposalId: number,
  voter: string
): DbVoteSnapshot | null => {
  const db = readDb();
  return db.voteSnapshots.find(
    (s) => s.contractAddress === contractAddress && 
           s.proposalId === proposalId &&
           s.voter === voter
  ) || null;
};

/**
 * Get all vote snapshots for a proposal
 */
export const getVoteSnapshots = (
  contractAddress: string,
  proposalId: number
): DbVoteSnapshot[] => {
  const db = readDb();
  return db.voteSnapshots.filter(
    (s) => s.contractAddress === contractAddress && s.proposalId === proposalId
  );
};

/**
 * Create a vote snapshot
 */
export const createVoteSnapshot = (
  snapshot: Omit<DbVoteSnapshot, "id" | "createdAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  // Check if snapshot already exists for this vote
  const existing = db.voteSnapshots.find(
    (s) => s.contractAddress === snapshot.contractAddress && 
           s.proposalId === snapshot.proposalId &&
           s.voter === snapshot.voter
  );
  
  if (existing) {
    // Update existing snapshot
    Object.assign(existing, snapshot);
    writeDb(db);
    return existing.id;
  }
  
  const newSnapshot: DbVoteSnapshot = {
    id: generateId(),
    ...snapshot,
    createdAt: now,
  };
  
  db.voteSnapshots.push(newSnapshot);
  writeDb(db);
  
  return newSnapshot.id;
};

/**
 * Get total vote weight from snapshots for a proposal
 */
export const getProposalVoteWeightFromSnapshots = (
  contractAddress: string,
  proposalId: number
): { yes: number; no: number; abstain: number; veto: number } => {
  const votes = getContractVotes(contractAddress, proposalId);
  const snapshots = getVoteSnapshots(contractAddress, proposalId);
  
  const result = { yes: 0, no: 0, abstain: 0, veto: 0 };
  
  for (const vote of votes) {
    // Find the snapshot for this vote
    const snapshot = snapshots.find((s) => s.voter === vote.voter);
    const weight = snapshot?.weightAtVote ?? vote.weight;
    
    switch (vote.vote) {
      case "yes":
        result.yes += weight;
        break;
      case "no":
        result.no += weight;
        break;
      case "abstain":
        result.abstain += weight;
        break;
      case "veto":
        result.veto += weight;
        break;
    }
  }
  
  return result;
};

// ============================================================================
// Phase 2: Group Event Operations
// ============================================================================

/**
 * Record a group event
 */
export const recordGroupEvent = (
  event: Omit<DbGroupEvent, "id" | "receivedAt" | "processed">
): string => {
  const db = readDb();
  
  const newEvent: DbGroupEvent = {
    id: generateId(),
    ...event,
    receivedAt: new Date().toISOString(),
    processed: false,
  };
  
  db.groupEvents.push(newEvent);
  writeDb(db);
  
  return newEvent.id;
};

/**
 * Get unprocessed group events
 */
export const getUnprocessedGroupEvents = (
  groupAddress: string
): DbGroupEvent[] => {
  const db = readDb();
  return db.groupEvents.filter(
    (e) => e.groupAddress === groupAddress && !e.processed
  );
};

/**
 * Mark group events as processed
 */
export const markGroupEventsProcessed = (eventIds: string[]): void => {
  const db = readDb();
  
  for (const event of db.groupEvents) {
    if (eventIds.includes(event.id)) {
      event.processed = true;
    }
  }
  
  writeDb(db);
};

/**
 * Get group events by type
 */
export const getGroupEventsByType = (
  groupAddress: string,
  eventType: DbGroupEvent["eventType"]
): DbGroupEvent[] => {
  const db = readDb();
  return db.groupEvents.filter(
    (e) => e.groupAddress === groupAddress && e.eventType === eventType
  );
};

// ============================================================================
// Phase 3: Credential Class Operations
// ============================================================================

/**
 * Get a credential class by team address
 */
export const getCredentialClass = (
  chainId: string,
  teamAddress: string
): DbCredentialClass | null => {
  const db = readDb();
  return db.credentialClasses.find(
    (c) => c.chainId === chainId && c.teamAddress === teamAddress
  ) || null;
};

/**
 * Get a credential class by class ID
 */
export const getCredentialClassById = (
  chainId: string,
  classId: string
): DbCredentialClass | null => {
  const db = readDb();
  return db.credentialClasses.find(
    (c) => c.chainId === chainId && c.classId === classId
  ) || null;
};

/**
 * Create a new credential class
 */
export const createCredentialClass = (
  data: Omit<DbCredentialClass, "id" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.credentialClasses.find(
    (c) => c.chainId === data.chainId && c.teamAddress === data.teamAddress
  );
  
  if (existing) {
    // Update existing
    Object.assign(existing, data, { updatedAt: now });
    writeDb(db);
    return existing.id;
  }
  
  const newClass: DbCredentialClass = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  
  db.credentialClasses.push(newClass);
  writeDb(db);
  
  return newClass.id;
};

/**
 * Update a credential class
 */
export const updateCredentialClass = (
  chainId: string,
  teamAddress: string,
  updates: Partial<Pick<DbCredentialClass, "issuer" | "features">>
): void => {
  const db = readDb();
  const credClass = db.credentialClasses.find(
    (c) => c.chainId === chainId && c.teamAddress === teamAddress
  );
  
  if (!credClass) {
    throw new Error(`Credential class not found for team: ${teamAddress}`);
  }
  
  Object.assign(credClass, updates, { updatedAt: new Date().toISOString() });
  writeDb(db);
};

// ============================================================================
// Phase 3: Credential Operations
// ============================================================================

/**
 * Get a credential by class ID and token ID
 */
export const getCredential = (
  classId: string,
  tokenId: string
): DbCredential | null => {
  const db = readDb();
  return db.credentials.find(
    (c) => c.classId === classId && c.tokenId === tokenId
  ) || null;
};

/**
 * Get a credential by owner address for a specific team
 */
export const getCredentialByOwner = (
  chainId: string,
  teamAddress: string,
  ownerAddress: string
): DbCredential | null => {
  const db = readDb();
  return db.credentials.find(
    (c) => c.chainId === chainId && 
           c.teamAddress === teamAddress && 
           c.ownerAddress === ownerAddress &&
           c.status === "active"
  ) || null;
};

/**
 * Get all credentials for a team
 */
export const getCredentialsByTeam = (
  chainId: string,
  teamAddress: string
): DbCredential[] => {
  const db = readDb();
  return db.credentials.filter(
    (c) => c.chainId === chainId && c.teamAddress === teamAddress
  );
};

/**
 * Get all credentials owned by an address
 */
export const getCredentialsByOwner = (
  chainId: string,
  ownerAddress: string
): DbCredential[] => {
  const db = readDb();
  return db.credentials.filter(
    (c) => c.chainId === chainId && c.ownerAddress === ownerAddress
  );
};

/**
 * Create a new credential
 */
export const createCredential = (
  data: Omit<DbCredential, "id" | "revokedAt" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const newCredential: DbCredential = {
    id: generateId(),
    ...data,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  
  db.credentials.push(newCredential);
  writeDb(db);
  
  return newCredential.id;
};

/**
 * Update credential status
 */
export const updateCredentialStatus = (
  classId: string,
  tokenId: string,
  status: DbCredential["status"],
  revokedAt?: string
): void => {
  const db = readDb();
  const credential = db.credentials.find(
    (c) => c.classId === classId && c.tokenId === tokenId
  );
  
  if (!credential) {
    throw new Error(`Credential not found: ${classId}:${tokenId}`);
  }
  
  credential.status = status;
  if (revokedAt) {
    credential.revokedAt = revokedAt;
  }
  credential.updatedAt = new Date().toISOString();
  writeDb(db);
};

/**
 * List credentials with filters
 */
export const listCredentials = (options: {
  chainId: string;
  classId?: string;
  ownerAddress?: string;
  teamAddress?: string;
  status?: string;
  role?: string;
  limit?: number;
}): DbCredential[] => {
  const db = readDb();
  let results = db.credentials.filter((c) => c.chainId === options.chainId);
  
  if (options.classId) {
    results = results.filter((c) => c.classId === options.classId);
  }
  if (options.ownerAddress) {
    results = results.filter((c) => c.ownerAddress === options.ownerAddress);
  }
  if (options.teamAddress) {
    results = results.filter((c) => c.teamAddress === options.teamAddress);
  }
  if (options.status) {
    results = results.filter((c) => c.status === options.status);
  }
  if (options.role) {
    results = results.filter((c) => c.role === options.role);
  }
  if (options.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
};

// ============================================================================
// Phase 3: Credential Event Operations
// ============================================================================

/**
 * Record a credential event
 */
export const recordCredentialEvent = (
  event: Omit<DbCredentialEvent, "id" | "createdAt">
): string => {
  const db = readDb();
  
  const newEvent: DbCredentialEvent = {
    id: generateId(),
    ...event,
    createdAt: new Date().toISOString(),
  };
  
  db.credentialEvents.push(newEvent);
  writeDb(db);
  
  return newEvent.id;
};

/**
 * Get credential events by class ID
 */
export const getCredentialEventsByClass = (
  classId: string
): DbCredentialEvent[] => {
  const db = readDb();
  return db.credentialEvents.filter((e) => e.classId === classId);
};

/**
 * Get credential events by token ID
 */
export const getCredentialEventsByToken = (
  classId: string,
  tokenId: string
): DbCredentialEvent[] => {
  const db = readDb();
  return db.credentialEvents.filter(
    (e) => e.classId === classId && e.tokenId === tokenId
  );
};

/**
 * Get credential events by type
 */
export const getCredentialEventsByType = (
  chainId: string,
  eventType: DbCredentialEvent["eventType"]
): DbCredentialEvent[] => {
  const db = readDb();
  return db.credentialEvents.filter(
    (e) => e.chainId === chainId && e.eventType === eventType
  );
};

// ============================================================================
// Phase 4: Policy Operations
// ============================================================================

/**
 * Create or update a policy
 */
export const upsertPolicy = (
  data: Omit<DbPolicy, "id" | "createdAt" | "updatedAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.policies.find(
    (p) => p.multisigAddress === data.multisigAddress && 
           p.chainId === data.chainId &&
           p.name === data.name
  );
  
  if (existing) {
    Object.assign(existing, data, { updatedAt: now });
    writeDb(db);
    return existing.id;
  }
  
  const newPolicy: DbPolicy = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  
  db.policies.push(newPolicy);
  writeDb(db);
  
  return newPolicy.id;
};

/**
 * Get policies for a multisig
 */
export const getPolicies = (
  multisigAddress: string,
  chainId: string
): DbPolicy[] => {
  const db = readDb();
  return db.policies
    .filter((p) => p.multisigAddress === multisigAddress && p.chainId === chainId)
    .sort((a, b) => a.priority - b.priority);
};

/**
 * Get a policy by ID
 */
export const getPolicyById = (id: string): DbPolicy | null => {
  const db = readDb();
  return db.policies.find((p) => p.id === id) || null;
};

/**
 * Update a policy
 */
export const updatePolicy = (
  id: string,
  updates: Partial<Pick<DbPolicy, "configJSON" | "enabled" | "priority" | "name">>
): void => {
  const db = readDb();
  const policy = db.policies.find((p) => p.id === id);
  
  if (!policy) {
    throw new Error(`Policy not found: ${id}`);
  }
  
  Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
  writeDb(db);
};

/**
 * Delete a policy
 */
export const deletePolicy = (id: string): boolean => {
  const db = readDb();
  const index = db.policies.findIndex((p) => p.id === id);
  
  if (index === -1) {
    return false;
  }
  
  db.policies.splice(index, 1);
  writeDb(db);
  return true;
};

/**
 * Record a policy violation
 */
export const recordPolicyViolation = (
  data: Omit<DbPolicyViolation, "id" | "timestamp">
): string => {
  const db = readDb();
  
  const violation: DbPolicyViolation = {
    id: generateId(),
    ...data,
    timestamp: new Date().toISOString(),
  };
  
  db.policyViolations.push(violation);
  writeDb(db);
  
  return violation.id;
};

/**
 * Get policy violations for a multisig
 */
export const getPolicyViolations = (
  multisigAddress: string,
  limit: number = 100
): DbPolicyViolation[] => {
  const db = readDb();
  return db.policyViolations
    .filter((v) => v.multisigAddress === multisigAddress)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

// ============================================================================
// Phase 4: Emergency State Operations
// ============================================================================

/**
 * Get or create emergency state for a multisig
 */
export const getEmergencyState = (
  multisigAddress: string,
  chainId: string
): DbEmergencyState | null => {
  const db = readDb();
  return db.emergencyStates.find(
    (s) => s.multisigAddress === multisigAddress && s.chainId === chainId
  ) || null;
};

/**
 * Update emergency state
 */
export const updateEmergencyState = (
  multisigAddress: string,
  chainId: string,
  updates: Partial<Omit<DbEmergencyState, "id" | "multisigAddress" | "chainId">>
): void => {
  const db = readDb();
  const now = new Date().toISOString();
  
  let state = db.emergencyStates.find(
    (s) => s.multisigAddress === multisigAddress && s.chainId === chainId
  );
  
  if (!state) {
    state = {
      id: generateId(),
      multisigAddress,
      chainId,
      isPaused: false,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      autoUnpauseAt: null,
      isSafeMode: false,
      safeModeThreshold: null,
      safeModeActivatedAt: null,
      updatedAt: now,
    };
    db.emergencyStates.push(state);
  }
  
  Object.assign(state, updates, { updatedAt: now });
  writeDb(db);
};

/**
 * Record an emergency event
 */
export const recordEmergencyEvent = (
  data: Omit<DbEmergencyEvent, "id" | "timestamp">
): string => {
  const db = readDb();
  
  const event: DbEmergencyEvent = {
    id: generateId(),
    ...data,
    timestamp: new Date().toISOString(),
  };
  
  db.emergencyEvents.push(event);
  writeDb(db);
  
  return event.id;
};

/**
 * Get emergency events for a multisig
 */
export const getEmergencyEvents = (
  multisigAddress: string,
  limit: number = 50
): DbEmergencyEvent[] => {
  const db = readDb();
  return db.emergencyEvents
    .filter((e) => e.multisigAddress === multisigAddress)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

// ============================================================================
// Phase 4: Incident Operations
// ============================================================================

/**
 * Create an incident
 */
export const createIncident = (
  data: Omit<DbIncident, "id" | "createdAt" | "acknowledgedAt" | "acknowledgedBy" | "resolvedAt" | "resolvedBy">
): string => {
  const db = readDb();
  
  const incident: DbIncident = {
    id: generateId(),
    ...data,
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
  };
  
  db.incidents.push(incident);
  writeDb(db);
  
  return incident.id;
};

/**
 * Get incidents for a multisig
 */
export const getIncidents = (
  multisigAddress: string,
  status?: DbIncident["status"]
): DbIncident[] => {
  const db = readDb();
  return db.incidents
    .filter((i) => i.multisigAddress === multisigAddress && (!status || i.status === status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

/**
 * Update an incident
 */
export const updateIncident = (
  id: string,
  updates: Partial<Pick<DbIncident, "status" | "playbookStatus" | "acknowledgedAt" | "acknowledgedBy" | "resolvedAt" | "resolvedBy">>
): void => {
  const db = readDb();
  const incident = db.incidents.find((i) => i.id === id);
  
  if (!incident) {
    throw new Error(`Incident not found: ${id}`);
  }
  
  Object.assign(incident, updates);
  writeDb(db);
};

// ============================================================================
// Phase 4: Alert Rule Operations
// ============================================================================

/**
 * Create or update an alert rule
 */
export const upsertAlertRule = (
  data: Omit<DbAlertRule, "id" | "createdAt" | "updatedAt" | "lastTriggeredAt">
): string => {
  const db = readDb();
  const now = new Date().toISOString();
  
  const existing = db.alertRules.find(
    (r) => r.multisigAddress === data.multisigAddress && 
           r.chainId === data.chainId &&
           r.name === data.name
  );
  
  if (existing) {
    Object.assign(existing, data, { updatedAt: now });
    writeDb(db);
    return existing.id;
  }
  
  const newRule: DbAlertRule = {
    id: generateId(),
    ...data,
    lastTriggeredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  
  db.alertRules.push(newRule);
  writeDb(db);
  
  return newRule.id;
};

/**
 * Get alert rules for a multisig
 */
export const getAlertRules = (
  multisigAddress: string,
  chainId: string
): DbAlertRule[] => {
  const db = readDb();
  return db.alertRules.filter(
    (r) => r.multisigAddress === multisigAddress && r.chainId === chainId
  );
};

/**
 * Update alert rule last triggered
 */
export const updateAlertRuleLastTriggered = (id: string): void => {
  const db = readDb();
  const rule = db.alertRules.find((r) => r.id === id);
  
  if (rule) {
    rule.lastTriggeredAt = new Date().toISOString();
    writeDb(db);
  }
};

/**
 * Record a sent alert
 */
export const recordAlert = (
  data: Omit<DbAlert, "id" | "sentAt" | "acknowledged" | "acknowledgedAt">
): string => {
  const db = readDb();
  
  const alert: DbAlert = {
    id: generateId(),
    ...data,
    sentAt: new Date().toISOString(),
    acknowledged: false,
    acknowledgedAt: null,
  };
  
  db.alerts.push(alert);
  writeDb(db);
  
  return alert.id;
};

/**
 * Get alerts for a multisig
 */
export const getAlerts = (
  multisigAddress: string,
  limit: number = 100
): DbAlert[] => {
  const db = readDb();
  return db.alerts
    .filter((a) => a.multisigAddress === multisigAddress)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, limit);
};

// ============================================================================
// Phase 4: Spend Record Operations
// ============================================================================

/**
 * Record a spend
 */
export const recordSpend = (
  data: Omit<DbSpendRecord, "id">
): string => {
  const db = readDb();
  
  const record: DbSpendRecord = {
    id: generateId(),
    ...data,
  };
  
  db.spendRecords.push(record);
  writeDb(db);
  
  return record.id;
};

/**
 * Get spend records for a multisig within a time window
 */
export const getSpendRecordsInWindow = (
  multisigAddress: string,
  chainId: string,
  windowStartTimestamp: string
): DbSpendRecord[] => {
  const db = readDb();
  const startTime = new Date(windowStartTimestamp).getTime();
  
  return db.spendRecords.filter(
    (r) => 
      r.multisigAddress === multisigAddress && 
      r.chainId === chainId &&
      new Date(r.executedAt).getTime() >= startTime
  );
};

/**
 * Get total spent by denom in a time window
 */
export const getTotalSpentInWindow = (
  multisigAddress: string,
  chainId: string,
  windowStartTimestamp: string
): Map<string, bigint> => {
  const records = getSpendRecordsInWindow(multisigAddress, chainId, windowStartTimestamp);
  const totals = new Map<string, bigint>();
  
  for (const record of records) {
    const current = totals.get(record.denom) ?? BigInt(0);
    totals.set(record.denom, current + BigInt(record.amount));
  }
  
  return totals;
};

// ============================================================================
// Type Exports
// ============================================================================

export type {
  DbMultisig,
  DbTransaction,
  DbSignature,
  DbNonce,
  DbContractMultisig,
  DbContractProposal,
  DbContractVote,
  DbSyncState,
  DbWebSocketEvent,
  // Phase 2 types
  DbGroup,
  DbMemberSnapshot,
  DbVoteSnapshot,
  DbGroupEvent,
  // Phase 3 types
  DbCredentialClass,
  DbCredential,
  DbCredentialEvent,
  // Phase 4 types
  DbPolicy,
  DbPolicyViolation,
  DbEmergencyEvent,
  DbEmergencyState,
  DbIncident,
  DbAlertRule,
  DbAlert,
  DbSpendRecord,
};

