/**
 * Signature inbox (Home > "Needs your signature")
 *
 * File: __tests__/features/signature-inbox.test.tsx
 *
 * Covers the inbox on Home, the data it reads from PendingTransactionsContext
 * (needs-me filter, de-duplicated CLIQs, the Ledger gate) and the Ledger rows in
 * "Your CLIQs". Nothing here signs or broadcasts; wallet functions are mocks that
 * must never be called by these screens.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardPage from "@/pages/[chainName]/dashboard";
import {
  dispatchTransactionStatusChanged,
  PendingTransactionsProvider,
  usePendingTransactionsContext,
  type PendingTransactionsData,
} from "@/context/PendingTransactionsContext";

const ME = "cosmos1me";
const OTHER = "cosmos1other";

jest.mock("@/components/dataViews/ListMultisigTxs", () =>
  jest.requireActual("@/components/dataViews/ListMultisigTxs"),
);

// A stable chain object: the real ChainsContext keeps one, and checkValidators re-runs
// whenever `chain` changes identity.
const mockChain = {
  registryName: "cosmos",
  chainDisplayName: "Cosmos Hub",
  chainId: "cosmoshub-4",
  addressPrefix: "cosmos",
  nodeAddress: "https://rpc.cosmos.network",
};
// Tests that switch chain point this at another object; beforeEach puts it back.
let mockCurrentChain = mockChain;
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({ chain: mockCurrentChain }),
}));

let mockWallet: Record<string, unknown> = {};
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => mockWallet,
}));

const mockGetUserSettings = jest.fn();
jest.mock("@/lib/settingsStorage", () => ({
  getUserSettings: () => mockGetUserSettings(),
  updateUserSettings: jest.fn(),
}));

const mockGetDbUserMultisigs = jest.fn();
const mockGetPendingDbTxs = jest.fn();
jest.mock("@/lib/api", () => ({
  getDbUserMultisigs: (...args: unknown[]) => mockGetDbUserMultisigs(...args),
  getPendingDbTxs: (...args: unknown[]) => mockGetPendingDbTxs(...args),
}));

jest.mock("@/lib/validatorHelpers", () => ({
  getAssociatedValidators: jest.fn().mockResolvedValue([]),
}));

// The page and ListUserCliqs read this hook; the context tests below use the real provider.
let mockPending: Record<string, unknown> = {};
jest.mock("@/lib/hooks/usePendingTransactions", () => ({
  usePendingTransactions: () => mockPending,
}));

const keplr = { type: "Keplr", address: ME, pubKey: "pk-me" };
const ledger = { type: "Ledger", address: ME, pubKey: "pk-me" };

const wallet = (walletInfo: unknown, extra: Record<string, unknown> = {}) => ({
  walletInfo,
  loading: {},
  isConnecting: false,
  isVerified: false,
  isVerifying: false,
  verificationSignature: null,
  verify: jest.fn().mockResolvedValue(null),
  connectKeplr: jest.fn(),
  connectLedger: jest.fn(),
  ...extra,
});

const makeTx = (id: string, signers: string[]) => ({
  id,
  dataJSON: "{}",
  txHash: null,
  status: "pending" as const,
  signatures: signers.map((address) => ({ address, bodyBytes: "b", signature: "s" })),
});

const withNeedsMe = (tx: ReturnType<typeof makeTx>) => ({
  ...tx,
  needsMe: !tx.signatures.some(({ address }) => address === ME),
});

const pendingData = (overrides: Record<string, unknown> = {}) => ({
  hasPendingTransactions: false,
  totalPendingCount: 0,
  needsMyCount: 0,
  multisigsWithPending: [],
  cliqs: [],
  isLoading: false,
  hasLoaded: true,
  error: null,
  refresh: jest.fn(),
  ...overrides,
});

const txHrefs = () =>
  screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.includes("/transaction/")));

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentChain = mockChain;
  // dbTxFromJson logs every parse; keep the test output readable.
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: false });
  mockWallet = wallet(keplr);
  mockPending = pendingData();
  mockGetDbUserMultisigs.mockResolvedValue({ created: [], belonged: [] });
  mockGetPendingDbTxs.mockResolvedValue([]);
});

describe("Home inbox rows", () => {
  const twoCliqs = () =>
    pendingData({
      hasPendingTransactions: true,
      totalPendingCount: 3,
      needsMyCount: 2,
      cliqs: [
        { address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 },
        { address: "cosmos1cliqb0123456789012345678901234567890", threshold: 1, memberCount: 2 },
      ],
      multisigsWithPending: [
        {
          address: "cosmos1cliqa",
          pendingCount: 2,
          needsMeCount: 1,
          transactions: [
            withNeedsMe(makeTx("older-a", [OTHER])),
            withNeedsMe(makeTx("signed-a", [ME])),
          ],
        },
        {
          address: "cosmos1cliqb0123456789012345678901234567890",
          pendingCount: 1,
          needsMeCount: 1,
          transactions: [withNeedsMe(makeTx("only-b", []))],
        },
      ],
    });

  it("lists only transactions that need my signature in the main list", () => {
    mockPending = twoCliqs();
    render(<DashboardPage />);

    const hrefs = txHrefs();
    expect(hrefs).toEqual([
      "/cosmos/cosmos1cliqa/transaction/older-a",
      "/cosmos/cosmos1cliqb0123456789012345678901234567890/transaction/only-b",
    ]);
    expect(screen.getByText("2 waiting for you")).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("each row is one link that ends in Review and sign, and names its CLIQ", () => {
    mockPending = twoCliqs();
    render(<DashboardPage />);

    const row = screen.getByRole("link", { name: /Treasury/ });
    expect(row).toHaveAttribute("href", "/cosmos/cosmos1cliqa/transaction/older-a");
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).getAllByText("Review and sign").length).toBeGreaterThan(0);
    // A CLIQ without a name falls back to its truncated address.
    expect(screen.getAllByText("cosmos1c...567890").length).toBeGreaterThan(0);
  });

  it("puts the later transaction of a CLIQ first", () => {
    mockPending = pendingData({
      cliqs: [{ address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 }],
      multisigsWithPending: [
        {
          address: "cosmos1cliqa",
          pendingCount: 2,
          needsMeCount: 2,
          transactions: [withNeedsMe(makeTx("first", [])), withNeedsMe(makeTx("second", []))],
        },
      ],
    });
    render(<DashboardPage />);

    expect(txHrefs()).toEqual([
      "/cosmos/cosmos1cliqa/transaction/second",
      "/cosmos/cosmos1cliqa/transaction/first",
    ]);
  });

  it("moves transactions I already signed into a collapsed Waiting on other signers list", () => {
    mockPending = twoCliqs();
    render(<DashboardPage />);

    const trigger = screen.getByRole("button", { name: "Waiting on other signers (1)" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(txHrefs()).not.toContain("/cosmos/cosmos1cliqa/transaction/signed-a");

    fireEvent.click(trigger);

    expect(txHrefs()).toContain("/cosmos/cosmos1cliqa/transaction/signed-a");
    // A row I already signed has nothing left to do, so it carries no Review and sign.
    const signedRow = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.endsWith("/signed-a"));
    expect(within(signedRow as HTMLElement).queryByText("Review and sign")).toBeNull();
  });

  it("hides Waiting on other signers when there is nothing in it", () => {
    mockPending = pendingData({
      cliqs: [{ address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 }],
      multisigsWithPending: [
        {
          address: "cosmos1cliqa",
          pendingCount: 1,
          needsMeCount: 1,
          transactions: [withNeedsMe(makeTx("only", []))],
        },
      ],
    });
    render(<DashboardPage />);

    expect(screen.queryByText(/Waiting on other signers/)).not.toBeInTheDocument();
  });

  it("says You're all caught up when loaded with nothing waiting", () => {
    render(<DashboardPage />);

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.getByText("0 waiting for you")).toBeInTheDocument();
  });

  it("an error is shown as an error with Retry, never as all caught up", () => {
    const refresh = jest.fn();
    mockPending = pendingData({ error: "Network down", hasLoaded: false, refresh });
    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load signatures waiting for you",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("some CLIQs failed but others loaded: keeps the loaded rows, with a warning and Retry", () => {
    const refresh = jest.fn();
    mockPending = pendingData({
      error: "Could not load pending transactions for 1 CLIQ.",
      refresh,
      cliqs: [{ address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 }],
      multisigsWithPending: [
        {
          address: "cosmos1cliqa",
          pendingCount: 1,
          needsMeCount: 1,
          transactions: [withNeedsMe(makeTx("good", []))],
        },
      ],
    });
    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Some CLIQs could not be loaded.");
    expect(txHrefs()).toEqual(["/cosmos/cosmos1cliqa/transaction/good"]);
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("some CLIQs failed and the loaded ones have nothing waiting: a warning, never all caught up", () => {
    mockPending = pendingData({
      error: "Could not load pending transactions for 1 CLIQ.",
      cliqs: [{ address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 }],
    });
    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Some CLIQs could not be loaded.");
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("transactions with enough signatures are ready to broadcast, in the main list", () => {
    mockPending = pendingData({
      cliqs: [{ address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 }],
      multisigsWithPending: [
        {
          address: "cosmos1cliqa",
          pendingCount: 4,
          needsMeCount: 1,
          transactions: [
            // Both signed, nothing broadcast yet.
            withNeedsMe(makeTx("ready", [ME, OTHER])),
            // Enough signatures from others, but not mine yet.
            withNeedsMe(makeTx("ready-unsigned", [OTHER, "cosmos1third"])),
            // One short.
            withNeedsMe(makeTx("one-short", [ME])),
            // The same signer twice is still one signer.
            withNeedsMe(makeTx("twice", [ME, ME])),
          ],
        },
      ],
    });
    render(<DashboardPage />);

    expect(txHrefs()).toEqual([
      "/cosmos/cosmos1cliqa/transaction/ready-unsigned",
      "/cosmos/cosmos1cliqa/transaction/ready",
    ]);
    for (const id of ["ready", "ready-unsigned"]) {
      const row = screen
        .getAllByRole("link")
        .find((a) => a.getAttribute("href")?.endsWith(`/${id}`)) as HTMLElement;
      expect(within(row).getAllByText("Review and broadcast").length).toBeGreaterThan(0);
      expect(within(row).queryByText("Review and sign")).toBeNull();
    }
    // Only the two below-threshold transactions wait on others.
    expect(
      screen.getByRole("button", { name: "Waiting on other signers (2)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 waiting for you")).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("sign-in on and not verified: asks to verify and adds no verify() call of its own", async () => {
    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    const verify = jest.fn().mockResolvedValue(null);
    mockWallet = wallet(keplr, { verify });
    mockPending = pendingData({ hasLoaded: false });
    render(<DashboardPage />);

    expect(
      screen.getByText(
        "Verify your identity to see signatures waiting for you. Use Verify in Your CLIQs below.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    // The only verify() entry points are the existing checkValidators prompt (one call, on
    // mount) and the button inside ListUserCliqs (mocked out here); the inbox adds none.
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
  });

  it("Ledger with sign-in on: explains it cannot load, instead of asking to verify", () => {
    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    mockWallet = wallet(ledger);
    mockPending = pendingData({ hasLoaded: false });
    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Turn it off in Settings, or use Keplr");
    expect(screen.queryByText(/Verify your identity/)).not.toBeInTheDocument();
  });
});

describe("PendingTransactionsContext data", () => {
  const Probe = () => {
    const data = usePendingTransactionsContext();
    return (
      <div>
        <p data-testid="loaded">{String(data.hasLoaded)}</p>
        <p data-testid="needs-my-count">{data.needsMyCount}</p>
        <p data-testid="cliqs">
          {data.cliqs
            .map((c) => `${c.address}:${c.name}:${c.threshold}/${c.memberCount}`)
            .join("|")}
        </p>
        <p data-testid="needs-me">
          {data.multisigsWithPending
            .flatMap((m) => m.transactions.map((tx) => `${tx.id}=${tx.needsMe}`))
            .join("|")}
        </p>
      </div>
    );
  };

  // The wallet (pk-me) is one of the three members; membership is what makes a signature "mine".
  const membersJSON = (...pubkeys: string[]) =>
    JSON.stringify({
      value: { threshold: "2", pubkeys: pubkeys.map((value) => ({ type: "k", value })) },
    });
  const pubkeyJSON = membersJSON("pk-me", "pk-x", "pk-y");
  const cliqA = { address: "cosmos1cliqa", name: "Treasury", pubkeyJSON };
  const cliqB = { address: "cosmos1cliqb", name: null, pubkeyJSON };

  const renderProvider = () =>
    render(
      <PendingTransactionsProvider>
        <Probe />
      </PendingTransactionsProvider>,
    );

  // The latest value the real provider exposes.
  let latest: PendingTransactionsData;
  const Capture = () => {
    latest = usePendingTransactionsContext();
    return null;
  };
  const renderCapture = () =>
    render(
      <PendingTransactionsProvider>
        <Capture />
      </PendingTransactionsProvider>,
    );

  // The real provider feeds the real Home through the mocked hook.
  const Bridge = () => {
    latest = usePendingTransactionsContext();
    mockPending = { ...latest };
    return <DashboardPage />;
  };
  const renderHome = () =>
    render(
      <PendingTransactionsProvider>
        <Bridge />
      </PendingTransactionsProvider>,
    );

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  beforeEach(() => {
    // The same CLIQ comes back as both created and belonged: it must appear once.
    mockGetDbUserMultisigs.mockResolvedValue({ created: [cliqA], belonged: [cliqA, cliqB] });
    mockGetPendingDbTxs.mockImplementation(async (address: string) =>
      address === "cosmos1cliqa"
        ? [makeTx("t-needs", [OTHER]), makeTx("t-signed", [ME, OTHER])]
        : [makeTx("t-b", [])],
    );
  });

  it("exposes de-duplicated CLIQs with name, threshold and member count", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(screen.getByTestId("cliqs")).toHaveTextContent(
      "cosmos1cliqa:Treasury:2/3|cosmos1cliqb:undefined:2/3",
    );
  });

  it("marks needsMe per transaction and counts only those lacking my signature", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(screen.getByTestId("needs-me")).toHaveTextContent(
      "t-needs=true|t-signed=false|t-b=true",
    );
    expect(screen.getByTestId("needs-my-count")).toHaveTextContent("2");
  });

  it("Keplr is served whatever the sign-in setting says (once verified)", async () => {
    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    mockWallet = wallet(keplr, { isVerified: true, verificationSignature: { signature: "sig" } });
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(mockGetDbUserMultisigs).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signature: { signature: "sig" } }),
    );
  });

  it("a CLIQ whose pending list fails to load is an error, never all caught up", async () => {
    mockGetPendingDbTxs.mockRejectedValue(new Error("pending down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    renderHome();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Some CLIQs could not be loaded."),
    );
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("a creator who is not a member is never asked to sign, a member is", async () => {
    const outsider = {
      address: "cosmos1cliqx",
      name: "Created for others",
      pubkeyJSON: membersJSON("pk-x", "pk-y", "pk-z"),
    };
    mockGetDbUserMultisigs.mockResolvedValue({ created: [outsider], belonged: [cliqA] });
    mockGetPendingDbTxs.mockImplementation(async (address: string) => [
      makeTx(address === "cosmos1cliqx" ? "t-outsider" : "t-member", [OTHER]),
    ]);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(screen.getByTestId("needs-me")).toHaveTextContent("t-outsider=false|t-member=true");
    expect(screen.getByTestId("needs-my-count")).toHaveTextContent("1");
  });

  it("Home lists a non-member creator's transaction as waiting, with nothing to sign", async () => {
    const outsider = {
      address: "cosmos1cliqx",
      name: "Created for others",
      pubkeyJSON: membersJSON("pk-x", "pk-y", "pk-z"),
    };
    mockGetDbUserMultisigs.mockResolvedValue({ created: [outsider], belonged: [cliqA] });
    mockGetPendingDbTxs.mockImplementation(async (address: string) => [
      makeTx(address === "cosmos1cliqx" ? "t-outsider" : "t-member", [OTHER]),
    ]);
    renderHome();

    await waitFor(() => expect(txHrefs()).toEqual(["/cosmos/cosmos1cliqa/transaction/t-member"]));
    fireEvent.click(screen.getByRole("button", { name: "Waiting on other signers (1)" }));
    const row = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.endsWith("/t-outsider")) as HTMLElement;
    expect(within(row).queryByText("Review and sign")).toBeNull();
    expect(within(row).queryByText("Review and broadcast")).toBeNull();
  });

  it("a fully signed transaction reaches Home as ready to broadcast, and the count stays 0", async () => {
    // Threshold "2" is a string in real pubkey JSON; Home has to compare it as a number.
    mockGetDbUserMultisigs.mockResolvedValue({ created: [], belonged: [cliqA] });
    mockGetPendingDbTxs.mockResolvedValue([makeTx("t-ready", [ME, OTHER])]);
    renderHome();

    await waitFor(() => expect(txHrefs()).toEqual(["/cosmos/cosmos1cliqa/transaction/t-ready"]));
    expect(screen.getAllByText("Review and broadcast").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Waiting on other signers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    // The badge counts signatures I still owe, not broadcasts.
    expect(latest.needsMyCount).toBe(0);
  });

  it("one CLIQ whose pending list fails leaves the other CLIQ's row on Home", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetPendingDbTxs.mockImplementation(async (address: string) => {
      if (address === "cosmos1cliqa") throw new Error("pending down");
      return [makeTx("t-b", [])];
    });
    renderHome();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Some CLIQs could not be loaded."),
    );
    expect(txHrefs()).toEqual(["/cosmos/cosmos1cliqb/transaction/t-b"]);
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("a failed load followed by a load that finds no CLIQs clears the error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetDbUserMultisigs
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ created: [], belonged: [] });
    renderCapture();

    await waitFor(() => expect(latest.error).toBe("boom"));
    await act(async () => {
      await latest.refresh();
    });

    expect(latest.error).toBeNull();
    expect(latest.hasLoaded).toBe(true);
    expect(latest.cliqs).toEqual([]);
  });

  it("Home: a CLIQ that failed to load and is then gone leaves all caught up, with no alert", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    // Home's own validator check also lists CLIQs, so the list stays up to date for both callers.
    let belonged = [cliqA];
    mockGetDbUserMultisigs.mockImplementation(async () => ({ created: [], belonged }));
    mockGetPendingDbTxs.mockRejectedValue(new Error("pending down"));
    renderHome();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    belonged = [];
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: /Retry/i }));

    await waitFor(() => expect(screen.getByText("You're all caught up.")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("one owner per data set (wallet and chain)", () => {
    const BOB = "cosmos1bob";
    const keplrBob = { type: "Keplr", address: BOB, pubKey: "pk-bob" };
    const aliceCliq = {
      address: "cosmos1alicecliq",
      name: "Alice CLIQ",
      pubkeyJSON: membersJSON("pk-me", "pk-x", "pk-y"),
    };
    const bobCliq = {
      address: "cosmos1bobcliq",
      name: "Bob CLIQ",
      pubkeyJSON: membersJSON("pk-bob", "pk-x", "pk-y"),
    };
    const listFor = (address: string) => ({
      created: [],
      belonged: [address === BOB ? bobCliq : aliceCliq],
    });
    type Listing = ReturnType<typeof listFor>;
    const rerenderProvider = (view: ReturnType<typeof renderProvider>) =>
      view.rerender(
        <PendingTransactionsProvider>
          <Probe />
        </PendingTransactionsProvider>,
      );

    beforeEach(() => {
      mockGetPendingDbTxs.mockImplementation(async (address: string) => [
        makeTx(`tx-${address}`, []),
      ]);
    });

    it("switching wallet clears the old wallet's rows at once, then shows the new wallet's", async () => {
      const bobGate = deferred<Listing>();
      mockGetDbUserMultisigs.mockImplementation((_chain: unknown, who: { address: string }) =>
        who.address === BOB ? bobGate.promise : Promise.resolve(listFor(who.address)),
      );
      const view = renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1alicecliq"),
      );
      expect(screen.getByTestId("needs-my-count")).toHaveTextContent("1");

      mockWallet = wallet(keplrBob);
      rerenderProvider(view);

      // Bob's list is still loading: nothing of Alice's may show.
      expect(screen.getByTestId("loaded")).toHaveTextContent("false");
      expect(screen.getByTestId("cliqs")).toBeEmptyDOMElement();
      expect(screen.getByTestId("needs-me")).toBeEmptyDOMElement();
      expect(screen.getByTestId("needs-my-count")).toHaveTextContent("0");

      await act(async () => {
        bobGate.resolve(listFor(BOB));
      });
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));
      expect(screen.getByTestId("cliqs")).not.toHaveTextContent("cosmos1alicecliq");
      expect(screen.getByTestId("needs-my-count")).toHaveTextContent("1");
    });

    it("a slow fetch for the old wallet does not block the new wallet's, and is ignored when it lands", async () => {
      const aliceGate = deferred<Listing>();
      mockGetDbUserMultisigs.mockImplementation((_chain: unknown, who: { address: string }) =>
        who.address === BOB ? Promise.resolve(listFor(BOB)) : aliceGate.promise,
      );
      const view = renderProvider();
      await waitFor(() => expect(mockGetDbUserMultisigs).toHaveBeenCalledTimes(1));

      mockWallet = wallet(keplrBob);
      rerenderProvider(view);

      // Alice's fetch is still running, yet Bob's rows arrive.
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));

      await act(async () => {
        aliceGate.resolve(listFor(ME));
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq");
      expect(screen.getByTestId("cliqs")).not.toHaveTextContent("cosmos1alicecliq");
      expect(screen.getByTestId("needs-me")).not.toHaveTextContent("tx-cosmos1alicecliq");
    });

    it("a refresh timer set before the wallet changed does not fetch for the old wallet", async () => {
      mockGetDbUserMultisigs.mockImplementation(async (_chain: unknown, who: { address: string }) =>
        listFor(who.address),
      );
      const view = renderProvider();
      await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));

      // The provider schedules this refresh 300 ms out, holding Alice's wallet.
      act(() => dispatchTransactionStatusChanged());
      mockWallet = wallet(keplrBob);
      rerenderProvider(view);
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));
      mockGetDbUserMultisigs.mockClear();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
      });
      expect(mockGetDbUserMultisigs).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ address: ME }),
      );
    });

    it("a slow empty CLIQ list for the old wallet is ignored when it lands", async () => {
      const aliceGate = deferred<{ created: never[]; belonged: never[] }>();
      mockGetDbUserMultisigs.mockImplementation((_chain: unknown, who: { address: string }) =>
        who.address === BOB ? Promise.resolve(listFor(BOB)) : aliceGate.promise,
      );
      const view = renderProvider();
      await waitFor(() => expect(mockGetDbUserMultisigs).toHaveBeenCalledTimes(1));

      mockWallet = wallet(keplrBob);
      rerenderProvider(view);
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));

      await act(async () => {
        aliceGate.resolve({ created: [], belonged: [] });
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq");
      expect(screen.getByTestId("loaded")).toHaveTextContent("true");
    });

    it("a slow pending list for the old wallet is ignored when it lands", async () => {
      const alicePending = deferred<ReturnType<typeof makeTx>[]>();
      mockGetDbUserMultisigs.mockImplementation(async (_chain: unknown, who: { address: string }) =>
        listFor(who.address),
      );
      mockGetPendingDbTxs.mockImplementation((address: string) =>
        address === aliceCliq.address
          ? alicePending.promise
          : Promise.resolve([makeTx(`tx-${address}`, [])]),
      );
      const view = renderProvider();
      await waitFor(() =>
        expect(mockGetPendingDbTxs).toHaveBeenCalledWith(aliceCliq.address, expect.anything()),
      );

      mockWallet = wallet(keplrBob);
      rerenderProvider(view);
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));

      await act(async () => {
        alicePending.resolve([makeTx("tx-late", [])]);
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq");
      expect(screen.getByTestId("cliqs")).not.toHaveTextContent("cosmos1alicecliq");
      expect(screen.getByTestId("needs-me")).not.toHaveTextContent("tx-late");
    });

    it("a failure of the old wallet's fetch does not become the new wallet's error", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      let rejectAlice!: (reason: Error) => void;
      mockGetDbUserMultisigs.mockImplementation((_chain: unknown, who: { address: string }) =>
        who.address === BOB
          ? Promise.resolve(listFor(BOB))
          : new Promise((_resolve, reject) => {
              rejectAlice = reject;
            }),
      );
      const view = renderCapture();
      await waitFor(() => expect(mockGetDbUserMultisigs).toHaveBeenCalledTimes(1));

      mockWallet = wallet(keplrBob);
      view.rerender(
        <PendingTransactionsProvider>
          <Capture />
        </PendingTransactionsProvider>,
      );
      await waitFor(() => expect(latest.hasLoaded).toBe(true));

      await act(async () => {
        rejectAlice(new Error("alice down"));
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(latest.error).toBeNull();
      expect(latest.hasLoaded).toBe(true);
      expect(latest.cliqs.map((c) => c.address)).toEqual(["cosmos1bobcliq"]);
    });

    it("switching chain clears the old chain's rows at once", async () => {
      const otherChain = { ...mockChain, chainId: "other-1", registryName: "other" };
      const otherGate = deferred<Listing>();
      mockGetDbUserMultisigs.mockImplementation((chainArg: { chainId: string }) =>
        chainArg.chainId === "other-1" ? otherGate.promise : Promise.resolve(listFor(ME)),
      );
      const view = renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1alicecliq"),
      );

      mockCurrentChain = otherChain;
      rerenderProvider(view);

      expect(screen.getByTestId("loaded")).toHaveTextContent("false");
      expect(screen.getByTestId("cliqs")).toBeEmptyDOMElement();
      expect(screen.getByTestId("needs-my-count")).toHaveTextContent("0");
      await waitFor(() =>
        expect(mockGetDbUserMultisigs).toHaveBeenLastCalledWith(
          otherChain,
          expect.objectContaining({ address: ME }),
        ),
      );

      await act(async () => {
        otherGate.resolve(listFor(BOB));
      });
      await waitFor(() => expect(screen.getByTestId("cliqs")).toHaveTextContent("cosmos1bobcliq"));
    });
  });

  it("Ledger rows are cleared once the sign-in setting is on and the list refreshes", async () => {
    mockWallet = wallet(ledger);
    renderCapture();
    await waitFor(() => expect(latest.hasLoaded).toBe(true));
    expect(latest.cliqs).toHaveLength(2);
    expect(latest.needsMyCount).toBe(2);

    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    await act(async () => {
      await latest.refresh();
    });

    expect(latest.cliqs).toEqual([]);
    expect(latest.needsMyCount).toBe(0);
    expect(latest.multisigsWithPending).toEqual([]);
    expect(latest.hasLoaded).toBe(false);
  });

  it("Ledger gate is lifted when the sign-in setting is off", async () => {
    mockWallet = wallet(ledger);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(mockGetDbUserMultisigs).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: ME, pubkey: "pk-me" }),
    );
    expect(screen.getByTestId("needs-my-count")).toHaveTextContent("2");
  });

  it("Ledger gate stays shut when the sign-in setting is on", async () => {
    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    // Even a stale "verified" flag must not let a Ledger through: only Keplr can verify.
    mockWallet = wallet(ledger, { isVerified: true, verificationSignature: { signature: "old" } });
    renderProvider();

    // Give any (wrongly) started fetch a chance to land before asserting that none happened.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetDbUserMultisigs).not.toHaveBeenCalled();
    expect(screen.getByTestId("loaded")).toHaveTextContent("false");
    expect(screen.getByTestId("cliqs")).toHaveTextContent("");
    expect(screen.getByTestId("needs-my-count")).toHaveTextContent("0");
  });
});

describe("Your CLIQs rows (ListUserCliqs)", () => {
  // The global setup mocks ListUserCliqs; this test needs the real one.
  const RealListUserCliqs = jest.requireActual("@/components/dataViews/ListUserCliqs").default;

  const renderList = () =>
    render(
      <TooltipProvider>
        <RealListUserCliqs />
      </TooltipProvider>,
    );

  const contextRows = [
    { address: "cosmos1cliqa", name: "Treasury", threshold: 2, memberCount: 3 },
    { address: "cosmos1cliqb", threshold: 1, memberCount: 2 },
  ];

  it("Ledger with sign-in off: shows the context's CLIQ rows, and no dead-end message", () => {
    mockWallet = wallet(ledger);
    mockPending = pendingData({
      cliqs: contextRows,
      multisigsWithPending: [
        { address: "cosmos1cliqa", pendingCount: 1, needsMeCount: 1, transactions: [] },
      ],
    });
    renderList();

    expect(screen.getByRole("link", { name: /Treasury/ })).toHaveAttribute(
      "href",
      "/cosmos/cosmos1cliqa",
    );
    expect(screen.getByText("cosmos1cliqb")).toBeInTheDocument();
    expect(screen.getByText("1 waiting for you")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.queryByText(/Ledger can.t verify/)).not.toBeInTheDocument();
    expect(mockGetDbUserMultisigs).not.toHaveBeenCalled();
  });

  it("Ledger with sign-in on: shows the message and no rows", () => {
    mockGetUserSettings.mockReturnValue({ requireWalletSignInForCliqs: true });
    mockWallet = wallet(ledger);
    mockPending = pendingData({ cliqs: contextRows });
    renderList();

    expect(screen.getByText(/Ledger can.t verify identity/)).toBeInTheDocument();
    expect(screen.queryByText("cosmos1cliqb")).not.toBeInTheDocument();
  });

  it("Ledger with sign-in off and no CLIQs: offers Create your first CLIQ and open-by-address", () => {
    mockWallet = wallet(ledger);
    mockPending = pendingData({ cliqs: [] });
    renderList();

    expect(screen.getByRole("button", { name: /Create your first CLIQ/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open one you were added to" })).toHaveAttribute(
      "href",
      "#open-by-address",
    );
  });

  it("Keplr: created and belonged are merged and de-duplicated, with no show-all switch", async () => {
    const pubkeyJSON = JSON.stringify({ value: { threshold: "2", pubkeys: [{}, {}, {}] } });
    const a = { id: "1", chainId: "c", address: "cosmos1cliqa", name: "Treasury", pubkeyJSON };
    const b = { id: "2", chainId: "c", address: "cosmos1cliqb", name: null, pubkeyJSON };
    mockGetDbUserMultisigs.mockResolvedValue({ created: [a], belonged: [a, b] });
    mockWallet = wallet(keplr);
    renderList();

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText(/Show all Cliqs/i)).not.toBeInTheDocument();
  });

  it("Keplr: switching account drops the old account's CLIQs and loads the new account's", async () => {
    const row = (address: string, name: string) => ({
      id: address,
      chainId: "c",
      address,
      name,
      pubkeyJSON: JSON.stringify({ value: { threshold: "2", pubkeys: [{}, {}, {}] } }),
    });
    const bob = { type: "Keplr", address: "cosmos1bob", pubKey: "pk-bob" };
    let resolveBob!: (value: unknown) => void;
    mockGetDbUserMultisigs.mockImplementation((_chain: unknown, who: { address: string }) =>
      who.address === bob.address
        ? new Promise((resolve) => {
            resolveBob = resolve;
          })
        : Promise.resolve({ created: [row("cosmos1alicecliq", "Alice CLIQ")], belonged: [] }),
    );
    mockWallet = wallet(keplr);
    const view = renderList();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Alice CLIQ/ })).toBeInTheDocument(),
    );

    mockWallet = wallet(bob);
    view.rerender(
      <TooltipProvider>
        <RealListUserCliqs />
      </TooltipProvider>,
    );

    // Bob's list is still loading: Alice's CLIQ must not stay on screen.
    expect(screen.queryByRole("link", { name: /Alice CLIQ/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockGetDbUserMultisigs).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ address: "cosmos1bob" }),
      ),
    );

    await act(async () => {
      resolveBob({ created: [row("cosmos1bobcliq", "Bob CLIQ")], belonged: [] });
    });
    await waitFor(() => expect(screen.getByRole("link", { name: /Bob CLIQ/ })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /Alice CLIQ/ })).not.toBeInTheDocument();
  });
});
