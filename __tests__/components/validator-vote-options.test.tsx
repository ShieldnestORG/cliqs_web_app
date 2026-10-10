/**
 * Vote Options Test
 *
 * File: __tests__/components/validator-vote-options.test.tsx
 *
 * The vote dialog of the Governance section (ProposalViewer). The signing fence cannot see this
 * wiring (it hashes the code that calls a wallet, not the JSX that picks the arguments), so this
 * file is what pins it:
 *   - the four option buttons map Yes 1, Abstain 2, No 3, No with Veto 4
 *   - a button votes on the proposal whose "Vote Now" opened the dialog, not another one
 *   - the same arguments reach the message in both modes: a direct vote is signed as the wallet,
 *     a CLIQ vote is proposed as the CLIQ
 *   - every option button is off while read-only and while a vote is in flight
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
import ProposalViewer from "@/components/dataViews/ValidatorDashboard/ProposalViewer";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { createCliqTransaction } from "@/lib/validatorTx";
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";

const WALLET = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
const CLIQ = "testcore1zc53xg3ml9hxe9n6q6tjkcs9t3mxqt9awgxsj0";

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {}, pathname: "/tx/validator" }),
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
      explorerLinks: { tx: "", proposal: "" },
    },
  }),
}));

const mockGetDirectSigner = jest.fn();
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ walletInfo: { address: WALLET }, getDirectSigner: mockGetDirectSigner }),
}));

// Keep the real message helpers; replace only the part that writes to the database.
jest.mock("@/lib/validatorTx", () => ({
  ...jest.requireActual("@/lib/validatorTx"),
  createCliqTransaction: jest.fn(),
}));

const proposal = (id: number, title: string) =>
  ({ proposalId: id, status: 2, content: { title } }) as never;

// Two active proposals with different ids: a button must vote on the one whose dialog is open.
const data = {
  activeProposals: [proposal(47, "Raise the block gas limit"), proposal(52, "Enable IBC hooks")],
  pastProposals: [],
  validatorVotes: {},
  validator: { moniker: "Tokns.fi" },
  votingPowerPercentage: "2.74",
} as unknown as ValidatorDashboardData;

type Props = Partial<React.ComponentProps<typeof ProposalViewer>>;
const renderViewer = (props: Props = {}) => render(<ProposalViewer data={data} {...props} />);

/** Opens the dialog of the nth active proposal (0 = first). */
const openDialog = (n: number) =>
  fireEvent.click(screen.getAllByRole("button", { name: /^Vote Now$/ })[n]);
const option = (label: string) => screen.getByRole("button", { name: label });

const OPTIONS = [
  ["Yes", 1, "YES"],
  ["Abstain", 2, "ABSTAIN"],
  ["No", 3, "NO"],
  ["No with Veto", 4, "NO_WITH_VETO"],
] as const;

/** Stubs the signing client; returns the list of {address, messages} it was asked to sign. */
function stubSigningClient() {
  const sent: { address: string; messages: { typeUrl: string; value: unknown }[] }[] = [];
  jest.spyOn(SigningStargateClient, "connectWithSigner").mockResolvedValue({
    signAndBroadcast: async (address: string, messages: { typeUrl: string; value: unknown }[]) => {
      sent.push({ address, messages });
      return { code: 0, transactionHash: "TESTHASH", rawLog: "" };
    },
  } as unknown as SigningStargateClient);
  return sent;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDirectSigner.mockResolvedValue({});
  (createCliqTransaction as jest.Mock).mockResolvedValue({ success: true, txId: "9" });
});
afterEach(() => jest.restoreAllMocks());

describe("ProposalViewer vote options, direct signing: P0", () => {
  it.each(OPTIONS)(
    "%s votes option %i on the proposal that was opened, as the wallet",
    async (label, value) => {
      const sent = stubSigningClient();
      renderViewer();

      openDialog(1); // the second proposal, id 52
      fireEvent.click(option(label));

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].address).toBe(WALLET);
      expect(sent[0].messages).toEqual([
        { typeUrl: MsgTypeUrls.Vote, value: { proposalId: 52, voter: WALLET, option: value } },
      ]);
    },
  );

  it("votes on the first proposal when that one was opened", async () => {
    const sent = stubSigningClient();
    renderViewer();

    openDialog(0);
    fireEvent.click(option("Yes"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].messages[0].value).toEqual({ proposalId: 47, voter: WALLET, option: 1 });
  });
});

describe("ProposalViewer vote options, CLIQ mode: P0", () => {
  it.each(OPTIONS)(
    "%s proposes option %i on the proposal that was opened, as the CLIQ",
    async (label, value, memoLabel) => {
      renderViewer({ isCliqMode: true, cliqAddress: CLIQ });

      openDialog(1);
      fireEvent.click(option(label));

      await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
      const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
      expect(call.cliqAddress).toBe(CLIQ);
      expect(call.memo).toBe(`Vote ${memoLabel} on proposal #52`);
      expect(call.messages).toEqual([
        { typeUrl: MsgTypeUrls.Vote, value: { proposalId: 52, voter: CLIQ, option: value } },
      ]);
    },
  );
});

describe("ProposalViewer vote options are off when they must be: P0", () => {
  it("read-only turns all four options off, and a click sends nothing", async () => {
    const sent = stubSigningClient();
    renderViewer({ readOnly: true });

    openDialog(0);

    for (const [label] of OPTIONS) {
      expect(option(label)).toBeDisabled();
    }
    fireEvent.click(option("Yes"));
    await Promise.resolve();
    expect(sent).toHaveLength(0);
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("read-only in CLIQ mode creates no transaction either", async () => {
    renderViewer({ readOnly: true, isCliqMode: true, cliqAddress: CLIQ });

    openDialog(0);
    fireEvent.click(option("No"));
    await Promise.resolve();

    expect(option("No")).toBeDisabled();
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("while a vote is in flight all four options are off", async () => {
    (createCliqTransaction as jest.Mock).mockReturnValue(new Promise(() => {})); // never settles
    renderViewer({ isCliqMode: true, cliqAddress: CLIQ });

    openDialog(0);
    // keep the elements: while voting each shows a spinner instead of its label
    const buttons = OPTIONS.map(([label]) => option(label));
    buttons.forEach((b) => expect(b).toBeEnabled());

    fireEvent.click(buttons[0]);

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => buttons.forEach((b) => expect(b).toBeDisabled()));
  });
});
