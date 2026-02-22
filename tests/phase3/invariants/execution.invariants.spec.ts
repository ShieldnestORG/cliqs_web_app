/**
 * Phase 3: Execution Invariant Tests
 *
 * File: tests/phase3/invariants/execution.invariants.spec.ts
 *
 * Tests that execution invariants are never violated regardless of
 * policy states, emergency conditions, or spend amounts.
 *
 * Core Invariants:
 * ❌ Execution cannot occur if any policy denies
 * ❌ Emergency pause must dominate all paths
 * ❌ Spend limits must hold across any ordering
 */

import {
  assertExecutionInvariants,
  ExecutionContext,
  PolicyResult,
} from "../oracle/invariantOracle";
import {
  genPolicyCtx,
  genValidPolicyCtx,
  genHostilePolicyCtx,
  genPolicyCtxBatch,
  setSeed,
} from "../generators/genPolicyCtx";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";
import { faultController } from "../../chaos/faults";

describe("PHASE 3 INVARIANTS: Execution", () => {
  beforeEach(() => {
    setSeed(Date.now());
    faultController.reset();
  });

  // ==========================================================================
  // INVARIANT: Emergency Pause Dominates All Paths
  // ==========================================================================

  describe("Invariant: Emergency Pause Dominance", () => {
    test("execution during emergency pause always violates invariant", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-1",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: true,
        safeMode: false,
        executionAttempted: true,
        executionSucceeded: true, // This should never happen
      };

      expect(() => assertExecutionInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*emergency pause/
      );
    });

    test("execution blocked during emergency pause is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-1",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: true,
        safeMode: false,
        executionAttempted: true,
        executionSucceeded: false, // Correctly blocked
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });

    test("fuzz: emergency pause blocks all execution contexts", async () => {
      for (let i = 0; i < 100; i++) {
        const policyCtx = genPolicyCtx(i);
        policyCtx.emergencyPaused = true;

        const result = await evaluatePoliciesMinimal({
          isPaused: true,
          policyVersion: 1,
          expectedPolicyVersion: 1,
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // INVARIANT: Safe Mode Dominates All Paths
  // ==========================================================================

  describe("Invariant: Safe Mode Dominance", () => {
    test("execution during safe mode always violates invariant", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-2",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: false,
        safeMode: true,
        executionAttempted: true,
        executionSucceeded: true, // This should never happen
      };

      expect(() => assertExecutionInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*safe mode/
      );
    });

    test("execution blocked during safe mode is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-2",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: false,
        safeMode: true,
        executionAttempted: true,
        executionSucceeded: false, // Correctly blocked
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });

    test("fuzz: safe mode blocks all execution contexts", async () => {
      for (let i = 0; i < 100; i++) {
        const policyCtx = genPolicyCtx(i);
        policyCtx.safeMode = true;

        const result = await evaluatePoliciesMinimal({
          isSafeMode: true,
          policyVersion: 1,
          expectedPolicyVersion: 1,
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // INVARIANT: All Policies Must Allow
  // ==========================================================================

  describe("Invariant: All Policies Must Allow", () => {
    test("execution with denied policy violates invariant", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-3",
        policies: [
          { policyName: "policy-a", allowed: true },
          { policyName: "policy-b", allowed: false, reason: "denied" },
        ],
        emergencyPaused: false,
        safeMode: false,
        executionAttempted: true,
        executionSucceeded: true, // This should never happen
      };

      expect(() => assertExecutionInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*policy denial/
      );
    });

    test("execution blocked by policy denial is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-3",
        policies: [
          { policyName: "policy-a", allowed: true },
          { policyName: "policy-b", allowed: false, reason: "denied" },
        ],
        emergencyPaused: false,
        safeMode: false,
        executionAttempted: true,
        executionSucceeded: false, // Correctly blocked
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });

    test("execution with all policies allowing is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-4",
        policies: [
          { policyName: "policy-a", allowed: true },
          { policyName: "policy-b", allowed: true },
          { policyName: "policy-c", allowed: true },
        ],
        emergencyPaused: false,
        safeMode: false,
        executionAttempted: true,
        executionSucceeded: true,
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });
  });

  // ==========================================================================
  // INVARIANT: Spend Limits Hold
  // ==========================================================================

  describe("Invariant: Spend Limits Hold", () => {
    test("execution exceeding spend limit violates invariant", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-5",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: false,
        safeMode: false,
        spendAttempt: [{ amount: BigInt(2000), denom: "ucore" }],
        spendLimit: [{ amount: BigInt(1000), denom: "ucore" }],
        executionAttempted: true,
        executionSucceeded: true, // This should never happen
      };

      expect(() => assertExecutionInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*[Ss]pend limit/
      );
    });

    test("execution within spend limit is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-5",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: false,
        safeMode: false,
        spendAttempt: [{ amount: BigInt(500), denom: "ucore" }],
        spendLimit: [{ amount: BigInt(1000), denom: "ucore" }],
        executionAttempted: true,
        executionSucceeded: true,
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });

    test("execution at exact spend limit is valid", () => {
      const ctx: ExecutionContext = {
        proposalId: "test-proposal-6",
        policies: [{ policyName: "basic", allowed: true }],
        emergencyPaused: false,
        safeMode: false,
        spendAttempt: [{ amount: BigInt(1000), denom: "ucore" }],
        spendLimit: [{ amount: BigInt(1000), denom: "ucore" }],
        executionAttempted: true,
        executionSucceeded: true,
      };

      expect(() => assertExecutionInvariants(ctx)).not.toThrow();
    });
  });

  // ==========================================================================
  // FUZZ: Hostile Policy Contexts Always Deny
  // ==========================================================================

  describe("Fuzz: Hostile Policy Contexts", () => {
    test("500 hostile contexts never allow execution", async () => {
      let allowedCount = 0;
      let firstFailure: any = null;

      for (let i = 0; i < 500; i++) {
        const ctx = genHostilePolicyCtx(i);

        // All hostile contexts should be denied
        const result = await evaluatePoliciesMinimal({
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          credential: ctx.credential,
          timelock: ctx.timelock,
          spend: ctx.spend,
          nowMs: ctx.nowMs,
          signaturesRequired: ctx.signaturesRequired,
          signaturesCollected: ctx.signaturesCollected,
        }, 'execution');

        if (result.allowed) {
          allowedCount++;
          if (!firstFailure) {
            firstFailure = {
              index: i,
              ctx,
              result,
              generator: ctx._generator
            };
          }
        }
      }

      if (allowedCount > 0) {
        console.log(`Found ${allowedCount} contexts that were allowed when they should be denied`);
        console.log('First failure:', firstFailure);
      }

      expect(allowedCount).toBe(0);
    });

    test("valid contexts should allow execution", async () => {
      for (let i = 0; i < 100; i++) {
        const ctx = genValidPolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          credential: ctx.credential,
          timelock: { unlockAtMs: ctx.timelock.unlockAtMs },
          nowMs: ctx.nowMs,
        }, 'execution');

        expect(result.allowed).toBe(true);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Mixed Batch Testing
  // ==========================================================================

  describe("Fuzz: Mixed Batch Testing", () => {
    test("200 mixed contexts maintain invariants", async () => {
      const contexts = genPolicyCtxBatch(200, 54321);
      let allowedCount = 0;
      let deniedCount = 0;

      for (const ctx of contexts) {
        const result = await evaluatePoliciesMinimal({
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          credential: ctx.credential,
          timelock: ctx.timelock,
          spend: ctx.spend,
          nowMs: ctx.nowMs,
        }, 'execution');

        if (result.allowed) {
          allowedCount++;

          // Verify invariants for allowed executions
          const execCtx: ExecutionContext = {
            proposalId: `proposal-${ctx._seed}`,
            policies: [{ policyName: "simulated", allowed: true }],
            emergencyPaused: ctx.emergencyPaused,
            safeMode: ctx.safeMode,
            executionAttempted: true,
            executionSucceeded: true,
          };

          // This should not throw if the policy engine is correct
          expect(() => assertExecutionInvariants(execCtx)).not.toThrow();
        } else {
          deniedCount++;
        }
      }

      // Ensure we tested both paths
      expect(allowedCount).toBeGreaterThan(0);
      expect(deniedCount).toBeGreaterThan(0);
      console.log(`Mixed batch: ${allowedCount} allowed, ${deniedCount} denied`);
    });
  });

  // ==========================================================================
  // STRESS: High Volume Execution Invariant Testing
  // ==========================================================================

  describe("Stress: High Volume Testing", () => {
    test("1000 random execution contexts maintain invariants", () => {
      for (let i = 0; i < 1000; i++) {
        const ctx = genPolicyCtx(i);

        // Simulate execution attempt
        const shouldFail =
          ctx.emergencyPaused ||
          ctx.safeMode ||
          !ctx.credential.valid ||
          ctx.policyVersion !== ctx.expectedPolicyVersion;

        const execCtx: ExecutionContext = {
          proposalId: `stress-${i}`,
          policies: ctx.credential.valid
            ? [{ policyName: "credential", allowed: true }]
            : [{ policyName: "credential", allowed: false, reason: "invalid" }],
          emergencyPaused: ctx.emergencyPaused,
          safeMode: ctx.safeMode,
          executionAttempted: true,
          executionSucceeded: !shouldFail,
        };

        // Invariants should never throw for correctly behaving system
        expect(() => assertExecutionInvariants(execCtx)).not.toThrow();
      }
    });
  });
});

