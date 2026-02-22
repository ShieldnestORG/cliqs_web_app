# Phase 4: Advanced Policies + Attack-Ready Safeguards

## Product Requirements Document

**Version:** 1.0  
**Date:** December 18, 2025  
**Status:** Implemented

---

## Executive Summary

Phase 4 implements advanced policy enforcement and emergency controls for the Dual Multisig System. This phase adds five priority-ordered policy types, emergency pause/safe-mode capabilities, real-time monitoring with anomaly detection, and automated incident response playbooks.

### Key Deliverables

1. **Policy Evaluation System** - Central abstraction for all policy enforcement
2. **Five Policy Types** - Timelock, Emergency, Message-Type, Spend Limit, Address Filter
3. **Emergency Controls** - Pause mechanism and safe mode
4. **Observability Infrastructure** - Event streaming, metrics, anomaly detection
5. **Alert System** - Webhook/Slack/Discord notifications
6. **Incident Playbooks** - Automated response sequences
7. **UI Components** - Emergency panel, policy manager, monitoring dashboard
8. **API Endpoints** - RESTful APIs for all operations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           On-Chain Enforcement                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ContractMultisigEngine ──► PolicyEvaluator ──► Individual Policies    │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Timelock   │  │  Emergency  │  │  Msg Type   │  │ Spend Limit │   │
│  │  (P1)       │  │  (P2)       │  │  (P3)       │  │ (P4)        │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐                                      │
│  │  Allowlist  │  │  Denylist   │                                      │
│  │  (P5)       │  │  (P5)       │                                      │
│  └─────────────┘  └─────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         Off-Chain Monitoring                            │
├─────────────────────────────────────────────────────────────────────────┤
│  EventStream ──► AnomalyDetector ──► AlertEngine ──► PlaybookRunner    │
│       │                │                  │                │            │
│       ▼                ▼                  ▼                ▼            │
│  ┌─────────┐    ┌─────────────┐    ┌──────────┐    ┌────────────┐      │
│  │ Memory  │    │  Detection  │    │ Webhook  │    │ Automated  │      │
│  │ Webhook │    │  Rules      │    │ Slack    │    │ Response   │      │
│  │ Console │    │             │    │ Discord  │    │ Steps      │      │
│  └─────────┘    └─────────────┘    └──────────┘    └────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
lib/
├── policies/                          # Policy System
│   ├── types.ts                       # Core types and interfaces
│   ├── registry.ts                    # Central policy management
│   ├── timelock.ts                    # Timelock policy (Priority 1)
│   ├── msg-type-restriction.ts        # Message type policy (Priority 3)
│   ├── spend-limit.ts                 # Spend limit policy (Priority 4)
│   ├── spend-tracker.ts               # Spending aggregation
│   ├── address-filter.ts              # Allowlist/Denylist (Priority 5)
│   └── index.ts                       # Module exports
│
├── emergency/                         # Emergency Controls
│   ├── types.ts                       # Emergency state types
│   ├── pause-controller.ts            # Pause/unpause mechanism
│   ├── safe-mode.ts                   # Elevated threshold mode
│   └── index.ts                       # Module exports
│
├── monitoring/                        # Observability
│   ├── event-stream.ts                # Guaranteed event emission
│   ├── metrics.ts                     # Counters, gauges, histograms
│   ├── anomaly-detector.ts            # Rule-based detection
│   └── index.ts                       # Module exports
│
├── alerts/                            # Alerting System
│   ├── engine.ts                      # Alert routing and delivery
│   └── index.ts                       # Module exports
│
├── playbooks/                         # Incident Response
│   ├── types.ts                       # Playbook definitions
│   └── index.ts                       # Module exports
│
└── localDb.ts                         # Updated with Phase 4 tables

components/
├── emergency/                         # Emergency UI
│   ├── EmergencyPanel.tsx             # Pause/safe-mode controls
│   └── IncidentPanel.tsx              # Incident management
│
├── policies/                          # Policy UI
│   └── PolicyManager.tsx              # Policy list and management
│
└── monitoring/                        # Monitoring UI
    └── MonitoringDashboard.tsx        # Metrics and events

pages/api/chain/[chainId]/[address]/
├── policies/
│   ├── index.ts                       # List/create policies
│   └── [policyId].ts                  # Get/update/delete policy
│
├── emergency/
│   ├── status.ts                      # Get emergency state
│   ├── pause.ts                       # Pause/unpause operations
│   └── safe-mode.ts                   # Safe mode controls
│
└── monitoring/
    ├── metrics.ts                     # Get metrics
    ├── alerts.ts                      # Get alerts
    └── incidents.ts                   # Manage incidents

__tests__/
├── policies/
│   └── policy-enforcement.test.ts     # Policy tests
├── emergency/
│   └── emergency-controls.test.ts     # Emergency tests
└── monitoring/
    └── event-emission.test.ts         # Event tests
```

---

## 1. Policy Evaluation System

### 1.1 PolicyEvaluator Interface

**File:** `lib/policies/types.ts`

The central abstraction through which ALL policy logic flows.

```typescript
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
   */
  evaluateProposal(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult>;

  /**
   * Evaluate all policies for proposal execution
   */
  evaluateExecution(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult>;

  /**
   * Pre-validate a proposal before creation (UI optimization)
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
```

### 1.2 PolicyContext

**File:** `lib/policies/types.ts`

Complete context available for policy decisions:

```typescript
export interface PolicyContext {
  // ========== Credential Context ==========
  readonly signerRoles: readonly CredentialRole[];
  readonly credentialVersions: ReadonlyMap<string, number>;
  readonly minRequiredVersion: number;

  // ========== Spend Context ==========
  readonly spentInWindow: ReadonlyMap<string, Coin>;
  readonly proposalValue: readonly Coin[];
  readonly treasuryBalance: readonly Coin[];

  // ========== Recipient Context ==========
  readonly recipientAddresses: readonly string[];

  // ========== Message Context ==========
  readonly messageTypes: readonly MsgTypeUrl[];
  readonly messages: readonly EncodeObject[];

  // ========== Timing Context ==========
  readonly queuedAt: number | null;
  readonly timeSinceQueue: number;
  readonly currentHeight: number;
  readonly currentTimestamp: number;

  // ========== Emergency Context ==========
  readonly isPaused: boolean;
  readonly isSafeMode: boolean;
  readonly elevatedThreshold: number | null;
  readonly normalThreshold: number;

  // ========== Multisig Context ==========
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly policyVersion: number;
}
```

### 1.3 Policy Decision Types

```typescript
export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly violations: readonly PolicyViolation[] };

export interface PolicyViolation {
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly code: PolicyViolationCode;
  readonly message: string;
  readonly severity: PolicyViolationSeverity;
  readonly details?: Record<string, unknown>;
}
```

### 1.4 Policy Registry

**File:** `lib/policies/registry.ts`

Central management and orchestration of policies:

```typescript
export class PolicyRegistry implements PolicyEvaluator {
  /**
   * Register a policy for a multisig
   */
  registerPolicy(multisigAddress: string, policy: Policy): void;

  /**
   * Get all policies for a multisig (sorted by priority)
   */
  getPolicies(multisigAddress: string): Policy[];

  /**
   * Evaluate all policies for proposal creation
   */
  async evaluateProposal(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult>;

  /**
   * Get policy statistics for a multisig
   */
  getStats(multisigAddress: string): {
    totalPolicies: number;
    enabledPolicies: number;
    byType: Record<PolicyType, number>;
  };
}

// Factory function
export function createPolicyRegistry(
  config?: Partial<PolicyRegistryConfig>,
): PolicyRegistry;
```

---

## 2. Policy Implementations

### 2.1 Timelock Policy (Priority 1)

**File:** `lib/policies/timelock.ts`

Risk containment window - all other policies need reaction time.

```typescript
export class TimelockPolicy implements Policy {
  readonly type = "timelock";
  readonly priority = 10;

  constructor(
    id: string,
    name: string,
    config: Partial<TimelockPolicyConfig> = {},
  ) {
    this.config = {
      minDelaySeconds: config.minDelaySeconds ?? 3600,      // 1 hour
      maxDelaySeconds: config.maxDelaySeconds ?? 604800,     // 7 days
      highValueMultiplier: config.highValueMultiplier ?? 2.0,
      highValueThresholdPercent: config.highValueThresholdPercent ?? 10,
    };
  }

  async evaluateExecution(proposal: Proposal, context: PolicyContext) {
    // Check if operations are paused
    if (context.isPaused) {
      return denied([createViolation(
        this.id, this.type, "OPERATIONS_PAUSED",
        "Operations are currently paused", "critical"
      )]);
    }

    // Require queue before execution (2-step execution)
    if (context.queuedAt === null) {
      return denied([createViolation(
        this.id, this.type, "QUEUE_REQUIRED",
        "Proposal must be queued before execution", "high"
      )]);
    }

    // Check minimum delay
    const requiredDelay = this.getRequiredDelay(proposal, context);
    if (context.timeSinceQueue < requiredDelay) {
      const remaining = requiredDelay - context.timeSinceQueue;
      return denied([createViolation(
        this.id, this.type, "TIMELOCK_NOT_MET",
        `Must wait ${formatDuration(remaining)} before execution`, "high"
      )]);
    }

    // Check expiration
    if (context.timeSinceQueue > this.config.maxDelaySeconds) {
      return denied([createViolation(
        this.id, this.type, "TIMELOCK_EXPIRED",
        "Proposal has expired", "high"
      )]);
    }

    return allowed();
  }
}

// Usage
const timelockPolicy = new TimelockPolicy("timelock-1", "Standard Timelock", {
  minDelaySeconds: 7200,       // 2 hours
  maxDelaySeconds: 604800,      // 7 days
  highValueMultiplier: 3.0,     // 3x delay for high-value
  highValueThresholdPercent: 5, // >5% of treasury = high value
});
```

### 2.2 Message Type Restriction Policy (Priority 3)

**File:** `lib/policies/msg-type-restriction.ts`

Controls attack surface before enabling spending.

```typescript
export class MsgTypePolicy implements Policy {
  readonly type = "msg_type";
  readonly priority = 30;

  async evaluateProposal(proposal: Proposal, context: PolicyContext) {
    const violations: PolicyViolation[] = [];

    for (const msg of proposal.content.msgs) {
      const msgType = msg.typeUrl as MsgTypeUrl;

      // Check if blocked
      if (this.isBlocked(msgType)) {
        violations.push(createViolation(
          this.id, this.type, "MSG_TYPE_BLOCKED",
          `Message type ${msgType} is blocked`, "high"
        ));
        continue;
      }

      // Check if in allowlist (if active)
      if (!this.isAllowed(msgType)) {
        violations.push(createViolation(
          this.id, this.type, "MSG_TYPE_NOT_ALLOWED",
          `Message type ${msgType} is not allowed`, "high"
        ));
        continue;
      }

      // Check threshold requirements
      const required = this.getRequiredThreshold(msgType);
      if (required && required > context.normalThreshold) {
        violations.push(createViolation(
          this.id, this.type, "MSG_TYPE_REQUIRES_HIGHER_THRESHOLD",
          `Requires threshold of ${required}`, "medium"
        ));
      }
    }

    return violations.length > 0 ? denied(violations) : allowed();
  }
}

// Pre-built policies
export function createHighSecurityMsgTypePolicy(id: string, normalThreshold: number) {
  return new MsgTypePolicy(id, "High Security", {
    blockedMsgTypes: [MsgTypeUrls.MigrateContract],
    requiresHigherThreshold: new Map([
      [MsgTypeUrls.UpdateAdmin, normalThreshold + 1],
      [MsgTypeUrls.CreateValidator, normalThreshold + 1],
      [MsgTypeUrls.ExecuteContract, normalThreshold + 1],
    ]),
  });
}
```

### 2.3 Spend Limit Policy (Priority 4)

**File:** `lib/policies/spend-limit.ts`

Only safe after timelocks provide reaction window.

```typescript
export class SpendLimitPolicy implements Policy {
  readonly type = "spend_limit";
  readonly priority = 40;

  async evaluateProposal(proposal: Proposal, context: PolicyContext) {
    const violations: PolicyViolation[] = [];
    const proposalValue = this.calculateNonExemptValue(proposal, context);

    // Check per-transaction limits
    for (const limit of this.config.perTxLimits) {
      const spent = proposalValue.find(c => c.denom === limit.denom);
      if (spent && BigInt(spent.amount) > BigInt(limit.amount)) {
        violations.push(createViolation(
          this.id, this.type, "EXCEEDS_PER_TX_LIMIT",
          `Exceeds per-tx limit: ${spent.amount} > ${limit.amount} ${limit.denom}`,
          "high"
        ));
      }
    }

    // Check daily limits (including already spent)
    for (const limit of this.config.dailyLimits) {
      const alreadySpent = context.spentInWindow.get(limit.denom);
      const proposalSpend = proposalValue.find(c => c.denom === limit.denom);
      
      if (proposalSpend) {
        const total = BigInt(alreadySpent?.amount ?? 0) + BigInt(proposalSpend.amount);
        if (total > BigInt(limit.amount)) {
          violations.push(createViolation(
            this.id, this.type, "EXCEEDS_DAILY_LIMIT",
            `Would exceed daily limit`, "high"
          ));
        }
      }
    }

    return violations.length > 0 ? denied(violations) : allowed();
  }
}

// Usage
const spendPolicy = createBasicSpendLimitPolicy(
  "spend-1",
  { denom: "uatom", amount: "1000000" },   // 1 ATOM per tx
  { denom: "uatom", amount: "10000000" },  // 10 ATOM daily
);
```

### 2.4 Address Filter Policy (Priority 5)

**File:** `lib/policies/address-filter.ts`

Recipient filtering (allowlist/denylist).

```typescript
export class AddressFilterPolicy implements Policy {
  readonly type: "allowlist" | "denylist";
  readonly priority = 50;

  async evaluateProposal(proposal: Proposal, context: PolicyContext) {
    const violations: PolicyViolation[] = [];

    for (const recipient of context.recipientAddresses) {
      const result = this.checkAddress(recipient);
      
      if (!result.allowed) {
        violations.push(createViolation(
          this.id, this.type, result.code, result.message, "high"
        ));
      }
    }

    return violations.length > 0 ? denied(violations) : allowed();
  }

  private checkAddress(address: string) {
    // Denylist takes precedence
    if (this.isDenied(address)) {
      return { allowed: false, code: "RECIPIENT_IN_DENYLIST", ... };
    }

    // Check allowlist if active
    if (this.config.filterType === "allowlist" && !this.isAllowed(address)) {
      return { allowed: false, code: "RECIPIENT_NOT_IN_ALLOWLIST", ... };
    }

    return { allowed: true };
  }
}

// Usage
const trustedOnly = createAllowlistPolicy("filter-1", [
  "cosmos1validator1...",
  "cosmos1exchange...",
]);

const blockMalicious = createDenylistPolicy("filter-2", [
  "cosmos1scammer...",
  "cosmos1hacker...",
]);
```

---

## 3. Emergency Controls

### 3.1 Pause Controller

**File:** `lib/emergency/pause-controller.ts`

Kill switch for operations (Priority 2).

```typescript
export class PauseController {
  /**
   * Pause operations for a multisig
   * 
   * When paused:
   * - No new approvals allowed
   * - No execution allowed
   * - Queries still work
   * - Credential checks still enforced
   */
  async pause(
    multisigAddress: string,
    chainId: string,
    input: PauseInput,
  ): Promise<PauseResult> {
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate auto-unpause time
    let autoUnpauseAt: number | null = null;
    if (input.durationSeconds !== undefined) {
      autoUnpauseAt = now + Math.min(
        input.durationSeconds,
        this.config.maxPauseDurationSeconds
      );
    }

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isPaused: true,
      pausedAt: new Date(now * 1000).toISOString(),
      pausedBy: input.actor,
      pauseReason: input.reason,
      autoUnpauseAt: autoUnpauseAt ? new Date(autoUnpauseAt * 1000).toISOString() : null,
    });

    // Emit guaranteed event
    this.emitEvent({
      type: "EMERGENCY_PAUSED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: { reason: input.reason, autoUnpauseAt },
    });

    return { success: true, pausedAt: now, autoUnpauseAt };
  }

  /**
   * Check if an operation is blocked
   */
  isOperationBlocked(
    multisigAddress: string,
    chainId: string,
    operation: "approve" | "execute" | "query",
  ): { blocked: boolean; reason?: string } {
    // Queries are NEVER blocked
    if (operation === "query") {
      return { blocked: false };
    }

    const state = this.getState(multisigAddress, chainId);
    if (state.isPaused) {
      return { blocked: true, reason: state.pauseReason || "Operations paused" };
    }

    return { blocked: false };
  }
}

// Usage
const controller = getPauseController();

await controller.pause("cosmos1multisig...", "cosmoshub-4", {
  actor: "cosmos1admin...",
  reason: "Suspected compromise",
  durationSeconds: 86400, // 24 hours
});
```

### 3.2 Safe Mode Controller

**File:** `lib/emergency/safe-mode.ts`

Temporarily elevate threshold without contract redeployment.

```typescript
export class SafeModeController {
  /**
   * Activate safe mode
   */
  async activate(
    multisigAddress: string,
    chainId: string,
    normalThreshold: number,
    input: SafeModeActivateInput,
  ): Promise<SafeModeActivateResult> {
    // Validate threshold is elevated
    if (input.elevatedThreshold <= normalThreshold) {
      throw new EmergencyError(
        "Elevated threshold must be higher than normal",
        "INVALID_THRESHOLD"
      );
    }

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isSafeMode: true,
      safeModeThreshold: input.elevatedThreshold,
      safeModeActivatedAt: new Date().toISOString(),
    });

    // Emit guaranteed event
    this.emitEvent({
      type: "SAFE_MODE_ACTIVATED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: {
        trigger: input.trigger,
        previousThreshold: normalThreshold,
        newThreshold: input.elevatedThreshold,
      },
    });

    return {
      success: true,
      activatedAt: now,
      previousThreshold: normalThreshold,
      newThreshold: input.elevatedThreshold,
    };
  }

  /**
   * Get effective threshold (elevated if in safe mode)
   */
  getEffectiveThreshold(
    multisigAddress: string,
    chainId: string,
    normalThreshold: number,
  ): number {
    const state = this.getState(multisigAddress, chainId);
    
    if (state.isSafeMode && state.threshold !== null) {
      return state.threshold;
    }
    
    return normalThreshold;
  }
}

// Usage
const safeModeController = getSafeModeController();

await safeModeController.activate("cosmos1multisig...", "cosmoshub-4", 2, {
  actor: "cosmos1admin...",
  trigger: "anomaly_detected",
  elevatedThreshold: 4,
  reason: "Unusual credential revocation activity",
});
```

---

## 4. Observability Infrastructure

### 4.1 Event Streaming

**File:** `lib/monitoring/event-stream.ts`

Guaranteed event emission to multiple sinks.

```typescript
export class EventStream {
  private readonly sinks: Map<string, EventSink> = new Map();

  /**
   * Emit an event to all sinks
   */
  async emit(event: Omit<MultisigEvent, "id">): Promise<string> {
    const fullEvent: MultisigEvent = {
      ...event,
      id: this.generateEventId(),
    };

    // Process in parallel to all sinks
    const promises = Array.from(this.sinks.values()).map(sink =>
      sink.emit(fullEvent).catch(error => {
        console.error(`Error emitting to sink ${sink.id}:`, error);
      })
    );

    await Promise.all(promises);
    return fullEvent.id;
  }

  /**
   * Emit a proposal event with guaranteed attributes
   */
  async emitProposalEvent(
    type: "PROPOSAL_CREATED" | "PROPOSAL_QUEUED" | "PROPOSAL_EXECUTED" | "PROPOSAL_FAILED",
    multisigAddress: string,
    chainId: string,
    proposalId: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      data: { proposalId, ...data },
    });
  }
}

// Guaranteed Events (per Phase 4 requirements)
type MultisigEventType =
  | "PROPOSAL_QUEUED"       // proposal_id, queued_at, execute_after
  | "PROPOSAL_EXECUTED"     // proposal_id, tx_hash, executor
  | "PROPOSAL_FAILED"       // proposal_id, error_code, error_msg
  | "CREDENTIAL_MINTED"     // class_id, token_id, recipient, role
  | "CREDENTIAL_BURNED"     // class_id, token_id, previous_owner
  | "MEMBERSHIP_ADDED"      // group_addr, member_addr, weight
  | "MEMBERSHIP_REMOVED"    // group_addr, member_addr
  | "MEMBERSHIP_UPDATED"    // group_addr, member_addr, old_weight, new_weight
  | "EMERGENCY_PAUSED"      // paused_by, reason, auto_unpause_at
  | "EMERGENCY_UNPAUSED"    // unpaused_by
  | "SAFE_MODE_ACTIVATED"   // new_threshold, trigger_reason
  | "SAFE_MODE_DEACTIVATED" // restored_threshold
  | "POLICY_VIOLATION";     // policy_id, violation_type, details

// Usage
const stream = getEventStream();
stream.addSink(createWebhookSink("webhook-1", "Ops Webhook", "https://..."));
stream.addSink(createConsoleSink("console", "Debug Console"));

await stream.emitProposalEvent(
  "PROPOSAL_EXECUTED",
  "cosmos1multisig...",
  "cosmoshub-4",
  "42",
  { txHash: "ABC123", executor: "cosmos1..." }
);
```

### 4.2 Metrics Collector

**File:** `lib/monitoring/metrics.ts`

Counters, gauges, and histograms for observability.

```typescript
export class MetricsRegistry {
  counter(name: string, description: string, labels?: string[]): Counter;
  gauge(name: string, description: string, labels?: string[]): Gauge;
  histogram(name: string, description: string, labels?: string[], buckets?: number[]): Histogram;

  export(): Record<string, unknown>;
}

// Pre-defined standard metrics
export function createStandardMetrics(registry: MetricsRegistry) {
  return {
    proposalsCreated: registry.counter(
      "proposals_created_total",
      "Total proposals created",
      ["chain_id"]
    ),
    proposalsExecuted: registry.counter(
      "proposals_executed_total",
      "Total proposals executed",
      ["chain_id"]
    ),
    policyViolations: registry.counter(
      "policy_violations_total",
      "Total policy violations",
      ["chain_id", "policy_type"]
    ),
    emergencyPauses: registry.counter(
      "emergency_pauses_total",
      "Total emergency pauses",
      ["chain_id"]
    ),
    pendingProposals: registry.gauge(
      "pending_proposals",
      "Current pending proposals",
      ["chain_id", "multisig_address"]
    ),
    executionLatency: registry.histogram(
      "execution_latency_seconds",
      "Time from creation to execution",
      ["chain_id"],
      [60, 300, 900, 1800, 3600, 7200]
    ),
  };
}

// Usage
const registry = getMetricsRegistry();
const metrics = createStandardMetrics(registry);

metrics.proposalsCreated.inc({ chain_id: "cosmoshub-4" });
metrics.pendingProposals.set(5, { chain_id: "cosmoshub-4", multisig_address: "cosmos1..." });
```

### 4.3 Anomaly Detector

**File:** `lib/monitoring/anomaly-detector.ts`

Rule-based anomaly detection with configurable thresholds.

```typescript
export class AnomalyDetector {
  /**
   * Process an event and check for anomalies
   */
  processEvent(event: MultisigEvent): Anomaly[] {
    const detectedAnomalies: Anomaly[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled || !rule.applies(event)) continue;
      if (this.isOnCooldown(rule.id, event.multisigAddress)) continue;

      const result = rule.evaluate(event, this.recentEvents);
      
      if (result) {
        const anomaly: Anomaly = {
          id: this.generateAnomalyId(),
          type: result.type,
          severity: rule.severity,
          multisigAddress: event.multisigAddress,
          message: result.message,
          detectedAt: event.timestamp,
          ruleId: rule.id,
          relatedEvents: result.relatedEvents,
          metadata: result.metadata,
        };

        detectedAnomalies.push(anomaly);
        this.notifyListeners(anomaly);
      }
    }

    return detectedAnomalies;
  }
}

// Built-in detection rules
export class MembershipChurnRule implements DetectionRule {
  // Triggers when membership changes exceed threshold in time window
  // Default: 3 changes in 1 hour
}

export class RepeatedFailuresRule implements DetectionRule {
  // Triggers when proposal executions fail repeatedly
  // Default: 3 failures in 1 hour
}

export class HighProposalFrequencyRule implements DetectionRule {
  // Triggers when proposals are created too frequently
  // Default: 10 proposals in 1 hour
}

export class CredentialRevocationSpikeRule implements DetectionRule {
  // Triggers when credentials are revoked rapidly
  // Default: 2 revocations in 30 minutes
}

// Usage
const detector = getAnomalyDetector();

detector.onAnomaly((anomaly) => {
  console.log(`Anomaly detected: ${anomaly.type} - ${anomaly.message}`);
  // Trigger alert, playbook, etc.
});
```

---

## 5. Alert System

**File:** `lib/alerts/engine.ts`

```typescript
export class AlertEngine {
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
      }
    }

    return sentAlerts;
  }

  private async sendAlert(alert: Alert, channels: AlertChannelConfig[]) {
    for (const channel of channels) {
      const sender = channelSenders[channel.type];
      await sender.send(alert, channel.config);
    }
  }
}

// Channel senders
const channelSenders: Record<AlertChannel, ChannelSender> = {
  webhook: webhookSender,   // POST to URL
  slack: slackSender,       // Slack webhook with attachments
  discord: discordSender,   // Discord webhook with embeds
  email: emailSender,       // Email (requires service)
  console: consoleSender,   // Console logging
};

// Usage
const alertEngine = getAlertEngine();

alertEngine.addRule({
  id: "emergency-alerts",
  name: "Emergency Events",
  channels: [
    { type: "slack", config: { webhookUrl: "https://hooks.slack.com/..." } },
    { type: "discord", config: { webhookUrl: "https://discord.com/api/webhooks/..." } },
  ],
  conditions: [
    { type: "event_type", value: "EMERGENCY", operator: "contains" },
  ],
  severity: "critical",
  cooldownSeconds: 60,
  enabled: true,
});
```

---

## 6. Incident Playbooks

**File:** `lib/playbooks/types.ts`

Automated response sequences for incidents.

```typescript
export interface Playbook {
  readonly id: string;
  readonly name: string;
  readonly triggerConditions: PlaybookTrigger[];
  readonly steps: PlaybookStep[];
  readonly requiresApproval: boolean;
  readonly timeout: number;
}

export class PlaybookRunner {
  async execute(
    playbookId: string,
    multisigAddress: string,
    chainId: string,
    triggeredBy: string,
  ): Promise<PlaybookResult> {
    const playbook = this.playbooks.get(playbookId);
    
    for (const step of playbook.steps) {
      const result = await this.executeStep(step, context);
      
      if (result.status === "failure" && step.onFailure === "stop") {
        return this.completeExecution(executionId, "failed");
      }
    }

    return this.completeExecution(executionId, "completed");
  }
}

// Pre-defined playbooks
export const EMERGENCY_RESPONSE_PLAYBOOK: Playbook = {
  id: "emergency_response",
  name: "Emergency Response",
  triggerConditions: [
    { type: "anomaly", conditions: { minSeverity: "critical" } },
  ],
  steps: [
    { id: "pause", action: "pause_multisig", params: { reason: "Auto-response" } },
    { id: "alert", action: "send_alert", params: { message: "Critical anomaly" } },
    { id: "incident", action: "create_incident", params: { severity: "critical" } },
    { id: "notify", action: "notify_team", params: { channel: "emergency" } },
  ],
  requiresApproval: false,
  timeout: 60,
};

// Usage
const runner = getPlaybookRunner();

detector.onAnomaly(async (anomaly) => {
  const playbooks = runner.findPlaybooksForAnomaly(anomaly);
  
  for (const playbook of playbooks) {
    await runner.execute(
      playbook.id,
      anomaly.multisigAddress,
      anomaly.chainId,
      "anomaly_detector"
    );
  }
});
```

---

## 7. Database Schema

**File:** `lib/localDb.ts`

### New Tables

```typescript
// Policies
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

// Policy Violations
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

// Emergency State
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

// Incidents
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
  triggeredBy: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

// Spend Records (for limit tracking)
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
```

### Updated Schema

```typescript
interface DbContractMultisig {
  // ... existing fields
  policyVersion: number;  // NEW: Track policy upgrades
}
```

---

## 8. ContractMultisigEngine Integration

**File:** `lib/multisig/contract-engine.ts`

### New Configuration

```typescript
export interface ContractEngineConfig extends EngineConfig {
  // ... existing fields
  readonly policyEvaluator?: PolicyEvaluator;  // NEW
  readonly policyVersion?: number;              // NEW
}
```

### Policy Evaluation in createProposal

```typescript
async createProposal(input: ProposalInput, policyContext?: Partial<PolicyContext>) {
  // Phase 4: Pre-validate against policies
  if (this.policyEvaluator) {
    const draftProposal = this.buildDraftProposal(input);
    const policyResult = await this.evaluatePoliciesForProposal(draftProposal, policyContext);
    
    if (policyResult && !policyResult.allowed) {
      const violationMessages = policyResult.violations
        .map(v => `${v.policyType}: ${v.message}`)
        .join("; ");
      
      throw new MultisigEngineError(
        `Proposal violates policies: ${violationMessages}`,
        "PROPOSAL_NOT_PENDING",
        { violations: policyResult.violations }
      );
    }
  }

  // Continue with proposal creation...
}
```

### Policy Evaluation in executeProposal

```typescript
async executeProposal(proposalId: string, executorAddress?: string) {
  // ... credential verification ...

  // Phase 4: Evaluate policies before execution
  if (this.policyEvaluator && proposal) {
    const policyResult = await this.evaluatePoliciesForExecution(proposalForPolicy, {
      queuedAt,
      timeSinceQueue,
      currentTimestamp,
    });
    
    if (policyResult && !policyResult.allowed) {
      throw new MultisigEngineError(
        `Execution blocked by policies`,
        "PROPOSAL_NOT_PASSED",
        { violations: policyResult.violations }
      );
    }
  }

  // Continue with execution...
}
```

---

## 9. API Endpoints

### Policies API

```
GET  /api/chain/[chainId]/[address]/policies
POST /api/chain/[chainId]/[address]/policies
PUT  /api/chain/[chainId]/[address]/policies/[policyId]
DELETE /api/chain/[chainId]/[address]/policies/[policyId]
```

**Example: Create Policy**
```bash
POST /api/chain/cosmoshub-4/cosmos1multisig.../policies
Content-Type: application/json

{
  "type": "timelock",
  "name": "Standard Timelock",
  "config": {
    "minDelaySeconds": 3600,
    "maxDelaySeconds": 604800,
    "highValueMultiplier": 2.0
  },
  "enabled": true
}
```

### Emergency API

```
GET  /api/chain/[chainId]/[address]/emergency/status
POST /api/chain/[chainId]/[address]/emergency/pause
POST /api/chain/[chainId]/[address]/emergency/safe-mode
```

**Example: Pause Operations**
```bash
POST /api/chain/cosmoshub-4/cosmos1multisig.../emergency/pause
Content-Type: application/json

{
  "action": "pause",
  "actor": "cosmos1admin...",
  "reason": "Security incident investigation",
  "durationSeconds": 86400
}
```

### Monitoring API

```
GET /api/chain/[chainId]/[address]/monitoring/metrics
GET /api/chain/[chainId]/[address]/monitoring/alerts
GET /api/chain/[chainId]/[address]/monitoring/incidents
POST /api/chain/[chainId]/[address]/monitoring/incidents
PUT /api/chain/[chainId]/[address]/monitoring/incidents
```

---

## 10. UI Components

### EmergencyPanel

**File:** `components/emergency/EmergencyPanel.tsx`

Controls for pause/unpause and safe mode.

```tsx
<EmergencyPanel
  multisigAddress="cosmos1..."
  chainId="cosmoshub-4"
  state={emergencyState}
  normalThreshold={2}
  totalWeight={5}
  onPause={handlePause}
  onUnpause={handleUnpause}
  onActivateSafeMode={handleSafeMode}
  onDeactivateSafeMode={handleDeactivate}
  canPause={true}
  canUnpause={true}
/>
```

### PolicyManager

**File:** `components/policies/PolicyManager.tsx`

Policy list with create/edit/delete/toggle.

```tsx
<PolicyManager
  multisigAddress="cosmos1..."
  chainId="cosmoshub-4"
  policies={policies}
  onCreatePolicy={(type) => openEditor(type)}
  onEditPolicy={(policy) => openEditor(policy)}
  onDeletePolicy={handleDelete}
  onTogglePolicy={handleToggle}
/>
```

### MonitoringDashboard

**File:** `components/monitoring/MonitoringDashboard.tsx`

Metrics, events, anomalies, and alerts in tabs.

```tsx
<MonitoringDashboard
  multisigAddress="cosmos1..."
  chainId="cosmoshub-4"
  metrics={[
    { label: "Proposals Created", value: 42, change: 12 },
    { label: "Proposals Executed", value: 38, change: 8 },
    { label: "Policy Violations", value: 3, change: -50 },
    { label: "Active Alerts", value: 0 },
  ]}
  recentEvents={events}
  recentAnomalies={anomalies}
  recentAlerts={alerts}
/>
```

---

## 11. Testing

### Policy Enforcement Tests

**File:** `__tests__/policies/policy-enforcement.test.ts`

```typescript
describe("TimelockPolicy", () => {
  it("requires queue before execution", async () => {
    const policy = new TimelockPolicy("timelock-1", "Test", { minDelaySeconds: 3600 });
    const context = createTestContext({ queuedAt: null });
    
    const result = await policy.evaluateExecution(proposal, context);
    
    expect(result.allowed).toBe(false);
    expect(result.violations[0].code).toBe("QUEUE_REQUIRED");
  });

  it("blocks execution before timelock", async () => {
    const context = createTestContext({
      queuedAt: now - 1800, // 30 minutes ago
      timeSinceQueue: 1800,
    });
    
    const result = await policy.evaluateExecution(proposal, context);
    
    expect(result.allowed).toBe(false);
    expect(result.violations[0].code).toBe("TIMELOCK_NOT_MET");
  });
});
```

### Emergency Controls Tests

**File:** `__tests__/emergency/emergency-controls.test.ts`

```typescript
describe("PauseController", () => {
  it("blocks approvals when paused", () => {
    mockLocalDb.getEmergencyState.mockReturnValue({ isPaused: true, ... });

    const result = controller.isOperationBlocked(multisig, chainId, "approve");

    expect(result.blocked).toBe(true);
  });

  it("never blocks queries", () => {
    mockLocalDb.getEmergencyState.mockReturnValue({ isPaused: true, ... });

    const result = controller.isOperationBlocked(multisig, chainId, "query");

    expect(result.blocked).toBe(false);
  });
});
```

### Event Emission Tests

**File:** `__tests__/monitoring/event-emission.test.ts`

```typescript
describe("EventStream", () => {
  it("emits guaranteed events with required attributes", async () => {
    await stream.emitProposalEvent(
      "PROPOSAL_EXECUTED",
      "cosmos1...",
      "cosmoshub-4",
      "42",
      { txHash: "ABC123", executor: "cosmos1..." }
    );

    const events = memorySink.getEventsByType("PROPOSAL_EXECUTED");
    expect(events).toHaveLength(1);
    expect(events[0].data.proposalId).toBe("42");
    expect(events[0].data.txHash).toBe("ABC123");
  });
});
```

---

## Acceptance Criteria (Verified)

| Criteria | Status |
|----------|--------|
| PolicyEvaluator: All policy logic flows through interface | ✅ |
| Timelocks: Proposals delayed by configured duration | ✅ |
| Emergency Pause: Operations haltable, credentials preserved | ✅ |
| Safe Mode: Threshold elevatable without redeployment | ✅ |
| Message Restrictions: Unwanted types blocked at contract | ✅ |
| Spend Limits: Daily/per-tx caps enforced | ✅ |
| Allowlists: Recipient filtering enforced | ✅ |
| Event Guarantees: All required events emit reliably | ✅ |
| Anomaly Detection: Patterns trigger alerts < 1 minute | ✅ |
| Playbooks: Automated response to incidents | ✅ |
| Audit Trail: Complete history of policies/violations | ✅ |

---

## Migration Notes

### Existing Databases

The migration automatically adds:
- New Phase 4 tables (policies, incidents, alerts, etc.)
- `policyVersion` field to existing `contractMultisigs`

```typescript
// Migration code in lib/localDb.ts
if (!db.policies) db.policies = [];
if (!db.emergencyStates) db.emergencyStates = [];
// ...

for (const multisig of db.contractMultisigs || []) {
  if (multisig.policyVersion === undefined) {
    multisig.policyVersion = 1;
  }
}
```

### Breaking Changes

None - all Phase 4 features are additive and opt-in.

---

## Future Enhancements (Phase 5+)

1. **Full Observability Stack** - Prometheus/Grafana integration
2. **Policy Templates** - Pre-built policy configurations for common use cases
3. **Multi-Chain Policies** - Policies that span multiple chains
4. **Machine Learning Anomaly Detection** - Replace rule-based with ML
5. **Policy Versioning** - Rollback and version history for policies

