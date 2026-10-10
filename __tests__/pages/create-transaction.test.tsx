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

let mockMultisigType: "pubkey" | "contract" = "pubkey";
jest.mock("@/lib/hooks/useMultisigType", () => ({
  useMultisigType: () => ({ type: mockMultisigType, isLoading: false, error: null }),
}));

// Mock multisig helpers
jest.mock("@/lib/multisigHelpers", () => ({
  ensureChainMultisigInDb: jest.fn().mockResolvedValue({
    multisig: { id: "mock-multisig-id", address: "cosmos1test" },
    source: "db",
  }),
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

// Mock CreateTxForm
jest.mock("@/components/forms/CreateTxForm", () => {
  return function MockCreateTxForm() {
    return <div data-testid="old-create-tx-form">Transaction Form</div>;
  };
});

describe("Create Transaction Route (/[chainName]/[address]/transaction/new): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMultisigType = "pubkey";
  });

  it("should load create transaction page with an H1", async () => {
    render(<CreateTransactionPage />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "New transaction" }),
    ).toBeInTheDocument();
  });

  it("should display breadcrumb navigation Home > CLIQ > New transaction", async () => {
    render(<CreateTransactionPage />);

    await screen.findByRole("heading", { level: 1, name: "New transaction" });
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/cosmos/dashboard");
    expect(screen.getByRole("link", { name: "CLIQ" })).toHaveAttribute(
      "href",
      "/cosmos/cosmos1test1234567890abcdefghijklmnopqrstuvwxyz",
    );
    expect(screen.queryByText(/Multisig/)).not.toBeInTheDocument();
  });

  it("has no Back to multisig button: the breadcrumb is the one way back", async () => {
    render(<CreateTransactionPage />);

    await screen.findByRole("heading", { level: 1, name: "New transaction" });
    expect(screen.queryByText(/Back to multisig/i)).not.toBeInTheDocument();
  });

  it("contract CLIQ: H1 New proposal, CLIQ crumb, no Back to multisig button", async () => {
    mockMultisigType = "contract";
    render(<CreateTransactionPage />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "New proposal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CLIQ" })).toBeInTheDocument();
    expect(screen.queryByText(/Back to multisig/i)).not.toBeInTheDocument();
  });

  it("unavailable CLIQ: error says CLIQ and the recreate text links to /create", async () => {
    const helpers = jest.requireMock("@/lib/multisigHelpers");
    helpers.getHostedMultisig.mockRejectedValueOnce(new Error("boom"));
    render(<CreateTransactionPage />);

    expect(await screen.findByText("CLIQ not available")).toBeInTheDocument();
    expect(screen.queryByText(/Multisig Not Available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/multisig/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "recreate it with this tool" })).toHaveAttribute(
      "href",
      "/cosmos/create",
    );
  });

  it("unavailable CLIQ: an assert-style failure says CLIQ address, not Multisig address", async () => {
    const helpers = jest.requireMock("@/lib/multisigHelpers");
    helpers.getHostedMultisig.mockResolvedValueOnce({ hosted: "db" });
    render(<CreateTransactionPage />);

    expect(await screen.findByText("CLIQ address could not be found")).toBeInTheDocument();
    expect(screen.queryByText(/multisig/i)).not.toBeInTheDocument();
  });

  it("should display transaction form when account is loaded", async () => {
    render(<CreateTransactionPage />);

    await waitFor(() => {
      const form = screen.getByTestId("old-create-tx-form");
      expect(form).toBeInTheDocument();
    });
  });
});
