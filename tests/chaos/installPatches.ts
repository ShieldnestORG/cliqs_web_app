import { faultController } from "./faults";

// Real modules
import * as MultiRpcMod from "../../lib/rpc/multi-rpc-verifier";

let installed = false;

export function installChaosPatches() {
  if (installed) return;
  installed = true;

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
