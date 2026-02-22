/**
 * Polyfills for Jest test environment
 * 
 * File: jest.polyfills.js
 * 
 * This file runs before jest.setup.js to ensure polyfills are available
 */

// Polyfill TextEncoder/TextDecoder for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Also set on window for browser-like environment
if (typeof window !== 'undefined') {
  if (typeof window.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
  }
}
