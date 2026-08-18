/**
 * Audit Log Tests
 *
 * File: __tests__/lib/audit.test.ts
 *
 * The point of this suite is the FIRST test: proving recordAuditEvent completes
 * a successful write. Before this, it never had — it returned null on every call
 * after logging "[Audit] CONTROL GAP", and because no test asserted audit
 * behaviour, that could regress silently forever. A control with no test is a
 * claim, not a control.
 *
 * The database is a faithful in-memory fake of the three collection operations
 * lib/audit.ts uses (find().sort().limit().next(), find().sort().toArray(),
 * insertOne). That proves the chain logic, the hashing, and that an insert is
 * actually issued with a well-formed event. It does NOT prove behaviour against
 * a real Atlas deployment — see the caveat in docs/security/README.md.
 */

import { recordAuditEvent, verifyAuditChain, hashPayload } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { getRequestByodbUri } from "@/lib/byodb/middleware";
import { getDynamicDb } from "@/lib/byodb/dynamicMongo";

// Mocked wholesale rather than via requireActual: the real module pulls in the
// mongodb driver, whose bson dependency ships ESM that jest does not transform.
jest.mock("@/lib/mongodb", () => ({
  getDb: jest.fn(),
  Collections: { AUDIT_EVENTS: "audit_events" },
}));
jest.mock("@/lib/byodb/middleware", () => ({ getRequestByodbUri: jest.fn() }));
jest.mock("@/lib/byodb/dynamicMongo", () => ({ getDynamicDb: jest.fn() }));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockGetRequestByodbUri = getRequestByodbUri as jest.MockedFunction<typeof getRequestByodbUri>;
const mockGetDynamicDb = getDynamicDb as jest.MockedFunction<typeof getDynamicDb>;

/** Rows as they would sit in Mongo, in insertion order. */
type Row = Record<string, unknown>;

/**
 * In-memory stand-in for a Mongo Db, implementing only what lib/audit.ts calls.
 * Sorting honours the { ts, _id } orderings the module asks for, using insertion
 * index as the _id tiebreak so same-millisecond events stay ordered.
 */
const makeFakeDb = () => {
  const rows: Row[] = [];

  const db = {
    collection: () => ({
      find: (filter: Record<string, unknown>) => {
        const matched = rows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => Object.entries(filter).every(([key, value]) => row[key] === value));

        const build = (direction: 1 | -1) => {
          const sorted = [...matched].sort((a, b) => {
            const at = String(a.row.ts);
            const bt = String(b.row.ts);
            if (at !== bt) return at < bt ? -direction : direction;
            return (a.index - b.index) * direction;
          });
          return sorted.map(({ row }) => row);
        };

        return {
          sort: (spec: Record<string, 1 | -1>) => {
            const ordered = build(spec.ts === -1 ? -1 : 1);
            return {
              limit: () => ({ next: async () => ordered[0] ?? null }),
              toArray: async () => ordered,
            };
          },
        };
      },
      insertOne: async (doc: Row) => {
        rows.push({ ...doc });
        return { insertedId: `id-${rows.length}` };
      },
    }),
  };

  return { db, rows };
};

const MULTISIG = "cosmos1auditmultisig";

describe("audit log", () => {
  let fake: ReturnType<typeof makeFakeDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    fake = makeFakeDb();
    mockGetRequestByodbUri.mockReturnValue(null);
    mockGetDb.mockResolvedValue(fake.db as never);
  });

  describe("the write path actually completes", () => {
    it("records an event and returns it, rather than dropping it as a control gap", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const event = await recordAuditEvent({
        action: "HISTORY_WIPED",
        multisigAddress: MULTISIG,
        outcome: "allow",
        actorAddress: "cosmos1actor",
        chainId: "cosmoshub-4",
      });

      // The regression this suite exists to catch.
      expect(event).not.toBeNull();
      expect(errorSpy).not.toHaveBeenCalled();

      // It reached the database.
      expect(fake.rows).toHaveLength(1);
      expect(fake.rows[0]).toMatchObject({
        action: "HISTORY_WIPED",
        multisigAddress: MULTISIG,
        outcome: "allow",
        actorAddress: "cosmos1actor",
        chainId: "cosmoshub-4",
        prevHash: null,
      });
      expect(typeof fake.rows[0].hash).toBe("string");
      expect(String(fake.rows[0].hash)).toHaveLength(64);

      errorSpy.mockRestore();
    });

    it("stamps a server timestamp and a unique event id", async () => {
      const a = await recordAuditEvent({
        action: "TX_CREATED",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });
      const b = await recordAuditEvent({
        action: "TX_CREATED",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });

      expect(a?.eventId).not.toBe(b?.eventId);
      expect(() => new Date(a?.ts ?? "").toISOString()).not.toThrow();
    });

    it("defaults authMethod to none, so unauthenticated routes can still be logged", async () => {
      const event = await recordAuditEvent({
        action: "TX_CANCELLED",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });

      expect(event?.authMethod).toBe("none");
    });
  });

  describe("privacy", () => {
    it("stores only a hash of the payload, never the payload", async () => {
      const payload = { amount: "1000000", recipient: "cosmos1victim", memo: "rent" };

      const event = await recordAuditEvent({
        action: "TX_CREATED",
        multisigAddress: MULTISIG,
        outcome: "allow",
        payload,
      });

      expect(event?.payloadHash).toBe(hashPayload(payload));

      const serialized = JSON.stringify(fake.rows[0]);
      expect(serialized).not.toContain("cosmos1victim");
      expect(serialized).not.toContain("1000000");
      expect(serialized).not.toContain("rent");
    });

    it("hashes payloads canonically, so key order does not change the digest", () => {
      expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
      expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    });
  });

  describe("tamper evidence", () => {
    const appendThree = async () => {
      await recordAuditEvent({ action: "TX_CREATED", multisigAddress: MULTISIG, outcome: "allow" });
      await recordAuditEvent({
        action: "SIGNATURE_ADDED",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });
      await recordAuditEvent({
        action: "TX_BROADCAST",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });
    };

    it("chains each event to its predecessor", async () => {
      await appendThree();

      expect(fake.rows[0].prevHash).toBeNull();
      expect(fake.rows[1].prevHash).toBe(fake.rows[0].hash);
      expect(fake.rows[2].prevHash).toBe(fake.rows[1].hash);
    });

    it("verifies an intact chain", async () => {
      await appendThree();

      const result = await verifyAuditChain(MULTISIG);

      expect(result.valid).toBe(true);
      expect(result.checked).toBe(3);
      expect(result.reason).toBeNull();
    });

    it("detects an edited event", async () => {
      await appendThree();
      fake.rows[1].outcome = "deny";

      const result = await verifyAuditChain(MULTISIG);

      expect(result.valid).toBe(false);
      expect(result.brokenAtEventId).toBe(fake.rows[1].eventId);
      expect(result.reason).toMatch(/modified after it was written/);
    });

    it("detects a deleted event", async () => {
      await appendThree();
      fake.rows.splice(1, 1);

      const result = await verifyAuditChain(MULTISIG);

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Broken link/);
    });

    it("keeps each multisig on its own chain", async () => {
      await recordAuditEvent({ action: "TX_CREATED", multisigAddress: MULTISIG, outcome: "allow" });
      const other = await recordAuditEvent({
        action: "TX_CREATED",
        multisigAddress: "cosmos1othermultisig",
        outcome: "allow",
      });

      // A different cliq starts a fresh chain rather than linking across tenants.
      expect(other?.prevHash).toBeNull();
      expect((await verifyAuditChain(MULTISIG)).valid).toBe(true);
      expect((await verifyAuditChain("cosmos1othermultisig")).valid).toBe(true);
    });
  });

  describe("BYODB isolation", () => {
    it("writes to the caller's own database when one is supplied", async () => {
      const byodb = makeFakeDb();
      mockGetRequestByodbUri.mockReturnValue("mongodb+srv://user:pw@tenant.example/db");
      mockGetDynamicDb.mockResolvedValue(byodb.db as never);

      await recordAuditEvent({
        action: "HISTORY_EXPORTED",
        multisigAddress: MULTISIG,
        outcome: "allow",
      });

      expect(byodb.rows).toHaveLength(1);
      // One tenant must never grow another tenant's log.
      expect(fake.rows).toHaveLength(0);
      expect(mockGetDb).not.toHaveBeenCalled();
    });
  });

  describe("fail-safe behaviour", () => {
    it("returns null instead of throwing when there is no database", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetDb.mockResolvedValue(null);

      await expect(
        recordAuditEvent({ action: "TX_CREATED", multisigAddress: MULTISIG, outcome: "allow" }),
      ).resolves.toBeNull();

      expect(errorSpy.mock.calls[0][0]).toContain("[Audit] CONTROL GAP");
      errorSpy.mockRestore();
    });

    it("returns null instead of throwing when the insert fails", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetDb.mockResolvedValue({
        collection: () => ({
          find: () => ({ sort: () => ({ limit: () => ({ next: async () => null }) }) }),
          insertOne: async () => {
            throw new Error("write concern failed");
          },
        }),
      } as never);

      await expect(
        recordAuditEvent({ action: "TX_CREATED", multisigAddress: MULTISIG, outcome: "allow" }),
      ).resolves.toBeNull();

      expect(errorSpy.mock.calls[0][0]).toContain("[Audit] CONTROL GAP");
      errorSpy.mockRestore();
    });

    it("refuses a non-string multisigAddress rather than passing it into a Mongo filter", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const event = await recordAuditEvent({
        action: "TX_CREATED",
        multisigAddress: { $ne: null } as unknown as string,
        outcome: "allow",
      });

      expect(event).toBeNull();
      expect(fake.rows).toHaveLength(0);
      errorSpy.mockRestore();
    });

    it("reports an unverifiable chain as invalid with a reason, not as tampering", async () => {
      mockGetDb.mockResolvedValue(null);

      const result = await verifyAuditChain(MULTISIG);

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/could not be verified/);
      expect(result.brokenAtEventId).toBeNull();
    });
  });
});
