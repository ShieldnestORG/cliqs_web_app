/**
 * localDb: files written before the Phase 4 removal
 *
 * File: __tests__/lib/localDb-legacy-keys.test.ts
 *
 * The Phase 4 collections (policies, emergency state, incidents, alerts, spend records) were
 * removed from lib/localDb.ts on 2026-10-10. A local-db.json written before that date still
 * carries those keys, so this suite pins two things: such a file keeps loading and working, and
 * a database created or migrated now no longer gets the removed collections.
 *
 * `fs` is replaced by a four-function in-memory fake, so nothing is read from or written to the
 * real data folder (a developer's data/local-db.json is never touched).
 */

const mockFiles = new Map<string, string>();

jest.mock("fs", () => {
  const fake = {
    existsSync: (p: string) => mockFiles.has(p) || p.endsWith("data"),
    mkdirSync: () => undefined,
    readFileSync: (p: string) => {
      const content = mockFiles.get(p);
      if (content === undefined) throw new Error(`ENOENT: ${p}`);
      return content;
    },
    writeFileSync: (p: string, data: string) => {
      mockFiles.set(p, data);
    },
  };
  return { __esModule: true, default: fake, ...fake };
});

const DB_FILE = `${process.cwd()}/data/local-db.json`;

const REMOVED_COLLECTIONS = [
  "policies",
  "policyViolations",
  "emergencyEvents",
  "emergencyStates",
  "incidents",
  "alertRules",
  "alerts",
  "spendRecords",
];

const CHAIN = "testchain-1";
const ADDRESS = "core1legacyaddress";

/** Every collection that still exists, with one cliq and one contract cliq. */
function currentCollections() {
  return {
    multisigs: [
      {
        id: "m1",
        chainId: CHAIN,
        address: ADDRESS,
        creator: null,
        pubkeyJSON: "{}",
        name: "Legacy",
        description: null,
        version: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    transactions: [],
    signatures: [],
    nonces: [],
    contractMultisigs: [
      {
        id: "c1",
        chainId: CHAIN,
        contractAddress: "core1contract",
        codeId: 1,
        creator: "core1creator",
        label: "legacy",
        threshold: 1,
        maxVotingPeriodSeconds: 60,
        members: [],
        name: null,
        description: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastSyncHeight: 0,
        // no policyVersion: the migration that fills it in must still run
      },
    ],
    contractProposals: [],
    contractVotes: [],
    syncStates: [],
    websocketEvents: [],
    groups: [],
    memberSnapshots: [],
    voteSnapshots: [],
    groupEvents: [],
    credentialClasses: [],
    credentials: [],
    credentialEvents: [],
  };
}

function loadLocalDb(): typeof import("@/lib/localDb") {
  jest.resetModules();
  return require("@/lib/localDb");
}

function storedDb(): Record<string, unknown> {
  const content = mockFiles.get(DB_FILE);
  if (content === undefined) throw new Error("local-db.json was not written");
  return JSON.parse(content);
}

describe("lib/localDb after the Phase 4 removal", () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    mockFiles.clear();
    delete process.env.VERCEL;
  });

  afterAll(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  test("a file that still carries the removed Phase 4 keys loads and keeps working", () => {
    mockFiles.set(
      DB_FILE,
      JSON.stringify({
        ...currentCollections(),
        policies: [{ id: "p1", multisigAddress: ADDRESS, chainId: CHAIN, type: "timelock" }],
        policyViolations: [{ id: "v1" }],
        emergencyEvents: [{ id: "e1" }],
        emergencyStates: [{ id: "s1", isPaused: true }],
        incidents: [{ id: "i1" }],
        alertRules: [{ id: "r1" }],
        alerts: [{ id: "a1" }],
        spendRecords: [{ id: "x1" }],
      }),
    );
    const localDb = loadLocalDb();

    expect(localDb.getMultisig(CHAIN, ADDRESS)?.name).toBe("Legacy");

    // writes still go through, with the old keys sitting unread in the same file
    localDb.createMultisig({
      chainId: CHAIN,
      address: "core1second",
      creator: null,
      pubkeyJSON: "{}",
    });
    expect(localDb.getMultisig(CHAIN, "core1second")).not.toBeNull();
    expect(localDb.getMultisig(CHAIN, ADDRESS)?.name).toBe("Legacy");
  });

  test("the policyVersion migration for contract cliqs still runs", () => {
    mockFiles.set(DB_FILE, JSON.stringify(currentCollections()));
    const localDb = loadLocalDb();

    expect(localDb.getContractMultisig(CHAIN, "core1contract")?.policyVersion).toBe(1);
  });

  test("a new database is created without the removed collections", () => {
    const localDb = loadLocalDb();

    expect(localDb.getMultisig(CHAIN, ADDRESS)).toBeNull();

    const keys = Object.keys(storedDb());
    expect(keys).toContain("multisigs");
    expect(keys).toContain("credentialEvents");
    for (const removed of REMOVED_COLLECTIONS) {
      expect(keys).not.toContain(removed);
    }
  });

  test("migrating an older file does not add the removed collections", () => {
    const { contractMultisigs, ...withoutOne } = currentCollections();
    void contractMultisigs;
    mockFiles.set(DB_FILE, JSON.stringify(withoutOne));
    const localDb = loadLocalDb();

    expect(localDb.getContractMultisig(CHAIN, "core1contract")).toBeNull();

    const keys = Object.keys(storedDb());
    expect(keys).toContain("contractMultisigs"); // the migration ran and wrote the file
    for (const removed of REMOVED_COLLECTIONS) {
      expect(keys).not.toContain(removed);
    }
  });
});
