/**
 * Policy Types for Phase 4 Advanced Policies
 *
 * File: lib/policies/types.ts
 *
 * This module defines the core policy abstractions for the multisig system.
 * All policy logic flows through ONE explicit abstraction (PolicyEvaluator)
 * to prevent policy spaghetti in business logic.
 *
 * Key Design Rules:
 * - ContractMultisigEngine calls PolicyEvaluator
 * - PolicyEvaluator calls individual policies
 * - No policy logic in engine
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Coin } from "@cosmjs/amino";
import { EncodeObject } from "@cosmjs/proto-signing";

import { MsgTypeUrl } from "@/types/txMsg";
import { CredentialRole } from "@/lib/credentials/types";
import { Proposal } from "@/lib/multisig/types";

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Types of policies that can be applied to a multisig
 * Priority order (per Phase 4 requirements):
 * 1. timelock - Risk containment window
 * 2. emergency - Kill switch
 * 3. msg_type - Attack surface control
 * 4. spend_limit - Value controls (only safe after timelock)
 * 5. allowlist/denylist - Recipient filtering (weakest protection)
 */
export type PolicyType =
  | "timelock"
  | "emergency"
  | "msg_type"
  | "spend_limit"
  | "allowlist"
  | "denylist"
  | "custom";

/**
 * Severity levels for policy violations
 */
export type PolicyViolationSeverity = "low" | "medium" | "high" | "critical";

/**
 * Codes for specific policy violation types
 */
export type PolicyViolationCode =
  // Timelock violations
  | "TIMELOCK_NOT_MET"
  | "TIMELOCK_EXPIRED"
  | "QUEUE_REQUIRED"
  // Emergency violations
  | "OPERATIONS_PAUSED"
  | "SAFE_MODE_ACTIVE"
  | "THRESHOLD_ELEVATED"
  // Message type violations
  | "MSG_TYPE_BLOCKED"
  | "MSG_TYPE_NOT_ALLOWED"
  | "MSG_TYPE_REQUIRES_HIGHER_THRESHOLD"
  // Spend limit violations
  | "EXCEEDS_PER_TX_LIMIT"
  | "EXCEEDS_DAILY_LIMIT"
  | "SPEND_WINDOW_EXCEEDED"
  // Address filter violations
  | "RECIPIENT_NOT_IN_ALLOWLIST"
  | "RECIPIENT_IN_DENYLIST"
  // Generic
  | "POLICY_DISABLED"
  | "CUSTOM_POLICY_VIOLATION";

// ============================================================================
// Policy Context - All information available for policy evaluation
// ============================================================================

/**
 * Complete context for policy evaluation
 * This contains all information a policy might need to make a decision
 */
export interface PolicyContext {
  // ========== Credential Context ==========
  /** Roles of the signer(s) from their credential NFTs */
  readonly signerRoles: readonly CredentialRole[];
  /** Map of signer address to credential version */
  readonly credentialVersions: ReadonlyMap<string, number>;
  /** Minimum required credential version (0 = any) */
  readonly minRequiredVersion: number;

  // ========== Spend Context ==========
  /** Total amount spent in current window, by denom */
  readonly spentInWindow: ReadonlyMap<string, Coin>;
  /** Value of the current proposal, by denom */
  readonly proposalValue: readonly Coin[];
  /** Total treasury balance for percentage calculations */
  readonly treasuryBalance: readonly Coin[];

  // ========== Recipient Context ==========
  /** All recipient addresses in the proposal */
  readonly recipientAddresses: readonly string[];

  // ========== Message Context ==========
  /** All message type URLs in the proposal */
  readonly messageTypes: readonly MsgTypeUrl[];
  /** Full message objects for deep inspection */
  readonly messages: readonly EncodeObject[];

  // ========== Timing Context ==========
  /** When the proposal was queued (null if not queued) */
  readonly queuedAt: number | null;
  /** Seconds since the proposal was queued */
  readonly timeSinceQueue: number;
  /** Current block height */
  readonly currentHeight: number;
  /** Current timestamp (Unix seconds) */
  readonly currentTimestamp: number;

  // ========== Emergency Context ==========
  /** Whether operations are currently paused */
  readonly isPaused: boolean;
  /** Whether safe mode is active */
  readonly isSafeMode: boolean;
  /** Elevated threshold if safe mode is active */
  readonly elevatedThreshold: number | null;
  /** Normal threshold for comparison */
  readonly normalThreshold: number;

  // ========== Multisig Context ==========
  /** Multisig contract/account address */
  readonly multisigAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Current policy version */
  readonly policyVersion: number;
}

// ============================================================================
// Policy Decision Types
// ============================================================================

/**
 * A single policy violation with details
 */
export interface PolicyViolation {
  /** ID of the policy that was violated */
  readonly policyId: string;
  /** Type of policy that was violated */
  readonly policyType: PolicyType;
  /** Specific violation code */
  readonly code: PolicyViolationCode;
  /** Human-readable description */
  readonly message: string;
  /** Severity of this violation */
  readonly severity: PolicyViolationSeverity;
  /** Additional details for debugging/UI */
  readonly details?: Record<string, unknown>;
}

/**
 * Result of evaluating a policy or set of policies
 */
export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly violations: readonly PolicyViolation[] };

/**
 * Combined result from evaluating all policies
 */
export interface PolicyEvaluationResult {
  /** Whether the action is allowed */
  readonly allowed: boolean;
  /** All violations if not allowed */
  readonly violations: readonly PolicyViolation[];
  /** Policies that were evaluated */
  readonly evaluatedPolicies: readonly string[];
  /** Timestamp of evaluation */
  readonly evaluatedAt: string;
  /** Warnings (allowed but flagged) */
  readonly warnings: readonly PolicyViolation[];
}

// ============================================================================
// Policy Interface - Base for all policy implementations
// ============================================================================

/**
 * Base interface for all policy implementations
 */
export interface Policy {
  /** Unique identifier for this policy instance */
  readonly id: string;
  /** Type of policy */
  readonly type: PolicyType;
  /** Human-readable name */
  readonly name: string;
  /** Whether this policy is currently enabled */
  readonly enabled: boolean;
  /** Priority (lower = evaluated first) */
  readonly priority: number;

  /**
   * Evaluate this policy for a proposal creation
   * @param proposal The proposal being created
   * @param context Full context for evaluation
   * @returns Decision allowing or denying the action
   */
  evaluateProposal(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision>;

  /**
   * Evaluate this policy for proposal execution
   * @param proposal The proposal being executed
   * @param context Full context for evaluation
   * @returns Decision allowing or denying the action
   */
  evaluateExecution(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision>;
}

// ============================================================================
// Policy Evaluator - Central evaluation orchestrator
// ============================================================================

/**
 * Central policy evaluation interface
 *
 * ALL policy logic flows through this interface.
 * ContractMultisigEngine calls PolicyEvaluator.
 * PolicyEvaluator calls individual policies.
 * No policy logic in engine.
 */
export interface PolicyEvaluator {
  /**
   * Evaluate all policies for proposal creation
   * @param proposal The proposal being created
   * @param context Full context for evaluation
   * @returns Combined result from all policies
   */
  evaluateProposal(proposal: Proposal, context: PolicyContext): Promise<PolicyEvaluationResult>;

  /**
   * Evaluate all policies for proposal execution
   * @param proposal The proposal being executed
   * @param context Full context for evaluation
   * @returns Combined result from all policies
   */
  evaluateExecution(proposal: Proposal, context: PolicyContext): Promise<PolicyEvaluationResult>;

  /**
   * Pre-validate a proposal before creation (UI optimization)
   * @param proposalInput The input for the proposal
   * @param context Partial context (some fields may be estimated)
   * @returns Quick validation result
   */
  preValidate(
    proposalInput: {
      msgs: readonly EncodeObject[];
      recipientAddresses: readonly string[];
      proposalValue: readonly Coin[];
    },
    context: Partial<PolicyContext>,
  ): Promise<PolicyEvaluationResult>;
}

// ============================================================================
// Policy Configuration Types
// ============================================================================

/**
 * Configuration for timelock policy
 */
export interface TimelockPolicyConfig {
  /** Minimum delay in seconds before execution */
  readonly minDelaySeconds: number;
  /** Maximum delay in seconds (proposal expires after) */
  readonly maxDelaySeconds: number;
  /** Multiplier for high-value transactions (e.g., 2.0 = 2x delay) */
  readonly highValueMultiplier: number;
  /** Threshold for "high value" as percentage of treasury (0-100) */
  readonly highValueThresholdPercent: number;
  /** Specific delays per message type (overrides default) */
  readonly perMsgTypeDelays?: ReadonlyMap<MsgTypeUrl, number>;
}

/**
 * Configuration for spend limit policy
 */
export interface SpendLimitPolicyConfig {
  /** Maximum per-transaction limit by denom */
  readonly perTxLimits: readonly Coin[];
  /** Maximum daily spend by denom */
  readonly dailyLimits: readonly Coin[];
  /** Rolling window in seconds (default 86400 = 24h) */
  readonly windowSeconds: number;
  /** Exempt message types (e.g., staking might be exempt) */
  readonly exemptMsgTypes?: readonly MsgTypeUrl[];
}

/**
 * Configuration for message type restriction policy
 */
export interface MsgTypePolicyConfig {
  /** If non-empty, only these message types are allowed */
  readonly allowedMsgTypes: readonly MsgTypeUrl[];
  /** These message types are always blocked (takes precedence) */
  readonly blockedMsgTypes: readonly MsgTypeUrl[];
  /** Message types that require higher threshold */
  readonly requiresHigherThreshold: ReadonlyMap<MsgTypeUrl, number>;
}

/**
 * Configuration for address filter policy
 */
export interface AddressFilterPolicyConfig {
  /** Filter type */
  readonly filterType: "allowlist" | "denylist" | "both";
  /** Addresses in the allowlist */
  readonly allowlist: readonly string[];
  /** Addresses in the denylist */
  readonly denylist: readonly string[];
}

/**
 * Union of all policy configs
 */
export type PolicyConfig =
  | { readonly type: "timelock"; readonly config: TimelockPolicyConfig }
  | { readonly type: "spend_limit"; readonly config: SpendLimitPolicyConfig }
  | { readonly type: "msg_type"; readonly config: MsgTypePolicyConfig }
  | { readonly type: "allowlist"; readonly config: AddressFilterPolicyConfig }
  | { readonly type: "denylist"; readonly config: AddressFilterPolicyConfig }
  | { readonly type: "emergency"; readonly config: EmergencyPolicyConfig }
  | { readonly type: "custom"; readonly config: Record<string, unknown> };

/**
 * Configuration for emergency policy
 */
export interface EmergencyPolicyConfig {
  /** Whether pause is currently active */
  readonly isPaused: boolean;
  /** Whether safe mode is active */
  readonly isSafeMode: boolean;
  /** Elevated threshold when in safe mode */
  readonly safeModeThreshold: number;
  /** Auto-unpause after this many seconds (null = manual only) */
  readonly autoUnpauseAfterSeconds: number | null;
}

// ============================================================================
// Stored Policy Types (for database)
// ============================================================================

/**
 * Serializable policy for database storage
 */
export interface StoredPolicy {
  readonly id: string;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly type: PolicyType;
  readonly name: string;
  readonly configJSON: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Serializable policy violation for database storage
 */
export interface StoredPolicyViolation {
  readonly id: string;
  readonly multisigAddress: string;
  readonly proposalId: string;
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly violationCode: PolicyViolationCode;
  readonly severity: PolicyViolationSeverity;
  readonly message: string;
  readonly detailsJSON: string;
  readonly timestamp: string;
}

// ============================================================================
// Policy Error Types
// ============================================================================

/**
 * Error codes specific to policy operations
 */
export type PolicyErrorCode =
  | "POLICY_NOT_FOUND"
  | "POLICY_ALREADY_EXISTS"
  | "INVALID_POLICY_CONFIG"
  | "POLICY_EVALUATION_FAILED"
  | "CONTEXT_INCOMPLETE"
  | "POLICY_DISABLED";

/**
 * Error thrown by policy operations
 */
export class PolicyError extends Error {
  constructor(
    message: string,
    public readonly code: PolicyErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

// ============================================================================
// Policy Event Types (for guaranteed event emission)
// ============================================================================

/**
 * Events that MUST be emitted for policy operations
 * Per Phase 4 Event Emission Guarantees
 */
export type PolicyEventType =
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "POLICY_DELETED"
  | "POLICY_ENABLED"
  | "POLICY_DISABLED"
  | "POLICY_VIOLATION";

/**
 * Policy event with guaranteed attributes
 */
export interface PolicyEvent {
  readonly type: PolicyEventType;
  readonly policyId: string;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly details: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an allowed policy decision
 */
export function allowed(): PolicyDecision {
  return { allowed: true };
}

/**
 * Create a denied policy decision with violations
 */
export function denied(violations: PolicyViolation[]): PolicyDecision {
  return { allowed: false, violations };
}

/**
 * Create a single policy violation
 */
export function createViolation(
  policyId: string,
  policyType: PolicyType,
  code: PolicyViolationCode,
  message: string,
  severity: PolicyViolationSeverity,
  details?: Record<string, unknown>,
): PolicyViolation {
  return {
    policyId,
    policyType,
    code,
    message,
    severity,
    details,
  };
}

/**
 * Merge multiple policy decisions into one
 */
export function mergeDecisions(decisions: PolicyDecision[]): PolicyDecision {
  const violations: PolicyViolation[] = [];

  for (const decision of decisions) {
    if (!decision.allowed) {
      violations.push(...decision.violations);
    }
  }

  if (violations.length > 0) {
    return { allowed: false, violations };
  }

  return { allowed: true };
}

/**
 * Check if a decision is allowed
 */
export function isAllowed(decision: PolicyDecision): decision is { allowed: true } {
  return decision.allowed;
}

/**
 * Get the highest severity from a list of violations
 */
export function getHighestSeverity(
  violations: readonly PolicyViolation[],
): PolicyViolationSeverity | null {
  if (violations.length === 0) return null;

  const severityOrder: PolicyViolationSeverity[] = ["low", "medium", "high", "critical"];
  let highest = 0;

  for (const violation of violations) {
    const index = severityOrder.indexOf(violation.severity);
    if (index > highest) {
      highest = index;
    }
  }

  return severityOrder[highest];
}
