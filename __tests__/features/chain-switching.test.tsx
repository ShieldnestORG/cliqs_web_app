/**
 * Chain Switching Test
 *
 * File: __tests__/features/chain-switching.test.tsx
 *
 * Tests for chain context switching
 * Priority: P0
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChainsProvider, useChains } from "@/context/ChainsContext";
import { setChain } from "@/context/ChainsContext/helpers";
import type { ChainInfo } from "@/context/ChainsContext/types";

// jest.setup.js globally replaces ChainsContext with a static object whose chain
// never changes and whose setChain is a no-op, and replaces ChainsProvider with a
// passthrough. Under those global mocks the real reducer never runs, so a chain
// switch is unobservable and this suite cannot test what it claims to test.
// Restore the real modules for this file only.
jest.mock("@/context/ChainsContext", () => jest.requireActual("@/context/ChainsContext"));
jest.mock("@/context/ChainsContext/helpers", () =>
  jest.requireActual("@/context/ChainsContext/helpers"),
);

// The real provider re-runs its init effect whenever the object returned by
// useChainsFromRegistry changes identity, and that effect calls setChain
// unconditionally. The real hook starts with empty maps and then swaps in fetched
// ones, which would overwrite the chain the user just picked. A stable, already
// populated registry makes the effect settle once so the switch is observable.
jest.mock("@/context/ChainsContext/service", () => {
  const actual = jest.requireActual("@/context/ChainsContext/service");
  const { osmosis, cosmos } = mockBuildChains();

  const registry = {
    chainItems: {
      mainnets: new Map([
        [cosmos.registryName, cosmos],
        [osmosis.registryName, osmosis],
      ]),
      testnets: new Map(),
      localnets: new Map(),
    },
    chainItemsError: null,
  };

  return {
    ...actual,
    useChainsFromRegistry: () => registry,
    getChain: () => cosmos,
    getNodeFromArray: async (addresses: readonly string[]) => addresses[0],
  };
});

// Declared as a hoisted function so the jest.mock factory above can call it, and
// prefixed with "mock" to satisfy jest's out-of-scope reference rule.
function mockBuildChains() {
  const osmosis = {
    registryName: "osmosis",
    logo: "/osmosis.png",
    chainId: "osmosis-1",
    chainDisplayName: "Osmosis",
    nodeAddress: "https://rpc.osmosis.zone",
    nodeAddresses: ["https://rpc.osmosis.zone"],
    denom: "uosmo",
    displayDenom: "OSMO",
    displayDenomExponent: 6,
    assets: [
      {
        denom_units: [
          { denom: "uosmo", exponent: 0 },
          { denom: "osmo", exponent: 6 },
        ],
        base: "uosmo",
        display: "osmo",
        name: "Osmosis",
        symbol: "OSMO",
      },
    ],
    gasPrice: "0.025uosmo",
    addressPrefix: "osmo",
    explorerLinks: {
      tx: "https://www.mintscan.io/osmosis/txs",
      account: "https://www.mintscan.io/osmosis/account",
    },
  } as unknown as ChainInfo;

  const cosmos = {
    registryName: "cosmoshub",
    logo: "/cosmoshub.png",
    chainId: "cosmoshub-4",
    chainDisplayName: "Cosmos Hub",
    nodeAddress: "https://rpc.cosmos.network",
    nodeAddresses: ["https://rpc.cosmos.network"],
    denom: "uatom",
    displayDenom: "ATOM",
    displayDenomExponent: 6,
    assets: [
      {
        denom_units: [
          { denom: "uatom", exponent: 0 },
          { denom: "atom", exponent: 6 },
        ],
        base: "uatom",
        display: "atom",
        name: "Cosmos Hub Atom",
        symbol: "ATOM",
      },
    ],
    gasPrice: "0.025uatom",
    addressPrefix: "cosmos",
    explorerLinks: {
      tx: "https://www.mintscan.io/cosmos/txs",
      account: "https://www.mintscan.io/cosmos/account",
    },
  } as unknown as ChainInfo;

  return { osmosis, cosmos };
}

const { osmosis: osmosisChain, cosmos: cosmosChain } = mockBuildChains();

// Mock component that uses chain context. Chain changes go through the `setChain`
// helper, which dispatches the "setChain" action on the dispatch returned by
// useChains() — the real context exposes `chainsDispatch`, not a `setChain`.
function TestChainComponent() {
  const { chain, chainsDispatch } = useChains();

  return (
    <div>
      <div data-testid="current-chain">{chain.chainDisplayName || chain.registryName}</div>
      <button onClick={() => setChain(chainsDispatch, osmosisChain)}>Switch to Osmosis</button>
      <button onClick={() => setChain(chainsDispatch, cosmosChain)}>Switch to Cosmos</button>
    </div>
  );
}

describe("Chain Switching: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The reducer persists the selected chain to localStorage and to the URL, so
    // reset both to keep each test independent of the previous one.
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("should display current chain", async () => {
    render(
      <ChainsProvider>
        <TestChainComponent />
      </ChainsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-chain")).toHaveTextContent("Cosmos Hub");
    });
  });

  it("should switch chain context", async () => {
    render(
      <ChainsProvider>
        <TestChainComponent />
      </ChainsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-chain")).toHaveTextContent("Cosmos Hub");
    });

    fireEvent.click(screen.getByText("Switch to Osmosis"));

    await waitFor(() => {
      expect(screen.getByTestId("current-chain")).toHaveTextContent("Osmosis");
    });

    fireEvent.click(screen.getByText("Switch to Cosmos"));

    await waitFor(() => {
      expect(screen.getByTestId("current-chain")).toHaveTextContent("Cosmos Hub");
    });
  });
});
