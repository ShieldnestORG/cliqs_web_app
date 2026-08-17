/**
 * Polyfills for Jest test environment
 *
 * File: jest.polyfills.js
 *
 * This file runs before jest.setup.js to ensure polyfills are available
 */

// Polyfill TextEncoder/TextDecoder for Node.js environment
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Also set on window for browser-like environment
if (typeof window !== "undefined") {
  if (typeof window.TextEncoder === "undefined") {
    const { TextEncoder, TextDecoder } = require("util");
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
  }
}

// Web Crypto (subtle) for BYODB credential tests.
// jsdom exposes crypto.getRandomValues but not crypto.subtle, so AES-GCM and
// PBKDF2 throw — which left security levels 1 and 2 untestable and let a real
// bug in level 2 ship. defineProperty rather than assignment because jsdom's
// `crypto` is a non-configurable accessor on some versions.
if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.subtle === "undefined") {
  const { webcrypto } = require("node:crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
