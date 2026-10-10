/**
 * Multisig View Route Test
 *
 * File: __tests__/pages/multisig-view.test.tsx
 *
 * Tests for the CLIQ page (/[chainName]/[address]): header, tabs mirrored to ?tab=,
 * one New transaction action, one transactions list, not-found card.
 * Priority: P0
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import MultisigViewPage from "@/pages/[chainName]/[address]/index";

const ADDRESS = "cosmos1test1234567890abcdefghijklmnopqrstuvwxyz";
const PUBKEY = {
  type: "tendermint/PubKeyMultisigThreshold",
  value: {
    threshold: "2",
    pubkeys: [
      { type: "tendermint/PubKeySecp256k1", value: "A8B5KVhRz1oQuV1dguzFdGBhHrIU/I+R/QfBZcbZFWVG" },
      { type: "tendermint/PubKeySecp256k1", value: "AjVTQkyYuUpVwnZw7mj2g8VtCNBYsFhsTqMDJIf4p1jc" },
      { type: "tendermint/PubKeySecp256k1", value: "AuS1mVYWz0A4lCsGKyA+QwM+bW1kHpwM7DOvJLl6Hjjb" },
    ],
  },
};

// The global amino mock returns one address for every key; members need distinct ones.
jest.mock("@cosmjs/amino", () => ({
  isSecp256k1Pubkey: () => true,
  pubkeyToAddress: (pubkey: { value: string }) => `cosmos1member${pubkey.value.slice(0, 6)}`,
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
    },
  }),
}));

// Mock next/router
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockQuery: Record<string, string> = {};
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: {
      chainName: "cosmos",
      address: "cosmos1test1234567890abcdefghijklmnopqrstuvwxyz",
      ...mockQuery,
    },
    pathname: "/[chainName]/[address]",
    push: mockPush,
    replace: mockReplace,
  }),
}));

// The shared mock in jest.setup.js drops `subheader`, which carries the breadcrumb.
jest.mock("@/components/layout/DashboardLayout", () => ({
  __esModule: true,
  default: ({
    children,
    title,
    subheader,
  }: {
    children: React.ReactNode;
    title?: string;
    subheader?: React.ReactNode;
  }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {subheader}
      {children}
    </div>
  ),
}));

// Mock multisig helpers
const mockGetHostedMultisig = jest.fn();
jest.mock("@/lib/multisigHelpers", () => ({
  ensureChainMultisigInDb: jest.fn().mockResolvedValue({
    multisig: {
      id: "mock-multisig-id",
      address: "cosmos1test1234567890abcdefghijklmnopqrstuvwxyz",
    },
    source: "db",
  }),
  getHostedMultisig: (...args: unknown[]) => mockGetHostedMultisig(...args),
}));

let mockMultisigType: "pubkey" | "contract" = "pubkey";
jest.mock("@/lib/hooks/useMultisigType", () => ({
  useMultisigType: () => ({ type: mockMultisigType, isLoading: false, error: null }),
}));

jest.mock("@/components/dataViews/ContractProposalList", () => () => <div>Proposals</div>);
jest.mock("@/components/dataViews/ContractVotePanel", () => () => <div>Vote</div>);
jest.mock("@/components/dataViews/CredentialManagerPanel", () => ({
  CredentialManagerPanel: () => <div>Credentials</div>,
}));

// Mock keplr
jest.mock("@/lib/keplr", () => ({
  getKeplrKey: jest.fn().mockResolvedValue({
    address: "cosmos1test",
    pubKey: new Uint8Array([1, 2, 3]),
  }),
}));

// Mock components
jest.mock("@/components/dataViews/BalancesTable", () => {
  return function MockBalancesTable() {
    return <div data-testid="balances-table">Balances</div>;
  };
});

jest.mock("@/components/dataViews/ListMultisigTxs", () => {
  return function MockListMultisigTxs() {
    return <div data-testid="multisig-txs">Transactions</div>;
  };
});

jest.mock("@/components/dataViews/TransactionPrivacy", () => {
  return function MockTransactionPrivacy() {
    return <div data-testid="transaction-privacy">Privacy</div>;
  };
});

const funded = {
  hosted: "db+chain",
  pubkeyOnDb: PUBKEY,
  accountOnChain: { address: ADDRESS, accountNumber: 1, sequence: 0 },
  explorerLink: "https://explorer.example/account/x",
};
const unfunded = { hosted: "db", pubkeyOnDb: PUBKEY };

describe("Multisig View Route (/[chainName]/[address]): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = {};
    mockMultisigType = "pubkey";
    mockGetHostedMultisig.mockResolvedValue(funded);
  });

  it("should load multisig view page", async () => {
    mockGetHostedMultisig.mockReturnValue(new Promise(() => {}));
    render(<MultisigViewPage />);

    // Should show loading state initially
    expect(await screen.findByText(/Loading your CLIQ/i)).toBeInTheDocument();
  });

  it("header: H1 CLIQ, threshold and Funded badges, copy and explorer controls", async () => {
    render(<MultisigViewPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "CLIQ" })).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Funded")).toBeInTheDocument();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy CLIQ address/i })).toBeInTheDocument();
    expect(screen.getByLabelText("View on explorer")).toHaveAttribute(
      "href",
      "https://explorer.example/account/x",
    );
  });

  it("breadcrumb root is Home and points at the dashboard", async () => {
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/cosmos/dashboard");
  });

  it("has exactly one New transaction action, linking to the new-transaction page", async () => {
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    const links = screen.getAllByRole("link", { name: /New transaction/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", `/cosmos/${ADDRESS}/transaction/new`);
  });

  it("shows tabs Transactions, Members, Balances, Data & Privacy and no Overview or Settings tab", async () => {
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    const names = screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"));
    expect(names).toEqual(["Transactions", "Members (3)", "Balances", "Data & Privacy"]);
  });

  it("mounts the transactions list once, on the default Transactions tab", async () => {
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    expect(screen.getAllByTestId("multisig-txs")).toHaveLength(1);
    expect(screen.queryByTestId("balances-table")).not.toBeInTheDocument();
  });

  it("mirrors the selected tab to ?tab= with a shallow replace", async () => {
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Balances" }));

    expect(mockReplace).toHaveBeenCalledWith(
      {
        pathname: "/[chainName]/[address]",
        query: { chainName: "cosmos", address: ADDRESS, tab: "balances" },
      },
      undefined,
      { shallow: true },
    );
  });

  it("opens the tab named in ?tab=", async () => {
    mockQuery = { tab: "privacy" };
    render(<MultisigViewPage />);

    expect(await screen.findByTestId("transaction-privacy")).toBeInTheDocument();
    expect(screen.queryByTestId("multisig-txs")).not.toBeInTheDocument();
  });

  it("an unknown ?tab= falls back to Transactions", async () => {
    mockQuery = { tab: "overview" };
    render(<MultisigViewPage />);

    expect(await screen.findByTestId("multisig-txs")).toBeInTheDocument();
  });

  it("unfunded CLIQ: Needs funding badge, funding alert, Members tab by default, New transaction disabled", async () => {
    mockGetHostedMultisig.mockResolvedValue(unfunded);
    render(<MultisigViewPage />);

    await screen.findByRole("heading", { level: 1, name: "CLIQ" });
    expect(screen.getByText("Needs funding")).toBeInTheDocument();
    expect(screen.getByText(/needs to be funded/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Members (3)" })).toHaveAttribute(
      "data-state",
      "active",
    );
    const button = screen.getByRole("button", { name: /New transaction/i });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("link", { name: /New transaction/i })).not.toBeInTheDocument();
  });

  it.each(["transactions", "balances", "privacy"])(
    "unfunded CLIQ: the %s tab says it is available once funded",
    async (tab) => {
      mockGetHostedMultisig.mockResolvedValue(unfunded);
      mockQuery = { tab };
      render(<MultisigViewPage />);

      expect(await screen.findByText("Available once this CLIQ is funded.")).toBeInTheDocument();
    },
  );

  it("unfunded CLIQ: the disabled New transaction button explains itself in a tooltip", async () => {
    mockGetHostedMultisig.mockResolvedValue(unfunded);
    render(<MultisigViewPage />);

    const button = await screen.findByRole("button", { name: /New transaction/i });
    fireEvent.focus(button.closest("span") as HTMLElement);
    expect((await screen.findAllByText("Fund this CLIQ first")).length).toBeGreaterThan(0);
  });

  it("not found: Go Home is the primary action and Create a CLIQ is a text link", async () => {
    mockGetHostedMultisig.mockResolvedValue({ hosted: "nowhere" });
    render(<MultisigViewPage />);

    const home = await screen.findByRole("link", { name: "Go Home" });
    expect(home).toHaveAttribute("href", "/cosmos/dashboard");
    const create = screen.getByRole("link", { name: "Create a CLIQ" });
    expect(create).toHaveAttribute("href", "/cosmos/create");
    expect(within(document.body).queryByText(/Create Cliq/)).not.toBeInTheDocument();
  });

  it("should display multisig address", async () => {
    render(<MultisigViewPage />);

    await waitFor(() => {
      expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    });
  });

  it("contract CLIQ: the dashboard gets the same Home > address breadcrumb", async () => {
    mockMultisigType = "contract";
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    render(<MultisigViewPage />);

    const home = await screen.findByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/cosmos/dashboard");
    expect(screen.getByText("cosmos1test1...uvwxyz")).toBeInTheDocument();
  });
});
