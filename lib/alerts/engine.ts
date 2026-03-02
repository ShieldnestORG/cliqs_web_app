/**
 * Alert Engine - Webhook, Email, Slack, Discord Support
 *
 * File: lib/alerts/engine.ts
 *
 * Routes alerts to appropriate channels with cooldown management
 * and severity-based routing.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import * as localDb from "@/lib/localDb";
import { Anomaly } from "@/lib/monitoring/anomaly-detector";
import { MultisigEvent } from "@/lib/monitoring/event-stream";

// ============================================================================
// Alert Types
// ============================================================================

export type AlertChannel = "webhook" | "email" | "slack" | "discord" | "console";
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Alert configuration
 */
export interface AlertConfig {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly channels: AlertChannelConfig[];
  readonly conditions: AlertCondition[];
  readonly severity: AlertSeverity;
  readonly cooldownSeconds: number;
  readonly enabled: boolean;
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  readonly type: AlertChannel;
  readonly config: Record<string, unknown>;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  readonly type: "event_type" | "anomaly_type" | "severity" | "multisig" | "custom";
  readonly value: string;
  readonly operator?: "equals" | "contains" | "regex";
}

/**
 * Alert payload
 */
export interface Alert {
  readonly id: string;
  readonly ruleId: string;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly message: string;
  readonly timestamp: number;
  readonly source: "event" | "anomaly";
  readonly sourceId: string;
  readonly metadata: Record<string, unknown>;
}

// ============================================================================
// Channel Senders
// ============================================================================

/**
 * Interface for channel senders
 */
interface ChannelSender {
  send(alert: Alert, config: Record<string, unknown>): Promise<boolean>;
}

/**
 * Webhook sender
 */
const webhookSender: ChannelSender = {
  async send(alert: Alert, config: Record<string, unknown>): Promise<boolean> {
    const url = config.url as string;
    if (!url) return false;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...((config.headers as Record<string, string>) || {}),
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error("Webhook send failed:", error);
      return false;
    }
  },
};

/**
 * Slack sender
 */
const slackSender: ChannelSender = {
  async send(alert: Alert, config: Record<string, unknown>): Promise<boolean> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) return false;

    const color =
      alert.severity === "critical"
        ? "#ff0000"
        : alert.severity === "warning"
          ? "#ffaa00"
          : "#00ff00";

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachments: [
            {
              color,
              title: alert.title,
              text: alert.message,
              fields: [
                { title: "Multisig", value: alert.multisigAddress, short: true },
                { title: "Chain", value: alert.chainId, short: true },
                { title: "Severity", value: alert.severity, short: true },
              ],
              ts: alert.timestamp,
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error("Slack send failed:", error);
      return false;
    }
  },
};

/**
 * Discord sender
 */
const discordSender: ChannelSender = {
  async send(alert: Alert, config: Record<string, unknown>): Promise<boolean> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) return false;

    const color =
      alert.severity === "critical" ? 0xff0000 : alert.severity === "warning" ? 0xffaa00 : 0x00ff00;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: alert.title,
              description: alert.message,
              color,
              fields: [
                { name: "Multisig", value: alert.multisigAddress, inline: true },
                { name: "Chain", value: alert.chainId, inline: true },
                { name: "Severity", value: alert.severity, inline: true },
              ],
              timestamp: new Date(alert.timestamp * 1000).toISOString(),
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error("Discord send failed:", error);
      return false;
    }
  },
};

/**
 * Console sender (for debugging)
 */
const consoleSender: ChannelSender = {
  async send(alert: Alert, _config: Record<string, unknown>): Promise<boolean> {
    const prefix =
      alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
    console.log(`${prefix} [ALERT] ${alert.title}: ${alert.message}`);
    return true;
  },
};

const channelSenders: Record<AlertChannel, ChannelSender> = {
  webhook: webhookSender,
  email: { send: async () => false }, // Email requires external service
  slack: slackSender,
  discord: discordSender,
  console: consoleSender,
};

// ============================================================================
// Alert Engine Implementation
// ============================================================================

export class AlertEngine {
  private readonly rules: Map<string, AlertConfig> = new Map();
  private readonly cooldowns: Map<string, number> = new Map();

  constructor() {}

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Add or update an alert rule
   */
  addRule(rule: AlertConfig): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): AlertConfig[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules for a multisig
   */
  getRulesForMultisig(multisigAddress: string): AlertConfig[] {
    return Array.from(this.rules.values()).filter(
      (r) =>
        r.conditions.some((c) => c.type === "multisig" && c.value === multisigAddress) ||
        !r.conditions.some((c) => c.type === "multisig"),
    );
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  /**
   * Process an event and send alerts
   */
  async processEvent(event: MultisigEvent): Promise<Alert[]> {
    const sentAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (!this.matchesConditions(rule, event, null)) continue;
      if (this.isOnCooldown(rule.id, event.multisigAddress)) continue;

      const alert = this.createAlertFromEvent(rule, event);
      const sent = await this.sendAlert(alert, rule.channels);

      if (sent) {
        sentAlerts.push(alert);
        this.setCooldown(rule.id, event.multisigAddress, rule.cooldownSeconds);
        this.recordAlert(alert, rule.id);
      }
    }

    return sentAlerts;
  }

  /**
   * Process an anomaly and send alerts
   */
  async processAnomaly(anomaly: Anomaly): Promise<Alert[]> {
    const sentAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (!this.matchesConditions(rule, null, anomaly)) continue;
      if (this.isOnCooldown(rule.id, anomaly.multisigAddress)) continue;

      const alert = this.createAlertFromAnomaly(rule, anomaly);
      const sent = await this.sendAlert(alert, rule.channels);

      if (sent) {
        sentAlerts.push(alert);
        this.setCooldown(rule.id, anomaly.multisigAddress, rule.cooldownSeconds);
        this.recordAlert(alert, rule.id);
      }
    }

    return sentAlerts;
  }

  // ============================================================================
  // Condition Matching
  // ============================================================================

  private matchesConditions(
    rule: AlertConfig,
    event: MultisigEvent | null,
    anomaly: Anomaly | null,
  ): boolean {
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(condition, event, anomaly)) {
        return false;
      }
    }
    return true;
  }

  private matchesCondition(
    condition: AlertCondition,
    event: MultisigEvent | null,
    anomaly: Anomaly | null,
  ): boolean {
    const operator = condition.operator || "equals";

    switch (condition.type) {
      case "event_type":
        if (!event) return false;
        return this.matchValue(event.type, condition.value, operator);

      case "anomaly_type":
        if (!anomaly) return false;
        return this.matchValue(anomaly.type, condition.value, operator);

      case "severity":
        const severity = anomaly?.severity || "info";
        return this.matchValue(severity, condition.value, operator);

      case "multisig":
        const address = event?.multisigAddress || anomaly?.multisigAddress || "";
        return this.matchValue(address, condition.value, operator);

      default:
        return true;
    }
  }

  private matchValue(value: string, pattern: string, operator: string): boolean {
    switch (operator) {
      case "equals":
        return value === pattern;
      case "contains":
        return value.includes(pattern);
      case "regex":
        try {
          return new RegExp(pattern).test(value);
        } catch {
          return false;
        }
      default:
        return value === pattern;
    }
  }

  // ============================================================================
  // Alert Creation
  // ============================================================================

  private createAlertFromEvent(rule: AlertConfig, event: MultisigEvent): Alert {
    return {
      id: this.generateAlertId(),
      ruleId: rule.id,
      multisigAddress: event.multisigAddress,
      chainId: event.chainId,
      severity: rule.severity,
      title: `${event.type} Alert`,
      message: `Event ${event.type} detected on multisig ${event.multisigAddress.slice(0, 12)}...`,
      timestamp: Math.floor(Date.now() / 1000),
      source: "event",
      sourceId: event.id,
      metadata: event.data,
    };
  }

  private createAlertFromAnomaly(rule: AlertConfig, anomaly: Anomaly): Alert {
    return {
      id: this.generateAlertId(),
      ruleId: rule.id,
      multisigAddress: anomaly.multisigAddress,
      chainId: anomaly.chainId,
      severity: rule.severity,
      title: `Anomaly Detected: ${anomaly.type}`,
      message: anomaly.message,
      timestamp: Math.floor(Date.now() / 1000),
      source: "anomaly",
      sourceId: anomaly.id,
      metadata: anomaly.metadata,
    };
  }

  // ============================================================================
  // Alert Sending
  // ============================================================================

  private async sendAlert(alert: Alert, channels: AlertChannelConfig[]): Promise<boolean> {
    let anySent = false;

    for (const channel of channels) {
      const sender = channelSenders[channel.type];
      if (sender) {
        try {
          const sent = await sender.send(alert, channel.config);
          if (sent) anySent = true;
        } catch (error) {
          console.error(`Failed to send alert via ${channel.type}:`, error);
        }
      }
    }

    return anySent;
  }

  // ============================================================================
  // Cooldown Management
  // ============================================================================

  private isOnCooldown(ruleId: string, multisigAddress: string): boolean {
    const key = `${ruleId}:${multisigAddress}`;
    const lastTriggered = this.cooldowns.get(key);
    if (!lastTriggered) return false;

    const now = Math.floor(Date.now() / 1000);
    return now < lastTriggered;
  }

  private setCooldown(ruleId: string, multisigAddress: string, cooldownSeconds: number): void {
    const key = `${ruleId}:${multisigAddress}`;
    const expiresAt = Math.floor(Date.now() / 1000) + cooldownSeconds;
    this.cooldowns.set(key, expiresAt);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private recordAlert(alert: Alert, ruleId: string): void {
    try {
      localDb.recordAlert({
        ruleId,
        multisigAddress: alert.multisigAddress,
        chainId: alert.chainId,
        eventType:
          alert.source === "event" ? alert.sourceId : (alert.metadata.type as string) || "anomaly",
        eventId: alert.sourceId,
        severity: alert.severity,
        message: alert.message,
        channelsSentJSON: "[]",
      });

      localDb.updateAlertRuleLastTriggered(ruleId);
    } catch (error) {
      console.error("Failed to record alert:", error);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateAlertId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `alert_${timestamp}_${random}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an alert engine
 */
export function createAlertEngine(): AlertEngine {
  return new AlertEngine();
}

/**
 * Create a default alert rule for critical events
 */
export function createCriticalEventsRule(
  multisigAddress: string,
  channels: AlertChannelConfig[],
): AlertConfig {
  return {
    id: `critical_${multisigAddress.slice(0, 8)}`,
    name: "Critical Events",
    description: "Alert on all critical events",
    channels,
    conditions: [{ type: "multisig", value: multisigAddress }],
    severity: "critical",
    cooldownSeconds: 300,
    enabled: true,
  };
}

/**
 * Create an alert rule for emergency events
 */
export function createEmergencyEventsRule(
  multisigAddress: string,
  channels: AlertChannelConfig[],
): AlertConfig {
  return {
    id: `emergency_${multisigAddress.slice(0, 8)}`,
    name: "Emergency Events",
    description: "Alert on pause/safe mode events",
    channels,
    conditions: [
      { type: "multisig", value: multisigAddress },
      { type: "event_type", value: "EMERGENCY", operator: "contains" },
    ],
    severity: "critical",
    cooldownSeconds: 60,
    enabled: true,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalAlertEngine: AlertEngine | null = null;

/**
 * Get the global alert engine
 */
export function getAlertEngine(): AlertEngine {
  if (!globalAlertEngine) {
    globalAlertEngine = new AlertEngine();
  }
  return globalAlertEngine;
}

/**
 * Set the global alert engine
 */
export function setAlertEngine(engine: AlertEngine): void {
  globalAlertEngine = engine;
}
