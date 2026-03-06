// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiCreateMultisig from "@/pages/api/chain/[chainId]/multisig/index";
import { createMultisig } from "@/graphql/multisig";
import { syncMultisigToIndexer } from "@/lib/multisigIndexer";
import { parseResponseData } from "../helpers";

jest.mock("@/graphql/multisig", () => ({
  createMultisig: jest.fn(),
}));

jest.mock("@/lib/multisigIndexer", () => ({
  syncMultisigToIndexer: jest.fn().mockResolvedValue(undefined),
}));

const mockGraphqlCreateMultisig = createMultisig as jest.MockedFunction<typeof createMultisig>;
const mockSyncMultisigToIndexer = syncMultisigToIndexer as jest.MockedFunction<
  typeof syncMultisigToIndexer
>;

describe("API: POST /api/chain/[chainId]/multisig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a multisig and syncs it to the indexer", async () => {
    mockGraphqlCreateMultisig.mockResolvedValue("cosmos1multisig");

    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "cosmoshub-4",
        address: "cosmos1multisig",
        creator: "cosmos1creator",
        pubkeyJSON:
          '{"type":"tendermint/PubKeyMultisigThreshold","value":{"threshold":"2","pubkeys":[]}}',
        name: "Treasury",
        description: "Team treasury",
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data).toEqual({ dbMultisigAddress: "cosmos1multisig" });
    expect(mockGraphqlCreateMultisig).toHaveBeenCalledWith({
      chainId: "cosmoshub-4",
      address: "cosmos1multisig",
      creator: "cosmos1creator",
      pubkeyJSON:
        '{"type":"tendermint/PubKeyMultisigThreshold","value":{"threshold":"2","pubkeys":[]}}',
      name: "Treasury",
      description: "Team treasury",
    });
    expect(mockSyncMultisigToIndexer).toHaveBeenCalledWith(
      {
        chainId: "cosmoshub-4",
        address: "cosmos1multisig",
        creator: "cosmos1creator",
        pubkeyJSON:
          '{"type":"tendermint/PubKeyMultisigThreshold","value":{"threshold":"2","pubkeys":[]}}',
        name: "Treasury",
        description: "Team treasury",
      },
      { source: "app_import" },
    );
  });

  it("does not fail the request if indexer sync fails", async () => {
    mockGraphqlCreateMultisig.mockResolvedValue("cosmos1multisig");
    mockSyncMultisigToIndexer.mockRejectedValueOnce(new Error("indexer unavailable"));

    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "cosmoshub-4",
        address: "cosmos1multisig",
        creator: "cosmos1creator",
        pubkeyJSON:
          '{"type":"tendermint/PubKeyMultisigThreshold","value":{"threshold":"2","pubkeys":[]}}',
      },
    });

    await apiCreateMultisig(req as never, res as never);

    expect(res._getStatusCode()).toBe(200);
    expect(mockSyncMultisigToIndexer).toHaveBeenCalled();
  });

  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { chainId: "cosmoshub-4" },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when chainId mismatch", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "different-chain",
        address: "cosmos1multisig",
        creator: "cosmos1creator",
        pubkeyJSON: "{}",
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 400 on createMultisig error", async () => {
    mockGraphqlCreateMultisig.mockRejectedValue(new Error("Database error"));

    const { req, res } = createMocks({
      method: "POST",
      query: { chainId: "cosmoshub-4" },
      body: {
        chainId: "cosmoshub-4",
        address: "cosmos1multisig",
        creator: "cosmos1creator",
        pubkeyJSON: "{}",
      },
    });

    await apiCreateMultisig(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to create multisig");
  });
});
