/**
 * BYODB Import Data Validator
 *
 * File: lib/byodb/importValidator.ts
 *
 * Validates and sanitizes imported data before it is written to a user's
 * database. Prevents:
 *   - Injection of oversized documents
 *   - Malformed/missing required fields
 *   - Unexpected fields (NoSQL injection vectors)
 *   - Invalid ObjectId references
 *   - Extreme data volumes (DoS protection)
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const MAX_MULTISIGS = 500;
const MAX_TRANSACTIONS = 5_000;
const MAX_SIGNATURES = 20_000;
const MAX_NONCES = 1_000;
const MAX_STRING_LENGTH = 100_000; // 100KB for large JSON fields like dataJSON/pubkeyJSON
const MAX_SHORT_STRING = 256;
const MAX_PAYLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB total payload limit

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const safeString = z.string().max(MAX_SHORT_STRING);
const safeLongString = z.string().max(MAX_STRING_LENGTH);

const MultisigSchema = z.object({
  chainId: safeString,
  address: safeString,
  creator: safeString.nullable().optional(),
  pubkeyJSON: safeLongString,
  name: safeString.nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  version: z.number().int().min(0).max(1000).optional().default(1),
  createdAt: safeString.optional(),
  updatedAt: safeString.optional(),
});

const TransactionSchema = z.object({
  id: safeString.optional(), // original ID for reference
  txHash: safeString.nullable().optional(),
  creatorId: safeString,
  dataJSON: safeLongString,
  status: z.enum(["pending", "broadcast", "cancelled"]).optional().default("pending"),
  payloadHash: safeString.optional(),
  signDocHash: safeString.optional(),
  createdAt: safeString.optional(),
  updatedAt: safeString.optional(),
});

const SignatureSchema = z.object({
  transactionId: safeString,
  bodyBytes: safeLongString,
  signature: safeLongString,
  address: safeString,
  createdAt: safeString.optional(),
});

const NonceSchema = z.object({
  chainId: safeString,
  address: safeString,
  nonce: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

const ImportPayloadSchema = z.object({
  version: z.literal(1).optional().default(1),
  exportedAt: safeString.optional(),
  multisigs: z.array(MultisigSchema).max(MAX_MULTISIGS).optional().default([]),
  transactions: z.array(TransactionSchema).max(MAX_TRANSACTIONS).optional().default([]),
  signatures: z.array(SignatureSchema).max(MAX_SIGNATURES).optional().default([]),
  nonces: z.array(NonceSchema).max(MAX_NONCES).optional().default([]),
});

export type ImportPayload = z.infer<typeof ImportPayloadSchema>;
export type ValidatedMultisig = z.infer<typeof MultisigSchema>;
export type ValidatedTransaction = z.infer<typeof TransactionSchema>;
export type ValidatedSignature = z.infer<typeof SignatureSchema>;
export type ValidatedNonce = z.infer<typeof NonceSchema>;

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  data: ImportPayload | null;
  errors: string[];
  warnings: string[];
  stats: {
    multisigs: number;
    transactions: number;
    signatures: number;
    nonces: number;
    totalSizeBytes: number;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize import data.
 *
 * Steps:
 *   1. Check raw payload size
 *   2. Parse JSON if string
 *   3. Validate schema with Zod
 *   4. Cross-reference integrity (signatures -> transactions -> multisigs)
 *   5. Detect duplicate addresses
 *   6. Return cleaned data or error report
 */
export function validateImportData(rawData: unknown, rawSizeBytes?: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Size check
  const sizeBytes = rawSizeBytes ?? JSON.stringify(rawData).length;
  if (sizeBytes > MAX_PAYLOAD_SIZE_BYTES) {
    return {
      valid: false,
      data: null,
      errors: [`Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE_BYTES / 1024 / 1024}MB`],
      warnings: [],
      stats: {
        multisigs: 0,
        transactions: 0,
        signatures: 0,
        nonces: 0,
        totalSizeBytes: sizeBytes,
      },
    };
  }

  // Step 2: Parse if string
  let parsed: unknown = rawData;
  if (typeof rawData === "string") {
    try {
      parsed = JSON.parse(rawData);
    } catch (e) {
      return {
        valid: false,
        data: null,
        errors: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`],
        warnings: [],
        stats: {
          multisigs: 0,
          transactions: 0,
          signatures: 0,
          nonces: 0,
          totalSizeBytes: sizeBytes,
        },
      };
    }
  }

  // Step 3: Zod validation
  const result = ImportPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const zodErrors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return {
      valid: false,
      data: null,
      errors: zodErrors.slice(0, 20), // Cap error count
      warnings: [],
      stats: {
        multisigs: 0,
        transactions: 0,
        signatures: 0,
        nonces: 0,
        totalSizeBytes: sizeBytes,
      },
    };
  }

  const data = result.data;

  // Step 4: Cross-reference integrity checks
  const multisigAddresses = new Set(data.multisigs.map((m) => m.address));
  const transactionIds = new Set(data.transactions.map((t) => t.id).filter(Boolean));

  // Check that transactions reference known multisig addresses
  for (const tx of data.transactions) {
    if (tx.creatorId && !multisigAddresses.has(tx.creatorId)) {
      warnings.push(`Transaction references unknown multisig address: ${tx.creatorId}`);
    }
  }

  // Check that signatures reference known transactions
  for (const sig of data.signatures) {
    if (sig.transactionId && !transactionIds.has(sig.transactionId)) {
      warnings.push(`Signature references unknown transaction ID: ${sig.transactionId}`);
    }
  }

  // Step 5: Duplicate detection
  const seenAddresses = new Set<string>();
  for (const m of data.multisigs) {
    const key = `${m.chainId}:${m.address}`;
    if (seenAddresses.has(key)) {
      warnings.push(`Duplicate multisig address in import: ${key}`);
    }
    seenAddresses.add(key);
  }

  // Step 6: Validate pubkeyJSON is parseable
  for (const m of data.multisigs) {
    try {
      JSON.parse(m.pubkeyJSON);
    } catch {
      errors.push(`Multisig ${m.address} has invalid pubkeyJSON (not valid JSON)`);
    }
  }

  // Step 7: Validate dataJSON is parseable
  for (const tx of data.transactions) {
    try {
      JSON.parse(tx.dataJSON);
    } catch {
      errors.push(`Transaction ${tx.id || "unknown"} has invalid dataJSON (not valid JSON)`);
    }
  }

  // Step 8: Check for suspicious patterns
  const allStrings = JSON.stringify(data);
  if (allStrings.includes("$where") || allStrings.includes("$function")) {
    errors.push("Import data contains MongoDB operator injection patterns ($where/$function)");
  }
  if (allStrings.includes("<script") || allStrings.includes("javascript:")) {
    errors.push("Import data contains potential XSS payloads");
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? data : null,
    errors,
    warnings,
    stats: {
      multisigs: data.multisigs.length,
      transactions: data.transactions.length,
      signatures: data.signatures.length,
      nonces: data.nonces.length,
      totalSizeBytes: sizeBytes,
    },
  };
}

/**
 * Strip MongoDB internal fields from documents to prevent overwriting _id etc.
 */
export function sanitizeForInsert<T extends Record<string, unknown>>(
  doc: T,
): Omit<T, "_id" | "__v"> {
  const { _id, __v, ...clean } = doc;
  void _id;
  void __v;
  return clean as Omit<T, "_id" | "__v">;
}
