/**
 * Direct Mode Multisig Transaction Builder
 *
 * This module provides support for SIGN_MODE_DIRECT in multisig transactions.
 * TX (and some other chains) require SIGN_MODE_DIRECT for certain message types
 * like MsgWithdrawValidatorCommission.
 *
 * For Direct mode signing:
 * 1. The AuthInfo (with fee and signer_infos) must be pre-constructed
 * 2. Each signer signs: SHA256(SignDoc) where SignDoc = { bodyBytes, authInfoBytes, chainId, accountNumber }
 * 3. Signatures are assembled into the final transaction
 */

import { MultisigThresholdPubkey, pubkeyToAddress } from "@cosmjs/amino";
import { fromBech32, toBase64 } from "@cosmjs/encoding";
import { encodePubkey } from "@cosmjs/proto-signing";
import { normalizePubkey, normalizeFee } from "./multisigAmino";
import { StdFee } from "@cosmjs/stargate";
import {
  CompactBitArray,
  MultiSignature,
} from "cosmjs-types/cosmos/crypto/multisig/v1beta1/multisig";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { AuthInfo, SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { sha256 } from "@cosmjs/crypto";

/**
 * Creates a compact bit array indicating which pubkeys have signed
 */
function makeCompactBitArray(bits: readonly boolean[]): CompactBitArray {
  const byteCount = Math.ceil(bits.length / 8);
  const extraBits = bits.length - Math.floor(bits.length / 8) * 8;
  const bytes = new Uint8Array(byteCount);

  bits.forEach((value, index) => {
    const bytePos = Math.floor(index / 8);
    const bitPos = index % 8;
    if (value) {
      // eslint-disable-next-line no-bitwise -- Bitwise operations are required for CompactBitArray encoding
      bytes[bytePos] |= 0b1 << (8 - 1 - bitPos);
    }
  });

  return CompactBitArray.fromPartial({ elems: bytes, extraBitsStored: extraBits });
}

/**
 * Pre-constructs the AuthInfo for Direct mode signing.
 * This must be done BEFORE collecting signatures, as the authInfoBytes
 * are part of what gets signed in Direct mode.
 */
export function makeDirectModeAuthInfo(
  multisigPubkey: MultisigThresholdPubkey,
  sequence: number,
  fee: StdFee,
): { authInfo: AuthInfo; authInfoBytes: Uint8Array } {
  // Normalize to prevent "str.match is not a function" from Uint53.fromString(threshold)
  const pubkey = normalizePubkey(multisigPubkey);
  const normalizedFee = normalizeFee(fee);

  // For multisig, we create a single signer_info with the multisig pubkey
  // The mode_info is "multi" with SIGN_MODE_DIRECT for each individual signer
  const signerInfo = {
    publicKey: encodePubkey(pubkey),
    modeInfo: {
      multi: {
        // The bitarray will be filled in when we know which signers have signed
        // For pre-construction, we assume all will sign
        bitarray: makeCompactBitArray(pubkey.value.pubkeys.map(() => true)),
        modeInfos: pubkey.value.pubkeys.map(() => ({
          single: { mode: SignMode.SIGN_MODE_DIRECT },
        })),
      },
    },
    sequence: BigInt(sequence),
  };

  const authInfo = AuthInfo.fromPartial({
    signerInfos: [signerInfo],
    fee: {
      amount: [...normalizedFee.amount],
      gasLimit: BigInt(normalizedFee.gas),
    },
  });

  const authInfoBytes = AuthInfo.encode(authInfo).finish();

  return { authInfo, authInfoBytes };
}

/**
 * Creates the Direct mode SignDoc that each signer must sign.
 * This is the protobuf-encoded SignDoc, not the Amino JSON SignDoc.
 */
export function makeDirectSignDoc(
  bodyBytes: Uint8Array,
  authInfoBytes: Uint8Array,
  chainId: string,
  accountNumber: number,
): { signDoc: SignDoc; signDocBytes: Uint8Array; signDocHash: Uint8Array } {
  const signDoc = SignDoc.fromPartial({
    bodyBytes,
    authInfoBytes,
    chainId,
    accountNumber: BigInt(accountNumber),
  });

  const signDocBytes = SignDoc.encode(signDoc).finish();
  const signDocHash = sha256(signDocBytes);

  return { signDoc, signDocBytes, signDocHash };
}

/**
 * Assembles a multisig transaction from Direct mode signatures.
 * Similar to makeMultisignedTxBytes but uses SIGN_MODE_DIRECT.
 *
 * WARNING: This function currently has a fundamental limitation for the
 * "sign independently" workflow. For SIGN_MODE_DIRECT, the authInfoBytes
 * (which include bitarray indicating who signed) are part of what gets signed.
 * Since we don't know who will sign until they actually sign, this creates
 * a mismatch between signing-time authInfo and broadcast-time authInfo.
 *
 * This function should only be used when ALL signers are known beforehand
 * and sign with a consistent authInfo. For independent signing workflows,
 * use Amino mode (makeMultisignedTxBytes) instead.
 */
export function makeMultisignedTxBytesDirect(
  multisigPubkey: MultisigThresholdPubkey,
  sequence: number,
  fee: StdFee,
  bodyBytes: Uint8Array,
  signatures: Map<string, Uint8Array>,
): Uint8Array {
  // Normalize to prevent "str.match is not a function" from Uint53.fromString(threshold)
  const pubkey = normalizePubkey(multisigPubkey);
  const normalizedFee = normalizeFee(fee);

  const addresses = Array.from(signatures.keys());
  const prefix = fromBech32(addresses[0]).prefix;

  // Determine which pubkeys have signatures
  const signers: boolean[] = Array(pubkey.value.pubkeys.length).fill(false);
  const signaturesList: Uint8Array[] = [];

  for (let i = 0; i < pubkey.value.pubkeys.length; i++) {
    const signerAddress = pubkeyToAddress(pubkey.value.pubkeys[i], prefix);
    const signature = signatures.get(signerAddress);
    if (signature) {
      signers[i] = true;
      signaturesList.push(signature);
    }
  }

  // Create the signer info with SIGN_MODE_DIRECT for each signer
  const signerInfo = {
    publicKey: encodePubkey(pubkey),
    modeInfo: {
      multi: {
        bitarray: makeCompactBitArray(signers),
        modeInfos: signaturesList.map(() => ({
          single: { mode: SignMode.SIGN_MODE_DIRECT },
        })),
      },
    },
    sequence: BigInt(sequence),
  };

  const authInfo = AuthInfo.fromPartial({
    signerInfos: [signerInfo],
    fee: {
      amount: [...normalizedFee.amount],
      gasLimit: BigInt(normalizedFee.gas),
    },
  });

  const authInfoBytes = AuthInfo.encode(authInfo).finish();

  const signedTx = TxRaw.fromPartial({
    bodyBytes,
    authInfoBytes,
    signatures: [
      MultiSignature.encode(MultiSignature.fromPartial({ signatures: signaturesList })).finish(),
    ],
  });

  return Uint8Array.from(TxRaw.encode(signedTx).finish());
}

/**
 * Logs Direct SignDoc debug information
 */
export function logDirectSignDocDebug(
  bodyBytes: Uint8Array,
  authInfoBytes: Uint8Array,
  chainId: string,
  accountNumber: number,
  label: string = "Direct SignDoc Debug",
): void {
  const { signDocHash } = makeDirectSignDoc(bodyBytes, authInfoBytes, chainId, accountNumber);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📜 ${label}`);
  console.log("=".repeat(60));
  console.log("\n🔑 Direct SignDoc Hash:");
  console.log(`  Base64: ${toBase64(signDocHash)}`);
  console.log(`  Hex:    ${Buffer.from(signDocHash).toString("hex")}`);
  console.log("\n📄 SignDoc Components:");
  console.log(`  bodyBytes length: ${bodyBytes.length}`);
  console.log(`  authInfoBytes length: ${authInfoBytes.length}`);
  console.log(`  chainId: ${chainId}`);
  console.log(`  accountNumber: ${accountNumber}`);
  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Check if a transaction should use Direct mode based on message types.
 *
 * IMPORTANT: Direct mode for multisig requires all signers to sign the same
 * authInfoBytes, which includes a bitarray indicating which members signed.
 * This creates a chicken-and-egg problem for "sign independently" workflows
 * where we don't know who will sign until they actually sign.
 *
 * For now, we disable Direct mode for multisig transactions and use Amino mode
 * instead. Amino mode doesn't include authInfoBytes in the signed data, so it
 * works with independent signing.
 *
 * If a specific chain truly requires Direct mode for certain messages, we would
 * need to implement a "commit phase" where signers agree on who will sign before
 * any signing occurs.
 */
export function shouldUseDirectMode(msgs: readonly { typeUrl: string }[]): boolean {
  // Direct mode is REQUIRED for certain message types on some chains.
  //
  // IMPORTANT: Direct mode for multisig has a constraint - the authInfoBytes include
  // a bitarray indicating which members signed. We pre-construct this assuming ALL
  // threshold members will sign. This works when:
  // 1. All members sign (bitarray at signing time = bitarray at broadcast time)
  // 2. The multisig threshold equals the total number of members (e.g., 3-of-3)
  //
  // For partial signing (e.g., 2-of-3 where only 2 sign), the bitarray will differ
  // and signatures will fail. In that case, Amino mode should be used.
  //
  // MsgWithdrawValidatorCommission requires Direct mode on Coreum and other chains.
  const directModeRequiredTypes = ["/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission"];
  return msgs.some((msg) => directModeRequiredTypes.includes(msg.typeUrl));
}
