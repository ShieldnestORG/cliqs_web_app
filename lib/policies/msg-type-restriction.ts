/**
 * Message Type Restriction Policy
 * 
 * File: lib/policies/msg-type-restriction.ts
 * 
 * Priority 3 policy - Controls attack surface before enabling spending.
 * Allows blocking/allowing specific message types and requiring
 * higher thresholds for certain operations.
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Proposal } from "@/lib/multisig/types";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import {
  Policy,
  PolicyContext,
  PolicyDecision,
  PolicyViolation,
  MsgTypePolicyConfig,
  StoredPolicy,
  allowed,
  denied,
  createViolation,
} from "./types";

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * High-risk message types that might need extra scrutiny
 */
export const HIGH_RISK_MSG_TYPES: readonly MsgTypeUrl[] = [
  MsgTypeUrls.UpdateAdmin,       // Changing contract admin
  MsgTypeUrls.MigrateContract,   // Upgrading contract code
  MsgTypeUrls.CreateValidator,   // Creating a validator
  MsgTypeUrls.EditValidator,     // Editing validator params
];

/**
 * Message types that move value
 */
export const VALUE_MOVING_MSG_TYPES: readonly MsgTypeUrl[] = [
  MsgTypeUrls.Send,
  MsgTypeUrls.Transfer,
  MsgTypeUrls.Delegate,
  MsgTypeUrls.Undelegate,
  MsgTypeUrls.BeginRedelegate,
];

const DEFAULT_CONFIG: MsgTypePolicyConfig = {
  allowedMsgTypes: [], // Empty = all allowed
  blockedMsgTypes: [],
  requiresHigherThreshold: new Map(),
};

// ============================================================================
// Message Type Policy Implementation
// ============================================================================

export class MsgTypePolicy implements Policy {
  readonly id: string;
  readonly type = "msg_type" as const;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  
  private readonly config: MsgTypePolicyConfig;

  constructor(
    id: string,
    name: string,
    config: Partial<MsgTypePolicyConfig> = {},
    options: { enabled?: boolean; priority?: number } = {},
  ) {
    this.id = id;
    this.name = name;
    this.enabled = options.enabled ?? true;
    this.priority = options.priority ?? 30; // After timelock and emergency
    
    this.config = {
      allowedMsgTypes: config.allowedMsgTypes ?? DEFAULT_CONFIG.allowedMsgTypes,
      blockedMsgTypes: config.blockedMsgTypes ?? DEFAULT_CONFIG.blockedMsgTypes,
      requiresHigherThreshold: config.requiresHigherThreshold ?? DEFAULT_CONFIG.requiresHigherThreshold,
    };
  }

  /**
   * Evaluate for proposal creation
   */
  async evaluateProposal(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyDecision> {
    const violations: PolicyViolation[] = [];

    for (const msg of proposal.content.msgs) {
      const msgType = msg.typeUrl as MsgTypeUrl;

      // Check if message type is blocked
      if (this.isBlocked(msgType)) {
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_BLOCKED",
            `Message type ${this.formatMsgType(msgType)} is blocked by policy`,
            "high",
            { msgType, blockedTypes: Array.from(this.config.blockedMsgTypes) },
          ),
        );
        continue;
      }

      // Check if message type is allowed (if allowlist is active)
      if (!this.isAllowed(msgType)) {
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_NOT_ALLOWED",
            `Message type ${this.formatMsgType(msgType)} is not in the allowed list`,
            "high",
            { msgType, allowedTypes: Array.from(this.config.allowedMsgTypes) },
          ),
        );
        continue;
      }

      // Check if message type requires higher threshold
      const requiredThreshold = this.getRequiredThreshold(msgType);
      if (requiredThreshold !== null && requiredThreshold > context.normalThreshold) {
        // This is a warning during proposal creation
        // Will be enforced more strictly during execution
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_REQUIRES_HIGHER_THRESHOLD",
            `Message type ${this.formatMsgType(msgType)} requires threshold of ${requiredThreshold} (current: ${context.normalThreshold})`,
            "medium",
            { 
              msgType, 
              requiredThreshold, 
              currentThreshold: context.normalThreshold,
            },
          ),
        );
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
  async evaluateExecution(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyDecision> {
    // Re-evaluate at execution time in case policies changed
    const violations: PolicyViolation[] = [];

    for (const msg of proposal.content.msgs) {
      const msgType = msg.typeUrl as MsgTypeUrl;

      // Check if message type is blocked
      if (this.isBlocked(msgType)) {
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_BLOCKED",
            `Execution blocked: message type ${this.formatMsgType(msgType)} is not allowed`,
            "critical",
            { msgType },
          ),
        );
        continue;
      }

      // Check allowlist
      if (!this.isAllowed(msgType)) {
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_NOT_ALLOWED",
            `Execution blocked: message type ${this.formatMsgType(msgType)} is not in allowed list`,
            "critical",
            { msgType },
          ),
        );
        continue;
      }

      // Check threshold requirement
      const requiredThreshold = this.getRequiredThreshold(msgType);
      const effectiveThreshold = context.isSafeMode && context.elevatedThreshold 
        ? context.elevatedThreshold 
        : context.normalThreshold;
        
      if (requiredThreshold !== null && requiredThreshold > effectiveThreshold) {
        violations.push(
          createViolation(
            this.id,
            this.type,
            "MSG_TYPE_REQUIRES_HIGHER_THRESHOLD",
            `Execution requires threshold of ${requiredThreshold} for ${this.formatMsgType(msgType)}`,
            "high",
            { 
              msgType, 
              requiredThreshold, 
              effectiveThreshold,
            },
          ),
        );
      }
    }

    if (violations.length > 0) {
      return denied(violations);
    }

    return allowed();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if a message type is blocked
   */
  private isBlocked(msgType: MsgTypeUrl): boolean {
    return this.config.blockedMsgTypes.includes(msgType);
  }

  /**
   * Check if a message type is allowed
   * Empty allowlist = all allowed (except blocked)
   */
  private isAllowed(msgType: MsgTypeUrl): boolean {
    // If no allowlist, all non-blocked types are allowed
    if (this.config.allowedMsgTypes.length === 0) {
      return true;
    }
    return this.config.allowedMsgTypes.includes(msgType);
  }

  /**
   * Get required threshold for a message type
   */
  private getRequiredThreshold(msgType: MsgTypeUrl): number | null {
    return this.config.requiresHigherThreshold.get(msgType) ?? null;
  }

  /**
   * Format message type for display
   */
  private formatMsgType(msgType: string): string {
    // Extract the last part of the type URL for readability
    const parts = msgType.split(".");
    return parts[parts.length - 1] || msgType;
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get the current configuration
   */
  getConfig(): MsgTypePolicyConfig {
    return {
      allowedMsgTypes: [...this.config.allowedMsgTypes],
      blockedMsgTypes: [...this.config.blockedMsgTypes],
      requiresHigherThreshold: new Map(this.config.requiresHigherThreshold),
    };
  }

  /**
   * Get blocked message types
   */
  getBlockedTypes(): readonly MsgTypeUrl[] {
    return this.config.blockedMsgTypes;
  }

  /**
   * Get allowed message types
   */
  getAllowedTypes(): readonly MsgTypeUrl[] {
    return this.config.allowedMsgTypes;
  }

  /**
   * Check if a specific type requires higher threshold
   */
  requiresElevatedThreshold(msgType: MsgTypeUrl): boolean {
    return this.config.requiresHigherThreshold.has(msgType);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a message type policy from stored configuration
 */
export function createMsgTypePolicy(stored: StoredPolicy): MsgTypePolicy {
  const parsedConfig = JSON.parse(stored.configJSON);
  
  // Convert requiresHigherThreshold from object to Map if needed
  let requiresHigherThreshold = parsedConfig.requiresHigherThreshold;
  if (requiresHigherThreshold && !(requiresHigherThreshold instanceof Map)) {
    const thresholds = requiresHigherThreshold as unknown as Record<string, number>;
    requiresHigherThreshold = new Map(Object.entries(thresholds)) as ReadonlyMap<MsgTypeUrl, number>;
  }
  
  const config: MsgTypePolicyConfig = {
    ...parsedConfig,
    requiresHigherThreshold,
  };
  
  return new MsgTypePolicy(
    stored.id,
    stored.name,
    config,
    { enabled: stored.enabled, priority: stored.priority },
  );
}

/**
 * Create a permissive policy (allows all, blocks none)
 */
export function createPermissiveMsgTypePolicy(id: string): MsgTypePolicy {
  return new MsgTypePolicy(id, "Permissive Message Types", {
    allowedMsgTypes: [],
    blockedMsgTypes: [],
    requiresHigherThreshold: new Map(),
  });
}

/**
 * Create a restrictive policy (only allows basic operations)
 */
export function createRestrictiveMsgTypePolicy(id: string): MsgTypePolicy {
  return new MsgTypePolicy(id, "Restrictive Message Types", {
    allowedMsgTypes: [
      MsgTypeUrls.Send,
      MsgTypeUrls.Delegate,
      MsgTypeUrls.Undelegate,
      MsgTypeUrls.BeginRedelegate,
      MsgTypeUrls.Vote,
      MsgTypeUrls.WithdrawDelegatorReward,
    ],
    blockedMsgTypes: [],
    requiresHigherThreshold: new Map(),
  });
}

/**
 * Create a high-security policy (blocks dangerous operations)
 */
export function createHighSecurityMsgTypePolicy(
  id: string,
  normalThreshold: number,
): MsgTypePolicy {
  const elevatedThreshold = normalThreshold + 1;
  
  return new MsgTypePolicy(id, "High Security Message Types", {
    allowedMsgTypes: [], // Allow all except blocked
    blockedMsgTypes: [
      MsgTypeUrls.MigrateContract, // Block contract migrations
    ],
    requiresHigherThreshold: new Map([
      [MsgTypeUrls.UpdateAdmin, elevatedThreshold],
      [MsgTypeUrls.CreateValidator, elevatedThreshold],
      [MsgTypeUrls.EditValidator, elevatedThreshold],
      [MsgTypeUrls.ExecuteContract, elevatedThreshold],
    ]),
  });
}

