// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiEnsureMultisig from "@/pages/api/chain/[chainId]/multisig/[multisigAddress]/ensure";
import { ensureMultisigRegistered } from "@/lib/multisigRegistry";
import { parseResponseData } from "../helpers";

jest.mock("@/lib/dbInit", () => ({
  ensureDbReady: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/byodb/middleware", () => ({
  withByodbMiddleware: (handler: unknown) => handler,
}));

jest.mock("@/lib/multisigRegistry", () => ({
  ensureMultisigRegistered: jest.fn(),
}));

const mockEnsureMultisigRegistered = ensureMultisigRegistered as jest.MockedFunction<
  typeof ensureMultisigRegistered
>;

describe("API: POST /api/chain/[chainId]/multisig/[address]/ensure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves and registers a multisig", async () => {
    mockEnsureMultisigRegistered.mockResolvedValue({
      multisig: {
        id: "multisig-id-123",
        chainId: "coreum-testnet-1",
        address: "testcore1multisigresolved",
        creator: null,
        pubkeyJSON: '{"type":"tendermint/PubKeyMultisigThreshold","value":{"threshold":"2"}}',
        name: null,
        description: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      source: "indexer",
    });

    const { req, res } = createMocks({
      method: "POST",
      query: {
        chainId: "coreum-testnet-1",
        multisigAddress: "testcore1multisigresolved",
      },
      body: {
        chain: {
          chainId: "coreum-testnet-1",
          addressPrefix: "testcore",
          nodeAddress: "https://rpc.testnet-1.coreum.dev",
        },
      },
    });

    await apiEnsureMultisig(req as never, res as never);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.source).toBe("indexer");
    expect(data.multisig.address).toBe("testcore1multisigresolved");
    expect(mockEnsureMultisigRegistered).toHaveBeenCalledWith("testcore1multisigresolved", {
      chainId: "coreum-testnet-1",
      addressPrefix: "testcore",
      nodeAddress: "https://rpc.testnet-1.coreum.dev",
    });
  });

  it("returns 400 on chain mismatch", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: {
        chainId: "coreum-testnet-1",
        multisigAddress: "testcore1multisigresolved",
      },
      body: {
        chain: {
          chainId: "coreum-mainnet-1",
          addressPrefix: "core",
          nodeAddress: "https://rpc.coreum.network",
        },
      },
    });

    await apiEnsureMultisig(req as never, res as never);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain("Failed to resolve multisig");
  });
});
