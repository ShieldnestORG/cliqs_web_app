/**
 * Tamper-Evident Audit Log
 *
 * File: lib/audit.ts
 *
 * Append-only record of every security-relevant action taken against a cliq,
 * chained per multisig so that deleting or editing an entry breaks the chain on
 * replay (SOC 2 TSC CC7.2 / CC4 — monitoring and evaluation of controls).
 *
 * Each event stores `hash = sha256(prevHash + canonicalJson(event-without-hash))`
 * where `prevHash` is the hash of the newest event already recorded for the same
 * multisigAddress. `verifyAuditChain` replays that computation: a removed row
 * breaks the prevHash link of its successor, an edited row fails its own hash.
 *
 * PRIVACY: the request body is never stored, only `payloadHash` — a sha256 of
 * its canonical JSON. Transaction bodies contain amounts, recipients and memos.
 *
 * HONEST SCOPE — WHAT THIS IS NOT:
 * - Append-only here is enforced by convention: nothing in this file writes an
 *   update or a delete, and nothing should. True immutability requires the
 *   Atlas database user to hold insert/find grants on `audit_events` WITHOUT
 *   update/delete (ideally with a separate verifier role). That is an
 *   infrastructure change outside this repo and it has not been made. Until it
 *   is, an attacker with database credentials can rewrite the whole chain
 *   consistently; the chain only proves that *partial* tampering happened.
 * - Writes are best-effort by design (see recordAuditEvent). A dropped write is
 *   a control gap, not a caught exception.
 * - Appends read the chain head and then insert, without a lock. Two concurrent
 *   events for the same multisig can therefore share a prevHash and fork the
 *   chain; verifyAuditChain reports that as a break. Serverless instances have
 *   no shared lock to prevent it.
 *
 * BYODB ISOLATION: when the request carries a user database (`x-byodb-uri`),
 * the event is written to THAT database. One tenant must never be able to read
 * or grow another tenant's log.
 */

import { createHash, randomUUID } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { getDynamicDb } from "./byodb/dynamicMongo";
import { getRequestByodbUri } from "./byodb/middleware";
import { Collections, getDb } from "./mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | "TX_CREATED"
  | "SIGNATURE_ADDED"
  | "TX_BROADCAST"
  | "TX_CANCELLED"
  | "HISTORY_EXPORTED"
  | "HISTORY_WIPED"
  | "MULTISIG_DELETED";

/** Matches AuthMethod in lib/apiAuth.ts, plus "none" for unauthenticated routes. */
export type AuditAuthMethod = "adr36" | "byodb-header" | "none";

export type AuditOutcome = "allow" | "deny";

/** What a caller passes in. Everything not supplied is stored as null. */
export interface AuditEventInput {
  readonly action: AuditAction;
  /** Chain-scoped identity of the cliq. Also the hash-chain partition key. */
  readonly multisigAddress: string;
  readonly outcome: AuditOutcome;
  readonly actorAddress?: string | null;
  readonly actorPubkey?: string | null;
  readonly authMethod?: AuditAuthMethod;
  readonly chainId?: string | null;
  /** Transaction id, signature id, or whatever the action acted on. */
  readonly targetId?: string | null;
  /** Why the action was denied. Only meaningful when outcome is "deny". */
  readonly denyReason?: string | null;
  /**
   * The request body (or any payload). ONLY its sha256 is stored — pass the
   * value here rather than hashing at the call site so no route can be tempted
   * to persist the body itself.
   */
  readonly payload?: unknown;
}

/** What is stored. `hash` closes over every other field. */
export interface AuditEvent {
  readonly _id?: ObjectId;
  readonly eventId: string;
  /** Server clock, ISO-8601. Never a client-supplied timestamp. */
  readonly ts: string;
  readonly actorAddress: string | null;
  readonly actorPubkey: string | null;
  readonly authMethod: AuditAuthMethod;
  readonly action: AuditAction;
  readonly chainId: string | null;
  readonly multisigAddress: string;
  readonly targetId: string | null;
  readonly outcome: AuditOutcome;
  readonly denyReason: string | null;
  readonly payloadHash: string | null;
  readonly prevHash: string | null;
  readonly hash: string;
}

export interface AuditChainVerification {
  readonly valid: boolean;
  /** How many events were replayed. */
  readonly checked: number;
  /** eventId of the first event that failed, if any. */
  readonly brokenAtEventId: string | null;
  /** Human-readable explanation, null when valid. */
  readonly reason: string | null;
}

// ---------------------------------------------------------------------------
// Canonicalisation + hashing
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON: object keys sorted, undefined dropped. Two structurally
 * equal values always produce the same string, so hashes are reproducible.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
}

const sha256Hex = (input: string): string => createHash("sha256").update(input).digest("hex");

/**
 * sha256 of a payload's canonical JSON. Exported so callers can hash something
 * they only want to reference by digest.
 */
export function hashPayload(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}

/** The fields covered by `hash`, in the order-independent canonical form. */
type UnhashedAuditEvent = Omit<AuditEvent, "hash" | "_id">;

function computeEventHash(event: UnhashedAuditEvent): string {
  return sha256Hex((event.prevHash ?? "") + canonicalJson(event));
}

// ---------------------------------------------------------------------------
// Database resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the database the event belongs in: the caller's own database on the
 * BYODB path, otherwise the shared default. Mirrors getByodbInstance() in
 * lib/db.ts. Returns null when neither is configured (local JSON dev mode),
 * in which case there is nowhere to append.
 */
async function getAuditDb(): Promise<Db | null> {
  const byodbUri = getRequestByodbUri();
  if (byodbUri) {
    return getDynamicDb(byodbUri);
  }
  return getDb();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append an event to the audit log.
 *
 * FAIL-SAFE, NOT FAIL-OPEN-SILENTLY: this never throws into the request path —
 * a logging failure must not break a user's transaction on a live chain. It
 * returns null instead, after logging loudly.
 *
 * Every null return is a CONTROL GAP: an action happened that the log cannot
 * evidence. The "[Audit] CONTROL GAP" prefix exists so an alert can be built on
 * it; nothing alerts on it today.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<AuditEvent | null> {
  try {
    // multisigAddress goes into a Mongo filter below; an object here would be
    // operator injection into the audit collection itself.
    if (typeof input.multisigAddress !== "string" || !input.multisigAddress) {
      console.error(
        `[Audit] CONTROL GAP: event dropped, multisigAddress is not a non-empty string (action=${input.action})`,
      );
      return null;
    }

    const db = await getAuditDb();
    if (!db) {
      console.error(
        `[Audit] CONTROL GAP: no database configured, event dropped (action=${input.action}, multisig=${input.multisigAddress}, outcome=${input.outcome})`,
      );
      return null;
    }

    const col = db.collection<AuditEvent>(Collections.AUDIT_EVENTS);

    // Head of this multisig's chain. Ties on ts are broken by insertion order.
    const previous = await col
      .find({ multisigAddress: input.multisigAddress })
      .sort({ ts: -1, _id: -1 })
      .limit(1)
      .next();

    const unhashed: UnhashedAuditEvent = {
      eventId: randomUUID(),
      ts: new Date().toISOString(),
      actorAddress: input.actorAddress ?? null,
      actorPubkey: input.actorPubkey ?? null,
      authMethod: input.authMethod ?? "none",
      action: input.action,
      chainId: input.chainId ?? null,
      multisigAddress: input.multisigAddress,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      denyReason: input.denyReason ?? null,
      payloadHash: input.payload === undefined ? null : hashPayload(input.payload),
      prevHash: previous?.hash ?? null,
    };

    const event: AuditEvent = { ...unhashed, hash: computeEventHash(unhashed) };

    await col.insertOne(event);

    return event;
  } catch (err: unknown) {
    console.error(
      `[Audit] CONTROL GAP: failed to record event (action=${input.action}, outcome=${input.outcome}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Replay a multisig's hash chain and report whether it is intact.
 *
 * A log with no verifier is a claim, not a control. Unlike recordAuditEvent
 * this is not on the request path, so it reports infrastructure failures as
 * `valid: false` with an explicit reason rather than pretending the chain is
 * fine — read `reason` before treating a false as evidence of tampering.
 */
export async function verifyAuditChain(multisigAddress: string): Promise<AuditChainVerification> {
  if (typeof multisigAddress !== "string" || !multisigAddress) {
    return {
      valid: false,
      checked: 0,
      brokenAtEventId: null,
      reason: "multisigAddress must be a non-empty string",
    };
  }

  let events: AuditEvent[];
  try {
    const db = await getAuditDb();
    if (!db) {
      return {
        valid: false,
        checked: 0,
        brokenAtEventId: null,
        reason: "Audit database unavailable — the chain could not be verified",
      };
    }

    events = await db
      .collection<AuditEvent>(Collections.AUDIT_EVENTS)
      .find({ multisigAddress })
      .sort({ ts: 1, _id: 1 })
      .toArray();
  } catch (err: unknown) {
    return {
      valid: false,
      checked: 0,
      brokenAtEventId: null,
      reason: `Audit database error — the chain could not be verified: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }

  let expectedPrevHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        checked: i,
        brokenAtEventId: event.eventId,
        reason: `Broken link at event ${i + 1}: prevHash does not match the previous event's hash (an event was deleted, reordered, or appended concurrently)`,
      };
    }

    const recomputed = computeEventHash({
      eventId: event.eventId,
      ts: event.ts,
      actorAddress: event.actorAddress,
      actorPubkey: event.actorPubkey,
      authMethod: event.authMethod,
      action: event.action,
      chainId: event.chainId,
      multisigAddress: event.multisigAddress,
      targetId: event.targetId,
      outcome: event.outcome,
      denyReason: event.denyReason,
      payloadHash: event.payloadHash,
      prevHash: event.prevHash,
    });

    if (recomputed !== event.hash) {
      return {
        valid: false,
        checked: i,
        brokenAtEventId: event.eventId,
        reason: `Hash mismatch at event ${i + 1}: the stored record was modified after it was written`,
      };
    }

    expectedPrevHash = event.hash;
  }

  return { valid: true, checked: events.length, brokenAtEventId: null, reason: null };
}
