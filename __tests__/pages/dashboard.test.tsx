/**
 * Home Route Test
 *
 * File: __tests__/pages/dashboard.test.tsx
 *
 * Tests for Home (/[chainName]/dashboard): section order, the not-connected and
 * not-ready states, old `?tab=` links, and the Validators section.
 * The signature inbox itself is covered in __tests__/features/signature-inbox.test.tsx.
 * Priority: P0
 */

import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/pages/[chainName]/dashboard";

const mockChain: Record<string, unknown> = {
  registryName: "cosmos",
  chainDisplayName: "Cosmos Hub",
  chainId: "cosmoshub-4",
  addressPrefix: "cosmos",
  nodeAddress: "https://rpc.cosmos.network",
};

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({ chain: mockChain }),
}));

const mockWalletInfo = { type: "Keplr", address: "cosmos1me", pubKey: "pk" };
let mockWallet: Record<string, unknown> = {};

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => mockWallet,
}));

const mockPending = {
  hasPendingTransactions: false,
  totalPendingCount: 0,
  needsMyCount: 0,
  multisigsWithPending: [],
  cliqs: [],
  isLoading: false,
  hasLoaded: true,
  error: null,
  refresh: jest.fn(),
};

jest.mock("@/lib/hooks/usePendingTransactions", () => ({
  usePendingTransactions: () => mockPending,
}));

const mockGetAssociatedValidators = jest.fn();
jest.mock("@/lib/validatorHelpers", () => ({
  getAssociatedValidators: (...args: unknown[]) => mockGetAssociatedValidators(...args),
}));

const mockGetDbUserMultisigs = jest.fn();
jest.mock("@/lib/api", () => ({
  getDbUserMultisigs: (...args: unknown[]) => mockGetDbUserMultisigs(...args),
}));

const connectedWallet = () => ({
  walletInfo: mockWalletInfo,
  verificationSignature: null,
  isVerified: false,
  verify: jest.fn().mockResolvedValue(null),
  loading: {},
  connectKeplr: jest.fn(),
  connectLedger: jest.fn(),
});

// Document order of two elements; avoids bitwise flags (lint: no-bitwise).
const isBefore = (a: HTMLElement, b: HTMLElement) =>
  a.compareDocumentPosition(b) === Node.DOCUMENT_POSITION_FOLLOWING;

describe("Home Route (/[chainName]/dashboard): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain.nodeAddress = "https://rpc.cosmos.network";
    mockWallet = connectedWallet();
    Object.assign(mockPending, { isLoading: false, hasLoaded: true, error: null });
    mockGetAssociatedValidators.mockResolvedValue([]);
    mockGetDbUserMultisigs.mockResolvedValue({ created: [], belonged: [] });
  });

  it("renders the Home heading, the chain-aware subtitle and the page title", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(
      screen.getByText("Signatures waiting for you and your CLIQs on Cosmos Hub."),
    ).toBeInTheDocument();
    expect(screen.getByText("Home - Cosmos Hub")).toBeInTheDocument();
  });

  it("connected: sections read Needs your signature, Your CLIQs, Open by address in that order", () => {
    render(<DashboardPage />);

    const needs = screen.getByText("Needs your signature");
    const cliqs = screen.getByText("Your CLIQs");
    const open = screen.getByText("Open by address");

    expect(isBefore(needs, cliqs)).toBe(true);
    expect(isBefore(cliqs, open)).toBe(true);
    expect(screen.getByTestId("list-user-cliqs")).toBeInTheDocument();
    expect(screen.getByTestId("find-multisig-form")).toBeInTheDocument();
    expect(open.closest("#open-by-address")).not.toBeNull();
  });

  it("has no tabs, stat tiles, quick actions or New CLIQ button (they moved or were removed)", () => {
    render(<DashboardPage />);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quick-stat")).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick Actions/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
    expect(screen.queryByText(/New CLIQ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No Validator Detected/i)).not.toBeInTheDocument();
  });

  it.each(["overview", "cliqs", "find"])(
    "an old ?tab=%s link still renders the merged Home (the page does not read the query)",
    (tab) => {
      // next/router is mocked globally; the page must not depend on the query at all.
      const router = jest.requireMock("next/router");
      router.useRouter = () => ({ query: { chainName: "cosmos", tab }, push: jest.fn() });

      render(<DashboardPage />);

      expect(screen.getByText("Needs your signature")).toBeInTheDocument();
      expect(screen.getByTestId("list-user-cliqs")).toBeInTheDocument();
      expect(screen.getByTestId("find-multisig-form")).toBeInTheDocument();
    },
  );

  describe("not connected", () => {
    beforeEach(() => {
      mockWallet = { ...connectedWallet(), walletInfo: null };
    });

    it("shows the shared connect prompt, Open by address and a Guides link", () => {
      render(<DashboardPage />);

      expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
      expect(
        screen.getByText("Connect your wallet to see signatures waiting for you."),
      ).toBeInTheDocument();
      expect(screen.getByText("Open by address")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Read the Guides" })).toHaveAttribute(
        "href",
        "/cosmos/get-started",
      );
    });

    it("does not mount the inbox, Your CLIQs or Validators", () => {
      render(<DashboardPage />);

      expect(screen.queryByText("Needs your signature")).not.toBeInTheDocument();
      expect(screen.queryByTestId("list-user-cliqs")).not.toBeInTheDocument();
      expect(screen.queryByText("Validators")).not.toBeInTheDocument();
      expect(mockGetAssociatedValidators).not.toHaveBeenCalled();
    });
  });

  describe("states", () => {
    it("chain not ready: header renders and the inbox slot shows 3 skeleton rows", () => {
      mockChain.nodeAddress = "";

      render(<DashboardPage />);

      expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
      const loading = screen.getByLabelText("Loading signatures waiting for you");
      expect(loading.children).toHaveLength(3);
      expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    });

    it("loading: shows the skeleton, not the caught-up line", () => {
      Object.assign(mockPending, { isLoading: true, hasLoaded: false });

      render(<DashboardPage />);

      expect(screen.getByLabelText("Loading signatures waiting for you")).toBeInTheDocument();
      expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    });
  });

  describe("Validators section", () => {
    it("is not rendered when no validator is detected", async () => {
      render(<DashboardPage />);

      await waitFor(() => expect(mockGetAssociatedValidators).toHaveBeenCalled());
      expect(screen.queryByText("Validators")).not.toBeInTheDocument();
    });

    it("lists a detected validator with its Manage Validator link", async () => {
      mockGetAssociatedValidators.mockResolvedValue([
        { address: "cosmos1me", validator: { moniker: "Alpha" } },
      ]);

      render(<DashboardPage />);

      expect(await screen.findByText("Validators")).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Manage Validator/i })).toHaveAttribute(
        "href",
        "/cosmos/validator?address=cosmos1me",
      );
    });

    it("failed CLIQ lookup shows the corrected copy, which no longer sends users to Settings", async () => {
      mockGetDbUserMultisigs.mockRejectedValue(new Error("db down"));

      render(<DashboardPage />);

      expect(
        await screen.findByText("Could not load CLIQ-based validators. Retry."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Verify your wallet in Settings/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
