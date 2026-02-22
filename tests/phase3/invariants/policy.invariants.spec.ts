/**
 * Phase 3: Policy Invariant Tests
 *
 * File: tests/phase3/invariants/policy.invariants.spec.ts
 *
 * Tests that policy evaluation invariants are never violated regardless of
 * context, timing, or credential state.
 *
 * Core Invariants:
 * ❌ Policy version mismatches always deny
 * ❌ Unexpired timelocks always deny
 * ❌ Invalid credentials always deny
 */

import {
  assertPolicyInvariants,
  PolicyContext,
} from "../oracle/invariantOracle";
import {
  genPolicyCtx,
  genValidPolicyCtx,
  genHostilePolicyCtx,
  genBoundaryPolicyCtx,
  setSeed,
} from "../generators/genPolicyCtx";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";
import { faultController } from "../../chaos/faults";

describe("PHASE 3 INVARIANTS: Policy Evaluation", () => {
  beforeEach(() => {
    setSeed(Date.now());
    faultController.reset();
  });

  // ==========================================================================
  // INVARIANT: Policy Version Mismatch Always Denies
  // ==========================================================================

  describe("Invariant: Policy Version Mismatch", () => {
    test("version mismatch allowing execution violates invariant", () => {
      const ctx: PolicyContext = {
        policyVersion: 2,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: true,
        evaluationResult: { allowed: true }, // This should never happen
      };

      expect(() => assertPolicyInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*version mismatch/
      );
    });

    test("version mismatch correctly denying is valid", () => {
      const ctx: PolicyContext = {
        policyVersion: 2,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: true,
        evaluationResult: { allowed: false }, // Correctly denied
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("matching versions allowing execution is valid", () => {
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: true,
        evaluationResult: { allowed: true },
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("fuzz: version mismatches always denied by policy engine", async () => {
      for (let version = 2; version <= 10; version++) {
        const result = await evaluatePoliciesMinimal({
          policyVersion: version,
          expectedPolicyVersion: 1,
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // INVARIANT: Unexpired Timelock Always Denies
  // ==========================================================================

  describe("Invariant: Unexpired Timelock", () => {
    test("unexpired timelock allowing execution violates invariant", () => {
      const now = Date.now();
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        timelockUnlockMs: now + 3600000, // 1 hour in future
        currentTimeMs: now,
        credentialValid: true,
        evaluationResult: { allowed: true }, // This should never happen
      };

      expect(() => assertPolicyInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*[Tt]imelock/
      );
    });

    test("unexpired timelock correctly denying is valid", () => {
      const now = Date.now();
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        timelockUnlockMs: now + 3600000,
        currentTimeMs: now,
        credentialValid: true,
        evaluationResult: { allowed: false }, // Correctly denied
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("expired timelock allowing execution is valid", () => {
      const now = Date.now();
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        timelockUnlockMs: now - 3600000, // 1 hour in past
        currentTimeMs: now,
        credentialValid: true,
        evaluationResult: { allowed: true },
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("fuzz: unexpired timelocks always denied", async () => {
      const now = Date.now();

      for (let i = 0; i < 100; i++) {
        const unlockOffset = Math.floor(Math.random() * 86400000) + 1000; // 1s to 1d in future

        const result = await evaluatePoliciesMinimal({
          policyVersion: 1,
          expectedPolicyVersion: 1,
          timelock: { unlockAtMs: now + unlockOffset },
          nowMs: now,
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // INVARIANT: Invalid Credentials Always Deny
  // ==========================================================================

  describe("Invariant: Invalid Credentials", () => {
    test("invalid credential allowing execution violates invariant", () => {
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: false,
        evaluationResult: { allowed: true }, // This should never happen
      };

      expect(() => assertPolicyInvariants(ctx)).toThrow(
        /INVARIANT VIOLATION.*credential/
      );
    });

    test("invalid credential correctly denying is valid", () => {
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: false,
        evaluationResult: { allowed: false }, // Correctly denied
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("valid credential allowing execution is valid", () => {
      const ctx: PolicyContext = {
        policyVersion: 1,
        expectedPolicyVersion: 1,
        currentTimeMs: Date.now(),
        credentialValid: true,
        evaluationResult: { allowed: true },
      };

      expect(() => assertPolicyInvariants(ctx)).not.toThrow();
    });

    test("fuzz: invalid credentials always denied", async () => {
      for (let i = 0; i < 100; i++) {
        const result = await evaluatePoliciesMinimal({
          policyVersion: 1,
          expectedPolicyVersion: 1,
          credential: {
            holder: `cosmos1test${i}`,
            valid: false,
            role: "member",
          },
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Generated Policy Contexts
  // ==========================================================================

  describe("Fuzz: Generated Policy Contexts", () => {
    test("500 random contexts maintain policy invariants", async () => {
      for (let i = 0; i < 500; i++) {
        const ctx = genPolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          credential: ctx.credential,
          timelock: ctx.timelock,
          nowMs: ctx.nowMs,
        }, 'execution');

        const policyCtx: PolicyContext = {
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          timelockUnlockMs: ctx.timelock.unlockAtMs,
          currentTimeMs: ctx.nowMs,
          credentialValid: ctx.credential.valid,
          evaluationResult: result,
        };

        // Policy invariants should never be violated
        // (allowed when they shouldn't be)
        expect(() => assertPolicyInvariants(policyCtx)).not.toThrow();
      }
    });

    test("100 valid contexts are all allowed", async () => {
      for (let i = 0; i < 100; i++) {
        const ctx = genValidPolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          isPaused: false,
          isSafeMode: false,
          credential: ctx.credential,
          timelock: ctx.timelock,
          nowMs: ctx.nowMs,
        }, 'execution');

        expect(result.allowed).toBe(true);
      }
    });

    test("100 hostile contexts are all denied", async () => {
      for (let i = 0; i < 100; i++) {
        const ctx = genHostilePolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          credential: ctx.credential,
          timelock: ctx.timelock,
          nowMs: ctx.nowMs,
          spend: ctx.spend,
          signaturesRequired: ctx.signaturesRequired,
          signaturesCollected: ctx.signaturesCollected,
        }, 'execution');

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // BOUNDARY: Edge Case Testing
  // ==========================================================================

  describe("Boundary: Edge Cases", () => {
    test("exact timelock boundary (unlock = now) should allow", async () => {
      const now = Date.now();

      const result = await evaluatePoliciesMinimal({
        policyVersion: 1,
        expectedPolicyVersion: 1,
        timelock: { unlockAtMs: now },
        nowMs: now,
      }, 'execution');

      // At exact unlock time, should be allowed
      expect(result.allowed).toBe(true);
    });

    test("policy version 0 matches expected 0", async () => {
      const result = await evaluatePoliciesMinimal({
        policyVersion: 0,
        expectedPolicyVersion: 0,
      }, 'execution');

      expect(result.allowed).toBe(true);
    });

    test("100 boundary contexts are handled correctly", async () => {
      for (let i = 0; i < 100; i++) {
        const ctx = genBoundaryPolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          credential: ctx.credential,
          timelock: ctx.timelock,
          spend: ctx.spend,
          nowMs: ctx.nowMs,
        }, 'execution');

        // Boundary cases should not crash and should return valid results
        expect(typeof result.allowed).toBe("boolean");
      }
    });
  });

  // ==========================================================================
  // STRESS: High Volume Policy Testing
  // ==========================================================================

  describe("Stress: High Volume Testing", () => {
    test("5000 policy evaluations maintain invariants", async () => {
      let violations = 0;

      for (let i = 0; i < 5000; i++) {
        const ctx = genPolicyCtx(i);

        const result = await evaluatePoliciesMinimal({
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          isPaused: ctx.emergencyPaused,
          isSafeMode: ctx.safeMode,
          credential: ctx.credential,
          timelock: ctx.timelock,
          nowMs: ctx.nowMs,
        }, 'execution');

        // Check for invariant violations
        const shouldDeny =
          ctx.emergencyPaused ||
          ctx.safeMode ||
          ctx.policyVersion !== ctx.expectedPolicyVersion ||
          !ctx.credential.valid ||
          ctx.nowMs < ctx.timelock.unlockAtMs;

        if (shouldDeny && result.allowed) {
          violations++;
        }
      }

      expect(violations).toBe(0);
    });
  });
});

