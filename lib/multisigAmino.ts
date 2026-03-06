/**
 * Safe Amino Multisig Assembly
 *
 * Provides a validated, type-normalized wrapper around cosmjs's
 * `makeMultisignedTxBytes`. The installed @cosmjs/encoding@0.35.0-rc.0 depends on
 * bech32@1.1.4 and @cosmjs/math calls `Uint53.fromString(pubkey.value.threshold)`,
 * which internally calls `str.match(...)`. If `threshold` is a JS number (not a
 * string) the call blows up with "str.match is not a function".
 *
 * Any time the pubkey is round-tripped through JSON.parse or arrives from a
 * protobuf decode path it may carry a numeric threshold. This module normalises all
 * numeric-but-should-be-string fields before handing them to cosmjs.
 */

import { MultisigThresholdPubkey, StdFee } from "@cosmjs/amino";
import { fromBech32 } from "@cosmjs/encoding";
import { makeMultisignedTxBytes } from "@cosmjs/stargate";

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Returns a copy of `pubkey` with `value.threshold` guaranteed to be a string.
 *
 * cosmjs 0.35.0-rc.0 calls `Uint53.fromString(pubkey.value.threshold)` inside
 * `encodePubkey`, which requires a string. If the pubkey was stored in the DB with
 * a numeric threshold or deserialized via protobuf, the threshold may be a number
 * at runtime even though the TypeScript type says `string`.
 */
export function normalizePubkey(pubkey: MultisigThresholdPubkey): MultisigThresholdPubkey {
  return {
    ...pubkey,
    value: {
      ...pubkey.value,
      // String() handles number, bigint, undefined, null gracefully
      threshold: String(pubkey.value.threshold),
    },
  };
}

/**
 * Returns a copy of `fee` with `gas`, `amount[].amount`, and `amount[].denom`
 * guaranteed to be strings.
 *
 * cosmjs uses `BigInt(fee.gas)` and validates coin amounts internally. If any of
 * these came from a JSON-deserialized object that had numbers instead of strings,
 * normalizing them here prevents downstream crashes.
 */
export function normalizeFee(fee: StdFee): StdFee {
  return {
    gas: String(fee.gas),
    amount: fee.amount.map((coin) => ({
      amount: String(coin.amount),
      denom: String(coin.denom),
    })),
    ...(fee.payer !== undefined && { payer: fee.payer }),
    ...(fee.granter !== undefined && { granter: fee.granter }),
  };
}

// ---------------------------------------------------------------------------
// Pre-flight validation
// ---------------------------------------------------------------------------

function validateSignatureMap(signatures: Map<string, Uint8Array>): void {
  if (signatures.size === 0) {
    throw new Error(
      "Cannot assemble multisig transaction: no signatures provided. " +
        "Ensure the transaction has been signed by enough members before broadcasting.",
    );
  }

  for (const addr of signatures.keys()) {
    if (!addr || typeof addr !== "string") {
      throw new Error(
        `Invalid signature key: expected a bech32 address string but got ${typeof addr}. ` +
          "The transaction data may be corrupt. Please cancel and create a new one.",
      );
    }
    try {
      fromBech32(addr);
    } catch {
      throw new Error(
        `Signature key "${addr}" is not a valid bech32 address. ` +
          "The transaction data may be corrupt. Please cancel and create a new one.",
      );
    }
  }
}

function validateNormalizedPubkey(pubkey: MultisigThresholdPubkey): void {
  const thresholdNum = Number(pubkey.value.threshold);
  if (!Number.isInteger(thresholdNum) || thresholdNum <= 0) {
    throw new Error(
      `Invalid multisig pubkey: threshold "${pubkey.value.threshold}" must be a positive integer string. ` +
        "The multisig may need to be re-registered. Please contact support.",
    );
  }
  if (!Array.isArray(pubkey.value.pubkeys) || pubkey.value.pubkeys.length === 0) {
    throw new Error(
      "Invalid multisig pubkey: no member public keys found. " +
        "The multisig data appears corrupt. Please cancel and create a new one.",
    );
  }
}

function validateNormalizedFee(fee: StdFee): void {
  if (!fee.gas || isNaN(Number(fee.gas)) || Number(fee.gas) <= 0) {
    throw new Error(
      `Invalid fee: gas "${fee.gas}" must be a positive numeric string. ` +
        "Please check the transaction fee settings.",
    );
  }
  for (const coin of fee.amount) {
    if (!coin.denom || typeof coin.denom !== "string" || coin.denom.length === 0) {
      throw new Error(
        "Invalid fee: coin denom must be a non-empty string. " +
          "Please check the transaction fee settings.",
      );
    }
    if (isNaN(Number(coin.amount)) || Number(coin.amount) < 0) {
      throw new Error(
        `Invalid fee: coin amount "${coin.amount}" must be a non-negative numeric string. ` +
          "Please check the transaction fee settings.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Safe assembly entry point
// ---------------------------------------------------------------------------

/**
 * Validated, type-normalized replacement for `makeMultisignedTxBytes`.
 *
 * - Normalizes `pubkey.value.threshold` to a string (fixes "str.match is not a
 *   function" crash in cosmjs@0.35.0-rc.0's Uint53.fromString).
 * - Normalizes fee numeric fields to strings.
 * - Validates signature map addresses are bech32 strings.
 * - Emits a detailed diagnostic `console.error` on failure before rethrowing.
 *
 * Use this in place of the raw `makeMultisignedTxBytes` import everywhere.
 */
export function safeAminoMultisigTxBytes(
  pubkey: MultisigThresholdPubkey,
  sequence: number,
  fee: StdFee,
  bodyBytes: Uint8Array,
  signatures: Map<string, Uint8Array>,
): Uint8Array {
  // Normalize types before any validation
  const normalizedPubkey = normalizePubkey(pubkey);
  const normalizedFee = normalizeFee(fee);

  try {
    // Validate after normalization so error messages reflect actual post-normalize state
    validateSignatureMap(signatures);
    validateNormalizedPubkey(normalizedPubkey);
    validateNormalizedFee(normalizedFee);

    return makeMultisignedTxBytes(
      normalizedPubkey,
      sequence,
      normalizedFee,
      bodyBytes,
      signatures,
    );
  } catch (e) {
    // Emit sanitized diagnostic metadata without exposing sensitive values
    console.error("[safeAminoMultisigTxBytes] Assembly failed:", {
      errorMessage: e instanceof Error ? e.message : String(e),
      thresholdType: typeof pubkey.value.threshold,
      thresholdValue: pubkey.value.threshold,
      normalizedThreshold: normalizedPubkey.value.threshold,
      pubkeyCount: pubkey.value?.pubkeys?.length ?? "unknown",
      signatureCount: signatures.size,
      signatureAddressTypes: Array.from(signatures.keys()).map((k) => typeof k),
      feeGasType: typeof fee.gas,
      feeGasValue: fee.gas,
      feeAmountCount: fee.amount?.length ?? "unknown",
      sequence,
    });
    throw e;
  }
}
