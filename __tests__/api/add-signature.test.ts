/**
 * Add Signature API Route Test
 *
 * File: __tests__/api/add-signature.test.ts
 *
 * Tests for POST /api/transaction/[id]/signature
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiCreateSignature from "@/pages/api/transaction/[transactionID]/signature";
import { createSignature } from "@/graphql/signature";
import { parseResponseData } from "../helpers";

// Mock GraphQL functions
jest.mock("@/graphql/signature", () => ({
  createSignature: jest.fn(),
}));

const mockCreateSignature = createSignature as jest.MockedFunction<typeof createSignature>;

describe("API: POST /api/transaction/[id]/signature - Add Signature: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should add signature successfully", async () => {
    const txId = "tx-id-123";
    // createSignature persists the draft and resolves with the signature string
    // itself (graphql/signature.ts), not with a signature record.
    const createdSignature = "test-signature";

    mockCreateSignature.mockResolvedValue(createdSignature);

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: txId },
      body: {
        address: "cosmos1member",
        bodyBytes: "CgoKCC9jb3Ntb3Mx",
        signature: createdSignature,
      },
    });

    await apiCreateSignature(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.signature).toEqual(createdSignature);
    expect(mockCreateSignature).toHaveBeenCalledWith({
      address: "cosmos1member",
      bodyBytes: "CgoKCC9jb3Ntb3Mx",
      signature: createdSignature,
      transaction: { id: txId },
    });
  });

  it("should return 405 for non-POST methods", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { transactionID: "tx-id-123" },
    });

    await apiCreateSignature(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 on createSignature error", async () => {
    mockCreateSignature.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "POST",
      query: { transactionID: "tx-id-123" },
      body: {
        address: "cosmos1member",
        bodyBytes: "CgoKCC9jb3Ntb3Mx",
        signature: "test-signature",
      },
    });

    await apiCreateSignature(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to create signature");
  });
});
