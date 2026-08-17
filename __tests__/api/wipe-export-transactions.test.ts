/**
 * Wipe / Export Transactions API Route Tests
 *
 * File: __tests__/api/wipe-export-transactions.test.ts
 *
 * Tests for POST /api/transaction/wipe and POST /api/transaction/export
 * Focus: ADR-36 auth gate (401/403 without a valid member signature) and the
 * shared-data 409 guard for pending transactions signed by other members.
 * Priority: P0 (security)
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiWipeTransactions from "@/pages/api/transaction/wipe/index";
import apiExportTransactions from "@/pages/api/transaction/export/index";
import { getMultisig } from "@/graphql";
import { getNonce, incrementNonce } from "@/graphql/nonce";
import * as db from "@/lib/db";
import { pubkeyToAddress } from "@cosmjs/amino";
import { parseResponseData } from "../helpers";

jest.mock("@/lib/dbInit", () => ({
  ensureDbReady: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/byodb/middleware", () => ({
  withByodbMiddleware: (handler: unknown) => handler,
  isUsingByodb: jest.fn().mockReturnValue(false),
}));

jest.mock("@/graphql", () => ({
  getMultisig: jest.fn(),
}));

jest.mock("@/graphql/nonce", () => ({
  getNonce: jest.fn(),
  incrementNonce: jest.fn(),
}));

jest.mock("@/lib/keplr", () => ({
  verifyKeplrSignature: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/db", () => ({
  wipeCompletedTransactions: jest.fn(),
  wipeAllTransactions: jest.fn(),
  deleteMultisig: jest.fn(),
  getPendingTransactionsByCreator: jest.fn(),
  getSignaturesByTransaction: jest.fn(),
  exportTransactionHistory: jest.fn(),
}));

// jest.setup.js mocks @cosmjs/amino and @cosmjs/encoding with CONSTANT return
// values (toBase64 always "AQID", pubkeyToAddress always "cosmos1test"), which
// makes every pubkey "a member". Override them here with pass-through
// implementations so the membership check actually discriminates.
jest.mock("@cosmjs/amino", () => ({
  decodeSignature: jest.fn((signature: { pub_key: { value: string } }) => ({
    pubkey: signature.pub_key.value,
    signature: new Uint8Array([1, 2, 3]),
  })),
  pubkeyToAddress: jest.fn(
    (pubkey: { value: string }, prefix: string) => `${prefix}1addr${pubkey.value}`,
  ),
}));

jest.mock("@cosmjs/encoding", () => ({
  toBase64: jest.fn((value: unknown) => String(value)),
}));

const mockGetMultisig = getMultisig as jest.MockedFunction<typeof getMultisig>;
const mockGetNonce = getNonce as jest.MockedFunction<typeof getNonce>;
const mockIncrementNonce = incrementNonce as jest.MockedFunction<typeof incrementNonce>;
const mockWipeCompleted = db.wipeCompletedTransactions as jest.MockedFunction<
  typeof db.wipeCompletedTransactions
>;
const mockWipeAll = db.wipeAllTransactions as jest.MockedFunction<typeof db.wipeAllTransactions>;
const mockDeleteMultisig = db.deleteMultisig as jest.MockedFunction<typeof db.deleteMultisig>;
const mockGetPendingTxs = db.getPendingTransactionsByCreator as jest.MockedFunction<
  typeof db.getPendingTransactionsByCreator
>;
const mockGetSignatures = db.getSignaturesByTransaction as jest.MockedFunction<
  typeof db.getSignaturesByTransaction
>;
const mockExportHistory = db.exportTransactionHistory as jest.MockedFunction<
  typeof db.exportTransactionHistory
>;

const chainId = "cosmoshub-4";
const multisigAddress = "cosmos1multisigaddress";

const memberPubkeyB64 = "memberpubkeybase64";
const strangerPubkeyB64 = "strangerpubkeybase64";

// Uses the pass-through pubkeyToAddress mock above, so this matches whatever
// address the handler derives for the member's signature
const memberAddress = pubkeyToAddress(
  { type: "tendermint/PubKeySecp256k1", value: memberPubkeyB64 },
  "cosmos",
);

const multisigPubkeyJSON = JSON.stringify({
  type: "tendermint/PubKeyMultisigThreshold",
  value: {
    threshold: "2",
    pubkeys: [{ type: "tendermint/PubKeySecp256k1", value: memberPubkeyB64 }],
  },
});

const dbMultisig = {
  id: "multisig-id-1",
  chainId,
  address: multisigAddress,
  pubkeyJSON: multisigPubkeyJSON,
} as Awaited<ReturnType<typeof getMultisig>>;

const chainBody = {
  chainId,
  addressPrefix: "cosmos",
  chainDisplayName: "Cosmos Hub",
  nodeAddress: "https://rpc.cosmos.network",
};

const signatureFor = (pubkeyB64: string) => ({
  pub_key: { type: "tendermint/PubKeySecp256k1", value: pubkeyB64 },
  signature: "fake-signature",
});

describe("API: POST /api/transaction/wipe - Auth + shared-data guard: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMultisig.mockResolvedValue(dbMultisig);
    mockGetNonce.mockResolvedValue(1);
    mockIncrementNonce.mockResolvedValue(2);
    mockGetPendingTxs.mockResolvedValue([]);
  });

  it("should return 401 when no signature is provided", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { multisigAddress, chainId, mode: "all" },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    expect(mockWipeAll).not.toHaveBeenCalled();
    expect(mockWipeCompleted).not.toHaveBeenCalled();
  });

  it("should return 403 when the signer is not a multisig member", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        mode: "all",
        chain: chainBody,
        signature: signatureFor(strangerPubkeyB64),
      },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(403);
    expect(mockWipeAll).not.toHaveBeenCalled();
  });

  it("should return 409 for mode 'all' while pending txs carry other members' signatures", async () => {
    mockGetPendingTxs.mockResolvedValue([{ id: "tx1" }, { id: "tx2" }] as any);
    mockGetSignatures.mockImplementation(async (txId: string) =>
      txId === "tx1"
        ? ([{ address: "cosmos1someoneelse" }] as any)
        : ([{ address: memberAddress }] as any),
    );

    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        mode: "all",
        chain: chainBody,
        signature: signatureFor(memberPubkeyB64),
      },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(409);
    expect(parseResponseData(res._getData())).toContain("1 pending transaction(s)");
    expect(mockWipeAll).not.toHaveBeenCalled();
  });

  it("should wipe completed transactions for a verified member", async () => {
    mockWipeCompleted.mockResolvedValue({ deletedTransactions: 3, deletedSignatures: 5 });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        mode: "completed",
        chain: chainBody,
        signature: signatureFor(memberPubkeyB64),
      },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.success).toBe(true);
    expect(data.deletedTransactions).toBe(3);
    expect(mockWipeCompleted).toHaveBeenCalledWith("multisig-id-1");
  });

  it("should delete the multisig record for mode 'multisig' when no pending txs block it", async () => {
    mockDeleteMultisig.mockResolvedValue({
      deletedTransactions: 2,
      deletedSignatures: 4,
      deletedMultisigs: 1,
    });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        mode: "multisig",
        chain: chainBody,
        signature: signatureFor(memberPubkeyB64),
      },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.deletedMultisigs).toBe(1);
    expect(mockDeleteMultisig).toHaveBeenCalledWith("multisig-id-1");
  });

  it("should return 400 for an unknown mode", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { multisigAddress, chainId, mode: "everything" },
    });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });

  it("should return 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });

    await apiWipeTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});

describe("API: POST /api/transaction/export - Auth gate: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMultisig.mockResolvedValue(dbMultisig);
    mockGetNonce.mockResolvedValue(1);
    mockIncrementNonce.mockResolvedValue(2);
  });

  it("should return 401 when no signature is provided", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { multisigAddress, chainId },
    });

    await apiExportTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    expect(mockExportHistory).not.toHaveBeenCalled();
  });

  it("should return 403 when the signer is not a multisig member", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        chain: chainBody,
        signature: signatureFor(strangerPubkeyB64),
      },
    });

    await apiExportTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(403);
    expect(mockExportHistory).not.toHaveBeenCalled();
  });

  it("should export history for a verified member", async () => {
    mockExportHistory.mockResolvedValue([{ id: "tx1" }] as any);

    const { req, res } = createMocks({
      method: "POST",
      body: {
        multisigAddress,
        chainId,
        chain: chainBody,
        signature: signatureFor(memberPubkeyB64),
      },
    });

    await apiExportTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.transactionCount).toBe(1);
    expect(mockExportHistory).toHaveBeenCalledWith("multisig-id-1");
  });
});
