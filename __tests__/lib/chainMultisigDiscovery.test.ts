jest.mock("@/graphql", () => ({
  createMultisig: jest.fn(),
}));

jest.mock("@/lib/multisigIndexer", () => ({
  discoverMultisigsFromIndexer: jest.fn(),
  isMultisigIndexerConfigured: jest.fn(),
  syncMultisigToIndexer: jest.fn(),
}));

import { discoverMultisigsWhereMember } from "@/lib/chainMultisigDiscovery";
import {
  discoverMultisigsFromIndexer,
  isMultisigIndexerConfigured,
} from "@/lib/multisigIndexer";

const mockDiscoverMultisigsFromIndexer = discoverMultisigsFromIndexer as jest.MockedFunction<
  typeof discoverMultisigsFromIndexer
>;
const mockIsMultisigIndexerConfigured = isMultisigIndexerConfigured as jest.MockedFunction<
  typeof isMultisigIndexerConfigured
>;

const chain = {
  chainId: "cosmoshub-4",
  addressPrefix: "cosmos",
  nodeAddress: "https://rpc.cosmos.network",
} as never;

describe("chainMultisigDiscovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the indexer result and caches it for repeated lookups", async () => {
    mockIsMultisigIndexerConfigured.mockReturnValue(true);
    mockDiscoverMultisigsFromIndexer.mockResolvedValue([
      {
        id: "chain-cosmos1multisig",
        chainId: "cosmoshub-4",
        address: "cosmos1multisig",
        creator: null,
        pubkeyJSON: '{"type":"tendermint/PubKeyMultisigThreshold"}',
        name: null,
        description: null,
        version: 1,
        createdAt: "2026-03-06T00:00:00.000Z",
        updatedAt: "2026-03-06T00:00:00.000Z",
      },
    ] as never);

    const first = await discoverMultisigsWhereMember(
      chain,
      "cosmos1member",
      "member-pubkey-cache-test",
    );
    const second = await discoverMultisigsWhereMember(
      chain,
      "cosmos1member",
      "member-pubkey-cache-test",
    );

    expect(first).toEqual(second);
    expect(mockDiscoverMultisigsFromIndexer).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when the indexer is unavailable", async () => {
    mockIsMultisigIndexerConfigured.mockReturnValue(false);

    const result = await discoverMultisigsWhereMember(
      chain,
      "cosmos1member",
      "member-pubkey-no-indexer",
    );

    expect(result).toEqual([]);
    expect(mockDiscoverMultisigsFromIndexer).not.toHaveBeenCalled();
  });
});
