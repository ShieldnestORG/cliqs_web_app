/**
 * Phase 3: Policy Fuzzing Tests
 *
 * File: tests/phase3/fuzz/policy.fuzz.spec.ts
 *
 * Systematically fuzzes policy evaluation with hostile, malformed,
 * and randomized inputs to prove fail-closed behavior.
 *
 * Goal: Prove that no randomized hostile policy context can
 * allow forbidden execution.
 */

import {
  genPolicyCtx,
  genHostilePolicyCtx,
  genBoundaryPolicyCtx,
  genPolicyCtxBatch,
  setSeed,
  resetRandom,
} from "../generators/genPolicyCtx";
import { assertPolicyInvariants, PolicyContext } from "../oracle/invariantOracle";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";
import { faultController } from "../../chaos/faults";

describe("PHASE 3 FUZZ: Policy Engine", () => {
  beforeEach(() => {
    faultController.reset();
    resetRandom();
  });

  // ==========================================================================
  // FUZZ: Randomized Hostile Policy Contexts
  // ==========================================================================

  describe("Fuzz: Hostile Policy Contexts Never Allow Forbidden Execution", () => {
    test("5000 randomized hostile contexts all fail closed", async () => {
      let passCount = 0;
      let failCount = 0;

      for (let i = 0; i < 5000; i++) {
        setSeed(i);
        const ctx = genPolicyCtx(i);

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: ctx.policyVersion,
            expectedPolicyVersion: ctx.expectedPolicyVersion,
            isPaused: ctx.emergencyPaused,
            isSafeMode: ctx.safeMode,
            credential: ctx.credential,
            timelock: ctx.timelock,
            nowMs: ctx.nowMs,
            spend: ctx.spend,
          },
          "execution",
        );

        // Check if any forbidden condition exists
        const hasForbiddenCondition =
          ctx.emergencyPaused ||
          ctx.safeMode ||
          ctx.policyVersion !== ctx.expectedPolicyVersion ||
          !ctx.credential.valid ||
          ctx.nowMs < ctx.timelock.unlockAtMs;

        if (hasForbiddenCondition) {
          // Must be denied
          expect(result.allowed).toBe(false);
          failCount++;
        } else {
          passCount++;
        }
      }

      console.log(`Fuzz results: ${passCount} allowed, ${failCount} denied`);
      expect(failCount).toBeGreaterThan(0); // Ensure we tested denial paths
    });

    test("1000 explicitly hostile contexts all denied", async () => {
      for (let i = 0; i < 1000; i++) {
        const ctx = genHostilePolicyCtx(i);

        const result = await evaluatePoliciesMinimal(
          {
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
          },
          "execution",
        );

        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Emergency State Combinations
  // ==========================================================================

  describe("Fuzz: Emergency State Combinations", () => {
    const emergencyCombinations = [
      { emergencyPaused: true, safeMode: false },
      { emergencyPaused: false, safeMode: true },
      { emergencyPaused: true, safeMode: true },
    ];

    test.each(emergencyCombinations)(
      "emergency state $emergencyPaused/$safeMode blocks all 100 contexts",
      async ({ emergencyPaused, safeMode }) => {
        for (let i = 0; i < 100; i++) {
          setSeed(i);
          const ctx = genPolicyCtx(i);

          const result = await evaluatePoliciesMinimal(
            {
              policyVersion: ctx.policyVersion,
              expectedPolicyVersion: ctx.expectedPolicyVersion,
              isPaused: emergencyPaused,
              isSafeMode: safeMode,
              credential: ctx.credential,
              timelock: ctx.timelock,
              nowMs: ctx.nowMs,
            },
            "execution",
          );

          expect(result.allowed).toBe(false);
        }
      },
    );
  });

  // ==========================================================================
  // FUZZ: Version Drift Scenarios
  // ==========================================================================

  describe("Fuzz: Version Drift Scenarios", () => {
    test("all version mismatches (0-99 vs expected 1) are denied", async () => {
      for (let version = 0; version < 100; version++) {
        if (version === 1) continue; // Skip matching version

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: version,
            expectedPolicyVersion: 1,
            isPaused: false,
            isSafeMode: false,
            credential: { holder: "cosmos1test", valid: true, role: "member" },
          },
          "execution",
        );

        expect(result.allowed).toBe(false);
      }
    });

    test("random version pairs: mismatch always denied, match allowed", async () => {
      for (let i = 0; i < 500; i++) {
        setSeed(i);
        const version = Math.floor(Math.random() * 10);
        const expected = Math.floor(Math.random() * 10);

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: version,
            expectedPolicyVersion: expected,
            isPaused: false,
            isSafeMode: false,
            credential: { holder: "cosmos1test", valid: true, role: "member" },
          },
          "execution",
        );

        if (version !== expected) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      }
    });
  });

  // ==========================================================================
  // FUZZ: Timelock Boundary Fuzzing
  // ==========================================================================

  describe("Fuzz: Timelock Boundary Fuzzing", () => {
    test("1000 random timelock offsets respected", async () => {
      const baseTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        setSeed(i);
        // Random offset: -1 day to +1 day
        const offset = Math.floor(Math.random() * 172800000) - 86400000;
        const unlockAtMs = baseTime + offset;

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: 1,
            expectedPolicyVersion: 1,
            isPaused: false,
            isSafeMode: false,
            credential: { holder: "cosmos1test", valid: true, role: "member" },
            timelock: { unlockAtMs },
            nowMs: baseTime,
          },
          "execution",
        );

        if (baseTime < unlockAtMs) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      }
    });

    test("exact boundary: now === unlockAt should allow", async () => {
      const now = Date.now();

      const result = await evaluatePoliciesMinimal(
        {
          policyVersion: 1,
          expectedPolicyVersion: 1,
          timelock: { unlockAtMs: now },
          nowMs: now,
        },
        "execution",
      );

      expect(result.allowed).toBe(true);
    });

    test("1ms before unlock is denied", async () => {
      const now = Date.now();

      const result = await evaluatePoliciesMinimal(
        {
          policyVersion: 1,
          expectedPolicyVersion: 1,
          timelock: { unlockAtMs: now + 1 },
          nowMs: now,
        },
        "execution",
      );

      expect(result.allowed).toBe(false);
    });
  });

  // ==========================================================================
  // FUZZ: Spend Limit Fuzzing
  // ==========================================================================

  describe("Fuzz: Spend Limit Fuzzing", () => {
    test("1000 random spend amounts: over limit denied", async () => {
      const limit = 1000;

      for (let i = 0; i < 1000; i++) {
        setSeed(i);
        const amount = Math.floor(Math.random() * 5000);

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: 1,
            expectedPolicyVersion: 1,
            isPaused: false,
            isSafeMode: false,
            spend: [{ amount: String(amount), denom: "ucore" }],
          },
          "execution",
        );

        if (amount > limit) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      }
    });

    test("exact spend limit boundary should allow", async () => {
      const result = await evaluatePoliciesMinimal(
        {
          policyVersion: 1,
          expectedPolicyVersion: 1,
          spend: [{ amount: "1000", denom: "ucore" }],
        },
        "execution",
      );

      expect(result.allowed).toBe(true);
    });

    test("1 over spend limit is denied", async () => {
      const result = await evaluatePoliciesMinimal(
        {
          policyVersion: 1,
          expectedPolicyVersion: 1,
          spend: [{ amount: "1001", denom: "ucore" }],
        },
        "execution",
      );

      expect(result.allowed).toBe(false);
    });
  });

  // ==========================================================================
  // FUZZ: Credential State Fuzzing
  // ==========================================================================

  describe("Fuzz: Credential State Fuzzing", () => {
    test("500 random credential states: invalid always denied", async () => {
      for (let i = 0; i < 500; i++) {
        setSeed(i);
        const isValid = Math.random() > 0.5;
        const role = ["admin", "member", "readonly", "unknown"][Math.floor(Math.random() * 4)];

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: 1,
            expectedPolicyVersion: 1,
            isPaused: false,
            isSafeMode: false,
            credential: {
              holder: `cosmos1test${i}`,
              valid: isValid,
              role: role as any,
            },
          },
          "execution",
        );

        if (!isValid) {
          expect(result.allowed).toBe(false);
        }
      }
    });
  });

  // ==========================================================================
  // FUZZ: Combined Hostile Conditions
  // ==========================================================================

  describe("Fuzz: Combined Hostile Conditions", () => {
    test("all combinations of hostile flags are denied", async () => {
      const flags = [
        "emergencyPaused",
        "safeMode",
        "versionMismatch",
        "invalidCredential",
        "timelockActive",
      ];

      // Test all 2^5 = 32 combinations
      for (let mask = 1; mask < 32; mask++) {
        const emergencyPaused = !!(mask & 1);
        const safeMode = !!(mask & 2);
        const versionMismatch = !!(mask & 4);
        const invalidCredential = !!(mask & 8);
        const timelockActive = !!(mask & 16);

        const now = Date.now();

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: versionMismatch ? 2 : 1,
            expectedPolicyVersion: 1,
            isPaused: emergencyPaused,
            isSafeMode: safeMode,
            credential: {
              holder: "cosmos1test",
              valid: !invalidCredential,
              role: "member",
            },
            timelock: {
              unlockAtMs: timelockActive ? now + 3600000 : now - 3600000,
            },
            nowMs: now,
          },
          "execution",
        );

        // At least one hostile flag is set, so must be denied
        expect(result.allowed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // STRESS: High Volume Fuzzing
  // ==========================================================================

  describe("Stress: High Volume Fuzzing", () => {
    test("10000 random policy contexts maintain invariants", async () => {
      const violations: string[] = [];

      for (let i = 0; i < 10000; i++) {
        setSeed(i);
        const ctx = genPolicyCtx(i);

        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: ctx.policyVersion,
            expectedPolicyVersion: ctx.expectedPolicyVersion,
            isPaused: ctx.emergencyPaused,
            isSafeMode: ctx.safeMode,
            credential: ctx.credential,
            timelock: ctx.timelock,
            nowMs: ctx.nowMs,
          },
          "execution",
        );

        // Build invariant context
        const policyCtx: PolicyContext = {
          policyVersion: ctx.policyVersion,
          expectedPolicyVersion: ctx.expectedPolicyVersion,
          timelockUnlockMs: ctx.timelock.unlockAtMs,
          currentTimeMs: ctx.nowMs,
          credentialValid: ctx.credential.valid,
          evaluationResult: result,
        };

        try {
          assertPolicyInvariants(policyCtx);
        } catch (error: any) {
          violations.push(`Iteration ${i}: ${error.message}`);
        }
      }

      if (violations.length > 0) {
        console.error(`Found ${violations.length} violations:`, violations.slice(0, 5));
      }

      expect(violations.length).toBe(0);
    });

    test("batch contexts all validated", async () => {
      const batch = genPolicyCtxBatch(1000, 99999);

      for (const ctx of batch) {
        const result = await evaluatePoliciesMinimal(
          {
            policyVersion: ctx.policyVersion,
            expectedPolicyVersion: ctx.expectedPolicyVersion,
            isPaused: ctx.emergencyPaused,
            isSafeMode: ctx.safeMode,
            credential: ctx.credential,
            timelock: ctx.timelock,
            nowMs: ctx.nowMs,
          },
          "execution",
        );

        // Result should be boolean
        expect(typeof result.allowed).toBe("boolean");
      }
    });
  });
});
