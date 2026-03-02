/**
 * Policy Registry Priority and Fail-Closed Tests
 *
 * File: __tests__/policies/registry-priority.test.ts
 *
 * Tests that the PolicyRegistry enforces correct priority order and
 * fail-closed behavior when policies are violated.
 */

import { evaluateProposal, evaluateExecution } from "../adapters/policyEngine.adapter";
import { PolicyRegistry } from "@/lib/policies";
import { TimelockPolicy, MsgTypePolicy } from "@/lib/policies";
import { MsgTypeUrls } from "@/types/txMsg";

describe("Policy Registry: priority + fail-closed", () => {
  let registry: PolicyRegistry;

  beforeEach(() => {
    registry = new PolicyRegistry();
  });

  test("Emergency pause blocks everything", async () => {
    const timelockPolicy = new TimelockPolicy("timelock-1", "Timelock Policy", {
      minDelaySeconds: 3600,
    });

    registry.registerPolicy("cosmos1multisig", timelockPolicy);

    const proposal = {
      id: "test-proposal",
      multisigAddress: "cosmos1multisig",
      chainId: "cosmoshub-4",
      payloadHash: "hash",
      content: {
        msgs: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
        fee: { amount: [], gas: "0" },
        memo: "",
        chainId: "cosmoshub-4",
        accountNumber: 0,
        sequence: 0,
      },
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const context = {
      signerRoles: [],
      credentialVersions: new Map(),
      minRequiredVersion: 0,
      spentInWindow: new Map(),
      proposalValue: [],
      treasuryBalance: [],
      recipientAddresses: [],
      messageTypes: [MsgTypeUrls.Send],
      messages: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
      queuedAt: null,
      timeSinceQueue: 0,
      currentHeight: 1000000,
      currentTimestamp: Math.floor(Date.now() / 1000),
      isPaused: true, // Emergency pause active
      isSafeMode: false,
      elevatedThreshold: null,
      normalThreshold: 2,
      multisigAddress: "cosmos1multisig",
      chainId: "cosmoshub-4",
      policyVersion: 1,
    };

    const res = await evaluateExecution(proposal, context, registry);

    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("paused");
  });

  test("Multiple policies are evaluated in priority order", async () => {
    // High priority policy (timelock - priority 10)
    const timelockPolicy = new TimelockPolicy("timelock-1", "Timelock Policy", {
      minDelaySeconds: 3600,
    });

    // Lower priority policy (msg type - priority 30)
    const msgTypePolicy = new MsgTypePolicy("msgtype-1", "MsgType Policy", {
      blockedMsgTypes: [MsgTypeUrls.Send],
    });

    registry.registerPolicy("cosmos1multisig", timelockPolicy);
    registry.registerPolicy("cosmos1multisig", msgTypePolicy);

    const proposal = {
      id: "test-proposal",
      multisigAddress: "cosmos1multisig",
      chainId: "cosmoshub-4",
      payloadHash: "hash",
      content: {
        msgs: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
        fee: { amount: [], gas: "0" },
        memo: "",
        chainId: "cosmoshub-4",
        accountNumber: 0,
        sequence: 0,
      },
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const context = {
      signerRoles: [],
      credentialVersions: new Map(),
      minRequiredVersion: 0,
      spentInWindow: new Map(),
      proposalValue: [],
      treasuryBalance: [],
      recipientAddresses: [],
      messageTypes: [MsgTypeUrls.Send],
      messages: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
      queuedAt: null,
      timeSinceQueue: 0,
      currentHeight: 1000000,
      currentTimestamp: Math.floor(Date.now() / 1000),
      isPaused: false,
      isSafeMode: false,
      elevatedThreshold: null,
      normalThreshold: 2,
      multisigAddress: "cosmos1multisig",
      chainId: "cosmoshub-4",
      policyVersion: 1,
    };

    const res = await evaluateProposal(proposal, context, registry);

    // Should be blocked by msg type policy (lower priority but still enforced)
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("blocked");
  });
});
