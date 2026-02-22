/**
 * Spend Tracker - Historical Spending Aggregation
 * 
 * File: lib/policies/spend-tracker.ts
 * 
 * Tracks historical spending for spend limit enforcement.
 * Aggregates spending within rolling windows.
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Coin } from "@cosmjs/amino";

import * as localDb from "@/lib/localDb";

// ============================================================================
// Spend Tracker Types
// ============================================================================

export interface SpendRecord {
  readonly proposalId: string;
  readonly denom: string;
  readonly amount: string;
  readonly recipientAddress: string;
  readonly executedAt: number;
  readonly height: number;
}

export interface SpendSummary {
  readonly denom: string;
  readonly totalSpent: string;
  readonly transactionCount: number;
  readonly windowStart: number;
  readonly windowEnd: number;
}

// ============================================================================
// Spend Tracker Implementation
// ============================================================================

export class SpendTracker {
  private readonly defaultWindowSeconds: number;

  constructor(defaultWindowSeconds: number = 86400) {
    this.defaultWindowSeconds = defaultWindowSeconds;
  }

  // ============================================================================
  // Recording
  // ============================================================================

  /**
   * Record a spend after proposal execution
   */
  recordSpend(
    multisigAddress: string,
    chainId: string,
    proposalId: string,
    amounts: Coin[],
    recipientAddresses: string[],
    height: number,
  ): void {
    const executedAt = new Date().toISOString();

    for (let i = 0; i < amounts.length; i++) {
      const coin = amounts[i];
      const recipient = recipientAddresses[i] || recipientAddresses[0] || "unknown";

      localDb.recordSpend({
        multisigAddress,
        chainId,
        proposalId,
        denom: coin.denom,
        amount: coin.amount,
        recipientAddress: recipient,
        executedAt,
        height,
      });
    }
  }

  // ============================================================================
  // Querying
  // ============================================================================

  /**
   * Get total spent in a time window
   */
  getTotalSpentInWindow(
    multisigAddress: string,
    chainId: string,
    windowSeconds?: number,
  ): Map<string, Coin> {
    const window = windowSeconds ?? this.defaultWindowSeconds;
    const windowStart = new Date(Date.now() - window * 1000).toISOString();

    const totals = localDb.getTotalSpentInWindow(
      multisigAddress,
      chainId,
      windowStart,
    );

    const result = new Map<string, Coin>();
    for (const [denom, amount] of totals) {
      result.set(denom, { denom, amount: amount.toString() });
    }

    return result;
  }

  /**
   * Get spending summary for each denom
   */
  getSpendingSummary(
    multisigAddress: string,
    chainId: string,
    windowSeconds?: number,
  ): SpendSummary[] {
    const window = windowSeconds ?? this.defaultWindowSeconds;
    const windowStart = new Date(Date.now() - window * 1000).toISOString();
    const windowEnd = new Date().toISOString();

    const records = localDb.getSpendRecordsInWindow(
      multisigAddress,
      chainId,
      windowStart,
    );

    // Aggregate by denom
    const summaryMap = new Map<string, { total: bigint; count: number }>();

    for (const record of records) {
      const existing = summaryMap.get(record.denom) ?? { total: BigInt(0), count: 0 };
      summaryMap.set(record.denom, {
        total: existing.total + BigInt(record.amount),
        count: existing.count + 1,
      });
    }

    return Array.from(summaryMap.entries()).map(([denom, data]) => ({
      denom,
      totalSpent: data.total.toString(),
      transactionCount: data.count,
      windowStart: new Date(windowStart).getTime() / 1000,
      windowEnd: new Date(windowEnd).getTime() / 1000,
    }));
  }

  /**
   * Get recent spend records
   */
  getRecentSpends(
    multisigAddress: string,
    chainId: string,
    limit: number = 50,
  ): SpendRecord[] {
    // Get last 7 days of records
    const windowStart = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    const records = localDb.getSpendRecordsInWindow(
      multisigAddress,
      chainId,
      windowStart,
    );

    return records
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit)
      .map((r) => ({
        proposalId: r.proposalId,
        denom: r.denom,
        amount: r.amount,
        recipientAddress: r.recipientAddress,
        executedAt: new Date(r.executedAt).getTime() / 1000,
        height: r.height,
      }));
  }

  /**
   * Get spending by recipient
   */
  getSpendingByRecipient(
    multisigAddress: string,
    chainId: string,
    windowSeconds?: number,
  ): Map<string, Map<string, Coin>> {
    const window = windowSeconds ?? this.defaultWindowSeconds;
    const windowStart = new Date(Date.now() - window * 1000).toISOString();

    const records = localDb.getSpendRecordsInWindow(
      multisigAddress,
      chainId,
      windowStart,
    );

    const result = new Map<string, Map<string, bigint>>();

    for (const record of records) {
      let recipientMap = result.get(record.recipientAddress);
      if (!recipientMap) {
        recipientMap = new Map();
        result.set(record.recipientAddress, recipientMap);
      }

      const current = recipientMap.get(record.denom) ?? BigInt(0);
      recipientMap.set(record.denom, current + BigInt(record.amount));
    }

    // Convert to Coin format
    const coinResult = new Map<string, Map<string, Coin>>();
    for (const [recipient, denoms] of result) {
      const denomMap = new Map<string, Coin>();
      for (const [denom, amount] of denoms) {
        denomMap.set(denom, { denom, amount: amount.toString() });
      }
      coinResult.set(recipient, denomMap);
    }

    return coinResult;
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Calculate spending velocity (rate of change)
   */
  calculateSpendingVelocity(
    multisigAddress: string,
    chainId: string,
    denom: string,
  ): { hourly: string; daily: string } {
    const hourlyWindow = 3600;
    const dailyWindow = 86400;

    const hourlyTotals = this.getTotalSpentInWindow(multisigAddress, chainId, hourlyWindow);
    const dailyTotals = this.getTotalSpentInWindow(multisigAddress, chainId, dailyWindow);

    const hourlySpent = hourlyTotals.get(denom)?.amount ?? "0";
    const dailySpent = dailyTotals.get(denom)?.amount ?? "0";

    return {
      hourly: hourlySpent,
      daily: dailySpent,
    };
  }

  /**
   * Check if spending is anomalous (significantly higher than average)
   */
  isSpendingAnomalous(
    multisigAddress: string,
    chainId: string,
    denom: string,
    proposedAmount: string,
    threshold: number = 3, // 3x average is anomalous
  ): { isAnomalous: boolean; averageDaily: string; proposed: string } {
    // Get last 7 days of data
    const weekWindow = 7 * 86400;
    const totals = this.getTotalSpentInWindow(multisigAddress, chainId, weekWindow);
    
    const weeklyTotal = BigInt(totals.get(denom)?.amount ?? "0");
    const averageDaily = weeklyTotal / BigInt(7);
    const proposed = BigInt(proposedAmount);

    const isAnomalous = proposed > averageDaily * BigInt(threshold);

    return {
      isAnomalous,
      averageDaily: averageDaily.toString(),
      proposed: proposedAmount,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get default window in seconds
   */
  getDefaultWindow(): number {
    return this.defaultWindowSeconds;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a spend tracker
 */
export function createSpendTracker(
  defaultWindowSeconds?: number,
): SpendTracker {
  return new SpendTracker(defaultWindowSeconds);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalSpendTracker: SpendTracker | null = null;

/**
 * Get the global spend tracker
 */
export function getSpendTracker(): SpendTracker {
  if (!globalSpendTracker) {
    globalSpendTracker = new SpendTracker();
  }
  return globalSpendTracker;
}

/**
 * Set the global spend tracker
 */
export function setSpendTracker(tracker: SpendTracker): void {
  globalSpendTracker = tracker;
}

