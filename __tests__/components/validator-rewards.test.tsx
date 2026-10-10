/**
 * Pending Rewards Test
 *
 * File: __tests__/components/validator-rewards.test.tsx
 *
 * The Rewards rows of the validator dashboard (PendingRewardsCard): the commission and the
 * self-delegation rewards each have their own Claim button next to their amount, and one
 * "Claim all" sits under them. The layout moved on 2026-10-10; the wiring did not:
 *   - Claim all  -> claimCommission(true)   (rewards + commission in one transaction)
 *   - Claim (commission)   -> claimCommission(false)  (commission only)
 *   - Claim (rewards)      -> claimRewards            (rewards only)
 *   - each keeps its disabled rule (read-only, busy, or nothing to claim)
 *
 * One primary per view: exactly one coral button (`bg-primary-gradient`) shows in the card, or none:
 * "Claim all" when both amounts exist, only that row's Claim when one does, nothing coral when
 * there is nothing to claim. The primary is coral in BOTH signing modes (since 2026-10-10 gold is
 * the testnet colour, so nothing here is bronze); the CLIQ path is told apart by its "Create: "
 * labels, not by a second button colour. Every other button in the card is `outline`.
 *
 * Nothing here touches a chain: the signing client is a recording stub, and the CLIQ
 * transaction creator is mocked. The real message helpers run.
 *
 * Priority: P0
 */

// jest.setup.js stubs these cosmjs packages; the message helpers need the real encoding.
jest.unmock("@cosmjs/encoding");
jest.unmock("@cosmjs/proto-signing");
jest.unmock("@cosmjs/amino");

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PendingRewardsCard from "@/components/dataViews/ValidatorDashboard/PendingRewardsCard";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction } from "@/lib/validatorTx";
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";
const OPERATOR_ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
const CLIQ = "testcore1zc53xg3ml9hxe9n6q6tjkcs9t3mxqt9awgxsj0";

const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush, query: {}, pathname: "/tx/validator" }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn(() => "loading-toast"),
    dismiss: jest.fn(),
  },
}));

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "tx",
      chainId: "coreum-testnet-1",
      chainDisplayName: "TX",
      addressPrefix: "testcore",
      nodeAddress: "https://rpc.invalid:26657",
      denom: "utestcore",
      displayDenom: "TESTCORE",
      displayDenomExponent: 6,
      gasPrice: "0.0625utestcore",
      explorerLinks: { tx: "", account: "" },
    },
  }),
}));

const mockGetDirectSigner = jest.fn();
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletInfo: { address: OPERATOR_ACCOUNT },
    getDirectSigner: mockGetDirectSigner,
  }),
}));

// Keep the real message helpers; replace only the part that writes to the database.
jest.mock("@/lib/validatorTx", () => ({
  ...jest.requireActual("@/lib/validatorTx"),
  createCliqTransaction: jest.fn(),
}));

const validator = {
  operatorAddress: VALOPER,
  delegatorAddress: OPERATOR_ACCOUNT,
  moniker: "Tokns.fi",
} as ValidatorInfo;

// A DecCoin amount is the base amount times 10^18: 1,500,000 utestcore = 1.5 TESTCORE.
const dec = (base: string) => [{ denom: "utestcore", amount: `${base}${"0".repeat(18)}` }];
const NONE: never[] = [];

type Props = Partial<React.ComponentProps<typeof PendingRewardsCard>>;
const renderCard = (props: Props = {}) =>
  render(
    <PendingRewardsCard
      validator={validator}
      commission={dec("1500000")}
      selfDelegationRewards={dec("2500000")}
      {...props}
    />,
  );

const claimAll = () => screen.getByRole("button", { name: /^(Create: )?Claim all$/ });
const claimCommissionButton = () =>
  screen.getByRole("button", { name: /^(Create: )?Claim commission$/ });
const claimRewardsButton = () =>
  screen.getByRole("button", { name: /^(Create: )?Claim self-delegation rewards$/ });

/** Stubs the signing client; returns the list of {address, typeUrls} it was asked to sign. */
function stubSigningClient() {
  const sent: { address: string; typeUrls: string[] }[] = [];
  jest.spyOn(SigningStargateClient, "connectWithSigner").mockResolvedValue({
    signAndBroadcast: async (address: string, msgs: { typeUrl: string }[]) => {
      sent.push({ address, typeUrls: msgs.map((m) => m.typeUrl) });
      return { code: 0, transactionHash: "TESTHASH", rawLog: "" };
    },
  } as unknown as SigningStargateClient);
  return sent;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDirectSigner.mockResolvedValue({});
});
afterEach(() => jest.restoreAllMocks());

describe("PendingRewards claim buttons, direct signing: P0", () => {
  it("Claim all signs the rewards and the commission together, as the operator account", async () => {
    const sent = stubSigningClient();
    renderCard();

    fireEvent.click(claimAll());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].address).toBe(OPERATOR_ACCOUNT);
    expect(sent[0].typeUrls).toEqual([
      MsgTypeUrls.WithdrawDelegatorReward,
      MsgTypeUrls.WithdrawValidatorCommission,
    ]);
  });

  it("the commission Claim signs the commission only", async () => {
    const sent = stubSigningClient();
    renderCard();

    fireEvent.click(claimCommissionButton());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].typeUrls).toEqual([MsgTypeUrls.WithdrawValidatorCommission]);
  });

  it("the rewards Claim signs the self-delegation rewards only", async () => {
    const sent = stubSigningClient();
    renderCard();

    fireEvent.click(claimRewardsButton());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].typeUrls).toEqual([MsgTypeUrls.WithdrawDelegatorReward]);
  });

  it("refreshes the dashboard after a claim", async () => {
    stubSigningClient();
    const onTransactionComplete = jest.fn();
    renderCard({ onTransactionComplete });

    fireEvent.click(claimAll());

    await waitFor(() => expect(onTransactionComplete).toHaveBeenCalledTimes(1));
  });
});

describe("PendingRewards claim buttons, CLIQ mode: P0", () => {
  beforeEach(() => {
    (createCliqTransaction as jest.Mock).mockResolvedValue({ success: true, txId: "42" });
  });

  const renderCliq = (props: Props = {}) =>
    renderCard({ isCliqMode: true, cliqAddress: CLIQ, ...props });

  it("Create: Claim all creates one CLIQ transaction with the rewards and the commission", async () => {
    renderCliq();

    fireEvent.click(claimAll());

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(call.cliqAddress).toBe(CLIQ);
    expect(call.memo).toBe("Claim commission + rewards from validator");
    expect(call.messages.map((m: { typeUrl: string }) => m.typeUrl)).toEqual([
      MsgTypeUrls.WithdrawDelegatorReward,
      MsgTypeUrls.WithdrawValidatorCommission,
    ]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/tx/${CLIQ}/transaction/42`));
    expect(mockGetDirectSigner).not.toHaveBeenCalled();
  });

  it("the commission button creates a commission-only transaction", async () => {
    renderCliq();

    fireEvent.click(claimCommissionButton());

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(call.memo).toBe("Claim commission from validator");
    expect(call.messages.map((m: { typeUrl: string }) => m.typeUrl)).toEqual([
      MsgTypeUrls.WithdrawValidatorCommission,
    ]);
  });

  it("the rewards button creates a rewards-only transaction", async () => {
    renderCliq();

    fireEvent.click(claimRewardsButton());

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(call.memo).toBe("Claim staking rewards from validator");
    expect(call.messages.map((m: { typeUrl: string }) => m.typeUrl)).toEqual([
      MsgTypeUrls.WithdrawDelegatorReward,
    ]);
  });
});

describe("PendingRewards disabled rules: P0", () => {
  it("shows each amount next to its own button", () => {
    renderCard();

    expect(screen.getByText("Validator commission")).toBeInTheDocument();
    expect(screen.getByText("Self-delegation rewards")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(claimCommissionButton()).toBeEnabled();
    expect(claimRewardsButton()).toBeEnabled();
    expect(claimAll()).toBeEnabled();
  });

  it("read-only disables all three buttons", () => {
    renderCard({ readOnly: true });

    expect(claimAll()).toBeDisabled();
    expect(claimCommissionButton()).toBeDisabled();
    expect(claimRewardsButton()).toBeDisabled();
  });

  it("with commission only: no Claim all, the rewards button is off", () => {
    renderCard({ selfDelegationRewards: NONE });

    expect(screen.queryByRole("button", { name: /Claim all/ })).not.toBeInTheDocument();
    expect(claimCommissionButton()).toBeEnabled();
    expect(claimRewardsButton()).toBeDisabled();
  });

  it("with rewards only: no Claim all, the commission button is off", () => {
    renderCard({ commission: NONE });

    expect(screen.queryByRole("button", { name: /Claim all/ })).not.toBeInTheDocument();
    expect(claimCommissionButton()).toBeDisabled();
    expect(claimRewardsButton()).toBeEnabled();
  });

  it("with nothing to claim: says so and both buttons are off", () => {
    renderCard({ commission: NONE, selfDelegationRewards: NONE });

    expect(screen.getByText("No pending rewards to claim at this time.")).toBeInTheDocument();
    expect(claimCommissionButton()).toBeDisabled();
    expect(claimRewardsButton()).toBeDisabled();
  });

  it("disables every button while a claim is running, so a second claim cannot start", async () => {
    let finish: (value: unknown) => void = () => {};
    jest.spyOn(SigningStargateClient, "connectWithSigner").mockResolvedValue({
      signAndBroadcast: () => new Promise((resolve) => (finish = resolve)),
    } as unknown as SigningStargateClient);
    renderCard();

    fireEvent.click(claimCommissionButton());

    // Claim all shows "Claiming..." while a commission claim runs, so count the buttons instead
    await waitFor(() => expect(claimRewardsButton()).toBeDisabled());
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => expect(button).toBeDisabled());
    finish({ code: 0, transactionHash: "H", rawLog: "" });
    await waitFor(() => expect(claimRewardsButton()).toBeEnabled());
  });
});

describe("PendingRewards: one coral button per view: P2", () => {
  // The primary look is the coral sheen (bg-primary-gradient); every other button is `outline`
  // (the quiet raised pill: bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015] + shadow-btn-quiet). Names lose the CLIQ "Create: " prefix.
  const buttons = () => screen.getAllByRole("button");
  const nameOf = (button: HTMLElement) =>
    (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/^Create: /, "");
  const withClass = (cls: string) =>
    buttons()
      .filter((button) => button.classList.contains(cls))
      .map(nameOf);
  const bronzeClasses = () =>
    buttons().flatMap((button) => Array.from(button.classList).filter((c) => /bronze/.test(c)));

  const states: [string, Props, string[]][] = [
    ["both amounts", {}, ["Claim all"]],
    ["commission only", { selfDelegationRewards: NONE }, ["Claim commission"]],
    ["rewards only", { commission: NONE }, ["Claim self-delegation rewards"]],
    ["nothing to claim", { commission: NONE, selfDelegationRewards: NONE }, []],
  ];
  const modes: [string, Props][] = [
    ["direct mode", {}],
    ["CLIQ mode", { isCliqMode: true, cliqAddress: CLIQ }],
  ];
  const cases = modes.flatMap(([mode, modeProps]) =>
    states.map(
      ([state, props, expected]) => [mode, state, { ...modeProps, ...props }, expected] as const,
    ),
  );

  it.each(cases)("%s, %s: only the expected button is coral", (_mode, _state, props, expected) => {
    renderCard(props);

    expect(withClass("bg-primary-gradient")).toEqual(expected);
  });

  it.each(cases)(
    "%s, %s: every other button is outline, and nothing is bronze",
    (_mode, _state, props, expected) => {
      renderCard(props);

      const others = buttons().filter(
        (button) => !button.classList.contains("bg-primary-gradient"),
      );
      expect(others.length + expected.length).toBe(buttons().length);
      for (const button of others) {
        expect(button).toHaveClass(
          "bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]",
          "shadow-btn-quiet",
          "border-border/15",
        );
        expect(button).not.toHaveClass("shadow-btn");
      }
      for (const button of buttons().filter((b) => b.classList.contains("bg-primary-gradient"))) {
        expect(button).toHaveClass("shadow-btn", "hover:shadow-btn-hover");
      }
      expect(bronzeClasses()).toEqual([]);
    },
  );

  it.each(states)(
    "%s: CLIQ mode picks the same coral button as direct mode",
    (_state, props, expected) => {
      const direct = renderCard(props);
      const inDirect = withClass("bg-primary-gradient");
      direct.unmount();

      renderCard({ isCliqMode: true, cliqAddress: CLIQ, ...props });

      expect(withClass("bg-primary-gradient")).toEqual(inDirect);
      expect(inDirect).toEqual(expected);
    },
  );

  it("with nothing to claim there is no coral button and both row buttons are off", () => {
    renderCard({ commission: NONE, selfDelegationRewards: NONE });

    expect(withClass("bg-primary-gradient")).toEqual([]);
    expect(screen.queryByRole("button", { name: /Claim all/ })).not.toBeInTheDocument();
    expect(claimCommissionButton()).toBeDisabled();
    expect(claimRewardsButton()).toBeDisabled();
  });
});
