/**
 * Indexer Module Exports
 *
 * File: lib/indexer/index.ts
 *
 * Three-layer indexer architecture for contract multisig:
 *
 * Layer 1 (WebSocket): Real-time event listener for UX updates
 * Layer 2 (Sync Job): Height-based authoritative sync for correctness
 * Layer 3 (Verifier): On-demand chain verification for security
 *
 * Phase 2: Added group event tracking for CW4 groups
 */

// Layer 1: WebSocket Event Listener
export {
  WebSocketListener,
  createWebSocketListener,
  rpcToWsEndpoint,
  wsManager,
  type WebSocketConfig,
  type ParsedEvent,
  type EventCallback,
  type CW4EventType,
  type ContractEventType,
} from "./websocket-listener";

// Layer 2: Height-Based Sync Job
export {
  SyncJob,
  createSyncJob,
  SyncScheduler,
  syncScheduler,
  // Phase 2: Group sync
  GroupSyncJob,
  createGroupSyncJob,
  GroupSyncScheduler,
  groupSyncScheduler,
  type SyncJobConfig,
  type SyncResult,
  type GroupSyncJobConfig,
  type GroupSyncResult,
} from "./sync-job";

// Layer 3: On-Demand Chain Verification
export {
  ChainVerifier,
  chainVerifier,
  verifyCanVote,
  verifyCanExecute,
  verifyMembership,
  verifyAndReconcileProposal,
  type VerificationResult,
  type VerificationErrorCode,
  type ChainVerificationData,
  type VerifyVoteParams,
  type VerifyExecuteParams,
  type VerifyMembershipParams,
} from "./chain-verifier";
