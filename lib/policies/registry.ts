/**
 * Policy Registry - Central Policy Management and Evaluation
 * 
 * File: lib/policies/registry.ts
 * 
 * This is the central hub for policy management and evaluation.
 * ALL policy logic flows through this registry - no policy logic in engines.
 * 
 * Responsibilities:
 * - Register/unregister policies for multisigs
 * - Compose and orchestrate policy evaluation
 * - Cache and manage policy instances
 * - Emit policy-related events
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "@cosmjs/amino";

import { Proposal } from "@/lib/multisig/types";
import {
  Policy,
  PolicyContext,
  PolicyDecision,
  PolicyEvaluationResult,
  PolicyEvaluator,
  PolicyType,
  PolicyViolation,
  PolicyConfig,
  StoredPolicy,
  PolicyError,
  PolicyEvent,
  allowed,
  mergeDecisions,
} from "./types";

// ============================================================================
// Policy Registry Configuration
// ============================================================================

export interface PolicyRegistryConfig {
  /** Maximum number of policies per multisig */
  readonly maxPoliciesPerMultisig: number;
  /** Whether to fail on first violation or collect all */
  readonly failFast: boolean;
  /** Default policy version for new multisigs */
  readonly defaultPolicyVersion: number;
}

const DEFAULT_CONFIG: PolicyRegistryConfig = {
  maxPoliciesPerMultisig: 20,
  failFast: false,
  defaultPolicyVersion: 1,
};

// ============================================================================
// Policy Factory Type
// ============================================================================

/**
 * Factory function to create policy instances from stored configuration
 */
export type PolicyFactory = (stored: StoredPolicy) => Policy;

// ============================================================================
// Policy Registry Implementation
// ============================================================================

/**
 * Central policy registry implementing PolicyEvaluator interface
 */
export class PolicyRegistry implements PolicyEvaluator {
  private readonly config: PolicyRegistryConfig;
  
  /** Map of multisig address to policies */
  private readonly policies: Map<string, Map<string, Policy>> = new Map();
  
  /** Policy factories by type */
  private readonly factories: Map<PolicyType, PolicyFactory> = new Map();
  
  /** Event listeners */
  private readonly eventListeners: Set<(event: PolicyEvent) => void> = new Set();

  constructor(config: Partial<PolicyRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // Policy Factory Registration
  // ============================================================================

  /**
   * Register a factory for creating policies of a specific type
   */
  registerFactory(type: PolicyType, factory: PolicyFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Get registered factory for a policy type
   */
  getFactory(type: PolicyType): PolicyFactory | undefined {
    return this.factories.get(type);
  }

  // ============================================================================
  // Policy Management
  // ============================================================================

  /**
   * Register a policy for a multisig
   */
  registerPolicy(multisigAddress: string, policy: Policy): void {
    let multisigPolicies = this.policies.get(multisigAddress);
    
    if (!multisigPolicies) {
      multisigPolicies = new Map();
      this.policies.set(multisigAddress, multisigPolicies);
    }
    
    if (multisigPolicies.size >= this.config.maxPoliciesPerMultisig) {
      throw new PolicyError(
        `Maximum policies (${this.config.maxPoliciesPerMultisig}) reached for multisig`,
        "INVALID_POLICY_CONFIG",
        { multisigAddress, maxPolicies: this.config.maxPoliciesPerMultisig },
      );
    }
    
    multisigPolicies.set(policy.id, policy);
    
    this.emitEvent({
      type: "POLICY_CREATED",
      policyId: policy.id,
      multisigAddress,
      chainId: "", // Will be filled by caller
      timestamp: new Date().toISOString(),
      actor: "", // Will be filled by caller
      details: { policyType: policy.type, policyName: policy.name },
    });
  }

  /**
   * Unregister a policy from a multisig
   */
  unregisterPolicy(multisigAddress: string, policyId: string): boolean {
    const multisigPolicies = this.policies.get(multisigAddress);
    
    if (!multisigPolicies) {
      return false;
    }
    
    const policy = multisigPolicies.get(policyId);
    if (!policy) {
      return false;
    }
    
    multisigPolicies.delete(policyId);
    
    this.emitEvent({
      type: "POLICY_DELETED",
      policyId,
      multisigAddress,
      chainId: "",
      timestamp: new Date().toISOString(),
      actor: "",
      details: { policyType: policy.type },
    });
    
    return true;
  }

  /**
   * Get a specific policy
   */
  getPolicy(multisigAddress: string, policyId: string): Policy | undefined {
    return this.policies.get(multisigAddress)?.get(policyId);
  }

  /**
   * Get all policies for a multisig (sorted by priority)
   */
  getPolicies(multisigAddress: string): Policy[] {
    const multisigPolicies = this.policies.get(multisigAddress);
    
    if (!multisigPolicies) {
      return [];
    }
    
    return Array.from(multisigPolicies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all policies for a multisig (including disabled)
   */
  getAllPolicies(multisigAddress: string): Policy[] {
    const multisigPolicies = this.policies.get(multisigAddress);
    
    if (!multisigPolicies) {
      return [];
    }
    
    return Array.from(multisigPolicies.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if a multisig has any policies
   */
  hasPolicies(multisigAddress: string): boolean {
    const multisigPolicies = this.policies.get(multisigAddress);
    return multisigPolicies !== undefined && multisigPolicies.size > 0;
  }

  /**
   * Clear all policies for a multisig
   */
  clearPolicies(multisigAddress: string): void {
    this.policies.delete(multisigAddress);
  }

  // ============================================================================
  // Policy Loading from Storage
  // ============================================================================

  /**
   * Load policies from stored configuration
   */
  loadFromStorage(storedPolicies: StoredPolicy[]): void {
    for (const stored of storedPolicies) {
      const factory = this.factories.get(stored.type);
      
      if (!factory) {
        console.warn(`No factory registered for policy type: ${stored.type}`);
        continue;
      }
      
      try {
        const policy = factory(stored);
        this.registerPolicy(stored.multisigAddress, policy);
      } catch (error) {
        console.error(`Failed to load policy ${stored.id}:`, error);
      }
    }
  }

  // ============================================================================
  // PolicyEvaluator Implementation
  // ============================================================================

  /**
   * Evaluate all policies for proposal creation
   */
  async evaluateProposal(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult> {
    const policies = this.getPolicies(context.multisigAddress);
    const evaluatedPolicies: string[] = [];
    const decisions: PolicyDecision[] = [];
    const warnings: PolicyViolation[] = [];
    
    for (const policy of policies) {
      evaluatedPolicies.push(policy.id);
      
      try {
        const decision = await policy.evaluateProposal(proposal, context);
        decisions.push(decision);
        
        // In fail-fast mode, stop on first violation
        if (this.config.failFast && !decision.allowed) {
          break;
        }
      } catch (error) {
        // Policy evaluation error - treat as violation
        decisions.push({
          allowed: false,
          violations: [{
            policyId: policy.id,
            policyType: policy.type,
            code: "CUSTOM_POLICY_VIOLATION",
            message: `Policy evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            severity: "high",
            details: { error: String(error) },
          }],
        });
        
        if (this.config.failFast) {
          break;
        }
      }
    }
    
    const merged = mergeDecisions(decisions);
    const violations = merged.allowed ? [] : merged.violations;
    
    // Emit violation events
    for (const violation of violations) {
      this.emitEvent({
        type: "POLICY_VIOLATION",
        policyId: violation.policyId,
        multisigAddress: context.multisigAddress,
        chainId: context.chainId,
        timestamp: new Date().toISOString(),
        actor: "",
        details: {
          proposalId: proposal.id,
          violationCode: violation.code,
          severity: violation.severity,
          message: violation.message,
        },
      });
    }
    
    return {
      allowed: merged.allowed,
      violations,
      evaluatedPolicies,
      evaluatedAt: new Date().toISOString(),
      warnings,
    };
  }

  /**
   * Evaluate all policies for proposal execution
   */
  async evaluateExecution(
    proposal: Proposal,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult> {
    const policies = this.getPolicies(context.multisigAddress);
    const evaluatedPolicies: string[] = [];
    const decisions: PolicyDecision[] = [];
    const warnings: PolicyViolation[] = [];
    
    for (const policy of policies) {
      evaluatedPolicies.push(policy.id);
      
      try {
        const decision = await policy.evaluateExecution(proposal, context);
        decisions.push(decision);
        
        if (this.config.failFast && !decision.allowed) {
          break;
        }
      } catch (error) {
        decisions.push({
          allowed: false,
          violations: [{
            policyId: policy.id,
            policyType: policy.type,
            code: "CUSTOM_POLICY_VIOLATION",
            message: `Policy evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            severity: "high",
            details: { error: String(error) },
          }],
        });
        
        if (this.config.failFast) {
          break;
        }
      }
    }
    
    const merged = mergeDecisions(decisions);
    const violations = merged.allowed ? [] : merged.violations;
    
    // Emit violation events
    for (const violation of violations) {
      this.emitEvent({
        type: "POLICY_VIOLATION",
        policyId: violation.policyId,
        multisigAddress: context.multisigAddress,
        chainId: context.chainId,
        timestamp: new Date().toISOString(),
        actor: "",
        details: {
          proposalId: proposal.id,
          violationCode: violation.code,
          severity: violation.severity,
          message: violation.message,
          phase: "execution",
        },
      });
    }
    
    return {
      allowed: merged.allowed,
      violations,
      evaluatedPolicies,
      evaluatedAt: new Date().toISOString(),
      warnings,
    };
  }

  /**
   * Pre-validate a proposal before creation (UI optimization)
   * Uses partial context - some values may be estimated
   */
  async preValidate(
    proposalInput: {
      msgs: readonly EncodeObject[];
      recipientAddresses: readonly string[];
      proposalValue: readonly Coin[];
    },
    partialContext: Partial<PolicyContext>,
  ): Promise<PolicyEvaluationResult> {
    const multisigAddress = partialContext.multisigAddress;
    
    if (!multisigAddress) {
      throw new PolicyError(
        "Multisig address is required for pre-validation",
        "CONTEXT_INCOMPLETE",
      );
    }
    
    const policies = this.getPolicies(multisigAddress);
    const evaluatedPolicies: string[] = [];
    const warnings: PolicyViolation[] = [];
    
    // For pre-validation, we create a minimal context
    // Missing values are set to safe defaults
    const context: PolicyContext = {
      signerRoles: partialContext.signerRoles ?? [],
      credentialVersions: partialContext.credentialVersions ?? new Map(),
      minRequiredVersion: partialContext.minRequiredVersion ?? 0,
      spentInWindow: partialContext.spentInWindow ?? new Map(),
      proposalValue: proposalInput.proposalValue,
      treasuryBalance: partialContext.treasuryBalance ?? [],
      recipientAddresses: proposalInput.recipientAddresses,
      messageTypes: proposalInput.msgs.map((m) => m.typeUrl) as never,
      messages: proposalInput.msgs,
      queuedAt: null,
      timeSinceQueue: 0,
      currentHeight: partialContext.currentHeight ?? 0,
      currentTimestamp: partialContext.currentTimestamp ?? Math.floor(Date.now() / 1000),
      isPaused: partialContext.isPaused ?? false,
      isSafeMode: partialContext.isSafeMode ?? false,
      elevatedThreshold: partialContext.elevatedThreshold ?? null,
      normalThreshold: partialContext.normalThreshold ?? 1,
      multisigAddress,
      chainId: partialContext.chainId ?? "",
      policyVersion: partialContext.policyVersion ?? 1,
    };
    
    // Create a dummy proposal for evaluation
    const dummyProposal: Proposal = {
      id: "pre-validation",
      multisigAddress,
      chainId: context.chainId,
      payloadHash: "",
      content: {
        msgs: proposalInput.msgs,
        fee: { amount: [], gas: "0" },
        memo: "",
        chainId: context.chainId,
        accountNumber: 0,
        sequence: 0,
      },
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const decisions: PolicyDecision[] = [];
    
    for (const policy of policies) {
      evaluatedPolicies.push(policy.id);
      
      try {
        // Only evaluate proposal phase for pre-validation
        const decision = await policy.evaluateProposal(dummyProposal, context);
        decisions.push(decision);
      } catch (error) {
        // For pre-validation, we add warnings instead of failures
        warnings.push({
          policyId: policy.id,
          policyType: policy.type,
          code: "CUSTOM_POLICY_VIOLATION",
          message: `Pre-validation warning: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "medium",
        });
      }
    }
    
    const merged = mergeDecisions(decisions);
    
    return {
      allowed: merged.allowed,
      violations: merged.allowed ? [] : merged.violations,
      evaluatedPolicies,
      evaluatedAt: new Date().toISOString(),
      warnings,
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add an event listener
   */
  addEventListener(listener: (event: PolicyEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: (event: PolicyEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit a policy event
   */
  private emitEvent(event: PolicyEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in policy event listener:", error);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get policy statistics for a multisig
   */
  getStats(multisigAddress: string): {
    totalPolicies: number;
    enabledPolicies: number;
    byType: Record<PolicyType, number>;
  } {
    const policies = this.getAllPolicies(multisigAddress);
    const enabledPolicies = policies.filter((p) => p.enabled);
    
    const byType: Record<PolicyType, number> = {
      timelock: 0,
      emergency: 0,
      msg_type: 0,
      spend_limit: 0,
      allowlist: 0,
      denylist: 0,
      custom: 0,
    };
    
    for (const policy of policies) {
      byType[policy.type]++;
    }
    
    return {
      totalPolicies: policies.length,
      enabledPolicies: enabledPolicies.length,
      byType,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new policy registry
 */
export function createPolicyRegistry(
  config?: Partial<PolicyRegistryConfig>,
): PolicyRegistry {
  return new PolicyRegistry(config);
}

// ============================================================================
// Singleton Instance (optional)
// ============================================================================

let globalRegistry: PolicyRegistry | null = null;

/**
 * Get the global policy registry instance
 */
export function getPolicyRegistry(): PolicyRegistry {
  if (!globalRegistry) {
    globalRegistry = new PolicyRegistry();
  }
  return globalRegistry;
}

/**
 * Set the global policy registry instance
 */
export function setPolicyRegistry(registry: PolicyRegistry): void {
  globalRegistry = registry;
}

