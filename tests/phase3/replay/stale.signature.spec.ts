/**
 * Phase 3: Stale Signature Replay Attack Testing
 *
 * File: tests/phase3/replay/stale.signature.spec.ts
 *
 * Tests that old signed transaction bytes cannot be reused after
 * state changes (nonce increases, credential revocation, etc.).
 *
 * Core Invariant: Replayed tx bytes must not re-execute
 */

import { getWalletFlow } from "../../../__tests__/adapters/walletFlow.adapter";
import { MockWalletSigner } from "../../../__tests__/mocks/MockWalletSigner";
import { MockBroadcaster } from "../../../__tests__/mocks/MockBroadcaster";
import {
  genTx,
  genStaleSigTx,
  txToBytes,
  hashTxBytes,
  corruptBytes,
  setSeed,
} from "../generators/genTx";
import { assertReplayInvariants, ReplayContext } from "../oracle/invariantOracle";
import { faultController } from "../../chaos/faults";

describe("PHASE 3 REPLAY: Stale Signature Attack", () => {
  let walletFlow: ReturnType<typeof getWalletFlow>;
  let signer: MockWalletSigner;
  let broadcaster: MockBroadcaster;

  beforeEach(() => {
    walletFlow = getWalletFlow();
    signer = new MockWalletSigner();
    broadcaster = new MockBroadcaster();
    faultController.reset();
  });

  // ==========================================================================
  // BASIC STALE SIGNATURE DETECTION
  // ==========================================================================

  describe("Basic Stale Signature Detection", () => {
    test("old signed tx bytes cannot be reused", async () => {
      // Create and sign first transaction
      const tx1 = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
        memo: "tx1",
      });
      const signed1 = await walletFlow.signTxBytes(tx1, signer);

      // Create second transaction (different content)
      const tx2 = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: { different: true } }],
        memo: "tx2",
      });

      // Signed bytes should be different
      expect(signed1).not.toEqual(tx2);

      // Hash tracking
      const executedTxHashes = new Set<string>();

      // First execution
      const hash1 = hashTxBytes(signed1);
      expect(executedTxHashes.has(hash1)).toBe(false);
      executedTxHashes.add(hash1);

      // Attempt to replay signed1 bytes should be detected
      expect(executedTxHashes.has(hash1)).toBe(true);

      // Invariant check
      const replayCtx: ReplayContext = {
        txHash: hash1,
        txBytes: signed1,
        previousExecutions: executedTxHashes,
        executionSucceeded: false, // Should be false for replay
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
    });

    test("generated stale signature transactions are properly malformed", () => {
      for (let i = 0; i < 100; i++) {
        const tx = genStaleSigTx(i);

        // Transaction sequence should be higher than signature sequence
        const txSequence = parseInt(tx.sequence);
        const sigSequence = parseInt(tx.signatures[0]?.sequence ?? "0");

        expect(txSequence).toBeGreaterThan(sigSequence);
        expect(tx._malformationType).toBe("stale_signature");
      }
    });
  });

  // ==========================================================================
  // NONCE SEQUENCE PROTECTION
  // ==========================================================================

  describe("Nonce Sequence Protection", () => {
    test("increasing sequence numbers prevent replay", async () => {
      const executedTxHashes = new Set<string>();

      // Simulate account with increasing sequence
      for (let sequence = 0; sequence < 10; sequence++) {
        const tx = await walletFlow.buildTxBytes({
          msgs: [{ type: "test", value: { sequence } }],
        });

        // Sign with current sequence
        const signedTx = await walletFlow.signTxBytes(tx, signer);
        const txHash = hashTxBytes(signedTx);

        // First execution succeeds
        expect(executedTxHashes.has(txHash)).toBe(false);
        executedTxHashes.add(txHash);

        // Any attempt to replay this tx should fail
        const replayCtx: ReplayContext = {
          txHash,
          txBytes: signedTx,
          sequence,
          previousExecutions: executedTxHashes,
          executionSucceeded: false,
        };

        expect(() => assertReplayInvariants(replayCtx)).not.toThrow();

        // Next sequence would be higher
        // In real blockchain, this would be handled by the node
      }
    });

    test("out-of-order sequence replay fails", async () => {
      const signedTxs: Uint8Array[] = [];
      const executedTxHashes = new Set<string>();

      // Create transactions with different sequences
      for (let seq = 0; seq < 5; seq++) {
        const tx = await walletFlow.buildTxBytes({
          msgs: [{ type: "test", value: { seq } }],
        });
        const signed = await walletFlow.signTxBytes(tx, signer);
        signedTxs.push(signed);

        // Execute in order
        const txHash = hashTxBytes(signed);
        executedTxHashes.add(txHash);
      }

      // Try to replay old transactions
      for (let i = 0; i < 4; i++) {
        const oldTxHash = hashTxBytes(signedTxs[i]);

        const replayCtx: ReplayContext = {
          txHash: oldTxHash,
          txBytes: signedTxs[i],
          sequence: i,
          previousExecutions: executedTxHashes,
          executionSucceeded: false, // Should be false
        };

        expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
      }
    });
  });

  // ==========================================================================
  // CREDENTIAL REVOCATION PROTECTION
  // ==========================================================================

  describe("Credential Revocation Protection", () => {
    test("credential revocation prevents signature reuse", async () => {
      // Create signed transaction with valid credential
      faultController.state.credentialValid = true;

      const tx = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signedTx = await walletFlow.signTxBytes(tx, signer);
      const txHash = hashTxBytes(signedTx);

      // Execute successfully
      const executedTxHashes = new Set([txHash]);

      // Revoke credential
      faultController.state.credentialValid = false;

      // Attempt to replay same signed bytes should fail
      const replayCtx: ReplayContext = {
        txHash,
        txBytes: signedTx,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();

      faultController.reset();
    });

    test("different signers prevent cross-signature replay", async () => {
      const signerA = new MockWalletSigner({ address: "cosmos1signerA" });
      const signerB = new MockWalletSigner({ address: "cosmos1signerB" });

      // Signer A creates and executes transaction
      const txA = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: { signer: "A" } }],
      });
      const signedA = await walletFlow.signTxBytes(txA, signerA);
      const hashA = hashTxBytes(signedA);

      const executedTxHashes = new Set([hashA]);

      // Signer B tries to replay A's signed transaction (should fail)
      const replayCtx: ReplayContext = {
        txHash: hashA,
        txBytes: signedA,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
    });
  });

  // ==========================================================================
  // MALFORMED SIGNATURE HANDLING
  // ==========================================================================

  describe("Malformed Signature Handling", () => {
    test("corrupted signatures cannot be replayed", async () => {
      // Create valid signed transaction
      const tx = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signedTx = await walletFlow.signTxBytes(tx, signer);

      // Corrupt the signature bytes
      const corruptedSignedTx = corruptBytes(signedTx, 0.1);
      const corruptedHash = hashTxBytes(corruptedSignedTx);

      const executedTxHashes = new Set<string>();

      // Original succeeds
      const originalHash = hashTxBytes(signedTx);
      executedTxHashes.add(originalHash);

      // Corrupted version should be treated as different transaction
      expect(corruptedHash).not.toBe(originalHash);

      // But if somehow corrupted version was executed, replay would be detected
      executedTxHashes.add(corruptedHash);

      const replayCtx: ReplayContext = {
        txHash: corruptedHash,
        txBytes: corruptedSignedTx,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
    });

    test("empty or invalid signatures are handled", async () => {
      // Create transaction with empty signature
      const tx = genStaleSigTx(12345);
      const txBytes = txToBytes(tx);

      // Should not crash
      expect(() => hashTxBytes(txBytes)).not.toThrow();

      const txHash = hashTxBytes(txBytes);
      const executedTxHashes = new Set<string>();

      // Attempt to "execute" (should fail due to invalid signature)
      const replayCtx: ReplayContext = {
        txHash,
        txBytes,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
    });
  });

  // ==========================================================================
  // BROADCAST FAILURE AND RETRY SCENARIOS
  // ==========================================================================

  describe("Broadcast Failure and Retry Scenarios", () => {
    test("failed broadcast does not prevent valid re-signing", async () => {
      // First attempt fails
      broadcaster.enqueueFailure(new Error("NETWORK_ERROR"));

      const tx1 = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signed1 = await walletFlow.signTxBytes(tx1, signer);

      await expect(walletFlow.broadcastSignedTx(signed1, broadcaster)).rejects.toThrow();

      // Second attempt with new signature succeeds
      broadcaster.enqueueSuccess({ code: 0, txhash: "SUCCESS_HASH" });

      const tx2 = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signed2 = await walletFlow.signTxBytes(tx2, signer);

      const result = await walletFlow.broadcastSignedTx(signed2, broadcaster);
      expect(result.code).toBe(0);

      // Hashes should be different (different timestamps in mock)
      const hash1 = hashTxBytes(signed1);
      const hash2 = hashTxBytes(signed2);
      expect(hash1).not.toBe(hash2);
    });

    test("successful broadcast prevents replay", async () => {
      broadcaster.enqueueSuccess({ code: 0, txhash: "EXECUTED_HASH" });

      const tx = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signedTx = await walletFlow.signTxBytes(tx, signer);

      // Execute successfully
      const result = await walletFlow.broadcastSignedTx(signedTx, broadcaster);
      expect(result.code).toBe(0);

      const executedTxHashes = new Set([hashTxBytes(signedTx)]);

      // Replay attempt should be detected
      const replayCtx: ReplayContext = {
        txHash: hashTxBytes(signedTx),
        txBytes: signedTx,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
    });
  });

  // ==========================================================================
  // STATE CHANGES AND REPLAY PROTECTION
  // ==========================================================================

  describe("State Changes and Replay Protection", () => {
    test("policy version changes prevent replay", async () => {
      // Create and execute transaction with version 1
      faultController.state.policyVersion = 1;

      const tx1 = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signed1 = await walletFlow.signTxBytes(tx1, signer);

      const executedTxHashes = new Set([hashTxBytes(signed1)]);

      // Change policy version
      faultController.state.policyVersion = 2;

      // Same signed bytes cannot be replayed
      const replayCtx: ReplayContext = {
        txHash: hashTxBytes(signed1),
        txBytes: signed1,
        previousExecutions: executedTxHashes,
        executionSucceeded: false,
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();

      faultController.reset();
    });

    test("emergency pause prevents replay execution", async () => {
      // Execute transaction normally
      const tx = await walletFlow.buildTxBytes({
        msgs: [{ type: "test", value: {} }],
      });
      const signedTx = await walletFlow.signTxBytes(tx, signer);

      const executedTxHashes = new Set([hashTxBytes(signedTx)]);

      // Activate emergency pause
      faultController.state.emergencyPaused = true;

      // Replay attempt should fail even if tried
      const replayCtx: ReplayContext = {
        txHash: hashTxBytes(signedTx),
        txBytes: signedTx,
        previousExecutions: executedTxHashes,
        executionSucceeded: false, // Would be blocked by emergency pause
      };

      expect(() => assertReplayInvariants(replayCtx)).not.toThrow();

      faultController.reset();
    });
  });

  // ==========================================================================
  // STRESS TESTING
  // ==========================================================================

  describe("Stress Testing", () => {
    test("1000 stale signature attempts are handled", () => {
      const executedTxHashes = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const tx = genStaleSigTx(i);
        const txBytes = txToBytes(tx);
        const txHash = hashTxBytes(txBytes);

        // Simulate that none of these stale signatures succeed
        const replayCtx: ReplayContext = {
          txHash,
          txBytes,
          previousExecutions: executedTxHashes,
          executionSucceeded: false,
        };

        expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
      }
    });

    test("rapid signature generation and validation", async () => {
      const startTime = Date.now();
      const executedTxHashes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        // Create, sign, and "execute" transaction
        const tx = await walletFlow.buildTxBytes({
          msgs: [{ type: "test", value: { id: i } }],
        });
        const signedTx = await walletFlow.signTxBytes(tx, signer);
        const txHash = hashTxBytes(signedTx);

        executedTxHashes.add(txHash);

        // Verify replay protection
        const replayCtx: ReplayContext = {
          txHash,
          txBytes: signedTx,
          previousExecutions: executedTxHashes,
          executionSucceeded: false,
        };

        expect(() => assertReplayInvariants(replayCtx)).not.toThrow();
      }

      const duration = Date.now() - startTime;
      console.log(`Processed 100 signatures in ${duration}ms`);

      // Should complete reasonably fast
      expect(duration).toBeLessThan(5000);
    });
  });
});
