/**
 * Wallet Flow Adapter for Autonomous Testing
 *
 * File: __tests__/adapters/walletFlow.adapter.ts
 *
 * Provides build/sign/broadcast flow for integration tests.
 * Currently uses mock implementations to avoid cosmjs version compatibility issues.
 */

import { MultiRpcVerifier } from "@/lib/rpc/multi-rpc-verifier";
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
      // Mock tx building - create deterministic bytes based on input
      const input = JSON.stringify({ msgs, memo, timestamp: Date.now() });
      const bytes = new TextEncoder().encode(input);
      return bytes;
    },

    async signTxBytes(txBytes: Uint8Array, signer: WalletSigner): Promise<Uint8Array> {
      // Get signature and append to tx bytes
      const sig = await signer.sign(txBytes, { purpose: "test" });
      const sigBytes = Buffer.from(JSON.stringify(sig), "utf8");
      return new Uint8Array(Buffer.concat([txBytes, sigBytes]));
    },

    async broadcastSignedTx(
      txBytes: Uint8Array,
      broadcaster: Broadcaster,
    ): Promise<BroadcastResult> {
      return broadcaster.broadcastTx(txBytes);
    },

    async broadcastViaMultiRpcVerifier(txBytes: Uint8Array): Promise<any> {
      // Create minimal endpoint config for testing
      const config = {
        chainId: "test-chain",
        minConfirmations: 1,
        endpoints: [
          {
            url: "http://test-rpc",
            priority: "primary" as const,
          },
        ],
      };

      const verifier = new MultiRpcVerifier(config);
      return verifier.broadcastAndVerify(txBytes);
    },
  };
}
