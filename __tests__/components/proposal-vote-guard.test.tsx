/**
 * ProposalViewer.submitVote takes a synchronous "voting in progress" lock so a double-click
 * cannot send two votes. The lock must not be taken when the vote cannot start: before
 * 2026-10-10 a click with no wallet connected set the lock and returned without clearing it,
 * so every later Vote click did nothing until the page was reloaded.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import ProposalViewer from "@/components/dataViews/ValidatorDashboard/ProposalViewer";
import { createCliqTransaction } from "@/lib/validatorTx";
import type { ValidatorDashboardData } from "@/lib/validatorHelpers";

let mockWalletInfo: { type: string; address: string; pubKey: string } | null = null;

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ walletInfo: mockWalletInfo, getDirectSigner: jest.fn() }),
}));

// The shared sonner mock in jest.setup.js has no toast.loading, which submitVote calls first.
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(() => "toast-id"),
    dismiss: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "tx",
      chainId: "coreum-mainnet-1",
      addressPrefix: "core",
      explorerLinks: { proposal: "" },
    },
  }),
}));

jest.mock("@/lib/validatorTx", () => ({
  buildVoteMsg: jest.fn(() => []),
  createCliqTransaction: jest.fn(async () => ({ success: true, txId: "tx-1" })),
}));

const data = {
  activeProposals: [{ proposalId: 47, content: { title: "Test proposal" } }],
  pastProposals: [],
  validatorVotes: {},
  validator: {},
} as unknown as ValidatorDashboardData;

const CLIQ = "core1cliqaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

function renderViewer() {
  return render(<ProposalViewer data={data} isCliqMode cliqAddress={CLIQ} />);
}

function openDialogAndClickYes() {
  fireEvent.click(screen.getByRole("button", { name: /vote now/i }));
  fireEvent.click(screen.getByRole("button", { name: "Yes" }));
}

describe("ProposalViewer vote lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletInfo = null;
  });

  it("tells a visitor with no wallet to connect, and sends nothing", () => {
    renderViewer();
    openDialogAndClickYes();
    expect(toast.error).toHaveBeenCalledWith("Please connect your wallet first");
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("still lets the vote through after the wallet connects (the lock was not left set)", async () => {
    const view = renderViewer();
    openDialogAndClickYes();
    expect(createCliqTransaction).not.toHaveBeenCalled();

    mockWalletInfo = { type: "Keplr", address: "core1member", pubKey: "A" };
    view.rerender(<ProposalViewer data={data} isCliqMode cliqAddress={CLIQ} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
  });

  it("a rapid double-click with a wallet still sends exactly one vote", async () => {
    mockWalletInfo = { type: "Keplr", address: "core1member", pubKey: "A" };
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: /vote now/i }));
    const yes = screen.getByRole("button", { name: "Yes" });
    fireEvent.click(yes);
    fireEvent.click(yes);
    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
  });
});
