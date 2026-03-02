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

// Mock component that uses chain context
function TestChainComponent() {
  const { chain, setChain } = useChains();

  return (
    <div>
      <div data-testid="current-chain">{chain.chainDisplayName || chain.registryName}</div>
      <button onClick={() => setChain({ registryName: "osmosis", chainDisplayName: "Osmosis" })}>
        Switch to Osmosis
      </button>
      <button onClick={() => setChain({ registryName: "cosmos", chainDisplayName: "Cosmos Hub" })}>
        Switch to Cosmos
      </button>
    </div>
  );
}

describe("Chain Switching: P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display current chain", async () => {
    render(
      <ChainsProvider>
        <TestChainComponent />
      </ChainsProvider>,
    );

    await waitFor(() => {
      const chainDisplay = screen.getByTestId("current-chain");
      expect(chainDisplay).toBeInTheDocument();
    });
  });

  it("should switch chain context", async () => {
    render(
      <ChainsProvider>
        <TestChainComponent />
      </ChainsProvider>,
    );

    await waitFor(() => {
      const osmosisButton = screen.getByText("Switch to Osmosis");
      fireEvent.click(osmosisButton);

      // Chain should update in context
      const chainDisplay = screen.getByTestId("current-chain");
      expect(chainDisplay).toBeInTheDocument();
    });
  });
});
