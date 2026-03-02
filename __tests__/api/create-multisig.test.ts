/**
 * Create Multisig API Route Test
 *
 * File: __tests__/api/create-multisig.test.ts
 *
 * Tests for POST /api/chain/[chainId]/multisig
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiCreateMultisig from "@/pages/api/chain/[chainId]/multisig/index";
import { createMultisig } from "@/graphql/multisig";
import { parseResponseData } from "../helpers";

// Mock GraphQL functions
jest.mock("@/graphql/multisig", () => ({
  createMultisig: jest.fn(),
}));

const mockCreateMultisig = createMultisig as jest.MockedFunction<typeof createMultisig>;

describe("API: POST /api/chain/[chainId]/multisig - Create Multisig: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create multisig successfully", async () => {
    const chainId = "cosmoshub-4";
    const mockDbAddress = "cosmos1multisig123";

    mockCreateMultisig.mockResolvedValue(mockDbAddress);

    const { req, res } = createMocks({
      method: "POST",
      query: { chainId },
      body: {
        chainId,
        members: [
          { address: "cosmos1member1", pubkey: "pubkey1" },
          { address: "cosmos1member2", pubkey: "pubkey2" },
        ],
        threshold: 2,
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.dbMultisigAddress).toBe(mockDbAddress);
    expect(mockCreateMultisig).toHaveBeenCalledWith(expect.objectContaining({ chainId }));
  });

  it("should return 405 for non-POST methods", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { chainId: "cosmoshub-4" },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 when chainId mismatch", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "different-chain",
        members: [],
        threshold: 1,
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });

  it("should return 400 on createMultisig error", async () => {
    mockCreateMultisig.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "cosmoshub-4",
        members: [],
        threshold: 1,
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to create multisig");
  });
});
