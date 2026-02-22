import { ChaosHarness } from "../chaosHarness";
import { installChaosPatches } from "../installPatches";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";

installChaosPatches();

describe("CHAOS: spend limit crossed via batching", () => {
  test("aggregated spend across batch is denied", async () => {
    const h = new ChaosHarness();

    await h.runScenario({
      name: "spend batching crosses limit",
      scenario: async (hh) => {
        hh.schedule(hh.now(), "batch execute", async () => {
          const res = await evaluatePoliciesMinimal({
            policyVersion: 1,
            expectedPolicyVersion: 1,
            emergencyPaused: false,
            safeMode: false,
            timelock: { unlockAtMs: 0 },

            // represent "batch" as aggregate list (your engine can interpret this however it does today)
            spend: [
              { amount: "600", denom: "ucore" },
              { amount: "600", denom: "ucore" },
            ],
          }, 'execution');

          expect(res.allowed).toBe(false);
        });
      },
    });
  });
});
