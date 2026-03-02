/**
 * Anomaly Detector - Rule-Based Anomaly Detection
 *
 * File: lib/monitoring/anomaly-detector.ts
 *
 * Detects suspicious patterns and triggers alerts.
 * Supports configurable rules and thresholds.
 *
 * Detection patterns:
 * - Sudden membership churn
 * - Repeated failed executions
 * - Suspicious proposal frequency
 * - Unusual spending patterns
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { MultisigEvent, MultisigEventType } from "./event-stream";

// ============================================================================
// Anomaly Types
// ============================================================================

export type AnomalyType =
  | "membership_churn"
  | "repeated_failures"
  | "high_proposal_frequency"
  | "unusual_spending"
  | "credential_revocation_spike"
  | "suspicious_timing"
  | "threshold_manipulation"
  | "custom";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

/**
 * Detected anomaly
 */
export interface Anomaly {
  readonly id: string;
  readonly type: AnomalyType;
  readonly severity: AnomalySeverity;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly message: string;
  readonly detectedAt: number;
  readonly ruleId: string;
  readonly relatedEvents: readonly string[];
  readonly metadata: Record<string, unknown>;
}

// ============================================================================
// Detection Rule Types
// ============================================================================

/**
 * Base detection rule interface
 */
export interface DetectionRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly severity: AnomalySeverity;
  readonly cooldownSeconds: number;

  /**
   * Check if rule applies to an event
   */
  applies(event: MultisigEvent): boolean;

  /**
   * Evaluate the rule against recent events
   */
  evaluate(event: MultisigEvent, recentEvents: readonly MultisigEvent[]): AnomalyResult | null;
}

export type AnomalyResult = {
  readonly type: AnomalyType;
  readonly message: string;
  readonly relatedEvents: readonly string[];
  readonly metadata: Record<string, unknown>;
};

// ============================================================================
// Built-in Detection Rules
// ============================================================================

/**
 * Membership churn detection rule
 * Triggers when membership changes exceed threshold in time window
 */
export class MembershipChurnRule implements DetectionRule {
  readonly id = "membership_churn";
  readonly name = "Membership Churn Detection";
  readonly description = "Detects excessive membership changes in a short period";
  readonly enabled: boolean;
  readonly severity: AnomalySeverity;
  readonly cooldownSeconds: number;

  private readonly threshold: number;
  private readonly windowSeconds: number;

  constructor(
    config: {
      enabled?: boolean;
      severity?: AnomalySeverity;
      cooldownSeconds?: number;
      threshold?: number;
      windowSeconds?: number;
    } = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.severity = config.severity ?? "high";
    this.cooldownSeconds = config.cooldownSeconds ?? 3600;
    this.threshold = config.threshold ?? 3;
    this.windowSeconds = config.windowSeconds ?? 3600;
  }

  applies(event: MultisigEvent): boolean {
    return ["MEMBERSHIP_ADDED", "MEMBERSHIP_REMOVED", "MEMBERSHIP_UPDATED"].includes(event.type);
  }

  evaluate(event: MultisigEvent, recentEvents: readonly MultisigEvent[]): AnomalyResult | null {
    const windowStart = event.timestamp - this.windowSeconds;

    const membershipEvents = recentEvents.filter(
      (e) =>
        e.multisigAddress === event.multisigAddress &&
        e.timestamp >= windowStart &&
        this.applies(e),
    );

    if (membershipEvents.length >= this.threshold) {
      return {
        type: "membership_churn",
        message: `${membershipEvents.length} membership changes in ${this.windowSeconds / 60} minutes`,
        relatedEvents: membershipEvents.map((e) => e.id),
        metadata: {
          count: membershipEvents.length,
          threshold: this.threshold,
          windowSeconds: this.windowSeconds,
        },
      };
    }

    return null;
  }
}

/**
 * Repeated failures detection rule
 * Triggers when proposal executions fail repeatedly
 */
export class RepeatedFailuresRule implements DetectionRule {
  readonly id = "repeated_failures";
  readonly name = "Repeated Execution Failures";
  readonly description = "Detects repeated proposal execution failures";
  readonly enabled: boolean;
  readonly severity: AnomalySeverity;
  readonly cooldownSeconds: number;

  private readonly threshold: number;
  private readonly windowSeconds: number;

  constructor(
    config: {
      enabled?: boolean;
      severity?: AnomalySeverity;
      cooldownSeconds?: number;
      threshold?: number;
      windowSeconds?: number;
    } = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.severity = config.severity ?? "medium";
    this.cooldownSeconds = config.cooldownSeconds ?? 1800;
    this.threshold = config.threshold ?? 3;
    this.windowSeconds = config.windowSeconds ?? 3600;
  }

  applies(event: MultisigEvent): boolean {
    return event.type === "PROPOSAL_FAILED";
  }

  evaluate(event: MultisigEvent, recentEvents: readonly MultisigEvent[]): AnomalyResult | null {
    const windowStart = event.timestamp - this.windowSeconds;

    const failedEvents = recentEvents.filter(
      (e) =>
        e.multisigAddress === event.multisigAddress &&
        e.timestamp >= windowStart &&
        e.type === "PROPOSAL_FAILED",
    );

    if (failedEvents.length >= this.threshold) {
      return {
        type: "repeated_failures",
        message: `${failedEvents.length} failed executions in ${this.windowSeconds / 60} minutes`,
        relatedEvents: failedEvents.map((e) => e.id),
        metadata: {
          count: failedEvents.length,
          threshold: this.threshold,
          windowSeconds: this.windowSeconds,
        },
      };
    }

    return null;
  }
}

/**
 * High proposal frequency detection rule
 * Triggers when proposals are created too frequently
 */
export class HighProposalFrequencyRule implements DetectionRule {
  readonly id = "high_proposal_frequency";
  readonly name = "High Proposal Frequency";
  readonly description = "Detects unusually high proposal creation rate";
  readonly enabled: boolean;
  readonly severity: AnomalySeverity;
  readonly cooldownSeconds: number;

  private readonly threshold: number;
  private readonly windowSeconds: number;

  constructor(
    config: {
      enabled?: boolean;
      severity?: AnomalySeverity;
      cooldownSeconds?: number;
      threshold?: number;
      windowSeconds?: number;
    } = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.severity = config.severity ?? "medium";
    this.cooldownSeconds = config.cooldownSeconds ?? 3600;
    this.threshold = config.threshold ?? 10;
    this.windowSeconds = config.windowSeconds ?? 3600;
  }

  applies(event: MultisigEvent): boolean {
    return event.type === "PROPOSAL_CREATED";
  }

  evaluate(event: MultisigEvent, recentEvents: readonly MultisigEvent[]): AnomalyResult | null {
    const windowStart = event.timestamp - this.windowSeconds;

    const proposalEvents = recentEvents.filter(
      (e) =>
        e.multisigAddress === event.multisigAddress &&
        e.timestamp >= windowStart &&
        e.type === "PROPOSAL_CREATED",
    );

    if (proposalEvents.length >= this.threshold) {
      return {
        type: "high_proposal_frequency",
        message: `${proposalEvents.length} proposals created in ${this.windowSeconds / 60} minutes`,
        relatedEvents: proposalEvents.map((e) => e.id),
        metadata: {
          count: proposalEvents.length,
          threshold: this.threshold,
          windowSeconds: this.windowSeconds,
        },
      };
    }

    return null;
  }
}

/**
 * Credential revocation spike detection rule
 */
export class CredentialRevocationSpikeRule implements DetectionRule {
  readonly id = "credential_revocation_spike";
  readonly name = "Credential Revocation Spike";
  readonly description = "Detects unusual credential revocation activity";
  readonly enabled: boolean;
  readonly severity: AnomalySeverity;
  readonly cooldownSeconds: number;

  private readonly threshold: number;
  private readonly windowSeconds: number;

  constructor(
    config: {
      enabled?: boolean;
      severity?: AnomalySeverity;
      cooldownSeconds?: number;
      threshold?: number;
      windowSeconds?: number;
    } = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.severity = config.severity ?? "critical";
    this.cooldownSeconds = config.cooldownSeconds ?? 1800;
    this.threshold = config.threshold ?? 2;
    this.windowSeconds = config.windowSeconds ?? 1800;
  }

  applies(event: MultisigEvent): boolean {
    return event.type === "CREDENTIAL_BURNED";
  }

  evaluate(event: MultisigEvent, recentEvents: readonly MultisigEvent[]): AnomalyResult | null {
    const windowStart = event.timestamp - this.windowSeconds;

    const revocationEvents = recentEvents.filter(
      (e) =>
        e.multisigAddress === event.multisigAddress &&
        e.timestamp >= windowStart &&
        e.type === "CREDENTIAL_BURNED",
    );

    if (revocationEvents.length >= this.threshold) {
      return {
        type: "credential_revocation_spike",
        message: `${revocationEvents.length} credentials revoked in ${this.windowSeconds / 60} minutes`,
        relatedEvents: revocationEvents.map((e) => e.id),
        metadata: {
          count: revocationEvents.length,
          threshold: this.threshold,
          windowSeconds: this.windowSeconds,
        },
      };
    }

    return null;
  }
}

// ============================================================================
// Anomaly Detector Implementation
// ============================================================================

/**
 * Anomaly Detector - processes events and detects anomalies
 */
export class AnomalyDetector {
  private readonly rules: Map<string, DetectionRule> = new Map();
  private readonly recentEvents: MultisigEvent[] = [];
  private readonly anomalyListeners: Set<(anomaly: Anomaly) => void> = new Set();
  private readonly cooldowns: Map<string, number> = new Map();
  private readonly maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;

    // Register default rules
    this.registerRule(new MembershipChurnRule());
    this.registerRule(new RepeatedFailuresRule());
    this.registerRule(new HighProposalFrequencyRule());
    this.registerRule(new CredentialRevocationSpikeRule());
  }

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Register a detection rule
   */
  registerRule(rule: DetectionRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get all registered rules
   */
  getRules(): DetectionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): DetectionRule[] {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  /**
   * Process an event and check for anomalies
   */
  processEvent(event: MultisigEvent): Anomaly[] {
    // Add to recent events
    this.recentEvents.push(event);

    // Trim if too large
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents.shift();
    }

    const detectedAnomalies: Anomaly[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (!rule.applies(event)) continue;

      // Check cooldown
      const cooldownKey = `${rule.id}:${event.multisigAddress}`;
      const lastTriggered = this.cooldowns.get(cooldownKey);
      if (lastTriggered && event.timestamp - lastTriggered < rule.cooldownSeconds) {
        continue;
      }

      // Evaluate rule
      const result = rule.evaluate(event, this.recentEvents);

      if (result) {
        const anomaly: Anomaly = {
          id: this.generateAnomalyId(),
          type: result.type,
          severity: rule.severity,
          multisigAddress: event.multisigAddress,
          chainId: event.chainId,
          message: result.message,
          detectedAt: event.timestamp,
          ruleId: rule.id,
          relatedEvents: result.relatedEvents,
          metadata: result.metadata,
        };

        detectedAnomalies.push(anomaly);
        this.cooldowns.set(cooldownKey, event.timestamp);

        // Notify listeners
        this.notifyListeners(anomaly);
      }
    }

    return detectedAnomalies;
  }

  // ============================================================================
  // Listener Management
  // ============================================================================

  /**
   * Add an anomaly listener
   */
  onAnomaly(listener: (anomaly: Anomaly) => void): void {
    this.anomalyListeners.add(listener);
  }

  /**
   * Remove an anomaly listener
   */
  offAnomaly(listener: (anomaly: Anomaly) => void): void {
    this.anomalyListeners.delete(listener);
  }

  private notifyListeners(anomaly: Anomaly): void {
    for (const listener of this.anomalyListeners) {
      try {
        listener(anomaly);
      } catch (error) {
        console.error("Error in anomaly listener:", error);
      }
    }
  }

  // ============================================================================
  // Query
  // ============================================================================

  /**
   * Get recent events for a multisig
   */
  getRecentEvents(multisigAddress: string, limit: number = 50): MultisigEvent[] {
    return this.recentEvents.filter((e) => e.multisigAddress === multisigAddress).slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: MultisigEventType, limit: number = 50): MultisigEvent[] {
    return this.recentEvents.filter((e) => e.type === type).slice(-limit);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateAnomalyId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `anom_${timestamp}_${random}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an anomaly detector with default rules
 */
export function createAnomalyDetector(maxEvents?: number): AnomalyDetector {
  return new AnomalyDetector(maxEvents);
}

/**
 * Create an anomaly detector with custom rules only
 */
export function createCustomAnomalyDetector(
  rules: DetectionRule[],
  maxEvents?: number,
): AnomalyDetector {
  const detector = new AnomalyDetector(maxEvents);

  // Clear default rules and add custom ones
  for (const rule of detector.getRules()) {
    detector.unregisterRule(rule.id);
  }

  for (const rule of rules) {
    detector.registerRule(rule);
  }

  return detector;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalAnomalyDetector: AnomalyDetector | null = null;

/**
 * Get the global anomaly detector
 */
export function getAnomalyDetector(): AnomalyDetector {
  if (!globalAnomalyDetector) {
    globalAnomalyDetector = new AnomalyDetector();
  }
  return globalAnomalyDetector;
}

/**
 * Set the global anomaly detector
 */
export function setAnomalyDetector(detector: AnomalyDetector): void {
  globalAnomalyDetector = detector;
}
