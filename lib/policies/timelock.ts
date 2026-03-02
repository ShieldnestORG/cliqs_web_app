/**
 * Timelock Policy Implementation
 *
 * File: lib/policies/timelock.ts
 *
 * Priority 1 policy - Risk containment window.
 * All other policies need reaction time, so timelock must come first.
 *
 * This policy enforces:
 * - Minimum delay between proposal approval and execution
 * - Maximum delay (proposals expire)
 * - High-value multiplier for extra protection
 * - Per-message-type delays
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Coin } from "@cosmjs/amino";

import { Proposal } from "@/lib/multisig/types";
import { MsgTypeUrl } from "@/types/txMsg";
import {
  Policy,
  PolicyContext,
  PolicyDecision,
  TimelockPolicyConfig,
  StoredPolicy,
  allowed,
  denied,
  createViolation,
} from "./types";

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TimelockPolicyConfig = {
  minDelaySeconds: 3600, // 1 hour default
  maxDelaySeconds: 604800, // 7 days default
  highValueMultiplier: 2.0,
  highValueThresholdPercent: 10, // 10% of treasury
  perMsgTypeDelays: undefined,
};

// ============================================================================
// Timelock Policy Implementation
// ============================================================================

export class TimelockPolicy implements Policy {
  readonly id: string;
  readonly type = "timelock" as const;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;

  private readonly config: TimelockPolicyConfig;

  constructor(
    id: string,
    name: string,
    config: Partial<TimelockPolicyConfig> = {},
    options: { enabled?: boolean; priority?: number } = {},
  ) {
    this.id = id;
    this.name = name;
    this.enabled = options.enabled ?? true;
    this.priority = options.priority ?? 10; // Timelock is high priority
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate for proposal creation
   * At creation time, we just check if timelock policy is enabled
   * The actual delay enforcement happens at execution
   */
  async evaluateProposal(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    // Proposal creation is always allowed by timelock policy
    // The actual enforcement happens at execution time
    // We might add warnings for high-value proposals here

    const isHighValue = this.isHighValue(context.proposalValue, context.treasuryBalance);

    if (isHighValue) {
      // Could add a warning here, but we allow the proposal
      // The high-value multiplier will be applied at execution
    }

    return allowed();
  }

  /**
   * Evaluate for proposal execution
   * This is where the timelock is actually enforced
   */
  async evaluateExecution(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    // Check if operations are paused (defer to emergency policy)
    if (context.isPaused) {
      return denied([
        createViolation(
          this.id,
          this.type,
          "OPERATIONS_PAUSED",
          "Operations are currently paused",
          "critical",
        ),
      ]);
    }

    // Check if proposal was queued
    if (context.queuedAt === null) {
      return denied([
        createViolation(
          this.id,
          this.type,
          "QUEUE_REQUIRED",
          "Proposal must be queued before execution. 2-step execution is required.",
          "high",
          { requiredDelay: this.getRequiredDelay(proposal, context) },
        ),
      ]);
    }

    // Calculate required delay
    const requiredDelay = this.getRequiredDelay(proposal, context);

    // Check minimum delay
    if (context.timeSinceQueue < requiredDelay) {
      const remainingSeconds = requiredDelay - context.timeSinceQueue;
      return denied([
        createViolation(
          this.id,
          this.type,
          "TIMELOCK_NOT_MET",
          `Proposal must wait ${this.formatDuration(remainingSeconds)} before execution`,
          "high",
          {
            requiredDelay,
            timeSinceQueue: context.timeSinceQueue,
            remainingSeconds,
            queuedAt: context.queuedAt,
            canExecuteAt: context.queuedAt + requiredDelay,
          },
        ),
      ]);
    }

    // Check maximum delay (expiration)
    if (context.timeSinceQueue > this.config.maxDelaySeconds) {
      return denied([
        createViolation(
          this.id,
          this.type,
          "TIMELOCK_EXPIRED",
          `Proposal has expired. Maximum queue time of ${this.formatDuration(this.config.maxDelaySeconds)} exceeded.`,
          "high",
          {
            maxDelay: this.config.maxDelaySeconds,
            timeSinceQueue: context.timeSinceQueue,
            queuedAt: context.queuedAt,
            expiredAt: context.queuedAt + this.config.maxDelaySeconds,
          },
        ),
      ]);
    }

    return allowed();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate the required delay for a proposal
   */
  private getRequiredDelay(proposal: Proposal, context: PolicyContext): number {
    let delay = this.config.minDelaySeconds;

    // Check for message-type-specific delays
    if (this.config.perMsgTypeDelays) {
      for (const msg of proposal.content.msgs) {
        const msgTypeDelay = this.config.perMsgTypeDelays.get(msg.typeUrl as MsgTypeUrl);
        if (msgTypeDelay !== undefined && msgTypeDelay > delay) {
          delay = msgTypeDelay;
        }
      }
    }

    // Apply high-value multiplier
    if (this.isHighValue(context.proposalValue, context.treasuryBalance)) {
      delay = Math.ceil(delay * this.config.highValueMultiplier);
    }

    // Apply safe mode multiplier (if in safe mode, double the delay)
    if (context.isSafeMode) {
      delay = delay * 2;
    }

    // Never exceed max delay
    return Math.min(delay, this.config.maxDelaySeconds);
  }

  /**
   * Check if a proposal is "high value"
   */
  private isHighValue(proposalValue: readonly Coin[], treasuryBalance: readonly Coin[]): boolean {
    if (treasuryBalance.length === 0 || proposalValue.length === 0) {
      return false;
    }

    // Check each denom in the proposal
    for (const proposedCoin of proposalValue) {
      const treasuryCoin = treasuryBalance.find((c) => c.denom === proposedCoin.denom);

      if (!treasuryCoin) {
        // If we're spending a denom that's not in treasury tracking, be conservative
        continue;
      }

      const treasuryAmount = BigInt(treasuryCoin.amount);
      if (treasuryAmount === BigInt(0)) {
        continue;
      }

      const proposedAmount = BigInt(proposedCoin.amount);
      const percentageOfTreasury = Number((proposedAmount * BigInt(100)) / treasuryAmount);

      if (percentageOfTreasury >= this.config.highValueThresholdPercent) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? "" : "s"}`;
    }

    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    }

    const days = Math.floor(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get the current configuration
   */
  getConfig(): TimelockPolicyConfig {
    return { ...this.config };
  }

  /**
   * Get the minimum delay in seconds
   */
  getMinDelaySeconds(): number {
    return this.config.minDelaySeconds;
  }

  /**
   * Get the maximum delay in seconds
   */
  getMaxDelaySeconds(): number {
    return this.config.maxDelaySeconds;
  }

  /**
   * Check if a specific message type has a custom delay
   */
  getMsgTypeDelay(msgType: MsgTypeUrl): number | undefined {
    return this.config.perMsgTypeDelays?.get(msgType);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a timelock policy from stored configuration
 */
export function createTimelockPolicy(stored: StoredPolicy): TimelockPolicy {
  const parsedConfig = JSON.parse(stored.configJSON);

  // Convert perMsgTypeDelays from object to Map if needed
  let perMsgTypeDelays = parsedConfig.perMsgTypeDelays;
  if (perMsgTypeDelays && !(perMsgTypeDelays instanceof Map)) {
    const delays = perMsgTypeDelays as unknown as Record<string, number>;
    perMsgTypeDelays = new Map(Object.entries(delays)) as ReadonlyMap<MsgTypeUrl, number>;
  }

  const config: TimelockPolicyConfig = {
    ...parsedConfig,
    perMsgTypeDelays,
  };

  return new TimelockPolicy(stored.id, stored.name, config, {
    enabled: stored.enabled,
    priority: stored.priority,
  });
}

/**
 * Create a new timelock policy with default configuration
 */
export function createDefaultTimelockPolicy(
  id: string,
  multisigAddress: string,
  options?: {
    minDelaySeconds?: number;
    maxDelaySeconds?: number;
    highValueMultiplier?: number;
    highValueThresholdPercent?: number;
  },
): TimelockPolicy {
  return new TimelockPolicy(id, "Timelock Policy", {
    minDelaySeconds: options?.minDelaySeconds ?? DEFAULT_CONFIG.minDelaySeconds,
    maxDelaySeconds: options?.maxDelaySeconds ?? DEFAULT_CONFIG.maxDelaySeconds,
    highValueMultiplier: options?.highValueMultiplier ?? DEFAULT_CONFIG.highValueMultiplier,
    highValueThresholdPercent:
      options?.highValueThresholdPercent ?? DEFAULT_CONFIG.highValueThresholdPercent,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the execute-after timestamp for a proposal
 */
export function calculateExecuteAfter(
  queuedAt: number,
  policy: TimelockPolicy,
  context: Pick<PolicyContext, "proposalValue" | "treasuryBalance" | "isSafeMode">,
  proposal: Proposal,
): number {
  const config = policy.getConfig();
  let delay = config.minDelaySeconds;

  // Check for message-type-specific delays
  if (config.perMsgTypeDelays) {
    for (const msg of proposal.content.msgs) {
      const msgTypeDelay = config.perMsgTypeDelays.get(msg.typeUrl as MsgTypeUrl);
      if (msgTypeDelay !== undefined && msgTypeDelay > delay) {
        delay = msgTypeDelay;
      }
    }
  }

  // Apply high-value multiplier
  if (
    isHighValueProposal(
      context.proposalValue,
      context.treasuryBalance,
      config.highValueThresholdPercent,
    )
  ) {
    delay = Math.ceil(delay * config.highValueMultiplier);
  }

  // Apply safe mode multiplier
  if (context.isSafeMode) {
    delay = delay * 2;
  }

  return queuedAt + Math.min(delay, config.maxDelaySeconds);
}

/**
 * Check if a proposal value is considered "high value"
 */
export function isHighValueProposal(
  proposalValue: readonly Coin[],
  treasuryBalance: readonly Coin[],
  thresholdPercent: number,
): boolean {
  if (treasuryBalance.length === 0 || proposalValue.length === 0) {
    return false;
  }

  for (const proposedCoin of proposalValue) {
    const treasuryCoin = treasuryBalance.find((c) => c.denom === proposedCoin.denom);

    if (!treasuryCoin) continue;

    const treasuryAmount = BigInt(treasuryCoin.amount);
    if (treasuryAmount === BigInt(0)) continue;

    const proposedAmount = BigInt(proposedCoin.amount);
    const percentageOfTreasury = Number((proposedAmount * BigInt(100)) / treasuryAmount);

    if (percentageOfTreasury >= thresholdPercent) {
      return true;
    }
  }

  return false;
}

/**
 * Format remaining timelock duration
 */
export function formatTimelockRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return "Ready to execute";
  }

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`);

  return parts.join(" ") || "Ready to execute";
}
