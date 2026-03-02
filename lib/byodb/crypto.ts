/**
 * BYODB Cryptographic Utilities
 *
 * File: lib/byodb/crypto.ts
 *
 * Provides AES-GCM encryption/decryption for storing database credentials
 * in the browser. Supports three security tiers:
 *
 *   Level 0 – Base64 obfuscation only (still HTTPS-encrypted in transit)
 *   Level 1 – AES-256-GCM with user passphrase (PBKDF2 key derivation)
 *   Level 2 – AES-256-GCM with key derived from wallet signature
 *
 * All crypto uses the Web Crypto API (SubtleCrypto) which is available in
 * modern browsers and in Node 18+ (for server-side validation).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM standard nonce length
const KEY_LENGTH = 256;

// Prefixes for identifying encryption level in stored ciphertext
const LEVEL0_PREFIX = "byodb:v0:";
const LEVEL1_PREFIX = "byodb:v1:";
const LEVEL2_PREFIX = "byodb:v2:";

export type SecurityLevel = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API not available in this environment");
}

// ---------------------------------------------------------------------------
// Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2.
 */
async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();

  const keyMaterial = await subtle.importKey(
    "raw",
    encoder.encode(passphrase) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive an AES-256-GCM key from a wallet signature.
 * The signature bytes are used as the "passphrase" material.
 */
async function deriveKeyFromSignature(
  signatureBytes: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();

  const keyMaterial = await subtle.importKey(
    "raw",
    signatureBytes as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns hex string: salt(32) + iv(24) + ciphertext(variable)
 */
async function aesEncrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(plaintext) as BufferSource,
  );

  return toHex(iv.buffer) + toHex(ciphertext);
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Expects hex string: iv(24) + ciphertext(variable)
 */
async function aesDecrypt(payload: string, key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const decoder = new TextDecoder();

  const ivHex = payload.slice(0, IV_BYTES * 2);
  const ctHex = payload.slice(IV_BYTES * 2);

  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ctHex);

  const plainBuf = await subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );

  return decoder.decode(plainBuf);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EncryptedCredential {
  /** The full encoded string including version prefix */
  encoded: string;
  /** Security level used */
  level: SecurityLevel;
}

/**
 * Level 0: Base64 obfuscation (no real encryption, just keeps it out of
 * plaintext in localStorage). Still transmitted over HTTPS.
 */
export function encryptLevel0(connectionString: string): EncryptedCredential {
  const encoded = LEVEL0_PREFIX + btoa(connectionString);
  return { encoded, level: 0 };
}

/**
 * Level 1: AES-256-GCM with user passphrase.
 */
export async function encryptLevel1(
  connectionString: string,
  passphrase: string,
): Promise<EncryptedCredential> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const ciphertext = await aesEncrypt(connectionString, key);
  const encoded = LEVEL1_PREFIX + toHex(salt.buffer) + ":" + ciphertext;
  return { encoded, level: 1 };
}

/**
 * Level 2: AES-256-GCM with wallet signature as key material.
 */
export async function encryptLevel2(
  connectionString: string,
  signatureBytes: Uint8Array,
): Promise<EncryptedCredential> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKeyFromSignature(signatureBytes, salt);
  const ciphertext = await aesEncrypt(connectionString, key);
  const encoded = LEVEL2_PREFIX + toHex(salt.buffer) + ":" + ciphertext;
  return { encoded, level: 2 };
}

/**
 * Detect the security level of an encoded credential string.
 */
export function detectLevel(encoded: string): SecurityLevel {
  if (encoded.startsWith(LEVEL2_PREFIX)) return 2;
  if (encoded.startsWith(LEVEL1_PREFIX)) return 1;
  return 0;
}

/**
 * Decrypt a credential string. Caller must provide the correct unlock
 * material for the detected level:
 *   Level 0 – no material needed
 *   Level 1 – passphrase (string)
 *   Level 2 – wallet signature bytes (Uint8Array)
 */
export async function decryptCredential(
  encoded: string,
  material?: string | Uint8Array,
): Promise<string> {
  const level = detectLevel(encoded);

  if (level === 0) {
    const b64 = encoded.slice(LEVEL0_PREFIX.length);
    return atob(b64);
  }

  if (level === 1) {
    if (typeof material !== "string") {
      throw new Error("Passphrase required to decrypt Level 1 credentials");
    }
    const prefix = LEVEL1_PREFIX;
    const rest = encoded.slice(prefix.length);
    const colonIdx = rest.indexOf(":");
    const saltHex = rest.slice(0, colonIdx);
    const ciphertext = rest.slice(colonIdx + 1);
    const salt = fromHex(saltHex);
    const key = await deriveKeyFromPassphrase(material, salt);
    return aesDecrypt(ciphertext, key);
  }

  if (level === 2) {
    if (!(material instanceof Uint8Array)) {
      throw new Error("Wallet signature bytes required to decrypt Level 2 credentials");
    }
    const prefix = LEVEL2_PREFIX;
    const rest = encoded.slice(prefix.length);
    const colonIdx = rest.indexOf(":");
    const saltHex = rest.slice(0, colonIdx);
    const ciphertext = rest.slice(colonIdx + 1);
    const salt = fromHex(saltHex);
    const key = await deriveKeyFromSignature(material, salt);
    return aesDecrypt(ciphertext, key);
  }

  throw new Error(`Unknown credential encoding level: ${level}`);
}

/**
 * Generate a fingerprint (SHA-256 hash) of a connection string.
 * Used to verify correctness without storing the plaintext.
 */
export async function fingerprintConnectionString(connectionString: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const hash = await subtle.digest("SHA-256", encoder.encode(connectionString));
  return toHex(hash).slice(0, 16); // 8-byte fingerprint is plenty
}

/**
 * Sanitize a MongoDB connection string for display (mask password).
 */
export function maskConnectionString(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = "••••••••";
    }
    return url.toString();
  } catch {
    // If parsing fails, mask everything after ://user:
    return uri.replace(/:([^@]+)@/, ":••••••••@");
  }
}
