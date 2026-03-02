/**
 * Spend Limit Policy
 *
 * File: lib/policies/spend-limit.ts
 *
 * Priority 4 policy - Only safe after timelocks provide reaction window.
 * Enforces per-transaction and daily spending limits.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Coin } from "@cosmjs/amino";

import { Proposal } from "@/lib/multisig/types";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import {
  Policy,
  PolicyContext,
  PolicyDecision,
  PolicyViolation,
  SpendLimitPolicyConfig,
  StoredPolicy,
  allowed,
  denied,
  createViolation,
} from "./types";

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SpendLimitPolicyConfig = {
  perTxLimits: [],
  dailyLimits: [],
  windowSeconds: 86400, // 24 hours
  exemptMsgTypes: [
    // Staking is often exempt from spend limits since it's still within the multisig's control
    MsgTypeUrls.Delegate,
    MsgTypeUrls.BeginRedelegate,
  ],
};

// ============================================================================
// Spend Limit Policy Implementation
// ============================================================================

export class SpendLimitPolicy implements Policy {
  readonly id: string;
  readonly type = "spend_limit" as const;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;

  private readonly config: SpendLimitPolicyConfig;

  constructor(
    id: string,
    name: string,
    config: Partial<SpendLimitPolicyConfig> = {},
    options: { enabled?: boolean; priority?: number } = {},
  ) {
    this.id = id;
    this.name = name;
    this.enabled = options.enabled ?? true;
    this.priority = options.priority ?? 40; // After timelock, emergency, msg-type

    this.config = {
      perTxLimits: config.perTxLimits ?? DEFAULT_CONFIG.perTxLimits,
      dailyLimits: config.dailyLimits ?? DEFAULT_CONFIG.dailyLimits,
      windowSeconds: config.windowSeconds ?? DEFAULT_CONFIG.windowSeconds,
      exemptMsgTypes: config.exemptMsgTypes ?? DEFAULT_CONFIG.exemptMsgTypes,
    };
  }

  /**
   * Evaluate for proposal creation
   */
  async evaluateProposal(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    const violations: PolicyViolation[] = [];

    // Calculate proposal value (excluding exempt message types)
    const proposalValue = this.calculateNonExemptValue(proposal, context);

    // Check per-transaction limits
    for (const limit of this.config.perTxLimits) {
      const spent = proposalValue.find((c) => c.denom === limit.denom);
      if (spent) {
        const spentAmount = BigInt(spent.amount);
        const limitAmount = BigInt(limit.amount);

        if (spentAmount > limitAmount) {
          violations.push(
            createViolation(
              this.id,
              this.type,
              "EXCEEDS_PER_TX_LIMIT",
              `Transaction exceeds per-tx limit for ${limit.denom}: ${this.formatAmount(spent)} > ${this.formatAmount(limit)}`,
              "high",
              {
                denom: limit.denom,
                proposedAmount: spent.amount,
                limit: limit.amount,
              },
            ),
          );
        }
      }
    }

    // Check daily limits (including already spent in window)
    for (const limit of this.config.dailyLimits) {
      const alreadySpent = context.spentInWindow.get(limit.denom);
      const proposalSpend = proposalValue.find((c) => c.denom === limit.denom);

      if (proposalSpend) {
        const alreadySpentAmount = alreadySpent ? BigInt(alreadySpent.amount) : BigInt(0);
        const proposalAmount = BigInt(proposalSpend.amount);
        const totalWouldSpend = alreadySpentAmount + proposalAmount;
        const limitAmount = BigInt(limit.amount);

        if (totalWouldSpend > limitAmount) {
          const remaining = limitAmount - alreadySpentAmount;
          violations.push(
            createViolation(
              this.id,
              this.type,
              "EXCEEDS_DAILY_LIMIT",
              `Transaction would exceed daily limit for ${limit.denom}: already spent ${this.formatCoin(alreadySpent)} + ${this.formatAmount(proposalSpend)} > ${this.formatAmount(limit)}`,
              "high",
              {
                denom: limit.denom,
                alreadySpent: alreadySpent?.amount ?? "0",
                proposedAmount: proposalSpend.amount,
                dailyLimit: limit.amount,
                remainingLimit: remaining > BigInt(0) ? remaining.toString() : "0",
              },
            ),
          );
        }
      }
    }

    if (violations.length > 0) {
      return denied(violations);
    }

    return allowed();
  }

  /**
   * Evaluate for proposal execution
   */
  async evaluateExecution(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    // Re-evaluate at execution time with current spending totals
    return this.evaluateProposal(proposal, context);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate the value of non-exempt message types
   */
  private calculateNonExemptValue(proposal: Proposal, _context: PolicyContext): Coin[] {
    const valueMap = new Map<string, bigint>();

    for (const msg of proposal.content.msgs) {
      const msgType = msg.typeUrl as MsgTypeUrl;

      // Skip exempt message types
      if (this.config.exemptMsgTypes?.includes(msgType)) {
        continue;
      }

      const amounts = this.extractValueFromMsg(msg);
      for (const coin of amounts) {
        const current = valueMap.get(coin.denom) ?? BigInt(0);
        valueMap.set(coin.denom, current + BigInt(coin.amount));
      }
    }

    return Array.from(valueMap.entries()).map(([denom, amount]) => ({
      denom,
      amount: amount.toString(),
    }));
  }

  /**
   * Extract value from a message
   */
  private extractValueFromMsg(msg: { typeUrl: string; value: unknown }): Coin[] {
    const value = msg.value as Record<string, unknown>;

    switch (msg.typeUrl) {
      case MsgTypeUrls.Send: {
        const amount = value.amount as Coin[] | undefined;
        return amount ?? [];
      }
      case MsgTypeUrls.Transfer: {
        const token = value.token as Coin | undefined;
        return token ? [token] : [];
      }
      case MsgTypeUrls.Delegate:
      case MsgTypeUrls.Undelegate: {
        const amount = value.amount as Coin | undefined;
        return amount ? [amount] : [];
      }
      case MsgTypeUrls.ExecuteContract: {
        const funds = value.funds as Coin[] | undefined;
        return funds ?? [];
      }
      case MsgTypeUrls.InstantiateContract:
      case MsgTypeUrls.InstantiateContract2: {
        const funds = value.funds as Coin[] | undefined;
        return funds ?? [];
      }
      default:
        return [];
    }
  }

  /**
   * Format a coin for display
   */
  private formatAmount(coin: Coin): string {
    return `${coin.amount} ${coin.denom}`;
  }

  /**
   * Format a coin that might be undefined
   */
  private formatCoin(coin: Coin | undefined): string {
    if (!coin) return "0";
    return `${coin.amount} ${coin.denom}`;
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get the current configuration
   */
  getConfig(): SpendLimitPolicyConfig {
    return {
      perTxLimits: [...this.config.perTxLimits],
      dailyLimits: [...this.config.dailyLimits],
      windowSeconds: this.config.windowSeconds,
      exemptMsgTypes: this.config.exemptMsgTypes ? [...this.config.exemptMsgTypes] : undefined,
    };
  }

  /**
   * Get per-transaction limit for a denom
   */
  getPerTxLimit(denom: string): Coin | undefined {
    return this.config.perTxLimits.find((c) => c.denom === denom);
  }

  /**
   * Get daily limit for a denom
   */
  getDailyLimit(denom: string): Coin | undefined {
    return this.config.dailyLimits.find((c) => c.denom === denom);
  }

  /**
   * Get the window duration in seconds
   */
  getWindowSeconds(): number {
    return this.config.windowSeconds;
  }

  /**
   * Check if a message type is exempt from spend limits
   */
  isExempt(msgType: MsgTypeUrl): boolean {
    return this.config.exemptMsgTypes?.includes(msgType) ?? false;
  }

  /**
   * Calculate remaining daily limit for a denom
   */
  calculateRemainingLimit(denom: string, spentInWindow: Map<string, Coin>): Coin | null {
    const limit = this.getDailyLimit(denom);
    if (!limit) return null;

    const spent = spentInWindow.get(denom);
    const spentAmount = spent ? BigInt(spent.amount) : BigInt(0);
    const limitAmount = BigInt(limit.amount);
    const remaining = limitAmount - spentAmount;

    return {
      denom,
      amount: remaining > BigInt(0) ? remaining.toString() : "0",
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a spend limit policy from stored configuration
 */
export function createSpendLimitPolicy(stored: StoredPolicy): SpendLimitPolicy {
  const config: SpendLimitPolicyConfig = JSON.parse(stored.configJSON);

  return new SpendLimitPolicy(stored.id, stored.name, config, {
    enabled: stored.enabled,
    priority: stored.priority,
  });
}

/**
 * Create a basic spend limit policy
 */
export function createBasicSpendLimitPolicy(
  id: string,
  perTxLimit: Coin,
  dailyLimit: Coin,
): SpendLimitPolicy {
  return new SpendLimitPolicy(id, "Basic Spend Limits", {
    perTxLimits: [perTxLimit],
    dailyLimits: [dailyLimit],
    windowSeconds: 86400,
  });
}

/**
 * Create a multi-denom spend limit policy
 */
export function createMultiDenomSpendLimitPolicy(
  id: string,
  limits: { denom: string; perTx: string; daily: string }[],
): SpendLimitPolicy {
  return new SpendLimitPolicy(id, "Multi-Denom Spend Limits", {
    perTxLimits: limits.map((l) => ({ denom: l.denom, amount: l.perTx })),
    dailyLimits: limits.map((l) => ({ denom: l.denom, amount: l.daily })),
    windowSeconds: 86400,
  });
}
