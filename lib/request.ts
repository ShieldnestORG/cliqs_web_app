export type RequestConfig = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Try to inject BYODB headers if the module is loaded and active.
 * This is a safe dynamic import so it doesn't break if called server-side.
 */
function getByodbHeadersSafe(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getByodbHeaders } = require("@/lib/byodb/storage");
    return getByodbHeaders();
  } catch {
    return {};
  }
}

export const requestJson = async (
  endpoint: string,
  { method, headers, body, ...restConfig }: RequestConfig = {},
) => {
  // Auto-inject BYODB headers when active
  const byodbHeaders = getByodbHeadersSafe();

  const config: RequestInit = {
    method: (method ?? body) ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", ...byodbHeaders, ...headers }
      : { ...byodbHeaders, ...headers },
    body: body ? JSON.stringify(body) : null,
    ...restConfig,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(endpoint, { ...config, signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.json();
    } else {
      const errorText = await response.text();
      return Promise.reject(new Error(errorText));
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return Promise.reject(new Error(`Request to ${endpoint} timed out after 30 seconds`));
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
