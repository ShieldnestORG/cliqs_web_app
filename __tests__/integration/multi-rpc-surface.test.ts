/**
 * Multi-RPC Verifier Module Surface Tests
 *
 * File: __tests__/integration/multi-rpc-surface.test.ts
 *
 * Tests that the MultiRpcVerifier module is importable and has
 * the broadcastAndVerify API surface for integration tests.
 */

import { getWalletFlow } from "../adapters/walletFlow.adapter";
import { MultiRpcVerifier } from "@/lib/rpc/multi-rpc-verifier";

describe("Integration: MultiRpcVerifier module surface", () => {
  test("MultiRpcVerifier class is importable", () => {
    expect(typeof MultiRpcVerifier).toBe("function");
    expect(MultiRpcVerifier.prototype).toBeDefined();
  });

  test("MultiRpcVerifier has broadcastAndVerify method", () => {
    const instance = new MultiRpcVerifier({
      chainId: "test-chain",
      minConfirmations: 1,
      endpoints: [{ url: "http://test-rpc", priority: "primary" }]
    });

    expect(typeof instance.broadcastAndVerify).toBe("function");
  });

  test("broadcastViaMultiRpcVerifier exists in wallet flow", async () => {
    const flow = getWalletFlow();
    expect(typeof flow.broadcastViaMultiRpcVerifier).toBe("function");
  });

  test("MultiRpcVerifier constructor accepts config", () => {
    const config = {
      chainId: "cosmoshub-4",
      minConfirmations: 2,
      endpoints: [
        { url: "https://rpc.cosmoshub.strange.love", priority: "primary" },
        { url: "https://cosmoshub-4.technofractal.com", priority: "secondary" },
      ]
    };

    expect(() => new MultiRpcVerifier(config)).not.toThrow();
  });

  test("MultiRpcVerifier instance has expected methods", () => {
    const instance = new MultiRpcVerifier({
      chainId: "test-chain",
      minConfirmations: 1,
      endpoints: [{ url: "http://test-rpc", priority: "primary" }]
    });

    expect(typeof instance.broadcastAndVerify).toBe("function");
    expect(typeof instance.verifyInclusion).toBe("function");
    expect(typeof instance.verifyStateChange).toBe("function");
    expect(typeof instance.waitForConfirmation).toBe("function");
    expect(typeof instance.disconnect).toBe("function");
  });
});
