/**
 * Wallet Flow Adapter for Autonomous Testing
 *
 * File: __tests__/adapters/walletFlow.adapter.ts
 *
 * Provides build/sign/broadcast flow for integration tests.
 * Currently uses mock implementations to avoid cosmjs version compatibility issues.
 */

import { MultiRpcVerifier } from "@/lib/rpc/multi-rpc-verifier";
import type { EndpointConfig } from "@/lib/rpc/endpoint-manager";
import { EncodeObject } from "@cosmjs/proto-signing";
import type { WalletSigner } from "../mocks/MockWalletSigner";
import type { Broadcaster, BroadcastResult } from "../mocks/MockBroadcaster";

export interface WalletFlow {
  buildTxBytes(input: { msgs: readonly EncodeObject[]; memo?: string }): Promise<Uint8Array>;
  signTxBytes(txBytes: Uint8Array, signer: WalletSigner): Promise<Uint8Array>;
  broadcastSignedTx(txBytes: Uint8Array, broadcaster: Broadcaster): Promise<BroadcastResult>;
  broadcastViaMultiRpcVerifier?(txBytes: Uint8Array): Promise<any>;
}

/**
 * Monotonic clock for mock tx building. Guarantees every build gets a distinct
 * timestamp even when several complete within the same millisecond.
 */
let lastBuildTimestamp = 0;

function nextBuildTimestamp(): number {
  const now = Date.now();
  lastBuildTimestamp = now > lastBuildTimestamp ? now : lastBuildTimestamp + 1;
  return lastBuildTimestamp;
}

/**
 * Get a wallet flow implementation with mock tx building for testing
 */
export function getWalletFlow(): WalletFlow {
  return {
    async buildTxBytes({
      msgs,
      memo,
    }: {
      msgs: readonly EncodeObject[];
      memo?: string;
    }): Promise<Uint8Array> {
      // Mock tx building - create deterministic bytes based on input.
      // The timestamp is forced strictly monotonic: Date.now() has millisecond
      // resolution, so two builds inside the same millisecond would otherwise
      // produce byte-identical txs, and any test asserting that two separate
      // builds differ would fail depending on machine speed.
      const input = JSON.stringify({ msgs, memo, timestamp: nextBuildTimestamp() });
      const bytes = new TextEncoder().encode(input);
      return bytes;
    },

    async signTxBytes(txBytes: Uint8Array, signer: WalletSigner): Promise<Uint8Array> {
      // Get signature and append to tx bytes
      const sig = await signer.sign(txBytes, { purpose: "test" });
      const sigBytes = new TextEncoder().encode(JSON.stringify(sig));
      const signed = new Uint8Array(txBytes.length + sigBytes.length);
      signed.set(txBytes, 0);
      signed.set(sigBytes, txBytes.length);
      return signed;
    },

    async broadcastSignedTx(
      txBytes: Uint8Array,
      broadcaster: Broadcaster,
    ): Promise<BroadcastResult> {
      return broadcaster.broadcastTx(txBytes);
    },

    async broadcastViaMultiRpcVerifier(txBytes: Uint8Array): Promise<any> {
      // Create minimal endpoint config for testing
      const config: EndpointConfig = {
        chainId: "test-chain",
        minConfirmations: 1,
        timeoutMs: 30000,
        endpoints: [
          {
            url: "http://test-rpc",
            priority: "primary",
            type: "private",
          },
        ],
      };

      const verifier = new MultiRpcVerifier(config);
      return verifier.broadcastAndVerify(txBytes);
    },
  };
}
