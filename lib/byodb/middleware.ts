/**
 * BYODB API Middleware
 *
 * File: lib/byodb/middleware.ts
 *
 * Extracts the user's MongoDB URI from the `x-byodb-uri` request header
 * and stores it in AsyncLocalStorage so that db.ts can route queries
 * to the user's database instead of the default one.
 *
 * Usage in API routes:
 *   import { withByodbMiddleware } from "@/lib/byodb/middleware";
 *
 *   export default withByodbMiddleware(async (req, res) => {
 *     // db.ts operations automatically use the user's DB if header present
 *   });
 *
 * Or check imperatively:
 *   import { getRequestByodbUri } from "@/lib/byodb/middleware";
 *   const userUri = getRequestByodbUri(); // string | null
 */

import { AsyncLocalStorage } from "async_hooks";
import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";

// ---------------------------------------------------------------------------
// AsyncLocalStorage for per-request context
// ---------------------------------------------------------------------------

const byodbStore = new AsyncLocalStorage<{ uri: string }>();

/**
 * Header name sent by the client.
 * Must match HEADER_NAME in lib/byodb/storage.ts
 */
const HEADER_NAME = "x-byodb-uri";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the BYODB connection URI for the current request.
 * Returns null if the request is not using BYODB.
 */
export function getRequestByodbUri(): string | null {
  const store = byodbStore.getStore();
  return store?.uri ?? null;
}

/**
 * Check whether the current request is using a user-supplied database.
 */
export function isUsingByodb(): boolean {
  return getRequestByodbUri() !== null;
}

/**
 * Basic validation of a MongoDB connection string.
 * Prevents injection of obviously malicious URIs.
 */
function validateMongoUri(uri: string): boolean {
  // Must start with mongodb:// or mongodb+srv://
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return false;
  }

  // Must be a reasonable length (connection strings shouldn't exceed ~2KB)
  if (uri.length > 2048) {
    return false;
  }

  // Must not contain null bytes or other control characters

  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(uri)) {
    return false;
  }

  // Must parse as a valid URL (roughly)
  try {
    new URL(uri);
    return true;
  } catch {
    // mongodb+srv:// might not parse as standard URL, so also check basic structure
    return /^mongodb(\+srv)?:\/\/.+/.test(uri);
  }
}

/**
 * Wrap a Next.js API handler with BYODB context.
 *
 * If the request includes a valid `x-byodb-uri` header, all database
 * operations within the handler will be routed to the user's database.
 */
export function withByodbMiddleware(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.headers["x-byodb-locked"] === "true") {
      res.status(403).json({
        error: "Database Locked",
        message: "Your custom database is currently locked. Please go to Settings to unlock it before interacting with your CLIQs.",
      });
      return;
    }

    const rawUri = req.headers[HEADER_NAME];
    const uri = Array.isArray(rawUri) ? rawUri[0] : rawUri;

    if (uri && typeof uri === "string" && uri.length > 0) {
      // Validate the URI before accepting it
      if (!validateMongoUri(uri)) {
        res.status(400).json({
          error: "Invalid BYODB connection string",
          message: "The provided MongoDB URI failed validation",
        });
        return;
      }

      // Run the handler within AsyncLocalStorage context
      return byodbStore.run({ uri }, () => handler(req, res));
    }

    // No BYODB header – run normally
    return handler(req, res);
  };
}

/**
 * For use in non-handler contexts (e.g. inside db.ts) to execute
 * a callback with a specific BYODB URI set.
 */
export function runWithByodbUri<T>(uri: string, fn: () => T): T {
  return byodbStore.run({ uri }, fn);
}
