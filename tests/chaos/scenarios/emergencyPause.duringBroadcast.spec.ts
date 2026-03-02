import { ChaosHarness } from "../chaosHarness";
import { faultController } from "../faults";
import { installChaosPatches } from "../installPatches";

installChaosPatches();

describe("CHAOS: emergency pause during broadcast", () => {
  test("broadcast hook toggles pause; subsequent policy checks fail closed", async () => {
    const h = new ChaosHarness();

    await h.runScenario({
      name: "pause during broadcast",
      faults: [
        {
          name: "toggle-emergency-on-duringBroadcast",
          hook: "duringBroadcast",
          once: true,
          run: async () => {
            faultController.state.emergencyPaused = true;
          },
        },
      ],
      scenario: async (hh) => {
        // We don't need a real RPC call here: the patch fires the hook when broadcast is invoked
        // so the "pause" happens at the worst time.

        // Simulate: the system attempts broadcast; the hook flips emergencyPaused=true
        hh.schedule(hh.now(), "simulate broadcast hook", async () => {
          await faultController.fire("duringBroadcast");
          expect(faultController.state.emergencyPaused).toBe(true);
        });

        // Afterwards, any policy evaluation must deny
        hh.schedule(hh.now() + 1, "post-pause deny", async () => {
          const { evaluatePoliciesMinimal } = await import(
            "../../../__tests__/adapters/policyEngine.adapter"
          );
          const res = await evaluatePoliciesMinimal(
            {
              timelock: { unlockAtMs: 0 },
              safeMode: false,
              // emergencyPaused omitted -> injected by patch
            },
            "execution",
          );
          expect(res.allowed).toBe(false);
        });
      },
    });
  });
});
