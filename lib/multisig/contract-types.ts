/**
 * Contract Multisig Types
 *
 * File: lib/multisig/contract-types.ts
 *
 * Types for CW3-Fixed style contract multisig operations.
 * These are placeholder types that will be customized when building
 * the custom contract in later phases.
 */

import { Coin } from "@cosmjs/amino";

// ============================================================================
// CW3 Config Types
// ============================================================================

/**
 * Threshold configuration for the multisig
 */
export interface ThresholdResponse {
  /** Absolute count threshold */
  absolute_count?: {
    weight: number;
    total_weight: number;
  };
  /** Absolute percentage threshold */
  absolute_percentage?: {
    percentage: string; // Decimal string like "0.5"
    total_weight: number;
  };
  /** Threshold quorum (majority of voters) */
  threshold_quorum?: {
    threshold: string;
    quorum: string;
    total_weight: number;
  };
}

/**
 * Voting period specification
 */
export interface Duration {
  /** Duration in seconds */
  time?: number;
  /** Duration in blocks */
  height?: number;
}

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

// ============================================================================
// CW3 Proposal Types
// ============================================================================

/**
 * Proposal status on-chain
 */
export type CW3ProposalStatus =
  | "pending" // Voting is still open
  | "open" // Alias for pending (some CW3 versions)
  | "passed" // Threshold met, ready to execute
  | "rejected" // Voting closed, threshold not met
  | "executed"; // Successfully executed

/**
 * Expiration time for a proposal
 */
export interface Expiration {
  /** Expires at specific block height */
  at_height?: number;
  /** Expires at specific timestamp (nanoseconds) */
  at_time?: string;
  /** Never expires */
  never?: Record<string, never>;
}

/**
 * CosmWasm message types that can be executed
 */
export interface CosmosMsg {
  bank?: BankMsg;
  staking?: StakingMsg;
  distribution?: DistributionMsg;
  wasm?: WasmMsg;
  stargate?: StargateMsg;
  ibc?: IbcMsg;
  gov?: GovMsg;
}

export interface BankMsg {
  send?: {
    to_address: string;
    amount: Coin[];
  };
  burn?: {
    amount: Coin[];
  };
}

export interface StakingMsg {
  delegate?: {
    validator: string;
    amount: Coin;
  };
  undelegate?: {
    validator: string;
    amount: Coin;
  };
  redelegate?: {
    src_validator: string;
    dst_validator: string;
    amount: Coin;
  };
}

export interface DistributionMsg {
  set_withdraw_address?: {
    address: string;
  };
  withdraw_delegator_reward?: {
    validator: string;
  };
}

export interface WasmMsg {
  execute?: {
    contract_addr: string;
    msg: string; // Base64-encoded JSON
    funds: Coin[];
  };
  instantiate?: {
    admin?: string;
    code_id: number;
    msg: string; // Base64-encoded JSON
    funds: Coin[];
    label: string;
  };
  migrate?: {
    contract_addr: string;
    new_code_id: number;
    msg: string; // Base64-encoded JSON
  };
  update_admin?: {
    contract_addr: string;
    admin: string;
  };
  clear_admin?: {
    contract_addr: string;
  };
}

export interface StargateMsg {
  type_url: string;
  value: string; // Base64-encoded protobuf
}

export interface IbcMsg {
  transfer?: {
    channel_id: string;
    to_address: string;
    amount: Coin;
    timeout: IbcTimeout;
  };
}

export interface IbcTimeout {
  block?: {
    revision: number;
    height: number;
  };
  timestamp?: string;
}

export interface GovMsg {
  vote?: {
    proposal_id: number;
    vote: "yes" | "no" | "abstain" | "no_with_veto";
  };
}

/**
 * CW3 Proposal structure
 */
export interface CW3Proposal {
  /** On-chain proposal ID (monotonic) */
  id: number;
  /** Proposal title */
  title: string;
  /** Proposal description */
  description: string;
  /** Messages to execute when proposal passes */
  msgs: CosmosMsg[];
  /** Current status */
  status: CW3ProposalStatus;
  /** When the proposal expires */
  expires: Expiration;
  /** Threshold at time of proposal creation */
  threshold: ThresholdResponse;
  /** Address that created the proposal */
  proposer: string;
  /** Optional deposit (for some contract variants) */
  deposit?: Coin[];
}

/**
 * Vote on a proposal
 */
export type VoteOption = "yes" | "no" | "abstain" | "veto";

/**
 * Individual vote record
 */
export interface CW3Vote {
  /** Voter address */
  voter: string;
  /** Vote cast */
  vote: VoteOption;
  /** Weight of this vote */
  weight: number;
}

/**
 * Vote info with proposal context
 */
export interface VoteInfo {
  proposal_id: number;
  voter: string;
  vote: VoteOption;
  weight: number;
}

// ============================================================================
// CW3 Execute Messages
// ============================================================================

/**
 * Execute messages for CW3 multisig contract
 */
export interface CW3ExecuteMsg {
  /** Create a new proposal */
  propose?: {
    title: string;
    description: string;
    msgs: CosmosMsg[];
    /** Optional: latest time/block proposal can be executed */
    latest?: Expiration;
  };
  /** Vote on an existing proposal */
  vote?: {
    proposal_id: number;
    vote: VoteOption;
  };
  /** Execute a passed proposal */
  execute?: {
    proposal_id: number;
  };
  /** Close a rejected/expired proposal */
  close?: {
    proposal_id: number;
  };
}

// ============================================================================
// CW3 Query Messages
// ============================================================================

/**
 * Query messages for CW3 multisig contract
 */
export interface CW3QueryMsg {
  /** Query threshold configuration */
  threshold?: Record<string, never>;
  /** Query a specific proposal */
  proposal?: {
    proposal_id: number;
  };
  /** List proposals with pagination */
  list_proposals?: {
    start_after?: number;
    limit?: number;
  };
  /** Reverse list proposals (newest first) */
  reverse_proposals?: {
    start_before?: number;
    limit?: number;
  };
  /** Query votes for a proposal */
  list_votes?: {
    proposal_id: number;
    start_after?: string;
    limit?: number;
  };
  /** Query a specific voter */
  voter?: {
    address: string;
  };
  /** List all voters */
  list_voters?: {
    start_after?: string;
    limit?: number;
  };
}

// ============================================================================
// CW3 Query Responses
// ============================================================================

/**
 * Response for threshold query
 */
export interface ThresholdQueryResponse {
  absolute_count?: {
    weight: number;
    total_weight: number;
  };
  absolute_percentage?: {
    percentage: string;
    total_weight: number;
  };
  threshold_quorum?: {
    threshold: string;
    quorum: string;
    total_weight: number;
  };
}

/**
 * Response for proposal query
 */
export interface ProposalResponse {
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

/**
 * Response for list proposals query
 */
export interface ProposalListResponse {
  proposals: ProposalResponse[];
}

/**
 * Response for list votes query
 */
export interface VoteListResponse {
  votes: VoteInfo[];
}

/**
 * Response for voter query
 */
export interface VoterResponse {
  weight: number;
}

/**
 * Response for list voters query
 */
export interface VoterListResponse {
  voters: CW3Voter[];
}

// ============================================================================
// Contract Instantiation
// ============================================================================

/**
 * Instantiate message for CW3-Fixed multisig
 */
export interface CW3FixedInstantiateMsg {
  /** List of voters with weights */
  voters: CW3Voter[];
  /** Threshold for passing proposals */
  threshold: {
    absolute_count?: {
      weight: number;
    };
    absolute_percentage?: {
      percentage: string;
    };
    threshold_quorum?: {
      threshold: string;
      quorum: string;
    };
  };
  /** Maximum voting period */
  max_voting_period: Duration;
}

// ============================================================================
// Contract Multisig Engine Types (extends base types)
// ============================================================================

/**
 * Contract-specific proposal input
 * Different from PubKey multisig - no account number/sequence needed
 */
export interface ContractProposalInput {
  /** Proposal title */
  title: string;
  /** Proposal description */
  description: string;
  /** Messages to execute */
  msgs: CosmosMsg[];
  /** Optional expiration override */
  latest?: Expiration;
}

/**
 * Contract-specific proposal state
 */
export interface ContractProposalState {
  /** On-chain proposal ID */
  id: number;
  /** Contract address */
  contractAddress: string;
  /** Chain ID */
  chainId: string;
  /** Proposal title */
  title: string;
  /** Proposal description */
  description: string;
  /** Messages to execute */
  msgs: CosmosMsg[];
  /** Current status */
  status: CW3ProposalStatus;
  /** Expiration time */
  expires: Expiration;
  /** Threshold configuration */
  threshold: ThresholdResponse;
  /** Proposer address */
  proposer: string;
  /** Current votes */
  votes: CW3Vote[];
  /** Current yes weight */
  yesWeight: number;
  /** Current no weight */
  noWeight: number;
  /** Current abstain weight */
  abstainWeight: number;
  /** Current veto weight */
  vetoWeight: number;
  /** Whether threshold is met */
  isReady: boolean;
  /** Block height when created */
  createdHeight?: number;
  /** Last verification timestamp */
  lastVerifiedAt?: string;
}

/**
 * Contract multisig policy
 */
export interface ContractMultisigPolicy {
  /** Threshold weight required */
  threshold: number;
  /** Total weight of all members */
  totalWeight: number;
  /** Maximum voting period in seconds */
  maxVotingPeriodSeconds: number;
  /** Policy version (derived from config) */
  version: number;
}

/**
 * Contract member (voter)
 */
export interface ContractMember {
  /** Bech32 address */
  address: string;
  /** Voting weight */
  weight: number;
}

/**
 * Contract approval receipt (after voting)
 */
export interface ContractApprovalReceipt {
  /** Proposal ID */
  proposalId: number;
  /** Voter address */
  voterAddress: string;
  /** Vote cast */
  vote: VoteOption;
  /** Transaction hash */
  txHash: string;
  /** Block height */
  height: number;
  /** Timestamp */
  timestamp: string;
  /** New yes weight after vote */
  newYesWeight: number;
  /** Whether threshold is now met */
  isReady: boolean;
}

/**
 * Contract execution result
 */
export interface ContractExecutionResult {
  /** Proposal ID */
  proposalId: number;
  /** Transaction hash */
  txHash: string;
  /** Block height */
  height: number;
  /** Gas used */
  gasUsed: number;
  /** Gas wanted */
  gasWanted: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Raw log from chain */
  rawLog?: string;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Contract Events (for indexer)
// ============================================================================

/**
 * Event types emitted by CW3 contracts
 */
export type CW3EventType = "propose" | "vote" | "execute" | "close";

/**
 * Parsed CW3 event from chain
 */
export interface CW3Event {
  /** Event type */
  type: CW3EventType;
  /** Contract address */
  contractAddress: string;
  /** Block height */
  height: number;
  /** Transaction hash */
  txHash: string;
  /** Event attributes */
  attributes: Record<string, string>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Propose event attributes
 */
export interface ProposeEventAttributes {
  proposal_id: string;
  proposer: string;
  title?: string;
}

/**
 * Vote event attributes
 */
export interface VoteEventAttributes {
  proposal_id: string;
  voter: string;
  vote: string;
  weight?: string;
}

/**
 * Execute event attributes
 */
export interface ExecuteEventAttributes {
  proposal_id: string;
  executor?: string;
}

/**
 * Close event attributes
 */
export interface CloseEventAttributes {
  proposal_id: string;
}
