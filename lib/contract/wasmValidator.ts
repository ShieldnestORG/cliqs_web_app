/**
 * WASM Binary Validator
 *
 * File: lib/contract/wasmValidator.ts
 *
 * Validates WASM bytecode against chain-specific constraints before upload.
 * Key checks:
 *   - File size vs chain's max_wasm_code_size
 *   - Bulk-memory opcodes (memory.init, data.drop, memory.copy, memory.fill)
 *     which some chains (e.g. Coreum) do not support
 *   - Valid WASM magic number and version
 */

import type { ChainDeploymentConstraints } from "./codeRegistry";

export interface WasmValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    sizeBytes: number;
    sizeKB: number;
    isValidWasm: boolean;
    wasmVersion: number;
    bulkMemoryOpcodes: BulkMemoryOpcodeHit[];
    hasBulkMemory: boolean;
  };
}

export interface BulkMemoryOpcodeHit {
  name: string;
  opcode: string;
  count: number;
}

/**
 * Bulk-memory opcodes use the 0xFC prefix byte:
 *   memory.init  = 0xFC 0x08
 *   data.drop    = 0xFC 0x09
 *   memory.copy  = 0xFC 0x0A
 *   memory.fill  = 0xFC 0x0B
 *
 * Chains running older wasmd versions or with bulk-memory disabled
 * will reject contracts containing these opcodes.
 */
const BULK_MEMORY_OPCODES: Array<{ byte2: number; name: string }> = [
  { byte2: 0x08, name: "memory.init" },
  { byte2: 0x09, name: "data.drop" },
  { byte2: 0x0a, name: "memory.copy" },
  { byte2: 0x0b, name: "memory.fill" },
];

function scanForBulkMemoryOpcodes(wasmBytes: Uint8Array): BulkMemoryOpcodeHit[] {
  const hits: BulkMemoryOpcodeHit[] = [];

  for (const { byte2, name } of BULK_MEMORY_OPCODES) {
    let count = 0;
    for (let i = 0; i < wasmBytes.length - 1; i++) {
      if (wasmBytes[i] === 0xfc && wasmBytes[i + 1] === byte2) {
        count++;
      }
    }
    if (count > 0) {
      hits.push({
        name,
        opcode: `0xFC 0x${byte2.toString(16).padStart(2, "0")}`,
        count,
      });
    }
  }

  return hits;
}

/**
 * Validate a WASM binary against chain constraints.
 */
export function validateWasm(
  wasmBytes: Uint8Array,
  constraints?: ChainDeploymentConstraints,
): WasmValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sizeBytes = wasmBytes.length;
  const sizeKB = Math.ceil(sizeBytes / 1024);

  // Check WASM magic number: \0asm
  const isValidWasm =
    wasmBytes.length >= 8 &&
    wasmBytes[0] === 0x00 &&
    wasmBytes[1] === 0x61 &&
    wasmBytes[2] === 0x73 &&
    wasmBytes[3] === 0x6d;

  // WASM version (little-endian u32 at offset 4)
  const wasmVersion = isValidWasm
    ? wasmBytes[4] | (wasmBytes[5] << 8) | (wasmBytes[6] << 16) | (wasmBytes[7] << 24)
    : 0;

  if (!isValidWasm) {
    errors.push("Not a valid WASM binary (missing \\0asm magic number)");
  }

  if (isValidWasm && wasmVersion !== 1) {
    warnings.push(`Unexpected WASM version ${wasmVersion} (expected 1)`);
  }

  // Size check
  if (constraints?.wasmSizeLimitKB && sizeKB > constraints.wasmSizeLimitKB) {
    errors.push(
      `WASM size ${sizeKB}KB exceeds chain limit of ${constraints.wasmSizeLimitKB}KB. ` +
        `Recompile with cosmwasm/optimizer to reduce size.`,
    );
  }

  // Bulk-memory scan
  const bulkMemoryOpcodes = isValidWasm ? scanForBulkMemoryOpcodes(wasmBytes) : [];
  const hasBulkMemory = bulkMemoryOpcodes.length > 0;

  if (hasBulkMemory && constraints?.supportsBulkMemory === false) {
    const opcodeList = bulkMemoryOpcodes.map((h) => `${h.name} x${h.count}`).join(", ");
    errors.push(
      `WASM contains bulk-memory opcodes (${opcodeList}) which this chain does not support. ` +
        `Recompile with Rust <= ${constraints.maxRustVersion || "1.81"} or use ` +
        `${constraints.optimizerImage || "cosmwasm/optimizer:0.16.1"} to strip them.`,
    );
  } else if (hasBulkMemory) {
    const opcodeList = bulkMemoryOpcodes.map((h) => `${h.name} x${h.count}`).join(", ");
    warnings.push(
      `WASM contains bulk-memory opcodes (${opcodeList}). ` +
        `This is fine for most chains but may fail on chains that don't support them.`,
    );
  }

  // Permissioned upload warning
  if (constraints?.permissionedUpload) {
    warnings.push(
      "This chain has permissioned uploads — contract code upload may require governance approval.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      sizeBytes,
      sizeKB,
      isValidWasm,
      wasmVersion,
      bulkMemoryOpcodes,
      hasBulkMemory,
    },
  };
}
