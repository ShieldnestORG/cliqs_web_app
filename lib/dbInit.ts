/**
 * Database Initialization Guard
 *
 * Call `ensureDbReady()` at the top of any API route.
 * It only runs once per process lifetime.
 */

import { initDb } from "./db";

let _ready = false;
let _promise: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (_ready) return;

  if (!_promise) {
    _promise = initDb()
      .then(() => {
        _ready = true;
      })
      .catch((err) => {
        console.error("[dbInit] Failed to initialize database:", err);
        _promise = null;
      });
  }

  return _promise;
}
