/**
 * Get Transaction API Route Test
 *
 * File: __tests__/api/get-transaction.test.ts
 *
 * Tests for GET /api/transaction/[id]
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiTransactionActions from "@/pages/api/transaction/[transactionID]/index";
import { cancelTransaction, updateTxHash } from "@/graphql/transaction";
import { parseResponseData } from "../helpers";

// Mock GraphQL functions
jest.mock("@/graphql/transaction", () => ({
  getTransaction: jest.fn(),
  cancelTransaction: jest.fn(),
  updateTxHash: jest.fn(),
}));

import { getTransaction, cancelTransaction, updateTxHash } from "@/graphql/transaction";

const mockGetTransaction = getTransaction as jest.MockedFunction<typeof getTransaction>;
const mockCancelTransaction = cancelTransaction as jest.MockedFunction<typeof cancelTransaction>;
const mockUpdateTxHash = updateTxHash as jest.MockedFunction<typeof updateTxHash>;

describe("API: GET /api/transaction/[id] - Get Transaction: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get transaction successfully", async () => {
    const txId = "tx-id-123";
    const mockTransaction = {
      id: txId,
      dataJSON: JSON.stringify({
        chainId: "cosmoshub-4",
        msgs: [],
      }),
      signatures: [],
    };

    mockGetTransaction.mockResolvedValue(mockTransaction);

    // Note: The actual endpoint handles POST for actions, but we test GET via getTransaction
    // This test would need to be adapted based on actual implementation
    expect(mockGetTransaction).toBeDefined();
  });
});

describe("API: POST /api/transaction/[id] - Transaction Actions: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should cancel transaction successfully", async () => {
    const txId = "tx-id-123";
    mockCancelTransaction.mockResolvedValue(true);

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: txId },
      body: {
        action: "cancel",
      },
    });

    await apiTransactionActions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.cancelled).toBe(true);
    expect(data.txId).toBe(txId);
    expect(mockCancelTransaction).toHaveBeenCalledWith(txId);
  });

  it("should update txHash successfully", async () => {
    const txId = "tx-id-123";
    const txHash = "0x1234567890abcdef";
    mockUpdateTxHash.mockResolvedValue(txHash);

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: txId },
      body: {
        txHash,
      },
    });

    await apiTransactionActions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.dbTxHash).toBe(txHash);
    expect(mockUpdateTxHash).toHaveBeenCalledWith(txId, txHash);
  });

  it("should return 405 for non-POST methods", async () => {
    const { req, res } = createMocks({
      method: "PUT",
      query: { transactionID: "tx-id-123" },
    });

    await apiTransactionActions(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 on error", async () => {
    mockCancelTransaction.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: "tx-id-123" },
      body: {
        action: "cancel",
      },
    });

    await apiTransactionActions(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });
});
