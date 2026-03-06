/**
 * Address Filter Policy (Allowlist/Denylist)
 *
 * File: lib/policies/address-filter.ts
 *
 * Priority 5 policy - Weakest protection, most opinionated.
 * Filters recipient addresses based on allowlists and denylists.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Proposal } from "@/lib/multisig/types";
import {
  Policy,
  PolicyContext,
  PolicyDecision,
  PolicyViolation,
  AddressFilterPolicyConfig,
  StoredPolicy,
  allowed,
  denied,
  createViolation,
} from "./types";
import { truncateAddress } from "../displayHelpers";

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AddressFilterPolicyConfig = {
  filterType: "denylist", // Denylist is more permissive
  allowlist: [],
  denylist: [],
};

// ============================================================================
// Address Filter Policy Implementation
// ============================================================================

export class AddressFilterPolicy implements Policy {
  readonly id: string;
  readonly type: "allowlist" | "denylist";
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;

  private readonly config: AddressFilterPolicyConfig;

  constructor(
    id: string,
    name: string,
    config: Partial<AddressFilterPolicyConfig> = {},
    options: { enabled?: boolean; priority?: number } = {},
  ) {
    this.id = id;
    this.name = name;
    this.enabled = options.enabled ?? true;
    this.priority = options.priority ?? 50; // Last in policy order

    this.config = {
      filterType: config.filterType ?? DEFAULT_CONFIG.filterType,
      allowlist: config.allowlist ?? DEFAULT_CONFIG.allowlist,
      denylist: config.denylist ?? DEFAULT_CONFIG.denylist,
    };

    // Set type based on primary filter mode
    this.type = this.config.filterType === "allowlist" ? "allowlist" : "denylist";
  }

  /**
   * Evaluate for proposal creation
   */
  async evaluateProposal(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    const violations: PolicyViolation[] = [];

    for (const recipient of context.recipientAddresses) {
      const result = this.checkAddress(recipient);

      if (!result.allowed) {
        violations.push(
          createViolation(this.id, this.type, result.code, result.message, "high", {
            address: recipient,
            reason: result.reason,
          }),
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
  async evaluateExecution(proposal: Proposal, context: PolicyContext): Promise<PolicyDecision> {
    // Re-check at execution time in case lists were updated
    return this.evaluateProposal(proposal, context);
  }

  // ============================================================================
  // Address Checking
  // ============================================================================

  /**
   * Check if an address is allowed
   */
  private checkAddress(address: string): {
    allowed: boolean;
    code: "RECIPIENT_NOT_IN_ALLOWLIST" | "RECIPIENT_IN_DENYLIST";
    message: string;
    reason: string;
  } {
    const normalizedAddress = address.toLowerCase();

    // Check denylist first (takes precedence)
    if (this.isDenied(normalizedAddress)) {
      return {
        allowed: false,
        code: "RECIPIENT_IN_DENYLIST",
        message: `Recipient ${truncateAddress(address, 10, 6)} is in the denylist`,
        reason: "Address is explicitly blocked",
      };
    }

    // Check allowlist if active
    if (this.config.filterType === "allowlist" || this.config.filterType === "both") {
      if (this.config.allowlist.length > 0 && !this.isAllowed(normalizedAddress)) {
        return {
          allowed: false,
          code: "RECIPIENT_NOT_IN_ALLOWLIST",
          message: `Recipient ${truncateAddress(address, 10, 6)} is not in the allowlist`,
          reason: "Address must be explicitly approved",
        };
      }
    }

    return {
      allowed: true,
      code: "RECIPIENT_NOT_IN_ALLOWLIST", // Not used when allowed
      message: "",
      reason: "",
    };
  }

  /**
   * Check if address is in denylist
   */
  private isDenied(address: string): boolean {
    return this.config.denylist.some((entry) => entry.toLowerCase() === address);
  }

  /**
   * Check if address is in allowlist
   */
  private isAllowed(address: string): boolean {
    return this.config.allowlist.some((entry) => entry.toLowerCase() === address);
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get the current configuration
   */
  getConfig(): AddressFilterPolicyConfig {
    return {
      filterType: this.config.filterType,
      allowlist: [...this.config.allowlist],
      denylist: [...this.config.denylist],
    };
  }

  /**
   * Get the filter type
   */
  getFilterType(): "allowlist" | "denylist" | "both" {
    return this.config.filterType;
  }

  /**
   * Get allowlist
   */
  getAllowlist(): readonly string[] {
    return this.config.allowlist;
  }

  /**
   * Get denylist
   */
  getDenylist(): readonly string[] {
    return this.config.denylist;
  }

  /**
   * Check if an address would be allowed
   */
  wouldAllow(address: string): boolean {
    return this.checkAddress(address.toLowerCase()).allowed;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an address filter policy from stored configuration
 */
export function createAddressFilterPolicy(stored: StoredPolicy): AddressFilterPolicy {
  const config: AddressFilterPolicyConfig = JSON.parse(stored.configJSON);

  return new AddressFilterPolicy(stored.id, stored.name, config, {
    enabled: stored.enabled,
    priority: stored.priority,
  });
}

/**
 * Create an allowlist-only policy
 */
export function createAllowlistPolicy(id: string, allowedAddresses: string[]): AddressFilterPolicy {
  return new AddressFilterPolicy(id, "Address Allowlist", {
    filterType: "allowlist",
    allowlist: allowedAddresses,
    denylist: [],
  });
}

/**
 * Create a denylist-only policy
 */
export function createDenylistPolicy(id: string, deniedAddresses: string[]): AddressFilterPolicy {
  return new AddressFilterPolicy(id, "Address Denylist", {
    filterType: "denylist",
    allowlist: [],
    denylist: deniedAddresses,
  });
}

/**
 * Create a combined allowlist/denylist policy
 */
export function createCombinedFilterPolicy(
  id: string,
  allowedAddresses: string[],
  deniedAddresses: string[],
): AddressFilterPolicy {
  return new AddressFilterPolicy(id, "Address Filter", {
    filterType: "both",
    allowlist: allowedAddresses,
    denylist: deniedAddresses,
  });
}

/**
 * Create a policy that only allows known contracts/validators
 */
export function createTrustedAddressesPolicy(
  id: string,
  trustedAddresses: string[],
): AddressFilterPolicy {
  return new AddressFilterPolicy(id, "Trusted Addresses Only", {
    filterType: "allowlist",
    allowlist: trustedAddresses,
    denylist: [],
  });
}
