import { ChaosHarness } from "../chaosHarness";
import { faultController } from "../faults";
import { installChaosPatches } from "../installPatches";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";

installChaosPatches();

describe("CHAOS: credential revoked mid-vote", () => {
  test("revocation before execution causes fail-closed at execution gate", async () => {
    const h = new ChaosHarness();

    await h.runScenario({
      name: "credential revoked mid-vote",
      faults: [
        {
          name: "revoke-credential-on-afterVote",
          hook: "afterVote",
          once: true,
          run: async () => {
            faultController.state.credentialValid = false;
          },
        },
      ],
      scenario: async (hh) => {
        // t0: credential valid, voting happens
        hh.schedule(hh.now(), "vote phase", async () => {
          await faultController.fire("beforeVote");
          // policy eval at vote time (should pass)
          const voteCheck = await evaluatePoliciesMinimal({
            policyVersion: 1,
            expectedPolicyVersion: 1,
            emergencyPaused: false,
            safeMode: false,
            credential: { holder: "cosmos1voter", valid: true, role: "member" },
            timelock: { unlockAtMs: 0 },
          }, 'proposal');
          expect(voteCheck.allowed).toBe(true);
          await faultController.fire("afterVote");
        });

        // t1: attempt execute, but credential now invalid -> deny
        hh.schedule(hh.now() + 1, "execute phase", async () => {
          const execCheck = await evaluatePoliciesMinimal({
            policyVersion: 1,
            expectedPolicyVersion: 1,
            emergencyPaused: false,
            safeMode: false,
            // NOTE: we omit credential and let chaos patch inject faultController.state.credentialValid
            timelock: { unlockAtMs: 0 },
          }, 'execution');
          expect(execCheck.allowed).toBe(false);
        });
      },
    });
  });
});
