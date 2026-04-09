/**
 * Canonical Transaction Builder
 *
 * File: lib/tx/canonical-builder.ts
 *
 * Enforces deterministic transaction construction with strict ordering,
 * immutable fee policy, and content-addressed hashing for integrity verification.
 *
 * Key principles:
 * - Deterministic: Same inputs always produce same outputs
 * - Immutable: No modification after construction
 * - Verifiable: Payload hash can be independently reproduced
 * - Replay-protected: Binds chain_id, account_number, sequence
 */

import { StdFee, MultisigThresholdPubkey } from "@cosmjs/amino";
import { sha256 } from "@cosmjs/crypto";
import { toBase64 } from "@cosmjs/encoding";
import { EncodeObject, Registry, TxBodyEncodeObject } from "@cosmjs/proto-signing";
import { AminoTypes } from "@cosmjs/stargate";

import { aminoConverters, makeAppRegistry } from "../msg";
import { makeDirectModeAuthInfo, makeDirectSignDoc } from "../multisigDirect";

// ============================================================================
// Types
// ============================================================================

export interface TxOptions {
  /** Chain ID for replay protection */
  readonly chainId: string;
  /** Account number for replay protection */
  readonly accountNumber: number;
  /** Sequence for replay protection */
  readonly sequence: number;
  /** Transaction fee */
  readonly fee: StdFee;
  /** Optional memo */
  readonly memo?: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface SignDocBytes {
  /** Raw sign bytes */
  readonly bytes: Uint8Array;
  /** SHA256 hash of sign bytes */
  readonly hash: Uint8Array;
  /** Base64-encoded hash */
  readonly hashBase64: string;
}

export interface CanonicalPayload {
  readonly chainId: string;
  readonly accountNumber: number;
  readonly sequence: number;
  readonly msgs: readonly CanonicalMessage[];
  readonly fee: StdFee;
  readonly memo: string;
}

export interface CanonicalMessage {
  readonly typeUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly value: any;
}

// ============================================================================
// CanonicalTxBuilder
// ============================================================================

export class CanonicalTxBuilder {
  private readonly msgs: readonly EncodeObject[];
  private readonly options: TxOptions;
  private readonly registry: Registry;
  private readonly aminoTypes: AminoTypes;

  // Cached values (computed lazily)
  private _bodyBytes?: Uint8Array;
  private _payloadHash?: Uint8Array;
  private _canonicalPayload?: CanonicalPayload;

  private constructor(msgs: readonly EncodeObject[], options: TxOptions) {
    this.msgs = Object.freeze([...msgs]);
    this.options = Object.freeze({ ...options });
    this.registry = makeAppRegistry();
    this.aminoTypes = new AminoTypes(aminoConverters);
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Create a CanonicalTxBuilder from messages and options
   *
   * Messages are sorted deterministically by typeUrl, then by a hash of their content.
   * This ensures the same set of messages always produces the same transaction.
   */
  static fromMessages(msgs: readonly EncodeObject[], options: TxOptions): CanonicalTxBuilder {
    // Sort messages deterministically
    const sortedMsgs = CanonicalTxBuilder.sortMessages(msgs);
    return new CanonicalTxBuilder(sortedMsgs, options);
  }

  /**
   * Create from existing transaction data (for verification)
   */
  static fromTransactionData(data: {
    msgs: readonly EncodeObject[];
    fee: StdFee;
    memo: string;
    chainId: string;
    accountNumber: number;
    sequence: number;
  }): CanonicalTxBuilder {
    return new CanonicalTxBuilder(data.msgs, {
      chainId: data.chainId,
      accountNumber: data.accountNumber,
      sequence: data.sequence,
      fee: data.fee,
      memo: data.memo,
    });
  }

  // ============================================================================
  // Core Methods
  // ============================================================================

  /**
   * Get the canonical payload representation
   */
  getCanonicalPayload(): CanonicalPayload {
    if (this._canonicalPayload) {
      return this._canonicalPayload;
    }

    this._canonicalPayload = {
      chainId: this.options.chainId,
      accountNumber: this.options.accountNumber,
      sequence: this.options.sequence,
      msgs: this.msgs.map((m) => ({
        typeUrl: m.typeUrl,
        value: this.normalizeValue(m.value),
      })),
      fee: this.options.fee,
      memo: this.options.memo ?? "",
    };

    return this._canonicalPayload;
  }

  /**
   * Compute the SHA256 hash of the canonical payload
   *
   * This hash uniquely identifies the transaction content and can be
   * independently reproduced by any party with the same inputs.
   */
  getPayloadHash(): Uint8Array {
    if (this._payloadHash) {
      return this._payloadHash;
    }

    const payload = this.getCanonicalPayload();
    const canonical = this.serializeCanonical(payload);
    this._payloadHash = sha256(canonical);

    return this._payloadHash;
  }

  /**
   * Get the payload hash as base64 string
   */
  getPayloadHashBase64(): string {
    return toBase64(this.getPayloadHash());
  }

  /**
   * Get the encoded body bytes
   */
  getBodyBytes(): Uint8Array {
    if (this._bodyBytes) {
      return this._bodyBytes;
    }

    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: this.msgs as EncodeObject[],
        memo: this.options.memo ?? "",
      },
    };

    this._bodyBytes = this.registry.encode(txBodyEncodeObject);
    return this._bodyBytes;
  }

  /**
   * Get sign bytes for Direct mode signing
   */
  getDirectSignDoc(multisigPubkey: MultisigThresholdPubkey): SignDocBytes {
    const bodyBytes = this.getBodyBytes();

    const { authInfoBytes } = makeDirectModeAuthInfo(
      multisigPubkey,
      this.options.sequence,
      this.options.fee,
    );

    const { signDocBytes, signDocHash } = makeDirectSignDoc(
      bodyBytes,
      authInfoBytes,
      this.options.chainId,
      this.options.accountNumber,
    );

    return {
      bytes: signDocBytes,
      hash: signDocHash,
      hashBase64: toBase64(signDocHash),
    };
  }

  /**
   * Get sign bytes for Amino mode signing
   *
   * Returns the Amino-formatted SignDoc that wallets expect
   */
  getAminoSignDoc(): {
    signDoc: AminoSignDoc;
    bytes: Uint8Array;
    hash: Uint8Array;
    hashBase64: string;
  } {
    const aminoMsgs = this.msgs.map((msg) => this.aminoTypes.toAmino(msg));

    const signDoc: AminoSignDoc = {
      chain_id: this.options.chainId,
      account_number: String(this.options.accountNumber),
      sequence: String(this.options.sequence),
      fee: {
        amount: this.options.fee.amount,
        gas: this.options.fee.gas,
      },
      msgs: aminoMsgs,
      memo: this.options.memo ?? "",
    };

    // Serialize using sorted JSON (canonical form)
    const bytes = new TextEncoder().encode(this.serializeSortedJson(signDoc));
    const hash = sha256(bytes);

    return {
      signDoc,
      bytes,
      hash,
      hashBase64: toBase64(hash),
    };
  }

  /**
   * Get the appropriate sign bytes based on sign mode
   */
  getSignDoc(mode: "amino" | "direct", multisigPubkey?: MultisigThresholdPubkey): SignDocBytes {
    if (mode === "direct") {
      if (!multisigPubkey) {
        throw new Error("Multisig pubkey required for Direct mode");
      }
      return this.getDirectSignDoc(multisigPubkey);
    }

    const amino = this.getAminoSignDoc();
    return {
      bytes: amino.bytes,
      hash: amino.hash,
      hashBase64: amino.hashBase64,
    };
  }

  /**
   * Validate the transaction
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check chain ID
    if (!this.options.chainId) {
      errors.push("Chain ID is required");
    }

    // Check account number
    if (typeof this.options.accountNumber !== "number" || this.options.accountNumber < 0) {
      errors.push("Invalid account number");
    }

    // Check sequence
    if (typeof this.options.sequence !== "number" || this.options.sequence < 0) {
      errors.push("Invalid sequence");
    }

    // Check messages
    if (!this.msgs.length) {
      errors.push("At least one message is required");
    }

    for (let i = 0; i < this.msgs.length; i++) {
      const msg = this.msgs[i];
      if (!msg.typeUrl) {
        errors.push(`Message ${i} is missing typeUrl`);
      }
      if (msg.value === undefined || msg.value === null) {
        errors.push(`Message ${i} is missing value`);
      }
    }

    // Check fee
    if (!this.options.fee) {
      errors.push("Fee is required");
    } else {
      if (!this.options.fee.amount?.length) {
        warnings.push("Fee amount is empty");
      }
      if (!this.options.fee.gas || parseInt(this.options.fee.gas, 10) <= 0) {
        errors.push("Invalid gas amount");
      }
    }

    // Check memo length
    if (this.options.memo && this.options.memo.length > 256) {
      warnings.push("Memo exceeds 256 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify that a payload hash matches this transaction
   */
  verifyPayloadHash(expectedHash: string): boolean {
    const actualHash = this.getPayloadHashBase64();
    return actualHash === expectedHash;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get messages(): readonly EncodeObject[] {
    return this.msgs;
  }

  get fee(): StdFee {
    return this.options.fee;
  }

  get memo(): string {
    return this.options.memo ?? "";
  }

  get chainId(): string {
    return this.options.chainId;
  }

  get accountNumber(): number {
    return this.options.accountNumber;
  }

  get sequence(): number {
    return this.options.sequence;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Sort messages deterministically
   */
  private static sortMessages(msgs: readonly EncodeObject[]): EncodeObject[] {
    return [...msgs].sort((a, b) => {
      // First, sort by typeUrl
      const typeCompare = a.typeUrl.localeCompare(b.typeUrl);
      if (typeCompare !== 0) {
        return typeCompare;
      }

      // Then by a hash of the content
      const hashA = sha256(new TextEncoder().encode(JSON.stringify(a.value)));
      const hashB = sha256(new TextEncoder().encode(JSON.stringify(b.value)));

      return toBase64(hashA).localeCompare(toBase64(hashB));
    });
  }

  /**
   * Normalize a value for canonical representation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeValue(value: any): any {
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
      return value.map((v) => this.normalizeValue(v));
    }

    if (typeof value === "object") {
      const normalized: Record<string, unknown> = {};
      const keys = Object.keys(value).sort();
      for (const key of keys) {
        normalized[key] = this.normalizeValue(value[key]);
      }
      return normalized;
    }

    return value;
  }

  /**
   * Serialize to canonical bytes
   */
  private serializeCanonical(payload: CanonicalPayload): Uint8Array {
    const json = this.serializeSortedJson(payload);
    return new TextEncoder().encode(json);
  }

  /**
   * Serialize object to sorted JSON (deterministic)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeSortedJson(obj: any): string {
    return JSON.stringify(obj, (_, value) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }
      // Sort object keys
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(value).sort();
      for (const key of keys) {
        sorted[key] = value[key];
      }
      return sorted;
    });
  }
}

// ============================================================================
// Amino SignDoc Type
// ============================================================================

interface AminoSignDoc {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  readonly fee: {
    readonly amount: readonly { readonly denom: string; readonly amount: string }[];
    readonly gas: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly msgs: readonly any[];
  readonly memo: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that a payload hash matches transaction data
 */
export function verifyPayloadHash(
  data: {
    msgs: readonly EncodeObject[];
    fee: StdFee;
    memo: string;
    chainId: string;
    accountNumber: number;
    sequence: number;
  },
  expectedHash: string,
): boolean {
  const builder = CanonicalTxBuilder.fromTransactionData(data);
  return builder.verifyPayloadHash(expectedHash);
}

/**
 * Compute payload hash for transaction data
 */
export function computePayloadHash(data: {
  msgs: readonly EncodeObject[];
  fee: StdFee;
  memo: string;
  chainId: string;
  accountNumber: number;
  sequence: number;
}): string {
  const builder = CanonicalTxBuilder.fromTransactionData(data);
  return builder.getPayloadHashBase64();
}
