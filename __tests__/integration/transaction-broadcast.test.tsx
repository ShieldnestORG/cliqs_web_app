/**
 * Transaction Broadcast Flow Integration Test
 *
 * File: __tests__/integration/transaction-broadcast.test.tsx
 *
 * Tests for the complete transaction broadcast flow
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiTransactionActions from "@/pages/api/transaction/[transactionID]/index";
import { updateTxHash } from "@/graphql/transaction";
import { parseResponseData } from "../helpers";

// Mock dependencies
jest.mock("@/graphql/transaction", () => ({
  updateTxHash: jest.fn(),
}));

const mockUpdateTxHash = updateTxHash as jest.MockedFunction<typeof updateTxHash>;

describe("Transaction Broadcast Flow: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should complete broadcast flow by updating txHash", async () => {
    const txId = "tx-id-123";
    const txHash = "0x1234567890abcdef";

    mockUpdateTxHash.mockResolvedValue(txHash);

    // Step 1: Update transaction hash after broadcast
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

  it("should handle broadcast errors gracefully", async () => {
    mockUpdateTxHash.mockRejectedValue(new Error("Broadcast failed"));

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: "tx-id-123" },
      body: {
        txHash: "0xinvalid",
      },
    });

    await apiTransactionActions(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to update transaction");
  });
});
