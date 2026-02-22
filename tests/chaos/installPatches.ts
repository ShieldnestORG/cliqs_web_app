import { faultController } from "./faults";

// Real modules
import { PolicyRegistry } from "../../lib/policies/registry";
import * as MultiRpcMod from "../../lib/rpc/multi-rpc-verifier";

let installed = false;

export function installChaosPatches() {
  if (installed) return;
  installed = true;

  // ---- Patch PolicyRegistry.evaluateProposal (or equivalent) ----
  const proto: any = (PolicyRegistry as any).prototype;

  const evalName =
    typeof proto.evaluateProposal === "function"
      ? "evaluateProposal"
      : typeof proto.evaluateExecution === "function"
      ? "evaluateExecution"
      : null;

  if (!evalName) {
    throw new Error(
      "Chaos patch: could not find PolicyRegistry.evaluateProposal or evaluateExecution"
    );
  }

  const originalEval = proto[evalName];

  proto[evalName] = async function patchedEvaluate(ctx: any) {
    // allow tests to mutate "reality" without knowing your ctx structure
    const injected = {
      ...ctx,
      emergencyPaused:
        ctx?.emergencyPaused ?? faultController.state.emergencyPaused,
      safeMode: ctx?.safeMode ?? faultController.state.safeMode,
      policyVersion: ctx?.policyVersion ?? faultController.state.policyVersion,
      expectedPolicyVersion:
        ctx?.expectedPolicyVersion ?? faultController.state.expectedPolicyVersion,
      credential: ctx?.credential ?? {
        holder: "cosmos1test",
        valid: faultController.state.credentialValid,
        role: "member",
      },
    };

    await faultController.fire("beforePolicyEval", { ctx: injected });

    return originalEval.call(this, injected);
  };

  // ---- Patch MultiRpcVerifier.broadcastAndVerify ----
  const MultiRpcVerifier: any =
    (MultiRpcMod as any).MultiRpcVerifier ?? (MultiRpcMod as any).default;

  if (MultiRpcVerifier?.broadcastAndVerify) {
    const original = MultiRpcVerifier.broadcastAndVerify.bind(MultiRpcVerifier);

    MultiRpcVerifier.broadcastAndVerify = async (...args: any[]) => {
      await faultController.fire("duringBroadcast", { args });
      const res = await original(...args);
      await faultController.fire("afterBroadcast", { res });
      return res;
    };
  } else if (MultiRpcVerifier) {
    // if instance method instead of static
    const p = MultiRpcVerifier.prototype;
    if (typeof p.broadcastAndVerify === "function") {
      const original = p.broadcastAndVerify;
      p.broadcastAndVerify = async function (...args: any[]) {
        await faultController.fire("duringBroadcast", { args });
        const res = await original.call(this, ...args);
        await faultController.fire("afterBroadcast", { res });
        return res;
      };
    }
  }
}
