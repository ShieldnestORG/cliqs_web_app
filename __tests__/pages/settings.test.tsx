/**
 * Settings Page Test
 *
 * File: __tests__/pages/settings.test.tsx
 *
 * Tests for the settings page route (/[chainName]/settings), which also
 * absorbs the former Account page (wallet section).
 * Priority: P1
 */

import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import SettingsPage from "@/pages/[chainName]/settings";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";

// Wallet state the test controls (names starting with "mock" are allowed in jest.mock factories)
let mockWalletInfo: { type: string; address: string; pubKey: string } | null = null;
const mockConnectKeplr = jest.fn();

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletInfo: mockWalletInfo,
    loading: {},
    connectKeplr: mockConnectKeplr,
    connectLedger: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

// Mock the ChainsContext
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "cosmos",
      chainDisplayName: "Cosmos Hub",
      chainId: "cosmoshub-4",
      addressPrefix: "cosmos",
      nodeAddress: "https://rpc.cosmos.network",
      explorerLinks: { account: "https://explorer.example/account/${accountAddress}" },
    },
  }),
}));

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: { chainName: "cosmos" },
    pathname: "/cosmos/settings",
  }),
}));

// Mock settings storage
jest.mock("@/lib/settingsStorage", () => ({
  getUserSettings: jest.fn().mockReturnValue({
    requireWalletSignInForCliqs: false,
  }),
  updateUserSettings: jest.fn(),
}));

// The shared jest.setup mock of DashboardLayout drops `subheader` (the breadcrumb)
// and renders sections without a heading element; this page needs both.
jest.mock("@/components/layout/DashboardLayout", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, title, subheader }: any) =>
      React.createElement("div", { "data-testid": "dashboard-layout", "data-title": title }, [
        React.createElement("div", { key: "sub" }, subheader),
        React.createElement("div", { key: "body" }, children),
      ]),
    DashboardSection: ({ children, title }: any) =>
      React.createElement("section", { "aria-label": title }, [
        React.createElement("h2", { key: "h" }, title),
        children,
      ]),
  };
});

// Use the real AccountView (jest.setup mocks it globally) so the not-connected branch is covered
jest.mock("@/components/dataViews/AccountView", () =>
  jest.requireActual("@/components/dataViews/AccountView"),
);

// Note: @/lib/utils is not mocked - cn function needs to work
// toastError and toastSuccess use sonner which is mocked in jest.setup.js

describe("Settings Page Route (/[chainName]/settings): P1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletInfo = null;
    (getUserSettings as jest.Mock).mockReturnValue({ requireWalletSignInForCliqs: false });
  });

  it("should load settings page with an H1 and the three sections", async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Wallet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Security" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Your own database (BYODB)" }),
    ).toBeInTheDocument();
  });

  it("should link Home in the breadcrumb to the dashboard", async () => {
    render(<SettingsPage />);

    const breadcrumb = await screen.findByTestId("breadcrumb");
    const home = within(breadcrumb).getByText("Home");
    expect(home.closest("a")).toHaveAttribute("href", "/cosmos/dashboard");
  });

  it("should show the sign-in requirement and database sections without a wallet", async () => {
    render(<SettingsPage />);

    expect(
      await screen.findByRole("switch", { name: /Require wallet sign-in for CLIQs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Database Configuration/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        "When on, your CLIQs and waiting signatures appear only after you verify your identity.",
      ),
    ).toBeInTheDocument();
  });

  it("should ask to connect in the wallet section only, with the shared prompt", async () => {
    render(<SettingsPage />);

    const wallet = await screen.findByRole("region", { name: "Wallet" });
    expect(within(wallet).getByText("Connect your wallet")).toBeInTheDocument();
    expect(screen.getAllByText("Connect your wallet")).toHaveLength(1);

    fireEvent.click(within(wallet).getByRole("button", { name: /Keplr/i }));
    expect(mockConnectKeplr).toHaveBeenCalledTimes(1);
  });

  it("should show the connected wallet details instead of the prompt", async () => {
    mockWalletInfo = { type: "Keplr", address: "cosmos1abc", pubKey: "pubkey123" };
    render(<SettingsPage />);

    expect(await screen.findByText("Connected to Keplr")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disconnect Keplr/i })).toBeInTheDocument();
    expect(screen.queryByText("Connect your wallet")).not.toBeInTheDocument();
  });

  it("should link the BYODB guide from the database section", async () => {
    render(<SettingsPage />);

    const guide = await screen.findByRole("link", { name: /step-by-step guide/i });
    expect(guide).toHaveAttribute("href", "/cosmos/get-started?journey=setup-byodb");
  });

  it("should keep the database-config anchor", async () => {
    const { container } = render(<SettingsPage />);

    await screen.findByRole("heading", { level: 1, name: "Settings" });
    expect(container.querySelector("#database-config")).not.toBeNull();
    expect(container.querySelector("#wallet")).not.toBeNull();
  });

  it("should toggle require wallet sign-in setting", async () => {
    render(<SettingsPage />);

    const toggle = await screen.findByRole("switch", { name: /Require wallet sign-in for CLIQs/i });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateUserSettings).toHaveBeenCalledWith({
        requireWalletSignInForCliqs: true,
      });
    });
  });

  it("should load saved settings on mount", async () => {
    (getUserSettings as jest.Mock).mockReturnValue({
      requireWalletSignInForCliqs: true,
    });

    render(<SettingsPage />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch", { name: /Require wallet sign-in for CLIQs/i });
      expect(toggle).toBeChecked();
    });
  });
});
