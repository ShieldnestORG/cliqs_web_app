/**
 * Create Transaction API Route Test
 *
 * File: __tests__/api/create-transaction.test.ts
 *
 * Tests for POST /api/transaction
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiCreateTransaction from "@/pages/api/transaction/index";
import { getMultisig } from "@/graphql/multisig";
import { createSignature } from "@/graphql/signature";
import { createTransaction } from "@/graphql/transaction";
import { parseResponseData } from "../helpers";

// Mock GraphQL functions
jest.mock("@/graphql/multisig", () => ({
  getMultisig: jest.fn(),
}));

jest.mock("@/graphql/transaction", () => ({
  createTransaction: jest.fn(),
}));

jest.mock("@/graphql/signature", () => ({
  createSignature: jest.fn(),
}));

const mockGetMultisig = getMultisig as jest.MockedFunction<typeof getMultisig>;
const mockCreateTransaction = createTransaction as jest.MockedFunction<typeof createTransaction>;
const mockCreateSignature = createSignature as jest.MockedFunction<typeof createSignature>;
const validImportedTx = {
  chainId: "cosmoshub-4",
  accountNumber: "1",
  sequence: "0",
  msgs: [
    {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: {
        fromAddress: "cosmos1multisig",
        toAddress: "cosmos1recipient",
        amount: [{ denom: "uatom", amount: "1" }],
      },
    },
  ],
  fee: { amount: [], gas: "200000" },
  memo: "Test transaction",
};

describe("API: POST /api/transaction - Create Transaction: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create transaction successfully", async () => {
    const mockMultisig = {
      id: "multisig-id-123",
      address: "cosmos1multisig",
      chainId: "cosmoshub-4",
    };
    const mockTxId = "tx-id-123";

    mockGetMultisig.mockResolvedValue(mockMultisig);
    mockCreateTransaction.mockResolvedValue(mockTxId);

    const { req, res } = createMocks({
      method: "POST",
      body: {
        chainId: "cosmoshub-4",
        creator: "cosmos1multisig",
        dataJSON: validImportedTx,
      },
    });

    await apiCreateTransaction(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.txId).toBe(mockTxId);
    expect(mockGetMultisig).toHaveBeenCalledWith("cosmoshub-4", "cosmos1multisig");
    expect(mockCreateTransaction).toHaveBeenCalled();
    expect(mockCreateTransaction).toHaveBeenCalledWith({
      creator: { id: "multisig-id-123" },
      dataJSON: JSON.stringify({
        ...validImportedTx,
        accountNumber: 1,
        sequence: 0,
      }),
    });
  });

  it("should persist imported signatures with the created transaction", async () => {
    mockGetMultisig.mockResolvedValue({
      id: "multisig-id-123",
      address: "cosmos1multisig",
      chainId: "cosmoshub-4",
    });
    mockCreateTransaction.mockResolvedValue("tx-id-123");
    mockCreateSignature.mockResolvedValue("sig-1");

    const importedSignature = {
      address: "cosmos1member",
      signature: "base64-signature",
      bodyBytes: "base64-body-bytes",
    };

    const { req, res } = createMocks({
      method: "POST",
      body: {
        chainId: "cosmoshub-4",
        creator: "cosmos1multisig",
        dataJSON: validImportedTx,
        importedSignatures: [importedSignature],
      },
    });

    await apiCreateTransaction(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(mockCreateSignature).toHaveBeenCalledWith({
      ...importedSignature,
      transaction: { id: "tx-id-123" },
    });
  });

  it("should return 405 for non-POST methods", async () => {
    const { req, res } = createMocks({
      method: "GET",
    });

    await apiCreateTransaction(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 when multisig not found", async () => {
    mockGetMultisig.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: "POST",
      body: {
        chainId: "cosmoshub-4",
        creator: "cosmos1nonexistent",
        dataJSON: validImportedTx,
      },
    });

    await apiCreateTransaction(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("multisig not found");
  });

  it("should return 400 on createTransaction error", async () => {
    const mockMultisig = {
      id: "multisig-id-123",
      address: "cosmos1multisig",
      chainId: "cosmoshub-4",
    };

    mockGetMultisig.mockResolvedValue(mockMultisig);
    mockCreateTransaction.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "POST",
      body: {
        chainId: "cosmoshub-4",
        creator: "cosmos1multisig",
        dataJSON: validImportedTx,
      },
    });

    await apiCreateTransaction(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to create transaction");
  });
});
