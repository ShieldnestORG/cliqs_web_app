import { ChaosHarness } from "../chaosHarness";
import { faultController } from "../faults";
import { installChaosPatches } from "../installPatches";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";

installChaosPatches();

describe("CHAOS: safe-mode during timelock", () => {
  test("even after timelock expires, safe-mode blocks execution", async () => {
    const h = new ChaosHarness();
    const now = 1_700_000_000_000;

    await h.runScenario({
      name: "safe-mode during timelock",
      scenario: async (hh) => {
        hh.setNow(now);

        // before unlock: should deny due to timelock
        hh.schedule(now, "pre-unlock execute attempt", async () => {
          const res = await evaluatePoliciesMinimal({
            nowMs: now,
            timelock: { unlockAtMs: now + 60_000 },
            safeMode: false,
            emergencyPaused: false,
            policyVersion: 1,
            expectedPolicyVersion: 1,
          }, 'execution');
          expect(res.allowed).toBe(false);
        });

        // flip safe mode while waiting
        hh.schedule(now + 30_000, "toggle safe-mode ON", async () => {
          faultController.state.safeMode = true;
        });

        // after unlock: still deny because safe-mode
        hh.schedule(now + 60_001, "post-unlock execute attempt", async () => {
          const res = await evaluatePoliciesMinimal({
            nowMs: now + 60_001,
            timelock: { unlockAtMs: now + 60_000 },
            emergencyPaused: false,
            policyVersion: 1,
            expectedPolicyVersion: 1,
          }, 'execution');
          expect(res.allowed).toBe(false);
        });
      },
    });
  });
});
