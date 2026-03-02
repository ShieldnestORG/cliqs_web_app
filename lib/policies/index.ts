/**
 * Policy Module Exports
 *
 * File: lib/policies/index.ts
 *
 * Central export point for Phase 4 policy system.
 * All policy logic flows through PolicyEvaluator interface.
 */

// Core types
export {
  // Policy types
  type PolicyType,
  type PolicyViolationSeverity,
  type PolicyViolationCode,

  // Context and decision types
  type PolicyContext,
  type PolicyViolation,
  type PolicyDecision,
  type PolicyEvaluationResult,

  // Policy interfaces
  type Policy,
  type PolicyEvaluator,

  // Configuration types
  type TimelockPolicyConfig,
  type SpendLimitPolicyConfig,
  type MsgTypePolicyConfig,
  type AddressFilterPolicyConfig,
  type EmergencyPolicyConfig,
  type PolicyConfig,

  // Storage types
  type StoredPolicy,
  type StoredPolicyViolation,

  // Event types
  type PolicyEventType,
  type PolicyEvent,

  // Error types
  type PolicyErrorCode,
  PolicyError,

  // Helper functions
  allowed,
  denied,
  createViolation,
  mergeDecisions,
  isAllowed,
  getHighestSeverity,
} from "./types";

// Registry
export {
  PolicyRegistry,
  createPolicyRegistry,
  getPolicyRegistry,
  setPolicyRegistry,
  type PolicyRegistryConfig,
  type PolicyFactory,
} from "./registry";

// Individual policies
export {
  TimelockPolicy,
  createTimelockPolicy,
  createDefaultTimelockPolicy,
  calculateExecuteAfter,
  isHighValueProposal,
  formatTimelockRemaining,
} from "./timelock";

export {
  MsgTypePolicy,
  createMsgTypePolicy,
  createPermissiveMsgTypePolicy,
  createRestrictiveMsgTypePolicy,
  createHighSecurityMsgTypePolicy,
  HIGH_RISK_MSG_TYPES,
  VALUE_MOVING_MSG_TYPES,
} from "./msg-type-restriction";

export {
  SpendLimitPolicy,
  createSpendLimitPolicy,
  createBasicSpendLimitPolicy,
  createMultiDenomSpendLimitPolicy,
} from "./spend-limit";

export {
  SpendTracker,
  createSpendTracker,
  getSpendTracker,
  setSpendTracker,
  type SpendRecord,
  type SpendSummary,
} from "./spend-tracker";

export {
  AddressFilterPolicy,
  createAddressFilterPolicy,
  createAllowlistPolicy,
  createDenylistPolicy,
  createCombinedFilterPolicy,
  createTrustedAddressesPolicy,
} from "./address-filter";
