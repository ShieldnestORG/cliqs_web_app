export type RequestConfig = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Override the default 30-second abort timeout for this request (ms). */
  timeout?: number;
};

// ---------------------------------------------------------------------------
// BYODB header injection (lazy-loaded, client-only)
//
// We use a cached dynamic require() instead of a top-level static import
// because storage.ts → crypto.ts references browser-only APIs (SubtleCrypto).
// A static import pulls them into the server bundle and can break SSR / the
// client compilation in Next.js 15.
// ---------------------------------------------------------------------------

let _getByodbHeaders: (() => Record<string, string>) | null = null;

function getByodbHeadersSafe(): Record<string, string> {
  if (typeof window === "undefined") return {};

  // Lazy-load on first call, then cache the function reference
  if (!_getByodbHeaders) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@/lib/byodb/storage");
      _getByodbHeaders = mod.getByodbHeaders;
    } catch (err) {
      console.warn("[BYODB] Could not load storage module:", err);
      return {};
    }
  }

  try {
    return _getByodbHeaders!();
  } catch (err) {
    console.warn("[BYODB] getByodbHeaders threw:", err);
    return {};
  }
}

const DEFAULT_TIMEOUT_MS = 30000;

export const requestJson = async (
  endpoint: string,
  { method, headers, body, timeout = DEFAULT_TIMEOUT_MS, ...restConfig }: RequestConfig = {},
) => {
  // Auto-inject BYODB headers when active, BUT ONLY for internal API calls.
  // We do not want to send user's DB credentials to 3rd party APIs (like GitHub) 
  // nor trigger CORS preflight errors with foreign servers.
  const isInternalServer =
    endpoint.startsWith("/") ||
    (typeof window !== "undefined" && endpoint.includes(window.location.host));

  const byodbHeaders = isInternalServer ? getByodbHeadersSafe() : {};

  const config: RequestInit = {
    method: (method ?? body) ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", ...byodbHeaders, ...headers }
      : { ...byodbHeaders, ...headers },
    body: body ? JSON.stringify(body) : null,
    ...restConfig,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, { ...config, signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.json();
    } else {
      const errorText = await response.text();
      let errorMessage = errorText;
      let isByodbLocked = false;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        }
        if (errorJson.error === "Database Locked") {
          isByodbLocked = true;
          errorMessage = `Database Locked: ${errorJson.message}`;
        }
      } catch {
        // Not JSON, use plain text
      }

      const error = new Error(errorMessage);
      (error as any).isByodbLocked = isByodbLocked;
      return Promise.reject(error);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return Promise.reject(
        new Error(`Request to ${endpoint} timed out after ${timeout / 1000} seconds`),
      );
    }
    // "Failed to fetch" can be thrown by browser extensions (e.g. Keplr)
    // that patch window.fetch. Log but re-throw so callers can handle it.
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      console.warn(`[request] Network error for ${endpoint} – this may be caused by a browser extension intercepting fetch.`);
    }
    throw error;
  }
};

export const requestGhJson = (endpoint: string, { headers, ...restConfig }: RequestConfig = {}) => {
  return requestJson(endpoint, {
    ...restConfig,
    headers: { ...headers, Accept: "application/vnd.github+json" },
  });
};

type RequestGraphQlJsonConfig = Omit<RequestInit, "body"> & { body: { query: string } };

export const requestGraphQlJson = (config: RequestGraphQlJsonConfig) =>
  requestJson(process.env.DGRAPH_URL || "", {
    ...config,
    headers: process.env.DGRAPH_SECRET
      ? { "X-Auth-Token": process.env.DGRAPH_SECRET, ...config.headers }
      : config.headers,
  });
