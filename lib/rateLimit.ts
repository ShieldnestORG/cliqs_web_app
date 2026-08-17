/**
 * Best-Effort Rate Limiting
 *
 * File: lib/rateLimit.ts
 *
 * In-memory fixed-window counter keyed by (route, identifier). No Redis, no new
 * dependency.
 *
 * READ THIS BEFORE RELYING ON IT — THE LIMIT IS PER INSTANCE, NOT GLOBAL:
 * on Vercel every serverless instance holds its own Map, instances scale out
 * under load, and a cold start resets the counters. A caller spread across N
 * instances therefore gets up to N x limit, and a caller who waits out a scale
 * event gets a fresh budget. This raises the cost of casual abuse and scripted
 * hammering from one source. It does NOT stop a distributed attacker and it is
 * not a guarantee of anything. Enforcing a real global limit needs shared state
 * (Redis / Upstash / Vercel KV) or an edge WAF rule; neither exists here.
 *
 * Fixed window, not sliding: a caller can spend the whole budget at the end of
 * one window and again at the start of the next, i.e. up to 2 x limit across a
 * window boundary. That is the accepted trade for keeping this dependency-free.
 */

/**
 * Minimal shape needed to identify a caller. Typed structurally rather than as
 * NextApiRequest so getServerSideProps can share one budget with the API route —
 * its `context.req` is a plain IncomingMessage, not a NextApiRequest.
 */
export interface IdentifiableRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly socket?: { readonly remoteAddress?: string };
}

/**
 * Shared budget for reading one transaction.
 *
 * Both read surfaces count against this single key on purpose: the API GET and
 * the transaction page's getServerSideProps return the same payload (dataJSON,
 * signatures, txHash), so budgeting them separately would let a sweep spend the
 * allowance twice and halve the cost of the exact harvest this limits.
 *
 * Legitimate volume is ~1 SSR render + ~1 API GET per page open — `loadTx` runs
 * once on mount and on the manual Retry button, and nothing on that page polls
 * (VERIFIED: no setInterval in pages/[chainName]/[address]/transaction/
 * [transactionID].tsx). 60/min/IP is therefore far above any human, including a
 * whole office behind one NAT egress address, while still capping a scripted
 * id-sweep at 60/min per instance instead of unlimited.
 *
 * WRITES ARE DELIBERATELY NOT LIMITED — see the route handler for why.
 */
export const TRANSACTION_READ_LIMIT = { limit: 60, windowMs: 60_000 } as const;

/** Single key for both read surfaces. */
export const TRANSACTION_READ_ROUTE = "transaction-read";

export interface RateLimitOptions {
  /** Maximum number of allowed requests per window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Seconds until the current window resets. 0 when allowed. */
  readonly retryAfterSeconds: number;
  /** Requests left in the current window after this call. */
  readonly remaining: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowState>();

/**
 * Hard cap on tracked keys so a flood of unique identifiers cannot grow the map
 * without bound. When exceeded, expired entries are dropped first; if that is
 * not enough the map is cleared, which forgives everyone currently limited —
 * another reason this is best-effort only.
 */
const MAX_TRACKED_KEYS = 10_000;

function prune(now: number, windowMs: number): void {
  for (const [key, state] of windows) {
    if (now - state.windowStart >= windowMs) {
      windows.delete(key);
    }
  }
}

/**
 * Build the map key. Use this everywhere so routes cannot invent conflicting
 * key formats: `route` scopes the budget, `identifier` is the caller.
 */
export function rateLimitKey(route: string, identifier: string): string {
  return `${route}:${identifier}`;
}

/**
 * Best-effort identifier for the caller: the first hop in x-forwarded-for,
 * falling back to the socket address, falling back to "unknown".
 *
 * x-forwarded-for is client-controlled unless a trusted proxy overwrites it.
 * On Vercel it is set by the platform, so the first entry is the real client;
 * anywhere else, treat this as a hint rather than an identity.
 */
export function getClientIdentifier(req: IdentifiableRequest | undefined): string {
  // Must never throw. This runs inside the transaction page's getServerSideProps,
  // where an exception would 500 the whole page — a worse outcome than any abuse
  // the limit prevents. A caller we cannot identify falls back to the shared
  // "unknown" bucket, which is the documented behaviour above.
  const forwarded = req?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = typeof raw === "string" ? raw.split(",")[0]?.trim() : undefined;

  return first || req?.socket?.remoteAddress || "unknown";
}

/**
 * Count one request against `key` and report whether it is allowed.
 *
 * Calling this consumes budget — call it once per request, and only when the
 * request should count.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = options;
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) {
    prune(now, windowMs);
    if (windows.size > MAX_TRACKED_KEYS) {
      windows.clear();
    }
  }

  const existing = windows.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - 1) };
  }

  existing.count++;

  if (existing.count > limit) {
    const elapsed = now - existing.windowStart;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)),
      remaining: 0,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: limit - existing.count };
}

/** Drop all counters. Intended for tests. */
export function resetRateLimits(): void {
  windows.clear();
}
