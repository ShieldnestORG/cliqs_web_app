/**
 * BYODB Storage Service
 *
 * File: lib/byodb/storage.ts
 *
 * Manages the lifecycle of "Bring Your Own Database" credentials:
 *   - Store encrypted credentials in localStorage
 *   - Retrieve and decrypt on demand
 *   - Attach to API requests via custom header
 *   - Track connection status
 *
 * The credential is never stored in plaintext on disk. It is only decrypted
 * in memory when needed for an API call and transmitted over HTTPS.
 */

import {
  type SecurityLevel,
  type EncryptedCredential,
  encryptLevel0,
  encryptLevel1,
  encryptLevel2,
  decryptCredential,
  detectLevel,
  fingerprintConnectionString,
  maskConnectionString,
} from "./crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "byodb:credential";
const META_KEY = "byodb:meta";
const HEADER_NAME = "x-byodb-uri";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ByodbMeta {
  /** Whether BYODB mode is active */
  enabled: boolean;
  /** Security level used to protect the credential */
  securityLevel: SecurityLevel;
  /** SHA-256 fingerprint of the connection string (first 16 hex chars) */
  fingerprint: string;
  /** Masked connection string for display (password hidden) */
  maskedUri: string;
  /** ISO timestamp when credential was last saved */
  savedAt: string;
  /** ISO timestamp of last successful connection test */
  lastTestedAt: string | null;
  /** Whether the database has been provisioned (tables/indexes created) */
  provisioned: boolean;
}

export interface ByodbStatus {
  enabled: boolean;
  meta: ByodbMeta | null;
  needsUnlock: boolean;
}

// ---------------------------------------------------------------------------
// Internal state – holds the decrypted URI in memory for the session
// ---------------------------------------------------------------------------

let _decryptedUri: string | null = null;

// ---------------------------------------------------------------------------
// Meta helpers
// ---------------------------------------------------------------------------

function readMeta(): ByodbMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: ByodbMeta): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function clearMeta(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(META_KEY);
}

// ---------------------------------------------------------------------------
// Public API – Credential lifecycle
// ---------------------------------------------------------------------------

/**
 * Save a database connection string with the specified security level.
 */
export async function saveCredential(
  connectionString: string,
  level: SecurityLevel,
  material?: string | Uint8Array,
): Promise<ByodbMeta> {
  let encrypted: EncryptedCredential;

  if (level === 0) {
    encrypted = encryptLevel0(connectionString);
  } else if (level === 1) {
    if (typeof material !== "string") {
      throw new Error("Passphrase required for Level 1 encryption");
    }
    encrypted = await encryptLevel1(connectionString, material);
  } else if (level === 2) {
    if (!(material instanceof Uint8Array)) {
      throw new Error("Wallet signature required for Level 2 encryption");
    }
    encrypted = await encryptLevel2(connectionString, material);
  } else {
    throw new Error(`Invalid security level: ${level}`);
  }

  // Store encrypted credential
  localStorage.setItem(STORAGE_KEY, encrypted.encoded);

  // Keep plaintext in memory for immediate use
  _decryptedUri = connectionString;

  // Store metadata (non-sensitive)
  const fingerprint = await fingerprintConnectionString(connectionString);
  const meta: ByodbMeta = {
    enabled: true,
    securityLevel: level,
    fingerprint,
    maskedUri: maskConnectionString(connectionString),
    savedAt: new Date().toISOString(),
    lastTestedAt: null,
    provisioned: false,
  };
  writeMeta(meta);

  return meta;
}

/**
 * Unlock the stored credential with the appropriate material.
 * Level 0 credentials are auto-unlocked.
 */
export async function unlockCredential(
  material?: string | Uint8Array,
): Promise<string> {
  const encoded = localStorage.getItem(STORAGE_KEY);
  if (!encoded) {
    throw new Error("No BYODB credential stored");
  }

  const uri = await decryptCredential(encoded, material);
  _decryptedUri = uri;
  return uri;
}

/**
 * Get the current status of BYODB configuration.
 */
export function getByodbStatus(): ByodbStatus {
  if (typeof window === "undefined") {
    return { enabled: false, meta: null, needsUnlock: false };
  }

  const meta = readMeta();

  if (!meta || !meta.enabled) {
    return { enabled: false, meta: null, needsUnlock: false };
  }

  const encoded = localStorage.getItem(STORAGE_KEY);
  if (!encoded) {
    return { enabled: false, meta: null, needsUnlock: false };
  }

  const level = detectLevel(encoded);

  // Level 0 credentials can be auto-unlocked (no passphrase/signature needed)
  if (_decryptedUri === null && level === 0) {
    try {
      _decryptedUri = atob(encoded.slice("byodb:v0:".length));
    } catch {
      // Corrupted credential — treat as needing re-setup
      return { enabled: false, meta: null, needsUnlock: false };
    }
  }

  const needsUnlock = _decryptedUri === null && level > 0;

  return { enabled: true, meta, needsUnlock };
}

/**
 * Check if BYODB is enabled and the credential is unlocked (ready to use).
 */
export function isByodbReady(): boolean {
  const status = getByodbStatus();
  return status.enabled && !status.needsUnlock;
}

/**
 * Get the decrypted connection URI. Returns null if not unlocked.
 */
export function getDecryptedUri(): string | null {
  return _decryptedUri;
}

/**
 * Update metadata (e.g. after successful connection test or provisioning).
 */
export function updateMeta(updates: Partial<ByodbMeta>): void {
  const meta = readMeta();
  if (!meta) return;
  writeMeta({ ...meta, ...updates });
}

/**
 * Clear all BYODB data and revert to default database.
 */
export function clearByodb(): void {
  _decryptedUri = null;
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  clearMeta();
}

/**
 * Lock the credential (clear in-memory plaintext).
 * The encrypted version remains in localStorage.
 */
export function lockCredential(): void {
  _decryptedUri = null;
}

// ---------------------------------------------------------------------------
// Request integration
// ---------------------------------------------------------------------------

/**
 * The custom header name used to transmit the BYODB URI to API routes.
 */
export { HEADER_NAME as BYODB_HEADER_NAME };

/**
 * Build headers object that includes the BYODB URI if active.
 * Call this when making API requests.
 */
export function getByodbHeaders(): Record<string, string> {
  if (!_decryptedUri) return {};
  return { [HEADER_NAME]: _decryptedUri };
}

/**
 * Wrap the existing requestJson to inject BYODB headers automatically.
 * Usage:
 *   import { withByodb } from "@/lib/byodb/storage";
 *   const result = await requestJson(endpoint, withByodb({ method: "POST", body }));
 */
export function withByodb<T extends { headers?: Record<string, string> }>(
  config: T,
): T {
  const byodbHeaders = getByodbHeaders();
  if (Object.keys(byodbHeaders).length === 0) return config;

  return {
    ...config,
    headers: { ...config.headers, ...byodbHeaders },
  };
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { maskConnectionString, fingerprintConnectionString } from "./crypto";
export type { SecurityLevel } from "./crypto";
