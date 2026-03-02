/**
 * Account Page Test
 *
 * File: __tests__/pages/account.test.tsx
 *
 * Tests for the account page route (/[chainName]/account)
 * Priority: P1
 */

import { render, screen, waitFor } from "@testing-library/react";
import AccountPage from "@/pages/[chainName]/account";

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
}));

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: { chainName: "cosmos" },
    pathname: "/cosmos/account",
  }),
}));

// Mock AccountView component
jest.mock("@/components/dataViews/AccountView", () => {
  return function MockAccountView() {
    return (
      <div data-testid="account-view">
        <h2>Account Information</h2>
        <p>Wallet Address: cosmos1test</p>
      </div>
    );
  };
});

describe("Account Page Route (/[chainName]/account): P1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load account page", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      const accountElements = screen.getAllByText(/Account/i);
      expect(accountElements.length).toBeGreaterThan(0);
    });
  });

  it("should display account view component", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      const accountView = screen.getByTestId("account-view");
      expect(accountView).toBeInTheDocument();
      expect(screen.getByText(/Account Information/i)).toBeInTheDocument();
    });
  });

  it("should display breadcrumb navigation", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      const homeElements = screen.getAllByText(/Home/i);
      const accountElements = screen.getAllByText(/Account/i);
      expect(homeElements.length).toBeGreaterThan(0);
      expect(accountElements.length).toBeGreaterThan(0);
    });
  });
});
