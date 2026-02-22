/**
 * SignDoc Debugging Utilities
 * 
 * These utilities help diagnose signature verification failures by providing
 * detailed comparison between what the app signs and what the chain expects.
 */

import { makeSignDoc, serializeSignDoc, StdFee, AminoMsg } from "@cosmjs/amino";
import { sha256, Secp256k1, Secp256k1Signature } from "@cosmjs/crypto";
import { toBase64, toHex } from "@cosmjs/encoding";
import { EncodeObject } from "@cosmjs/proto-signing";
import { AminoTypes } from "@cosmjs/stargate";
import { aminoConverters } from "./msg";

export interface SignDocDebugInfo {
  // The canonical JSON SignDoc
  signDocJson: string;
  // The serialized bytes
  signDocBytes: Uint8Array;
  // SHA256 hash of the SignDoc (what's actually signed)
  signDocHash: Uint8Array;
  // Base64 encoded hash (for display)
  signDocHashBase64: string;
  // Hex encoded hash (for comparison with CLI tools)
  signDocHashHex: string;
  // The Amino-converted messages
  aminoMsgs: AminoMsg[];
}

/**
 * Generate detailed SignDoc information for debugging
 */
export function generateSignDocDebugInfo(
  msgs: readonly EncodeObject[],
  fee: StdFee,
  chainId: string,
  memo: string,
  accountNumber: number | string,
  sequence: number | string,
  customAminoTypes?: AminoTypes
): SignDocDebugInfo {
  // Use provided amino types or create from shared aminoConverters
  const aminoTypes = customAminoTypes ?? new AminoTypes(aminoConverters);

  // Convert messages to Amino format
  const aminoMsgs: AminoMsg[] = msgs.map((msg) => aminoTypes.toAmino(msg));

  // Create the SignDoc
  const signDoc = makeSignDoc(
    aminoMsgs,
    { amount: fee.amount, gas: fee.gas },
    chainId,
    memo,
    String(accountNumber),
    String(sequence)
  );

  // Serialize to canonical JSON bytes
  const signDocBytes = serializeSignDoc(signDoc);
  
  // Get the JSON string for inspection
  const signDocJson = new TextDecoder().decode(signDocBytes);
  
  // Compute the hash
  const signDocHash = sha256(signDocBytes);

  return {
    signDocJson,
    signDocBytes,
    signDocHash,
    signDocHashBase64: toBase64(signDocHash),
    signDocHashHex: toHex(signDocHash),
    aminoMsgs,
  };
}

/**
 * Verify a signature against a SignDoc hash
 */
export async function verifySignatureAgainstSignDoc(
  signature: Uint8Array,
  signDocHash: Uint8Array,
  pubkeyBytes: Uint8Array
): Promise<boolean> {
  try {
    const sig = Secp256k1Signature.fromFixedLength(signature);
    return await Secp256k1.verifySignature(sig, signDocHash, pubkeyBytes);
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

/**
 * Compare two SignDoc hashes and identify where they differ
 */
export function compareSignDocs(
  doc1: SignDocDebugInfo,
  doc2: SignDocDebugInfo
): { match: boolean; differences: string[] } {
  const differences: string[] = [];

  // Parse JSON for detailed comparison
  const json1 = JSON.parse(doc1.signDocJson);
  const json2 = JSON.parse(doc2.signDocJson);

  // Compare each field
  if (json1.account_number !== json2.account_number) {
    differences.push(`account_number: "${json1.account_number}" vs "${json2.account_number}"`);
  }

  if (json1.sequence !== json2.sequence) {
    differences.push(`sequence: "${json1.sequence}" vs "${json2.sequence}"`);
  }

  if (json1.chain_id !== json2.chain_id) {
    differences.push(`chain_id: "${json1.chain_id}" vs "${json2.chain_id}"`);
  }

  if (json1.memo !== json2.memo) {
    differences.push(`memo: "${json1.memo}" vs "${json2.memo}"`);
  }

  // Compare fee
  if (JSON.stringify(json1.fee) !== JSON.stringify(json2.fee)) {
    differences.push(`fee: ${JSON.stringify(json1.fee)} vs ${JSON.stringify(json2.fee)}`);
  }

  // Compare messages
  if (json1.msgs.length !== json2.msgs.length) {
    differences.push(`msgs length: ${json1.msgs.length} vs ${json2.msgs.length}`);
  } else {
    for (let i = 0; i < json1.msgs.length; i++) {
      const msg1Str = JSON.stringify(json1.msgs[i]);
      const msg2Str = JSON.stringify(json2.msgs[i]);
      if (msg1Str !== msg2Str) {
        differences.push(`msgs[${i}]: ${msg1Str} vs ${msg2Str}`);
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

/**
 * Log comprehensive SignDoc debug information
 */
export function logSignDocDebug(
  debugInfo: SignDocDebugInfo,
  label: string = "SignDoc Debug"
): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📜 ${label}`);
  console.log("=".repeat(60));
  
  console.log("\n🔑 SignDoc Hash:");
  console.log(`  Base64: ${debugInfo.signDocHashBase64}`);
  console.log(`  Hex:    ${debugInfo.signDocHashHex}`);
  
  console.log("\n📝 Amino Messages:");
  debugInfo.aminoMsgs.forEach((msg, i) => {
    console.log(`  [${i}] type: ${msg.type}`);
    console.log(`      value: ${JSON.stringify(msg.value)}`);
  });
  
  console.log("\n📄 Full SignDoc JSON (canonical):");
  // Pretty print the JSON for readability
  try {
    const parsed = JSON.parse(debugInfo.signDocJson);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(debugInfo.signDocJson);
  }
  
  console.log("\n🔢 SignDoc Bytes (first 100):");
  console.log(`  ${toHex(debugInfo.signDocBytes.slice(0, 100))}...`);
  
  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Parse a CLI-generated unsigned transaction JSON and extract SignDoc info
 */
export function parseCliTransaction(cliTxJson: string): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Array<{ "@type": string; [key: string]: any }>;
  fee: { amount: Array<{ denom: string; amount: string }>; gas_limit: string };
  memo: string;
} {
  const tx = JSON.parse(cliTxJson);
  
  return {
    messages: tx.body.messages,
    fee: tx.auth_info.fee,
    memo: tx.body.memo || "",
  };
}

/**
 * Convert CLI message format to EncodeObject format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cliMsgToEncodeObject(cliMsg: { "@type": string; [key: string]: any }): EncodeObject {
  const typeUrl = cliMsg["@type"];
  const value = { ...cliMsg };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (value as any)["@type"];
  
  // Convert snake_case to camelCase for value fields
  const camelCaseValue = Object.fromEntries(
    Object.entries(value).map(([key, val]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      return [camelKey, val];
    })
  );
  
  return { typeUrl, value: camelCaseValue };
}

