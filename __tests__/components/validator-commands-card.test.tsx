/**
 * Validator Commands Card + CLIQ Upgrade CTA Test
 *
 * File: __tests__/components/validator-commands-card.test.tsx
 *
 *   - no Vote tile (ProposalViewer already lists proposals with the vote dialog)
 *   - the delegator-side reward tile is "Claim delegation rewards" and keeps its ?type= link
 *   - Delegate / Undelegate / Redelegate links are unchanged
 *   - "Edit validator" is one section heading and one button
 *   - the "Managing via CLIQ" mode line is gone from the card (it lives in the "Acting as" band)
 *   - both CliqUpgradeCTA buttons read "Create Validator CLIQ"
 *
 * Priority: P1
 */

import { fireEvent, render, screen } from "@testing-library/react";
import ValidatorCommandsCard from "@/components/dataViews/ValidatorDashboard/ValidatorCommandsCard";
import CliqUpgradeCTA from "@/components/dataViews/ValidatorDashboard/CliqUpgradeCTA";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { MsgTypeUrls } from "@/types/txMsg";

const CLIQ = "testcore1zc53xg3ml9hxe9n6q6tjkcs9t3mxqt9awgxsj0";

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "tx",
      chainId: "coreum-testnet-1",
      chainDisplayName: "TX",
      addressPrefix: "testcore",
      nodeAddress: "https://rpc.invalid:26657",
      gasPrice: "0.0625utestcore",
      explorerLinks: {},
    },
  }),
}));
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ walletInfo: { address: CLIQ }, getDirectSigner: jest.fn() }),
}));

const validator = {
  operatorAddress: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
  delegatorAddress: "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl",
  moniker: "Tokns.fi",
  identity: "",
  website: "",
  securityContact: "",
  details: "",
  commissionRate: "0.1",
  maxCommissionRate: "0.2",
  maxCommissionChangeRate: "0.01",
  minSelfDelegation: "1",
  jailed: false,
  status: "BONDED",
  tokens: "0",
  delegatorShares: "0",
} as ValidatorInfo;

const typeLink = (type: string) => `/tx/${CLIQ}/transaction/new?type=${encodeURIComponent(type)}`;

describe("ValidatorCommandsCard tiles (CLIQ mode): P1", () => {
  beforeEach(() => {
    render(<ValidatorCommandsCard validator={validator} isCliqMode cliqAddress={CLIQ} />);
  });

  it("has no Vote tile", () => {
    expect(screen.queryByText("Vote")).not.toBeInTheDocument();
    expect(screen.queryByText(/vote on governance proposals/i)).not.toBeInTheDocument();
    expect(document.querySelector(`a[href="${typeLink(MsgTypeUrls.Vote)}"]`)).toBeNull();
  });

  it("relabels the delegator reward tile and keeps its builder link", () => {
    const tile = screen.getByRole("heading", { name: "Claim delegation rewards" });
    expect(tile.closest("a")).toHaveAttribute(
      "href",
      typeLink(MsgTypeUrls.WithdrawDelegatorReward),
    );
    expect(screen.getByText("From any validator this CLIQ delegates to")).toBeInTheDocument();
    expect(screen.queryByText("Withdraw Rewards")).not.toBeInTheDocument();
  });

  it("keeps the Delegate, Undelegate and Redelegate links unchanged", () => {
    expect(screen.getByRole("heading", { name: "Delegate" }).closest("a")).toHaveAttribute(
      "href",
      typeLink(MsgTypeUrls.Delegate),
    );
    expect(screen.getByRole("heading", { name: "Undelegate" }).closest("a")).toHaveAttribute(
      "href",
      typeLink(MsgTypeUrls.Undelegate),
    );
    expect(screen.getByRole("heading", { name: "Redelegate" }).closest("a")).toHaveAttribute(
      "href",
      typeLink(MsgTypeUrls.BeginRedelegate),
    );
  });

  it("no longer carries the muted mode line (moved to the Acting as band)", () => {
    expect(screen.queryByText(/managing via cliq/i)).not.toBeInTheDocument();
  });

  it('shows "Edit validator" as one section heading and one button', () => {
    expect(screen.getAllByText(/edit validator/i)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Edit validator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit validator" })).toBeInTheDocument();
    expect(screen.queryByText("Edit Validator Info")).not.toBeInTheDocument();
  });
});

describe("ValidatorCommandsCard (solo mode): P1", () => {
  it("does not mention Vote or Withdraw Rewards in the explanation", () => {
    render(<ValidatorCommandsCard validator={validator} />);

    expect(screen.queryByText(/\bVote\b/)).not.toBeInTheDocument();
    expect(screen.getByText(/Claim delegation rewards are proposed through a/)).toBeInTheDocument();
  });
});

describe("CliqUpgradeCTA: P1", () => {
  it('labels both buttons "Create Validator CLIQ"', async () => {
    render(<CliqUpgradeCTA />);

    expect(screen.getAllByRole("button", { name: /create validator cliq/i })).toHaveLength(1);
    expect(screen.queryByText("Get Started")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /learn more/i }));
    // the open dialog hides the page behind it from the accessibility tree, so count by text
    expect(await screen.findAllByText("Create Validator CLIQ")).toHaveLength(2);
    expect(screen.queryByText("Get Started")).not.toBeInTheDocument();
  });
});
