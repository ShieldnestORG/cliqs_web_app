/**
 * Get Multisig API Route Test
 *
 * File: __tests__/api/get-multisig.test.ts
 *
 * Tests for GET /api/chain/[chainId]/multisig/[address]
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiGetMultisig from "@/pages/api/chain/[chainId]/multisig/[multisigAddress]/index";
import { getMultisig } from "@/graphql/multisig";
import { parseResponseData } from "../helpers";

// Mock GraphQL functions
jest.mock("@/graphql/multisig", () => ({
  getMultisig: jest.fn(),
}));

const mockGetMultisig = getMultisig as jest.MockedFunction<typeof getMultisig>;

describe("API: GET /api/chain/[chainId]/multisig/[address] - Get Multisig: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get multisig successfully", async () => {
    const chainId = "cosmoshub-4";
    const address = "cosmos1multisig123";
    // DbMultisig has no `members`/`threshold` columns — the member pubkeys and
    // the threshold live inside the serialized `pubkeyJSON`.
    const mockMultisig = {
      id: "multisig-id-123",
      address,
      chainId,
      version: 1,
      pubkeyJSON: JSON.stringify({
        type: "tendermint/PubKeyMultisigThreshold",
        value: {
          threshold: "2",
          pubkeys: [
            { type: "tendermint/PubKeySecp256k1", value: "member-1-pubkey" },
            { type: "tendermint/PubKeySecp256k1", value: "member-2-pubkey" },
          ],
        },
      }),
    };

    mockGetMultisig.mockResolvedValue(mockMultisig);

    const { req, res } = createMocks({
      method: "GET",
      query: { chainId, multisigAddress: address },
    });

    await apiGetMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.address).toBe(address);
    expect(mockGetMultisig).toHaveBeenCalledWith(chainId, address);
  });

  it("should return 400 when multisig not found", async () => {
    mockGetMultisig.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: "GET",
      query: { chainId: "cosmoshub-4", multisigAddress: "cosmos1nonexistent" },
    });

    await apiGetMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("multisig not found");
  });

  it("should return 405 for non-GET methods", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4", multisigAddress: "cosmos1test" },
    });

    await apiGetMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 on getMultisig error", async () => {
    mockGetMultisig.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "GET",
      query: { chainId: "cosmoshub-4", multisigAddress: "cosmos1test" },
    });

    await apiGetMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });
});
