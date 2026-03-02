/**
 * Create Transaction Route Test
 *
 * File: __tests__/pages/create-transaction.test.tsx
 *
 * Tests for the create transaction route (/[chainName]/[address]/transaction/new)
 * Priority: P0
 */

import { render, screen, waitFor } from "@testing-library/react";
import CreateTransactionPage from "@/pages/[chainName]/[address]/transaction/new";

// Mock the ChainsContext
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "cosmos",
      chainDisplayName: "Cosmos Hub",
      chainId: "cosmoshub-4",
      addressPrefix: "cosmos",
      nodeAddress: "https://rpc.cosmos.network",
    },
  }),
  isChainInfoFilled: () => true,
}));

// Mock next/router
const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: {
      chainName: "cosmos",
      address: "cosmos1test1234567890abcdefghijklmnopqrstuvwxyz",
    },
    pathname: "/cosmos/cosmos1test1234567890abcdefghijklmnopqrstuvwxyz/transaction/new",
    push: mockPush,
  }),
}));

// Mock multisig helpers
jest.mock("@/lib/multisigHelpers", () => ({
  getHostedMultisig: jest.fn().mockResolvedValue({
    hosted: "db+chain",
    accountOnChain: {
      address: "cosmos1test",
      accountNumber: 1,
      sequence: 0,
    },
  }),
  isAccount: jest.fn().mockReturnValue(true),
}));

// Mock API
jest.mock("@/lib/api", () => ({
  getPendingDbTxs: jest.fn().mockResolvedValue([]),
}));

// Mock OldCreateTxForm
jest.mock("@/components/forms/OldCreateTxForm", () => {
  return function MockOldCreateTxForm() {
    return <div data-testid="old-create-tx-form">Transaction Form</div>;
  };
});

describe("Create Transaction Route (/[chainName]/[address]/transaction/new): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load create transaction page", async () => {
    render(<CreateTransactionPage />);

    await waitFor(() => {
      expect(screen.getByText(/New Transaction/i)).toBeInTheDocument();
    });
  });

  it("should display breadcrumb navigation", async () => {
    render(<CreateTransactionPage />);

    await waitFor(() => {
      const homeElements = screen.getAllByText(/Home/i);
      const multisigElements = screen.getAllByText(/Multisig/i);
      expect(homeElements.length).toBeGreaterThan(0);
      expect(multisigElements.length).toBeGreaterThan(0);
    });
  });

  it("should display back button", async () => {
    render(<CreateTransactionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Back to multisig/i)).toBeInTheDocument();
    });
  });

  it("should display transaction form when account is loaded", async () => {
    render(<CreateTransactionPage />);

    await waitFor(() => {
      const form = screen.getByTestId("old-create-tx-form");
      expect(form).toBeInTheDocument();
    });
  });
});
