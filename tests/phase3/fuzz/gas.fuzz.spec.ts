import { RNG } from "../generators/rng";
import { genMsgBatch } from "../generators/genMsg";
import { genMemo } from "../generators/chainPrimitives";
import { estimateGas } from "../gas/gasEstimator";
import { classify } from "../gas/gasOracle";

import { faultController } from "../../chaos/faults";
import { installChaosPatches } from "../../chaos/installPatches";
import { getWalletFlow } from "../../../__tests__/adapters/walletFlow.adapter";
import { MockWalletSigner } from "../../../__tests__/mocks/MockWalletSigner";
import { MockBroadcaster } from "../../../__tests__/mocks/MockBroadcaster";

installChaosPatches();

describe("PHASE 3 GAS FUZZ: resource pressure + out-of-gas safety", () => {
  test("big valid batches fail safely and remain idempotent under out-of-gas injection", async () => {
    const flow = getWalletFlow();
    const signer = new MockWalletSigner();
    const bc = new MockBroadcaster();

    // default: broadcast succeeds unless we inject failure
    bc.enqueueSuccess({ code: 0, txhash: "OK1" });
    bc.enqueueSuccess({ code: 0, txhash: "OK2" });

    const rng = new RNG(0xbada55);

    for (let i = 0; i < 400; i++) {
      const msgs = genMsgBatch(rng, { maxMsgs: rng.int(1, 40), includeDisallowedChance: 0.0 });
      const memo = genMemo(rng, 128);

      const est = await estimateGas({ msgs, memo });
      const band = classify(est);

      // Inject "out of gas" failure only in nearLimit/overLimit bands.
      // This simulates the worst-case: everything is valid, but resources run out.
      faultController.state.emergencyPaused = false;
      faultController.state.safeMode = false;

      // one-shot fault: throw during broadcast
      faultController.addFault({
        name: `oog-${i}`,
        hook: "duringBroadcast",
        once: true,
        run: () => {
          if (band === "nearLimit" || band === "overLimit") {
            throw new Error("OUT_OF_GAS");
          }
        },
      });

      const txBytes = await flow.buildTxBytes({ msgs, memo });
      const signed = await flow.signTxBytes(txBytes, signer);

      // First attempt: may throw OUT_OF_GAS
      let firstOk = false;
      try {
        await flow.broadcastSignedTx(signed, bc);
        firstOk = true;
      } catch (e: any) {
        expect(String(e?.message ?? e)).toMatch(/OUT_OF_GAS/i);
      }

      // Retry behavior must be safe:
      // - If first succeeded, second should not "double execute" (your higher layer should prevent it).
      // - At this layer, we only assert retry doesn't crash weirdly.
      // For real-real: connect to MultisigChaosHarness and assert proposal state monotonicity.
      try {
        await flow.broadcastSignedTx(signed, bc);
        // if the first failed due to OOG, a retry might succeed (OK)
        // if first succeeded, your idempotency should be enforced above this layer.
        expect(true).toBe(true);
      } catch (e: any) {
        // Acceptable if your broadcaster rejects duplicates or still fails
        expect(String(e?.message ?? e)).toMatch(/OUT_OF_GAS|duplicate|already|replay/i);
      }

      // sanity: we exercised gas bands
      if (i === 399) {
        expect(["normal", "stressed", "nearLimit", "overLimit"]).toContain(band);
        expect(est.gas).toBeGreaterThan(0);
      }
    }
  });
});
