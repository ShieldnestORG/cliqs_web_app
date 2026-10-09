/**
 * Validator Dashboard Test
 *
 * File: __tests__/components/validator-dashboard.test.tsx
 *
 * The orchestrating component of /[chainName]/validator:
 *   - the "Acting as" band states solo / CLIQ / read-only mode, directly under the page H1
 *   - while jailed, the identity card (which hosts Unjail) is first in its row
 *   - the CLIQ upgrade upsell is never shown to people already running through a CLIQ
 *   - the not-a-validator state is titled "No validator found for this wallet"
 *
 * Nothing here touches a chain: the data fetchers, the membership lookup and every child card are mocked.
 *
 * Priority: P1
 */

// jest.setup.js stubs the cosmjs encoding package; the component needs the real bech32 helpers.
jest.unmock("@cosmjs/encoding");
// jest.setup.js replaces the dashboard with a stub; this file tests the real one.
jest.unmock("@/components/dataViews/ValidatorDashboard");

import { render, screen, waitFor } from "@testing-library/react";
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
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletInfo: { address: WALLET, pubKey: "pk" },
    loading: {},
    connectKeplr: jest.fn(),
    connectLedger: jest.fn(),
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

jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorIdentityCard", () => () => (
  <div data-testid="identity-card" />
));
jest.mock("@/components/dataViews/ValidatorDashboard/PendingRewardsCard", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorPerformanceCard", () => () => (
  <div data-testid="performance-card" />
));
jest.mock("@/components/dataViews/ValidatorDashboard/WithdrawAddressCard", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorCommandsCard", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/ValidatorDelegatorsCard", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/ProposalViewer", () => () => <div />);
jest.mock("@/components/dataViews/ValidatorDashboard/CliqUpgradeCTA", () => () => (
  <div data-testid="cliq-upgrade-cta" />
));

const dashboardData = (jailed = false) => ({
  validator: {
    operatorAddress: VALOPER,
    delegatorAddress: WALLET,
    moniker: "Tokns.fi",
    jailed,
  },
  commission: [],
  selfDelegationRewards: [],
  withdrawAddress: WALLET,
  signingInfo: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = {};
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

  it("is the first block of the loaded dashboard, ahead of the identity card", async () => {
    const { container } = render(<ValidatorDashboard />);

    const band = await screen.findByText(/^Acting as /);
    expect(container.firstElementChild?.firstElementChild?.contains(band)).toBe(true);
    const all = Array.from(document.body.querySelectorAll("*"));
    expect(all.indexOf(band)).toBeLessThan(all.indexOf(screen.getByTestId("identity-card")));
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
  it("puts the identity card first in its row while the validator is jailed", async () => {
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(dashboardData(true));
    render(<ValidatorDashboard />);

    const slot = (await screen.findByTestId("identity-card")).parentElement as HTMLElement;
    expect(slot).toHaveClass("order-first");
  });

  it("adds no ordering override when the validator is not jailed", async () => {
    render(<ValidatorDashboard />);

    const slot = (await screen.findByTestId("identity-card")).parentElement as HTMLElement;
    expect(slot).not.toHaveClass("order-first");
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
});

describe("ValidatorDashboard: not a validator: P1", () => {
  it('is titled "No validator found for this wallet"', async () => {
    (getValidatorDashboardData as jest.Mock).mockResolvedValue(null);
    render(<ValidatorDashboard />);

    expect(await screen.findByText("No validator found for this wallet")).toBeInTheDocument();
    expect(screen.queryByText("Not a Validator")).not.toBeInTheDocument();
  });
});
