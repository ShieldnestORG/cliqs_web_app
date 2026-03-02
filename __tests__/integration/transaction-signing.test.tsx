/**
 * Transaction Signing Flow Integration Test
 *
 * File: __tests__/integration/transaction-signing.test.tsx
 *
 * Tests for the complete transaction signing flow
 * Priority: P0
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiCreateSignature from "@/pages/api/transaction/[transactionID]/signature";
import { createSignature } from "@/graphql/signature";
import { parseResponseData } from "../helpers";

// Mock dependencies
jest.mock("@/graphql/signature", () => ({
  createSignature: jest.fn(),
}));

const mockCreateSignature = createSignature as jest.MockedFunction<typeof createSignature>;

describe("Transaction Signing Flow: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should complete full signing flow", async () => {
    const txId = "tx-id-123";
    const mockSignature = {
      id: "sig-id-123",
      transaction: { id: txId },
      signature: "test-signature",
      pubkey: "test-pubkey",
    };

    mockCreateSignature.mockResolvedValue(mockSignature);

    // Step 1: Create signature via API
    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: txId },
      body: {
        signature: "test-signature",
        pubkey: "test-pubkey",
      },
    });

    await apiCreateSignature(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.signature).toEqual(mockSignature);
  });

  it("should handle signature errors gracefully", async () => {
    mockCreateSignature.mockRejectedValue(new Error("Signature verification failed"));

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: "tx-id-123" },
      body: {
        signature: "invalid-signature",
        pubkey: "test-pubkey",
      },
    });

    await apiCreateSignature(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to create signature");
  });
});
