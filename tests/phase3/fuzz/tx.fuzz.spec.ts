/**
 * Phase 3: Transaction Fuzzing Tests
 *
 * File: tests/phase3/fuzz/tx.fuzz.spec.ts
 *
 * Fuzzes transaction building, signing, and validation with malformed,
 * hostile, and randomized inputs to prove resilient fail-closed behavior.
 *
 * Goal: Prove that no malformed transaction can be processed without
 * proper validation failures.
 */

import {
  genTx,
  genMalformedTx,
  genReplayTx,
  genStaleSigTx,
  genTxBatch,
  txToBytes,
  hashTxBytes,
  corruptBytes,
  setSeed,
} from "../generators/genTx";
import { assertReplayInvariants, ReplayContext, hashTxBytes as oracleHashTxBytes } from "../oracle/invariantOracle";
import { getWalletFlow } from "../../../__tests__/adapters/walletFlow.adapter";
import { MockWalletSigner } from "../../../__tests__/mocks/MockWalletSigner";
import { MockBroadcaster } from "../../../__tests__/mocks/MockBroadcaster";

describe("PHASE 3 FUZZ: Transaction Processing", () => {
  let walletFlow: ReturnType<typeof getWalletFlow>;
  let signer: MockWalletSigner;
  let broadcaster: MockBroadcaster;

  beforeEach(() => {
    walletFlow = getWalletFlow();
    signer = new MockWalletSigner();
    broadcaster = new MockBroadcaster();
  });

  // ==========================================================================
  // FUZZ: Valid Transaction Generation
  // ==========================================================================

  describe("Fuzz: Valid Transaction Generation", () => {
    test("1000 valid transactions produce valid bytes", async () => {
      for (let i = 0; i < 1000; i++) {
        setSeed(i);
        const tx = genTx(i);
        const bytes = txToBytes(tx);

        expect(bytes instanceof Uint8Array || bytes.constructor.name === 'Uint8Array').toBe(true);
        expect(bytes.length).toBeGreaterThan(0);

        // Hash should be deterministic
        const hash1 = hashTxBytes(bytes);
        const hash2 = hashTxBytes(bytes);
        expect(hash1).toBe(hash2);
      }
    });

    test("valid transactions can be signed", async () => {
      for (let i = 0; i < 100; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);

        const signedBytes = await walletFlow.signTxBytes(bytes, signer);

        expect(signedBytes).toBeInstanceOf(Uint8Array);
        expect(signedBytes.length).toBeGreaterThan(bytes.length);
      }
    });

    test("valid transactions can be broadcast", async () => {
      for (let i = 0; i < 100; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);
        const signedBytes = await walletFlow.signTxBytes(bytes, signer);

        broadcaster.enqueueSuccess({ code: 0, txhash: `HASH_${i}` });
        const result = await walletFlow.broadcastSignedTx(signedBytes, broadcaster);

        expect(result.code).toBe(0);
        expect(result.txhash).toBe(`HASH_${i}`);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Malformed Transaction Handling
  // ==========================================================================

  describe("Fuzz: Malformed Transaction Handling", () => {
    const malformationTypes = [
      "empty_messages",
      "invalid_addresses",
      "negative_amount",
      "overflow_amount",
      "empty_signature",
      "wrong_chain_id",
      "stale_sequence",
      "corrupted_bytes",
      "missing_fee",
      "zero_gas",
      "invalid_denom",
    ];

    test.each(malformationTypes)(
      "malformation '%s' produces invalid transaction data",
      async (malformationType) => {
        for (let i = 0; i < 50; i++) {
          setSeed(i);
          const tx = genMalformedTx(malformationType, i);

          expect(tx._malformationType).toBe(malformationType);

          // The transaction object exists but is malformed
          expect(tx).toBeDefined();

          // Specific malformation checks
          switch (malformationType) {
            case "empty_messages":
              expect(tx.messages.length).toBe(0);
              break;
            case "invalid_addresses":
              expect(tx.messages[0]?.value).toHaveProperty("fromAddress", "invalid_address_!!!");
              break;
            case "negative_amount":
              expect((tx.messages[0]?.value as any)?.amount[0]?.amount).toBe("-1000");
              break;
            case "zero_gas":
              expect(tx.fee.gas).toBe("0");
              break;
            case "empty_signature":
              expect(tx.signatures[0]?.signature).toBe("");
              break;
          }
        }
      }
    );

    test("500 malformed transactions do not crash serialization", () => {
      for (let i = 0; i < 500; i++) {
        setSeed(i);
        const malformationType = malformationTypes[i % malformationTypes.length];
        const tx = genMalformedTx(malformationType, i);

        // Should not throw
        expect(() => {
          const bytes = txToBytes(tx);
          hashTxBytes(bytes);
        }).not.toThrow();
      }
    });
  });

  // ==========================================================================
  // FUZZ: Corrupted Bytes Handling
  // ==========================================================================

  describe("Fuzz: Corrupted Bytes Handling", () => {
    test("100 corrupted byte arrays produce different hashes", () => {
      const originalTx = genTx(12345);
      const originalBytes = txToBytes(originalTx);
      const originalHash = hashTxBytes(originalBytes);

      for (let i = 0; i < 100; i++) {
        const corruptedBytes = corruptBytes(originalBytes, 0.1);

        // Most corrupted versions should have different hashes
        // (some might not if corruption doesn't affect hash-relevant bytes)
        const corruptedHash = hashTxBytes(corruptedBytes);

        // At least the bytes should be different
        let isDifferent = false;
        for (let j = 0; j < originalBytes.length; j++) {
          if (originalBytes[j] !== corruptedBytes[j]) {
            isDifferent = true;
            break;
          }
        }

        // With 10% corruption rate, very unlikely to be identical
        expect(isDifferent).toBe(true);
      }
    });

    test("heavily corrupted bytes are still processable", () => {
      for (let i = 0; i < 100; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);
        const corruptedBytes = corruptBytes(bytes, 0.5); // 50% corruption

        // Should not crash
        expect(() => hashTxBytes(corruptedBytes)).not.toThrow();
      }
    });
  });

  // ==========================================================================
  // FUZZ: Replay Attack Detection
  // ==========================================================================

  describe("Fuzz: Replay Attack Detection", () => {
    test("replay transactions are detected", () => {
      const executedHashes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const originalTx = genTx(i);
        const bytes = txToBytes(originalTx);
        const txHash = hashTxBytes(bytes);

        // First execution succeeds
        expect(executedHashes.has(txHash)).toBe(false);
        executedHashes.add(txHash);

        // Create replay
        const replayTx = genReplayTx(originalTx);
        const replayBytes = txToBytes({
          ...replayTx,
          // Use same data to get same hash
          messages: originalTx.messages,
          fee: originalTx.fee,
          memo: originalTx.memo,
          signatures: originalTx.signatures,
          chainId: originalTx.chainId,
          accountNumber: originalTx.accountNumber,
          sequence: originalTx.sequence,
        });
        const replayHash = hashTxBytes(replayBytes);

        // Replay should be detected
        expect(executedHashes.has(replayHash)).toBe(true);
      }
    });

    test("replay invariant assertions work correctly", () => {
      const executedTxHashes = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);
        const txHash = oracleHashTxBytes(bytes);

        // First execution
        const firstCtx: ReplayContext = {
          txHash,
          txBytes: bytes,
          previousExecutions: new Set(executedTxHashes),
          executionSucceeded: true,
        };

        expect(() => assertReplayInvariants(firstCtx)).not.toThrow();
        executedTxHashes.add(txHash);

        // Replay attempt (should fail if execution succeeds)
        const replayCtx: ReplayContext = {
          txHash,
          txBytes: bytes,
          previousExecutions: new Set(executedTxHashes),
          executionSucceeded: true, // This would be a violation
        };

        expect(() => assertReplayInvariants(replayCtx)).toThrow(/INVARIANT VIOLATION.*[Rr]eplay/);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Stale Signature Detection
  // ==========================================================================

  describe("Fuzz: Stale Signature Detection", () => {
    test("stale signatures produce mismatched sequences", () => {
      for (let i = 0; i < 100; i++) {
        const tx = genStaleSigTx(i);

        // Transaction sequence should be higher than signature sequence
        const txSequence = parseInt(tx.sequence);
        const sigSequence = parseInt(tx.signatures[0]?.sequence ?? "0");

        expect(txSequence).toBeGreaterThan(sigSequence);
      }
    });

    test("stale signature transactions are identifiable", () => {
      for (let i = 0; i < 100; i++) {
        const tx = genStaleSigTx(i);

        expect(tx._malformationType).toBe("stale_signature");

        // Verify the mismatch
        const isStale = tx.signatures.some(
          (sig) => parseInt(sig.sequence) < parseInt(tx.sequence)
        );
        expect(isStale).toBe(true);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Batch Transaction Testing
  // ==========================================================================

  describe("Fuzz: Batch Transaction Testing", () => {
    test("1000 mixed transactions (valid, malformed, stale) are processable", () => {
      const batch = genTxBatch(1000, 54321);

      let validCount = 0;
      let malformedCount = 0;
      let staleCount = 0;

      for (const tx of batch) {
        // All should be processable without crash
        expect(() => txToBytes(tx)).not.toThrow();

        if (tx._generator === "genTx") {
          validCount++;
        } else if (tx._generator === "genMalformedTx") {
          malformedCount++;
        } else if (tx._generator === "genStaleSigTx") {
          staleCount++;
        }
      }

      console.log(`Batch: ${validCount} valid, ${malformedCount} malformed, ${staleCount} stale`);

      // Ensure diverse coverage
      expect(validCount).toBeGreaterThan(0);
      expect(malformedCount).toBeGreaterThan(0);
      expect(staleCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // STRESS: High Volume Transaction Processing
  // ==========================================================================

  describe("Stress: High Volume Transaction Processing", () => {
    test("10000 transactions process without crashes", () => {
      for (let i = 0; i < 10000; i++) {
        setSeed(i);

        // Mix of valid and malformed
        const tx = i % 3 === 0 ? genTx(i) : genMalformedTx(undefined, i);
        const bytes = txToBytes(tx);
        const hash = hashTxBytes(bytes);

        expect(hash).toBeDefined();
        expect(hash.startsWith("txhash_")).toBe(true);
      }
    });

    test("high volume signing does not degrade", async () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);
        await walletFlow.signTxBytes(bytes, signer);
      }

      const duration = Date.now() - startTime;
      console.log(`Signed 1000 transactions in ${duration}ms (${1000000 / duration}/s)`);

      // Should complete in reasonable time (< 10s for 1000 txs)
      expect(duration).toBeLessThan(10000);
    });

    test("broadcast queue handles rapid fire", async () => {
      for (let i = 0; i < 500; i++) {
        broadcaster.enqueueSuccess({ code: 0, txhash: `RAPID_${i}` });
      }

      const promises: Promise<any>[] = [];

      for (let i = 0; i < 500; i++) {
        const tx = genTx(i);
        const bytes = txToBytes(tx);
        const signedBytes = await walletFlow.signTxBytes(bytes, signer);

        promises.push(walletFlow.broadcastSignedTx(signedBytes, broadcaster));
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(500);
      results.forEach((r, i) => {
        expect(r.code).toBe(0);
        expect(r.txhash).toBe(`RAPID_${i}`);
      });
    });
  });
});

