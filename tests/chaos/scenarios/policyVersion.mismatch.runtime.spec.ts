import { ChaosHarness } from "../chaosHarness";
import { faultController } from "../faults";
import { installChaosPatches } from "../installPatches";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";

installChaosPatches();

describe("CHAOS: policyVersion mismatch at runtime", () => {
  test("version mismatch denies even if previously allowed", async () => {
    const h = new ChaosHarness();

    await h.runScenario({
      name: "policy version flip",
      scenario: async (hh) => {
        // initial: versions aligned
        hh.schedule(hh.now(), "initial allow", async () => {
          faultController.state.policyVersion = 1;
          faultController.state.expectedPolicyVersion = 1;

          const res = await evaluatePoliciesMinimal(
            {
              timelock: { unlockAtMs: 0 },
              emergencyPaused: false,
              safeMode: false,
            },
            "execution",
          );

          // may be allowed depending on other policies; just ensure decision exists
          expect(res).toHaveProperty("allowed");
        });

        // flip expected version before execute
        hh.schedule(hh.now() + 1, "flip expected version", async () => {
          faultController.state.expectedPolicyVersion = 2;
        });

        hh.schedule(hh.now() + 2, "execute denied", async () => {
          const res = await evaluatePoliciesMinimal(
            {
              timelock: { unlockAtMs: 0 },
              emergencyPaused: false,
              safeMode: false,
            },
            "execution",
          );

          expect(res.allowed).toBe(false);
        });
      },
    });
  });
});
