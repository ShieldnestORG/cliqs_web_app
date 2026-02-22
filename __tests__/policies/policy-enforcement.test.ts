/**
 * Policy Enforcement Tests
 * 
 * File: __tests__/policies/policy-enforcement.test.ts
 * 
 * Tests for Phase 4 policy enforcement system
 */

import { Coin } from "@cosmjs/amino";

import { Proposal, ProposalContent } from "@/lib/multisig/types";
import { MsgTypeUrls } from "@/types/txMsg";
import {
  PolicyContext,
  PolicyRegistry,
  createPolicyRegistry,
  TimelockPolicy,
  MsgTypePolicy,
  SpendLimitPolicy,
  AddressFilterPolicy,
  allowed,
  denied,
  createViolation,
} from "@/lib/policies";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestProposal(
  msgs: { typeUrl: string; value: unknown }[] = [],
  memo: string = "Test proposal",
): Proposal {
  return {
    id: "test-proposal-1",
    multisigAddress: "cosmos1multisig...",
    chainId: "cosmoshub-4",
    payloadHash: "abc123",
    content: {
      msgs,
      fee: { amount: [{ denom: "uatom", amount: "5000" }], gas: "200000" },
      memo,
      chainId: "cosmoshub-4",
      accountNumber: 1,
      sequence: 1,
    },
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTestContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    signerRoles: [],
    credentialVersions: new Map(),
    minRequiredVersion: 0,
    spentInWindow: new Map(),
    proposalValue: [],
    treasuryBalance: [{ denom: "uatom", amount: "1000000000" }],
    recipientAddresses: [],
    messageTypes: [],
    messages: [],
    queuedAt: null,
    timeSinceQueue: 0,
    currentHeight: 1000000,
    currentTimestamp: Math.floor(Date.now() / 1000),
    isPaused: false,
    isSafeMode: false,
    elevatedThreshold: null,
    normalThreshold: 2,
    multisigAddress: "cosmos1multisig...",
    chainId: "cosmoshub-4",
    policyVersion: 1,
    ...overrides,
  };
}

// ============================================================================
// Timelock Policy Tests
// ============================================================================

describe("TimelockPolicy", () => {
  const policy = new TimelockPolicy("timelock-1", "Test Timelock", {
    minDelaySeconds: 3600, // 1 hour
    maxDelaySeconds: 604800, // 7 days
    highValueMultiplier: 2.0,
    highValueThresholdPercent: 10,
  });

  describe("evaluateProposal", () => {
    it("allows proposal creation", async () => {
      const proposal = createTestProposal();
      const context = createTestContext();
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe("evaluateExecution", () => {
    it("blocks execution when paused", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({ isPaused: true });
      
      const result = await policy.evaluateExecution(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("OPERATIONS_PAUSED");
      }
    });

    it("requires queue before execution", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({ queuedAt: null });
      
      const result = await policy.evaluateExecution(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("QUEUE_REQUIRED");
      }
    });

    it("blocks execution before timelock", async () => {
      const proposal = createTestProposal();
      const now = Math.floor(Date.now() / 1000);
      const context = createTestContext({
        queuedAt: now - 1800, // 30 minutes ago
        timeSinceQueue: 1800,
      });
      
      const result = await policy.evaluateExecution(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("TIMELOCK_NOT_MET");
      }
    });

    it("allows execution after timelock", async () => {
      const proposal = createTestProposal();
      const now = Math.floor(Date.now() / 1000);
      const context = createTestContext({
        queuedAt: now - 7200, // 2 hours ago
        timeSinceQueue: 7200,
      });
      
      const result = await policy.evaluateExecution(proposal, context);
      
      expect(result.allowed).toBe(true);
    });

    it("blocks expired proposals", async () => {
      const proposal = createTestProposal();
      const now = Math.floor(Date.now() / 1000);
      const context = createTestContext({
        queuedAt: now - 700000, // > 7 days ago
        timeSinceQueue: 700000,
      });
      
      const result = await policy.evaluateExecution(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("TIMELOCK_EXPIRED");
      }
    });
  });
});

// ============================================================================
// Message Type Policy Tests
// ============================================================================

describe("MsgTypePolicy", () => {
  describe("with blocklist", () => {
    const policy = new MsgTypePolicy("msgtype-1", "Test MsgType", {
      allowedMsgTypes: [],
      blockedMsgTypes: [MsgTypeUrls.MigrateContract],
      requiresHigherThreshold: new Map([
        [MsgTypeUrls.UpdateAdmin, 3],
      ]),
    });

    it("allows normal messages", async () => {
      const proposal = createTestProposal([
        { typeUrl: MsgTypeUrls.Send, value: { toAddress: "cosmos1..." } },
      ]);
      const context = createTestContext({
        messageTypes: [MsgTypeUrls.Send],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(true);
    });

    it("blocks blocked message types", async () => {
      const proposal = createTestProposal([
        { typeUrl: MsgTypeUrls.MigrateContract, value: {} },
      ]);
      const context = createTestContext({
        messageTypes: [MsgTypeUrls.MigrateContract],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("MSG_TYPE_BLOCKED");
      }
    });

    it("warns about higher threshold requirements", async () => {
      const proposal = createTestProposal([
        { typeUrl: MsgTypeUrls.UpdateAdmin, value: {} },
      ]);
      const context = createTestContext({
        messageTypes: [MsgTypeUrls.UpdateAdmin],
        normalThreshold: 2,
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("MSG_TYPE_REQUIRES_HIGHER_THRESHOLD");
      }
    });
  });

  describe("with allowlist", () => {
    const policy = new MsgTypePolicy("msgtype-2", "Restrictive", {
      allowedMsgTypes: [MsgTypeUrls.Send, MsgTypeUrls.Delegate],
      blockedMsgTypes: [],
      requiresHigherThreshold: new Map(),
    });

    it("allows messages in allowlist", async () => {
      const proposal = createTestProposal([
        { typeUrl: MsgTypeUrls.Send, value: {} },
      ]);
      const context = createTestContext({
        messageTypes: [MsgTypeUrls.Send],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(true);
    });

    it("blocks messages not in allowlist", async () => {
      const proposal = createTestProposal([
        { typeUrl: MsgTypeUrls.ExecuteContract, value: {} },
      ]);
      const context = createTestContext({
        messageTypes: [MsgTypeUrls.ExecuteContract],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("MSG_TYPE_NOT_ALLOWED");
      }
    });
  });
});

// ============================================================================
// Spend Limit Policy Tests
// ============================================================================

describe("SpendLimitPolicy", () => {
  const policy = new SpendLimitPolicy("spend-1", "Test Spend Limit", {
    perTxLimits: [{ denom: "uatom", amount: "1000000" }], // 1 ATOM
    dailyLimits: [{ denom: "uatom", amount: "10000000" }], // 10 ATOM
    windowSeconds: 86400,
    exemptMsgTypes: [MsgTypeUrls.Delegate],
  });

  it("allows transactions under limit", async () => {
    const proposal = createTestProposal([
      { 
        typeUrl: MsgTypeUrls.Send, 
        value: { amount: [{ denom: "uatom", amount: "500000" }] },
      },
    ]);
    const context = createTestContext({
      proposalValue: [{ denom: "uatom", amount: "500000" }],
    });
    
    const result = await policy.evaluateProposal(proposal, context);
    
    expect(result.allowed).toBe(true);
  });

  it("blocks transactions exceeding per-tx limit", async () => {
    const proposal = createTestProposal([
      { 
        typeUrl: MsgTypeUrls.Send, 
        value: { amount: [{ denom: "uatom", amount: "2000000" }] },
      },
    ]);
    const context = createTestContext({
      proposalValue: [{ denom: "uatom", amount: "2000000" }],
    });
    
    const result = await policy.evaluateProposal(proposal, context);
    
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.violations[0].code).toBe("EXCEEDS_PER_TX_LIMIT");
    }
  });

  it("blocks transactions exceeding daily limit", async () => {
    const proposal = createTestProposal([
      { 
        typeUrl: MsgTypeUrls.Send, 
        value: { amount: [{ denom: "uatom", amount: "500000" }] },
      },
    ]);
    const spentInWindow = new Map<string, Coin>();
    spentInWindow.set("uatom", { denom: "uatom", amount: "9800000" }); // Already spent 9.8 ATOM
    
    const context = createTestContext({
      proposalValue: [{ denom: "uatom", amount: "500000" }],
      spentInWindow,
    });
    
    const result = await policy.evaluateProposal(proposal, context);
    
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.violations[0].code).toBe("EXCEEDS_DAILY_LIMIT");
    }
  });
});

// ============================================================================
// Address Filter Policy Tests
// ============================================================================

describe("AddressFilterPolicy", () => {
  describe("with denylist", () => {
    const policy = new AddressFilterPolicy("filter-1", "Denylist", {
      filterType: "denylist",
      allowlist: [],
      denylist: ["cosmos1blocked...", "cosmos1evil..."],
    });

    it("allows normal addresses", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({
        recipientAddresses: ["cosmos1normal..."],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(true);
    });

    it("blocks denied addresses", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({
        recipientAddresses: ["cosmos1blocked..."],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("RECIPIENT_IN_DENYLIST");
      }
    });
  });

  describe("with allowlist", () => {
    const policy = new AddressFilterPolicy("filter-2", "Allowlist", {
      filterType: "allowlist",
      allowlist: ["cosmos1trusted1...", "cosmos1trusted2..."],
      denylist: [],
    });

    it("allows addresses in allowlist", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({
        recipientAddresses: ["cosmos1trusted1..."],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(true);
    });

    it("blocks addresses not in allowlist", async () => {
      const proposal = createTestProposal();
      const context = createTestContext({
        recipientAddresses: ["cosmos1random..."],
      });
      
      const result = await policy.evaluateProposal(proposal, context);
      
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violations[0].code).toBe("RECIPIENT_NOT_IN_ALLOWLIST");
      }
    });
  });
});

// ============================================================================
// Policy Registry Tests
// ============================================================================

describe("PolicyRegistry", () => {
  let registry: PolicyRegistry;

  beforeEach(() => {
    registry = createPolicyRegistry();
  });

  it("registers and retrieves policies", () => {
    const policy = new TimelockPolicy("test-timelock", "Test", {});
    
    registry.registerPolicy("cosmos1multisig...", policy);
    
    const policies = registry.getPolicies("cosmos1multisig...");
    expect(policies).toHaveLength(1);
    expect(policies[0].id).toBe("test-timelock");
  });

  it("evaluates multiple policies in order", async () => {
    const timelockPolicy = new TimelockPolicy("timelock", "Timelock", {
      minDelaySeconds: 3600,
    });
    const msgTypePolicy = new MsgTypePolicy("msgtype", "MsgType", {
      blockedMsgTypes: [MsgTypeUrls.MigrateContract],
    });

    registry.registerPolicy("cosmos1multisig...", timelockPolicy);
    registry.registerPolicy("cosmos1multisig...", msgTypePolicy);

    const proposal = createTestProposal([
      { typeUrl: MsgTypeUrls.MigrateContract, value: {} },
    ]);
    const context = createTestContext({
      messageTypes: [MsgTypeUrls.MigrateContract],
    });

    const result = await registry.evaluateProposal(proposal, context);

    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.evaluatedPolicies).toContain("timelock");
    expect(result.evaluatedPolicies).toContain("msgtype");
  });

  it("returns stats", () => {
    const policy1 = new TimelockPolicy("timelock", "Timelock", {});
    const policy2 = new SpendLimitPolicy("spend", "Spend", {});

    registry.registerPolicy("cosmos1multisig...", policy1);
    registry.registerPolicy("cosmos1multisig...", policy2);

    const stats = registry.getStats("cosmos1multisig...");

    expect(stats.totalPolicies).toBe(2);
    expect(stats.enabledPolicies).toBe(2);
    expect(stats.byType.timelock).toBe(1);
    expect(stats.byType.spend_limit).toBe(1);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("Policy Helper Functions", () => {
  it("allowed() returns allowed decision", () => {
    const decision = allowed();
    expect(decision.allowed).toBe(true);
  });

  it("denied() returns denied decision with violations", () => {
    const violation = createViolation(
      "test-policy",
      "timelock",
      "TIMELOCK_NOT_MET",
      "Test message",
      "high",
    );
    
    const decision = denied([violation]);
    
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.violations).toHaveLength(1);
      expect(decision.violations[0].code).toBe("TIMELOCK_NOT_MET");
    }
  });
});

