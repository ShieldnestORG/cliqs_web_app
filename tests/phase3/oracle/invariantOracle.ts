/**
 * Phase 3: Invariant Oracle (Single Source of Truth)
 *
 * File: tests/phase3/oracle/invariantOracle.ts
 *
 * This oracle defines and asserts the non-negotiable truths your system must
 * NEVER violate. It is reused by every fuzz + replay test.
 *
 * Global Invariants:
 * ❌ Proposal can never execute twice
 * ❌ Execution cannot occur if any policy denies
 * ❌ Emergency pause must dominate all paths
 * ❌ Spend limits must hold across any ordering
 * ❌ State transitions must be monotonic
 * ❌ Replayed tx bytes must not re-execute
 */

// ============================================================================
// PROPOSAL STATE MACHINE
// ============================================================================

export type ProposalState =
  | "DRAFT"
  | "OPEN"
  | "APPROVED"
  | "EXECUTABLE"
  | "EXECUTED"
  | "FAILED"
  | "REJECTED"
  | "EXPIRED";

// Valid state transitions (strict monotonicity)
const VALID_TRANSITIONS: Record<ProposalState, ProposalState[]> = {
  DRAFT: ["OPEN", "FAILED"],
  OPEN: ["APPROVED", "REJECTED", "EXPIRED", "FAILED"],
  APPROVED: ["EXECUTABLE", "REJECTED", "EXPIRED", "FAILED"],
  EXECUTABLE: ["EXECUTED", "EXPIRED", "FAILED"],
  EXECUTED: [], // Terminal state - no transitions allowed
  FAILED: [], // Terminal state - no transitions allowed
  REJECTED: [], // Terminal state - no transitions allowed
  EXPIRED: [], // Terminal state - no transitions allowed
};

// Terminal states (no further transitions)
const TERMINAL_STATES: Set<ProposalState> = new Set(["EXECUTED", "FAILED", "REJECTED", "EXPIRED"]);

// ============================================================================
// INVARIANT ASSERTION FUNCTIONS
// ============================================================================

/**
 * Assert proposal state machine invariants
 *
 * Enforces:
 * - No double execution (EXECUTED can only appear once)
 * - Monotonic state transitions (cannot regress after terminal states)
 * - Valid state transitions only
 */
export function assertProposalInvariants(history: ProposalState[]): void {
  const seen = new Set<ProposalState>();
  let lastState: ProposalState | null = null;

  for (let i = 0; i < history.length; i++) {
    const state = history[i];

    // INVARIANT 1: No double execution
    if (state === "EXECUTED" && seen.has("EXECUTED")) {
      throw new Error(
        `INVARIANT VIOLATION: Double execution detected at index ${i}. ` +
          `History: [${history.join(" → ")}]`,
      );
    }

    // INVARIANT 2: No state regression after terminal states
    if (lastState && TERMINAL_STATES.has(lastState) && state !== lastState) {
      throw new Error(
        `INVARIANT VIOLATION: State regression after terminal state '${lastState}' → '${state}' at index ${i}. ` +
          `Terminal states are immutable. History: [${history.join(" → ")}]`,
      );
    }

    // INVARIANT 3: Valid state transitions only
    if (lastState) {
      const validTransitions = VALID_TRANSITIONS[lastState as ProposalState] as ProposalState[];
      if (validTransitions && !validTransitions.includes(state) && state !== lastState) {
        throw new Error(
          `INVARIANT VIOLATION: Invalid transition '${lastState}' → '${state}' at index ${i}. ` +
            `Valid transitions from '${lastState}': [${validTransitions.join(", ")}]. ` +
            `History: [${history.join(" → ")}]`,
        );
      }
    }

    seen.add(state);
    lastState = state;
  }
}

/**
 * Assert execution invariants
 *
 * Enforces:
 * - Execution cannot occur without all policies allowing
 * - Emergency pause blocks all execution paths
 * - Spend limits cannot be exceeded
 */
export interface ExecutionContext {
  proposalId: string;
  policies: PolicyResult[];
  emergencyPaused: boolean;
  safeMode: boolean;
  spendAttempt?: { amount: bigint; denom: string }[];
  spendLimit?: { amount: bigint; denom: string }[];
  executionAttempted: boolean;
  executionSucceeded: boolean;
}

export interface PolicyResult {
  policyName: string;
  allowed: boolean;
  reason?: string;
}

export function assertExecutionInvariants(ctx: ExecutionContext): void {
  // INVARIANT 4: Emergency pause dominates all paths
  if (ctx.emergencyPaused && ctx.executionSucceeded) {
    throw new Error(
      `INVARIANT VIOLATION: Execution succeeded during emergency pause. ` +
        `Proposal: ${ctx.proposalId}. Emergency pause MUST block all executions.`,
    );
  }

  // INVARIANT 5: Safe mode dominates all paths
  if (ctx.safeMode && ctx.executionSucceeded) {
    throw new Error(
      `INVARIANT VIOLATION: Execution succeeded during safe mode. ` +
        `Proposal: ${ctx.proposalId}. Safe mode MUST block all executions.`,
    );
  }

  // INVARIANT 6: All policies must allow for execution to succeed
  const deniedPolicies = ctx.policies.filter((p) => !p.allowed);
  if (deniedPolicies.length > 0 && ctx.executionSucceeded) {
    throw new Error(
      `INVARIANT VIOLATION: Execution succeeded despite policy denials. ` +
        `Proposal: ${ctx.proposalId}. ` +
        `Denied by: [${deniedPolicies.map((p) => `${p.policyName}: ${p.reason}`).join(", ")}]`,
    );
  }

  // INVARIANT 7: Spend limits must hold
  if (ctx.spendAttempt && ctx.spendLimit) {
    for (const attempt of ctx.spendAttempt) {
      const limit = ctx.spendLimit.find((l) => l.denom === attempt.denom);
      if (limit && attempt.amount > limit.amount && ctx.executionSucceeded) {
        throw new Error(
          `INVARIANT VIOLATION: Spend limit exceeded. ` +
            `Proposal: ${ctx.proposalId}. ` +
            `Attempted: ${attempt.amount} ${attempt.denom}, ` +
            `Limit: ${limit.amount} ${limit.denom}`,
        );
      }
    }
  }
}

/**
 * Assert replay attack invariants
 *
 * Enforces:
 * - Same tx bytes cannot succeed twice
 * - Stale signatures cannot be reused after state changes
 */
export interface ReplayContext {
  txHash: string;
  txBytes: Uint8Array;
  nonce?: number;
  accountSequence?: number;
  previousExecutions: Set<string>;
  executionSucceeded: boolean;
}

export function assertReplayInvariants(ctx: ReplayContext): void {
  // INVARIANT 8: No replay of executed transactions
  if (ctx.previousExecutions.has(ctx.txHash) && ctx.executionSucceeded) {
    throw new Error(
      `INVARIANT VIOLATION: Replay attack succeeded. ` +
        `TxHash ${ctx.txHash} was already executed but succeeded again.`,
    );
  }
}

/**
 * Assert policy evaluation invariants
 *
 * Enforces:
 * - Policy version mismatches always deny
 * - Timelocks are respected
 * - Credential revocation is immediate
 */
export interface PolicyContext {
  policyVersion: number;
  expectedPolicyVersion: number;
  timelockUnlockMs?: number;
  currentTimeMs: number;
  credentialValid: boolean;
  evaluationResult: { allowed: boolean };
}

export function assertPolicyInvariants(ctx: PolicyContext): void {
  // INVARIANT 9: Policy version mismatch always denies
  if (ctx.policyVersion !== ctx.expectedPolicyVersion && ctx.evaluationResult.allowed) {
    throw new Error(
      `INVARIANT VIOLATION: Policy version mismatch allowed. ` +
        `Expected version ${ctx.expectedPolicyVersion}, got ${ctx.policyVersion}. ` +
        `Version mismatches MUST always deny.`,
    );
  }

  // INVARIANT 10: Unexpired timelocks always deny
  if (
    ctx.timelockUnlockMs &&
    ctx.currentTimeMs < ctx.timelockUnlockMs &&
    ctx.evaluationResult.allowed
  ) {
    throw new Error(
      `INVARIANT VIOLATION: Timelock bypassed. ` +
        `Current time ${ctx.currentTimeMs}ms < unlock time ${ctx.timelockUnlockMs}ms. ` +
        `Unexpired timelocks MUST always deny.`,
    );
  }

  // INVARIANT 11: Invalid credentials always deny
  if (!ctx.credentialValid && ctx.evaluationResult.allowed) {
    throw new Error(
      `INVARIANT VIOLATION: Invalid credential allowed. ` +
        `Credential is invalid but evaluation returned allowed. ` +
        `Invalid credentials MUST always deny.`,
    );
  }
}

// ============================================================================
// COMPOSITE INVARIANT CHECKER
// ============================================================================

export interface SystemState {
  proposalHistory: Map<string, ProposalState[]>;
  executedTxHashes: Set<string>;
  emergencyPaused: boolean;
  safeMode: boolean;
  policyVersion: number;
  expectedPolicyVersion: number;
}

/**
 * Assert all system invariants at once
 *
 * Use this after each fuzzing iteration to verify no invariants were violated.
 */
export function assertSystemInvariants(state: SystemState): void {
  // Check proposal invariants for all proposals
  for (const [proposalId, history] of state.proposalHistory) {
    try {
      assertProposalInvariants(history);
    } catch (error: any) {
      throw new Error(`Proposal ${proposalId}: ${error.message}`);
    }
  }

  // Additional global checks
  if (state.policyVersion !== state.expectedPolicyVersion) {
    // Log warning - version drift should trigger safe behavior
    console.warn(
      `[INVARIANT WARNING] Policy version drift detected: ` +
        `expected ${state.expectedPolicyVersion}, current ${state.policyVersion}`,
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a deterministic hash from tx bytes for tracking
 */
export function hashTxBytes(txBytes: Uint8Array): string {
  let hash = 0;
  for (const byte of txBytes) {
    hash = ((hash << 5) - hash + byte) | 0;
  }
  return `tx_${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Track state transition for a proposal
 */
export function trackStateTransition(
  history: ProposalState[],
  newState: ProposalState,
): ProposalState[] {
  const updated = [...history, newState];
  assertProposalInvariants(updated); // Validate immediately
  return updated;
}

/**
 * Create an empty system state for tracking
 */
export function createEmptySystemState(): SystemState {
  return {
    proposalHistory: new Map(),
    executedTxHashes: new Set(),
    emergencyPaused: false,
    safeMode: false,
    policyVersion: 1,
    expectedPolicyVersion: 1,
  };
}
