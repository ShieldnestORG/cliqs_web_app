/**
 * Validator Dashboard Test
 *
 * File: __tests__/components/validator-dashboard.test.tsx
 *
 * The orchestrating component of /[chainName]/validator:
 *   - the "Acting as" sentence states solo / CLIQ / read-only mode; it leads the context row
 *     (left of the network control), right under the identity strip
 *   - while jailed, the jailed alert (which hosts Unjail) is the very first block, above the strip
 *   - the page reads top to bottom as Rewards, Performance, Governance, Stakers, Manage
 *   - the CLIQ upgrade upsell is never shown to people already running through a CLIQ
 *   - the not-a-validator state is titled "No validator found for this wallet"
 *   - every card that can sign is handed the same mode props it always got (isCliqMode,
 *     cliqAddress, readOnly; the jailed alert also the signing info), and the connect buttons
 *     are bound to connectKeplr / connectLedger. The signing fence cannot see JSX wiring, so
 *     these tests are what pins it.
 *
 * Until 2026-10-10 the band was the first block of the page and the jailed state was an
 * `order-first` class on the identity card's grid slot.
 *
 * Nothing here touches a chain: the data fetchers, the membership lookup and every child card are
 * mocked; the card mocks record the props they were handed.
 *
 * Priority: P1 (P0 for the wiring tests)
 */

// jest.setup.js stubs the cosmjs encoding package; the component needs the real bech32 helpers.
jest.unmock("@cosmjs/encoding");
// jest.setup.js replaces the dashboard with a stub; this file tests the real one.
jest.unmock("@/components/dataViews/ValidatorDashboard");

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ValidatorDashboard from "@/components/dataViews/ValidatorDashboard";
import { getValidatorDashboardData } from "@/lib/validatorHelpers";
import { getDbUserMultisigs } from "@/lib/api";

const WALLET = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
const CLIQ = "testcore1zc53xg3ml9hxe9n6q6tjkcs9t3mxqt9awgxsj0";
const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";

let mockQuery: Record<string, string> = {};
jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: mockQuery, pathname: "/tx/validator" }),
}));

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "tx",
      chainId: "coreum-testnet-1",
      chainDisplayName: "TX",
      addressPrefix: "testcore",
      nodeAddress: "https://rpc.invalid:26657",
      restEndpoint: "https://rest.invalid",
      explorerLinks: {},
    },
    chains: { mainnets: new Map(), testnets: new Map() },
    chainsDispatch: jest.fn(),
  }),
}));

const mockVerify = jest.fn().mockResolvedValue("sig");
const mockConnectKeplr = jest.fn();
const mockConnectLedger = jest.fn();
let mockLoading: { keplr?: boolean; ledger?: boolean } = {};
let mockWalletInfo: { address: string; pubKey: string } | null = { address: WALLET, pubKey: "pk" };
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletInfo: mockWalletInfo,
    loading: mockLoading,
    connectKeplr: mockConnectKeplr,
    connectLedger: mockConnectLedger,
    verificationSignature: "sig",
    verify: mockVerify,
  }),
}));

jest.mock("@/lib/validatorHelpers", () => ({
  getValidatorDashboardData: jest.fn(),
  delegatorToValidatorAddress: jest.fn(() => "testcorevaloper1expected"),
  getAssociatedValidators: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/api", () => ({ getDbUserMultisigs: jest.fn() }));
jest.mock("@/lib/multisigHelpers", () => ({
  ensureChainMultisigInDb: jest.fn().mockResolvedValue({ multisig: {} }),
}));
jest.mock("@/components/DevTools/NetworkToggle", () => () => <div data-testid="network-toggle" />);

// The cards that can sign record the props the dashboard hands them (see "what the cards are handed").
const mockJailedProps = jest.fn();
const mockRewardsProps = jest.fn();
const mockWithdrawProps = jest.fn();
const mockProposalProps = jest.fn();
const mockCommandsProps = jest.fn();
jest.mock("@/components/dataViews/ValidatorDashboard/JailedAlert", () => (props: unknown) => {
  mockJailedProps(props);
  return <div data-testid="jailed-alert" />;
});
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorIdentityCard", () => () => (
  <div data-testid="identity-card" />
));
jest.mock(
  "@/components/dataViews/ValidatorDashboard/PendingRewardsCard",
  () => (props: unknown) => {
    mockRewardsProps(props);
    return <div />;
  },
);
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorPerformanceCard", () => () => (
  <div data-testid="performance-card" />
));
jest.mock(
  "@/components/dataViews/ValidatorDashboard/WithdrawAddressCard",
  () => (props: unknown) => {
    mockWithdrawProps(props);
    return <div />;
  },
);
jest.mock(
  "@/components/dataViews/ValidatorDashboard/ValidatorCommandsCard",
  () => (props: unknown) => {
    mockCommandsProps(props);
    return <div />;
  },
);
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorDelegatorsCard", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/ProposalViewer", () => (props: unknown) => {
  mockProposalProps(props);
  return <div />;
});
jest.mock("@/components/dataViews/ValidatorDashboard/CliqUpgradeCTA", () => () => (
  <div data-testid="cliq-upgrade-cta" />
));

// Commission and self-delegation rewards carry DIFFERENT, non-empty amounts, so a swap of the two
// props is visible (two empty arrays are equal, which let a swap pass).
const COMMISSION = [{ denom: "utestcore", amount: "1500000000000000000" }];
const SELF_REWARDS = [{ denom: "utestcore", amount: "2700000000000000000" }];

const dashboardData = (jailed = false, signingInfo: unknown = null) => ({
  validator: {
    operatorAddress: VALOPER,
    delegatorAddress: WALLET,
    moniker: "Tokns.fi",
    jailed,
  },
  commission: COMMISSION,
  selfDelegationRewards: SELF_REWARDS,
  withdrawAddress: WALLET,
  signingInfo,
});

/** The props of the most recent render of a recording card mock. */
const lastProps = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0];

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = {};
  mockLoading = {};
  mockWalletInfo = { address: WALLET, pubKey: "pk" };
  (getValidatorDashboardData as jest.Mock).mockResolvedValue(dashboardData());
  (getDbUserMultisigs as jest.Mock).mockResolvedValue({
    created: [],
    belonged: [{ address: CLIQ }],
  });
});

describe("ValidatorDashboard: Acting as band: P1", () => {
  it("solo mode states that actions sign with the connected wallet", async () => {
    render(<ValidatorDashboard />);

    expect(
      await screen.findByText("Acting as your wallet. Actions sign with your connected wallet."),
    ).toBeInTheDocument();
  });

  it("with no wallet connected (linked ?address= lookup) never claims to act as your wallet", async () => {
    mockWalletInfo = null;
    mockQuery = { address: CLIQ };
    render(<ValidatorDashboard />);

    expect(
      await screen.findByText("No wallet connected. Connect a wallet to act on this validator."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Acting as your wallet/)).not.toBeInTheDocument();
  });

  it("is the first block of the context row, ahead of the network control", async () => {
    render(<ValidatorDashboard />);

    const band = await screen.findByText(/^Acting as /);
    const row = screen.getByTestId("context-row");
    expect(row.firstElementChild?.contains(band)).toBe(true);
    const all = Array.from(document.body.querySelectorAll("*"));
    expect(all.indexOf(band)).toBeLessThan(all.indexOf(screen.getByTestId("network-toggle")));
  });

  it("sits right under the identity strip when the validator is not jailed", async () => {
    const { container } = render(<ValidatorDashboard />);

    await screen.findByText(/^Acting as /);
    const blocks = Array.from(container.firstElementChild?.children ?? []);
    expect(blocks[0]).toBe(screen.getByTestId("identity-card"));
    expect(blocks[1]).toBe(screen.getByTestId("context-row"));
  });

  it("CLIQ mode names the short CLIQ address and the sign-then-broadcast flow", async () => {
    mockQuery = { address: CLIQ };
    render(<ValidatorDashboard />);

    const band = await screen.findByText(/^Acting as CLIQ /);
    expect(band).toHaveTextContent(
      "Actions create a transaction for this CLIQ; its members sign it, then one member broadcasts.",
    );
    expect(band).not.toHaveTextContent(CLIQ);
    expect(band).toHaveTextContent(CLIQ.slice(0, 10));
  });

  it("read-only CLIQ mode shows the read-only text inside the band as a warning line", async () => {
    mockQuery = { address: CLIQ };
    (getDbUserMultisigs as jest.Mock).mockResolvedValue({ created: [], belonged: [] });
    render(<ValidatorDashboard />);

    const warning = await screen.findByText(/could not be verified as a member of this CLIQ/i);
    expect(warning.closest("p")).toHaveClass("text-warning");
    // moved, not duplicated: the old stand-alone card title is gone
    expect(screen.queryByText("Read-Only Mode")).not.toBeInTheDocument();
    expect(screen.getAllByText(/could not be verified as a member/i)).toHaveLength(1);
  });

  it("shows no read-only text when the connected wallet is a verified member", async () => {
    mockQuery = { address: CLIQ };
    render(<ValidatorDashboard />);

    await screen.findByText(/^Acting as CLIQ /);
    await waitFor(() => expect(getDbUserMultisigs).toHaveBeenCalled());
    expect(screen.queryByText(/could not be verified as a member/i)).not.toBeInTheDocument();
  });
});

describe("ValidatorDashboard: jailed layout: P1", () => {
  it("puts the jailed alert first, above the identity strip, while the validator is jailed", async () => {
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(dashboardData(true));
    const { container } = render(<ValidatorDashboard />);

    const alert = await screen.findByTestId("jailed-alert");
    expect(container.firstElementChild?.firstElementChild).toBe(alert);
    const all = Array.from(document.body.querySelectorAll("*"));
    expect(all.indexOf(alert)).toBeLessThan(all.indexOf(screen.getByTestId("identity-card")));
  });

  it("shows no jailed alert when the validator is not jailed", async () => {
    render(<ValidatorDashboard />);

    await screen.findByTestId("identity-card");
    expect(screen.queryByTestId("jailed-alert")).not.toBeInTheDocument();
  });
});

describe("ValidatorDashboard: section order: P1", () => {
  it("reads Rewards, Performance, Governance, Stakers, Manage, each under a scale rule heading", async () => {
    render(<ValidatorDashboard />);

    await screen.findByTestId("identity-card");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Rewards", "Performance", "Governance", "Stakers", "Manage"]);
  });
});

describe("ValidatorDashboard: CLIQ upsell: P1", () => {
  it("shows the Create Validator CLIQ upsell in solo mode", async () => {
    render(<ValidatorDashboard />);

    expect(await screen.findByTestId("cliq-upgrade-cta")).toBeInTheDocument();
  });

  it("never shows the upsell in CLIQ mode", async () => {
    mockQuery = { address: CLIQ };
    render(<ValidatorDashboard />);

    await screen.findByText(/^Acting as CLIQ /);
    expect(screen.queryByTestId("cliq-upgrade-cta")).not.toBeInTheDocument();
  });

  it("never shows the upsell when a CLIQ address is not a validator", async () => {
    mockQuery = { address: CLIQ };
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(null);
    render(<ValidatorDashboard />);

    await screen.findByText("No validator found for this wallet");
    expect(screen.queryByTestId("cliq-upgrade-cta")).not.toBeInTheDocument();
  });
});

describe("ValidatorDashboard: not a validator: P1", () => {
  it('is titled "No validator found for this wallet"', async () => {
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(null);
    render(<ValidatorDashboard />);

    expect(await screen.findByText("No validator found for this wallet")).toBeInTheDocument();
    expect(screen.queryByText("Not a Validator")).not.toBeInTheDocument();
  });
});

describe("ValidatorDashboard: what the cards are handed: P0", () => {
  const SIGNING_INFO = { tombstoned: false, jailedUntil: "later" };
  const actingCards = [
    ["JailedAlert", mockJailedProps],
    ["PendingRewardsCard", mockRewardsProps],
    ["WithdrawAddressCard", mockWithdrawProps],
    ["ProposalViewer", mockProposalProps],
    ["ValidatorCommandsCard", mockCommandsProps],
  ] as const;

  const jailedData = () => dashboardData(true, SIGNING_INFO);

  it.each(actingCards)(
    "solo mode: %s acts as the connected wallet, not read-only",
    async (_n, mock) => {
      (getValidatorDashboardData as jest.Mock).mockResolvedValue(jailedData());
      render(<ValidatorDashboard />);

      await screen.findByTestId("performance-card");
      expect(lastProps(mock)).toEqual(
        expect.objectContaining({
          isCliqMode: false,
          cliqAddress: undefined,
          readOnly: false,
          onTransactionComplete: expect.any(Function),
        }),
      );
    },
  );

  it.each(actingCards)(
    "CLIQ mode, verified member: %s gets the CLIQ and is not read-only",
    async (_n, mock) => {
      mockQuery = { address: CLIQ };
      (getValidatorDashboardData as jest.Mock).mockResolvedValue(jailedData());
      render(<ValidatorDashboard />);

      await screen.findByTestId("performance-card");
      await waitFor(() => expect(getDbUserMultisigs).toHaveBeenCalled());
      expect(lastProps(mock)).toEqual(
        expect.objectContaining({ isCliqMode: true, cliqAddress: CLIQ, readOnly: false }),
      );
    },
  );

  it.each(actingCards)("CLIQ mode, not a member: %s is read-only", async (_n, mock) => {
    mockQuery = { address: CLIQ };
    (getDbUserMultisigs as jest.Mock).mockResolvedValue({ created: [], belonged: [] });
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(jailedData());
    render(<ValidatorDashboard />);

    await screen.findByTestId("performance-card");
    await waitFor(() => expect(lastProps(mock).readOnly).toBe(true));
    expect(lastProps(mock)).toEqual(
      expect.objectContaining({ isCliqMode: true, cliqAddress: CLIQ, readOnly: true }),
    );
  });

  it("the jailed alert gets the validator and the chain's signing info, as the identity card did", async () => {
    const data = jailedData();
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(data);
    render(<ValidatorDashboard />);

    await screen.findByTestId("jailed-alert");
    expect(lastProps(mockJailedProps).validator).toBe(data.validator);
    expect(lastProps(mockJailedProps).signingInfo).toBe(SIGNING_INFO);
  });

  it("the cards get the validator, the rewards and the withdraw address of the loaded data", async () => {
    const data = dashboardData();
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(data);
    render(<ValidatorDashboard />);

    await screen.findByTestId("performance-card");
    // each by identity, so the commission prop cannot carry the self-delegation rewards or the
    // other way round; the fixtures differ so the identity check is not satisfied by an equal value
    expect(data.commission).not.toEqual(data.selfDelegationRewards);
    expect(lastProps(mockRewardsProps).validator).toBe(data.validator);
    expect(lastProps(mockRewardsProps).commission).toBe(data.commission);
    expect(lastProps(mockRewardsProps).selfDelegationRewards).toBe(data.selfDelegationRewards);
    expect(lastProps(mockRewardsProps).commission[0].amount).toBe("1500000000000000000");
    expect(lastProps(mockRewardsProps).selfDelegationRewards[0].amount).toBe("2700000000000000000");
    expect(lastProps(mockWithdrawProps)).toEqual(
      expect.objectContaining({ validator: data.validator, withdrawAddress: data.withdrawAddress }),
    );
    expect(lastProps(mockProposalProps).data).toBe(data);
    expect(lastProps(mockCommandsProps).validator).toBe(data.validator);
  });
});

describe("ValidatorDashboard: connect your wallet: P0", () => {
  beforeEach(() => {
    mockWalletInfo = null;
  });

  it("Keplr calls connectKeplr and nothing else", async () => {
    render(<ValidatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: /Keplr/ }));

    expect(mockConnectKeplr).toHaveBeenCalledTimes(1);
    expect(mockConnectLedger).not.toHaveBeenCalled();
  });

  it("Ledger calls connectLedger and nothing else", async () => {
    render(<ValidatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: /Ledger/ }));

    expect(mockConnectLedger).toHaveBeenCalledTimes(1);
    expect(mockConnectKeplr).not.toHaveBeenCalled();
  });

  it.each([["Keplr"], ["Ledger"]])("both buttons are off while %s is connecting", async (which) => {
    mockLoading = { [which.toLowerCase()]: true };
    render(<ValidatorDashboard />);

    expect(await screen.findByRole("button", { name: /Keplr/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ledger/ })).toBeDisabled();
  });
});
