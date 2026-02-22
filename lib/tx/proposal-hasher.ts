/**
 * Proposal Hash Computation
 * 
 * File: lib/tx/proposal-hasher.ts
 * 
 * Provides content-addressed hashing for proposals to ensure integrity.
 * The hash uniquely identifies the proposal content and can be independently
 * reproduced by any party with the same inputs.
 */

import { StdFee } from "@cosmjs/amino";
import { sha256 } from "@cosmjs/crypto";
import { toBase64 } from "@cosmjs/encoding";
import { EncodeObject } from "@cosmjs/proto-signing";

// ============================================================================
// Types
// ============================================================================

export interface ProposalHashInput {
  /** Chain ID for replay protection */
  readonly chainId: string;
  /** Account number for replay protection */
  readonly accountNumber: number;
  /** Sequence for replay protection */
  readonly sequence: number;
  /** Transaction messages */
  readonly msgs: readonly EncodeObject[];
  /** Transaction fee */
  readonly fee: StdFee;
  /** Transaction memo */
  readonly memo: string;
}

export interface ProposalHashResult {
  /** Raw hash bytes (32 bytes) */
  readonly hash: Uint8Array;
  /** Base64-encoded hash */
  readonly hashBase64: string;
  /** Hex-encoded hash */
  readonly hashHex: string;
  /** Canonical JSON used to compute the hash */
  readonly canonicalJson: string;
}

// ============================================================================
// ProposalHasher Class
// ============================================================================

export class ProposalHasher {
  /**
   * Compute the hash of a proposal
   * 
   * The hash is computed from a canonical JSON representation of the proposal,
   * ensuring deterministic output regardless of property order or formatting.
   */
  static hash(input: ProposalHashInput): ProposalHashResult {
    const canonical = ProposalHasher.toCanonicalJson(input);
    const bytes = new TextEncoder().encode(canonical);
    const hash = sha256(bytes);

    return {
      hash,
      hashBase64: toBase64(hash),
      hashHex: ProposalHasher.toHex(hash),
      canonicalJson: canonical,
    };
  }

  /**
   * Verify a proposal hash matches expected value
   */
  static verify(input: ProposalHashInput, expectedHash: string): boolean {
    const result = ProposalHasher.hash(input);
    
    // Support both base64 and hex formats
    if (expectedHash.length === 64) {
      // Looks like hex
      return result.hashHex === expectedHash.toLowerCase();
    }
    
    return result.hashBase64 === expectedHash;
  }

  /**
   * Convert proposal to canonical JSON representation
   * 
   * This produces a deterministic JSON string with:
   * - Sorted object keys
   * - Normalized values (BigInt to string, Uint8Array to base64)
   * - No extra whitespace
   */
  static toCanonicalJson(input: ProposalHashInput): string {
    const canonical = {
      // Order matters for determinism - use alphabetical
      accountNumber: input.accountNumber,
      chainId: input.chainId,
      fee: ProposalHasher.normalizeFee(input.fee),
      memo: input.memo,
      msgs: input.msgs.map((m) => ProposalHasher.normalizeMessage(m)),
      sequence: input.sequence,
    };

    return ProposalHasher.sortedStringify(canonical);
  }

  /**
   * Normalize a message for canonical representation
   */
  private static normalizeMessage(msg: EncodeObject): {
    typeUrl: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  } {
    return {
      typeUrl: msg.typeUrl,
      value: ProposalHasher.normalizeValue(msg.value),
    };
  }

  /**
   * Normalize a fee for canonical representation
   */
  private static normalizeFee(fee: StdFee): {
    amount: { amount: string; denom: string }[];
    gas: string;
  } {
    return {
      amount: fee.amount.map((coin) => ({
        amount: coin.amount,
        denom: coin.denom,
      })),
      gas: fee.gas,
    };
  }

  /**
   * Normalize a value recursively
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static normalizeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Uint8Array) {
      return toBase64(value);
    }

    if (Array.isArray(value)) {
      return value.map((v) => ProposalHasher.normalizeValue(v));
    }

    if (typeof value === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized: Record<string, any> = {};
      const keys = Object.keys(value).sort();
      for (const key of keys) {
        const normalizedValue = ProposalHasher.normalizeValue(value[key]);
        // Skip undefined values but keep null
        if (normalizedValue !== undefined) {
          normalized[key] = normalizedValue;
        }
      }
      return normalized;
    }

    return value;
  }

  /**
   * Stringify with sorted keys for determinism
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static sortedStringify(obj: any): string {
    return JSON.stringify(obj, (_, value) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }
      // Sort object keys alphabetically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted: Record<string, any> = {};
      const keys = Object.keys(value).sort();
      for (const key of keys) {
        sorted[key] = value[key];
      }
      return sorted;
    });
  }

  /**
   * Convert bytes to hex string
   */
  private static toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Compute the hash of a proposal
 * 
 * @param input - Proposal content
 * @returns Base64-encoded hash
 */
export function computeProposalHash(input: ProposalHashInput): string {
  return ProposalHasher.hash(input).hashBase64;
}

/**
 * Verify a proposal hash
 * 
 * @param input - Proposal content
 * @param expectedHash - Expected hash (base64 or hex)
 * @returns True if hash matches
 */
export function verifyProposalHash(
  input: ProposalHashInput,
  expectedHash: string,
): boolean {
  return ProposalHasher.verify(input, expectedHash);
}

/**
 * Get detailed hash result including canonical JSON
 * 
 * Useful for debugging and verification
 */
export function getProposalHashDetails(
  input: ProposalHashInput,
): ProposalHashResult {
  return ProposalHasher.hash(input);
}

