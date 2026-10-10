/**
 * Withdraw Address Test
 *
 * File: __tests__/components/validator-withdraw-address.test.tsx
 *
 * The withdraw address folded into Rewards as one line (WithdrawAddressCard):
 *   - "Paid to <address> [copy] [Change]" on ONE line: the fact "same as operator account" /
 *     "custom address" is the label's title and a screen-reader-only phrase, not a second line
 *   - Change reveals the input and the submit; Cancel folds it back and clears it
 *   - the wiring did not change: Confirm is off until an address is typed (and while read-only,
 *     even with an address already typed), and in CLIQ mode it creates the same
 *     set-withdraw-address CLIQ transaction as before
 *
 * Nothing here touches a chain: the CLIQ transaction creator is mocked; the real message helper runs.
 *
 * Priority: P0
 */

// jest.setup.js stubs the cosmjs encoding package; address validation needs the real bech32 helpers.
jest.unmock("@cosmjs/encoding");

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WithdrawAddressCard from "@/components/dataViews/ValidatorDashboard/WithdrawAddressCard";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction } from "@/lib/validatorTx";
import { MsgTypeUrls } from "@/types/txMsg";

const OPERATOR_ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
// A valid bech32 address (checksum included): the form validates what is typed
const OTHER = "testcore1yg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zt63zj4"; // synthetic: twenty 0x22 bytes

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
      gasPrice: "0.0625utestcore",
      explorerLinks: {},
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

jest.mock("@/lib/validatorTx", () => ({
  ...jest.requireActual("@/lib/validatorTx"),
  createCliqTransaction: jest.fn(),
}));

const validator = {
  operatorAddress: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
  delegatorAddress: OPERATOR_ACCOUNT,
  moniker: "Tokns.fi",
} as ValidatorInfo;

type Props = Partial<React.ComponentProps<typeof WithdrawAddressCard>>;
const renderCard = (props: Props = {}) =>
  render(
    <WithdrawAddressCard validator={validator} withdrawAddress={OPERATOR_ACCOUNT} {...props} />,
  );

const change = () => screen.getByRole("button", { name: /^Change/ });
const input = () => screen.getByLabelText("New Withdraw Address");

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDirectSigner.mockReset();
  (createCliqTransaction as jest.Mock).mockResolvedValue({ success: true, txId: "7" });
});

describe("WithdrawAddress one-line view: P0", () => {
  it("reads 'Paid to' with the address, a copy button and Change, and no input yet", () => {
    renderCard();

    expect(screen.getByText("Paid to")).toBeInTheDocument();
    expect(screen.getByTitle(OPERATOR_ACCOUNT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy withdraw address/ })).toBeInTheDocument();
    expect(change()).toBeEnabled();
    expect(screen.queryByLabelText("New Withdraw Address")).not.toBeInTheDocument();
  });

  it("notes when the address is the operator account, and when it is a custom one", () => {
    const { unmount } = renderCard();
    expect(screen.getByTitle("Same as operator account")).toHaveTextContent("Paid to");
    expect(screen.getByText(/same as operator account/)).toHaveClass("sr-only");
    unmount();

    renderCard({ withdrawAddress: OTHER });
    expect(screen.getByTitle("Custom address")).toHaveTextContent("Paid to");
    expect(screen.getByText(/custom address/)).toHaveClass("sr-only");
    expect(screen.queryByText(/same as operator account/)).not.toBeInTheDocument();
  });

  it("is one line: no second line of text under the row, the fact is not visible text", () => {
    const { container } = renderCard();

    expect(container.querySelectorAll("p")).toHaveLength(0);
    const row = screen.getByText("Paid to").parentElement as HTMLElement;
    expect(container.firstElementChild?.children).toHaveLength(1); // only the row, until Change
    expect(row).toContainElement(screen.getByTitle(OPERATOR_ACCOUNT));
    expect(row).toContainElement(change());
    // the sr-only phrase sits inside a positioned label, so it cannot escape a scroll box
    expect(screen.getByTitle("Same as operator account")).toHaveClass("relative");
  });

  it("in CLIQ mode the Change button says the change goes via the CLIQ", () => {
    renderCard({ isCliqMode: true, cliqAddress: OTHER });

    expect(change()).toHaveTextContent("(via CLIQ)");
  });
});

describe("WithdrawAddress edit form: P0", () => {
  it("Change reveals the input and the submit, hides Change, and keeps the address line", () => {
    renderCard();

    fireEvent.click(change());

    expect(input()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled(); // nothing typed yet
    expect(screen.queryByRole("button", { name: /^Change/ })).not.toBeInTheDocument();
    expect(screen.getByTitle(OPERATOR_ACCOUNT)).toBeInTheDocument();
  });

  it("Confirm turns on once an address is typed; Cancel folds the form back and clears it", () => {
    renderCard();
    fireEvent.click(change());

    fireEvent.change(input(), { target: { value: OTHER } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New Withdraw Address")).not.toBeInTheDocument();
    fireEvent.click(change());
    expect(input()).toHaveValue("");
  });

  it("read-only turns the input, Confirm and Cancel off", () => {
    renderCard({ readOnly: true });
    fireEvent.click(change());

    expect(input()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  // With nothing typed Confirm is already off, so the test above cannot see whether readOnly is in
  // Confirm's own disabled rule. Read-only really does arrive late: the dashboard turns it on when
  // the CLIQ membership check finishes, which can be after Change was opened and an address typed.
  it("Confirm goes off when read-only turns on after an address was typed", () => {
    const { rerender } = renderCard();
    fireEvent.click(change());
    fireEvent.change(input(), { target: { value: OTHER } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();

    rerender(
      <WithdrawAddressCard validator={validator} withdrawAddress={OPERATOR_ACCOUNT} readOnly />,
    );

    expect(input()).toHaveValue(OTHER); // the typed address is still there
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("in CLIQ mode Create Transaction goes off, and sends nothing, once read-only turns on", () => {
    const { rerender } = renderCard({ isCliqMode: true, cliqAddress: OTHER });
    fireEvent.click(change());
    fireEvent.change(input(), { target: { value: OTHER } });
    expect(screen.getByRole("button", { name: "Create Transaction" })).toBeEnabled();

    rerender(
      <WithdrawAddressCard
        validator={validator}
        withdrawAddress={OPERATOR_ACCOUNT}
        isCliqMode
        cliqAddress={OTHER}
        readOnly
      />,
    );

    const create = screen.getByRole("button", { name: "Create Transaction" });
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("in CLIQ mode Create Transaction creates the set-withdraw-address CLIQ transaction", async () => {
    renderCard({ isCliqMode: true, cliqAddress: OTHER });
    fireEvent.click(change());
    fireEvent.change(input(), { target: { value: OTHER } });

    fireEvent.click(screen.getByRole("button", { name: "Create Transaction" }));

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(call.cliqAddress).toBe(OTHER);
    expect(call.memo).toBe(`Set withdraw address to ${OTHER.slice(0, 12)}...`);
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].typeUrl).toBe(MsgTypeUrls.SetWithdrawAddress);
    expect(call.messages[0].value).toEqual({
      delegatorAddress: OPERATOR_ACCOUNT,
      withdrawAddress: OTHER,
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/tx/${OTHER}/transaction/7`));
  });
});

describe("WithdrawAddress while the submit is in flight: P0", () => {
  it("Confirm, Cancel and the input are off while the change is being signed, and Confirm comes back after", async () => {
    let finishSigner!: (signer: unknown) => void;
    mockGetDirectSigner.mockReturnValue(
      new Promise((resolve) => {
        finishSigner = resolve;
      }),
    );
    renderCard();
    fireEvent.click(change());
    fireEvent.change(input(), { target: { value: OTHER } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const busy = await screen.findByRole("button", { name: /Updating/ });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(input()).toBeDisabled();
    expect(mockGetDirectSigner).toHaveBeenCalledTimes(1);

    finishSigner(null); // no signer: the submit ends with an error toast, nothing was sent
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});
