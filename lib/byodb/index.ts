/**
 * BYODB Module Index
 *
 * File: lib/byodb/index.ts
 *
 * Re-exports the public API of the Bring Your Own Database module.
 */

// Client-side (browser) API
export {
  saveCredential,
  unlockCredential,
  getByodbStatus,
  clearByodb,
  updateMeta,
  lockCredential,
  getDecryptedUri,
  isByodbReady,
  getByodbHeaders,
  withByodb,
  BYODB_HEADER_NAME,
  maskConnectionString,
  fingerprintConnectionString,
  type ByodbMeta,
  type ByodbStatus,
  type SecurityLevel,
} from "./storage";

// Crypto utilities
export {
  encryptLevel0,
  encryptLevel1,
  encryptLevel2,
  decryptCredential,
  detectLevel,
} from "./crypto";
