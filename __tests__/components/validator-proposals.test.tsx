/**
 * Proposal Viewer Test
 *
 * File: __tests__/components/validator-proposals.test.tsx
 *
 * The Governance section of the validator dashboard (ProposalViewer):
 *   - active proposals are listed as before, each with its Vote Now button
 *   - past proposals sit in a drop-down, "Past proposals (latest N)", closed by default and opened
 *     by a click; the three data states (rows, none, unavailable) read the same inside it
 *   - the label is honest: "latest N" whenever N is 1 or more (N = the rows shown, at most 10; the
 *     helper reads the newest 20 proposals of any status, so a bare "(7)" could be less than the
 *     real total while "latest 7" is always true), "(0)" for none, "(unavailable)" for null; the
 *     opened list has its own scroll box so Governance grows by one box, not ten rows
 *
 * A proposal shows its real title: the gov v1 title when there is one, and "Proposal #<id>" (a
 * fact) when none can be had, never "Untitled Proposal" (a claim). Seen on the real page:
 * proposal 47 is "TX Chain Mainnet Upgrade v8.0.0" on chain but its v1beta1 view has no title.
 * The title is read from content.title, then content.value.title (a decoded Any); a blank or
 * non-text one counts as none. With no title the card says "Proposal #<id>" ONCE (the small
 * kicker above the heading is hidden); with a real title the kicker stays. The end-to-end group
 * runs the real getActiveProposals into the real viewer.
 *
 * The two voting-power sentences ("Your validator represents X% of the network's voting power" and
 * the vote dialog's "Your voting power: X%") are said only when the share was measured: a null
 * share (the pool query failed) renders neither, and a real "0" still renders both.
 *
 * The vote dialog and what each option button sends are in validator-vote-options.test.tsx
 * (the signing fence hashes submitVote's code, not the JSX that picks its arguments).
 *
 * Priority: P1
 */

import { fireEvent, render, screen } from "@testing-library/react";
import ProposalViewer from "@/components/dataViews/ValidatorDashboard/ProposalViewer";
import { getActiveProposals, ValidatorDashboardData } from "@/lib/validatorHelpers";

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {}, pathname: "/tx/validator" }),
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
      explorerLinks: { proposal: "https://explorer.invalid/proposals/${proposalId}" },
    },
  }),
}));

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ walletInfo: { address: "testcore1wallet" }, getDirectSigner: jest.fn() }),
}));

const proposal = (id: number, title: string, status = 3) =>
  ({
    proposalId: id,
    status,
    content: { title },
    votingEndTime: { seconds: BigInt(1_790_000_000) },
  }) as never;

const data = (over: Record<string, unknown> = {}) =>
  ({
    activeProposals: [proposal(11, "Raise the block gas limit", 2)],
    pastProposals: [proposal(7, "Enable IBC hooks", 3), proposal(5, "Retire the old faucet", 4)],
    validatorVotes: {},
    validator: { moniker: "Tokns.fi" },
    votingPowerPercentage: "2.74",
    ...over,
  }) as unknown as ValidatorDashboardData;

const renderViewer = (d = data()) => render(<ProposalViewer data={d} />);
const trigger = (count: string) =>
  screen.getByRole("button", { name: `Past proposals (${count})` });

describe("ProposalViewer active proposals: P1", () => {
  it("lists active proposals inline with a Vote Now button", () => {
    renderViewer();

    expect(screen.getByText("Raise the block gas limit")).toBeInTheDocument();
    expect(screen.getByText("NEEDS VOTE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vote Now" })).toBeEnabled();
  });

  it("says so when no proposal is in its voting period", () => {
    renderViewer(data({ activeProposals: [] }));

    expect(screen.getByText("No active proposals in voting period.")).toBeInTheDocument();
  });
});

describe("ProposalViewer proposal titles: P1", () => {
  const untitled = (id: number, content: unknown) =>
    ({ proposalId: BigInt(id), status: 2, content }) as never;

  it("shows 'Proposal #47' when the content has no title, never 'Untitled Proposal'", () => {
    // the v1beta1 view of proposal 47 on TX mainnet: an Any with no title anywhere
    renderViewer(
      data({
        activeProposals: [
          untitled(47, { typeUrl: "/cosmos.gov.v1.MsgSoftwareUpgrade", value: new Uint8Array() }),
        ],
      }),
    );

    expect(screen.getByRole("heading", { level: 4, name: "Proposal #47" })).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("says 'Proposal #47' once on the card when there is no title: no kicker above the heading", () => {
    renderViewer(
      data({
        activeProposals: [
          untitled(47, { typeUrl: "/cosmos.gov.v1.MsgSoftwareUpgrade", value: new Uint8Array() }),
        ],
      }),
    );

    expect(screen.getAllByText("Proposal #47")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 4, name: "Proposal #47" })).toBeInTheDocument();
  });

  it("keeps the small 'Proposal #<id>' kicker above a real title", () => {
    renderViewer();

    expect(
      screen.getByRole("heading", { level: 4, name: "Raise the block gas limit" }),
    ).toBeVisible();
    expect(screen.getAllByText("Proposal #11")).toHaveLength(1); // the kicker; the title is its own text
  });

  it("shows 'Proposal #<id>' for an empty title string and for a missing content", () => {
    renderViewer(
      data({
        activeProposals: [untitled(48, { title: "" }), untitled(49, undefined), untitled(50, null)],
      }),
    );

    expect(screen.getByRole("heading", { level: 4, name: "Proposal #48" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Proposal #49" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Proposal #50" })).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("treats a blank (whitespace) title as no title", () => {
    renderViewer(data({ activeProposals: [untitled(51, { title: "   " })] }));

    expect(screen.getByRole("heading", { level: 4, name: "Proposal #51" })).toBeInTheDocument();
  });

  it("reads the title from content.value when the content itself has none (a decoded Any)", () => {
    renderViewer(
      data({
        activeProposals: [
          untitled(52, {
            typeUrl: "/cosmos.gov.v1beta1.TextProposal",
            value: { title: "Decoded legacy title" },
          }),
        ],
      }),
    );

    expect(screen.getByRole("heading", { level: 4, name: "Decoded legacy title" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { level: 4, name: "Proposal #52" }),
    ).not.toBeInTheDocument();
  });

  it("prefers the content's own title over content.value's", () => {
    renderViewer(
      data({
        activeProposals: [untitled(53, { title: "Own title", value: { title: "Inner title" } })],
      }),
    );

    expect(screen.getByRole("heading", { level: 4, name: "Own title" })).toBeVisible();
    expect(screen.queryByText("Inner title")).not.toBeInTheDocument();
  });

  it("falls through a blank content title to content.value's title", () => {
    renderViewer(
      data({
        activeProposals: [untitled(54, { title: "  ", value: { title: "Inner title" } })],
      }),
    );

    expect(screen.getByRole("heading", { level: 4, name: "Inner title" })).toBeVisible();
  });

  it("says 'Proposal #<id>' for a blank or non-text content.value title, and does not throw", () => {
    renderViewer(
      data({
        activeProposals: [
          untitled(55, { value: { title: "" } }),
          untitled(56, { value: { title: "   " } }),
          untitled(57, { value: { title: 42 } }),
          untitled(58, { title: 42, value: { title: { text: "nested" } } }),
        ],
      }),
    );

    for (const id of [55, 56, 57, 58]) {
      expect(screen.getByRole("heading", { level: 4, name: `Proposal #${id}` })).toBeVisible();
    }
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("says the same in the past list", () => {
    renderViewer(data({ pastProposals: [untitled(7, { title: "" })] }));

    fireEvent.click(trigger("latest 1"));

    expect(screen.getByText("Proposal #7")).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });
});

describe("ProposalViewer titles end to end (real getActiveProposals): P1", () => {
  const RPC = "https://rpc.invalid:26657";
  const v1 = (title: string) => ({
    id: "47",
    status: "PROPOSAL_STATUS_VOTING_PERIOD",
    title,
    summary: "s",
    messages: [{ "@type": "/cosmos.gov.v1.MsgSoftwareUpgrade" }],
    voting_end_time: "2026-10-12T00:00:00Z",
  });
  const rest = (title: string) => ({
    ok: true,
    json: async () => ({ proposals: [v1(title)] }),
  });
  // the v1beta1 query as TX mainnet answers it: the proposal is there, its content has no title
  const v1beta1Client = {
    gov: {
      proposals: jest.fn().mockResolvedValue({
        proposals: [
          {
            proposalId: BigInt(47),
            status: 2,
            content: { typeUrl: "/cosmos.gov.v1.MsgSoftwareUpgrade", value: new Uint8Array() },
          },
        ],
      }),
    },
  } as never;

  const viewerFor = async (fetchImpl: jest.Mock) => {
    global.fetch = fetchImpl;
    const activeProposals = await getActiveProposals(v1beta1Client, RPC);
    renderViewer(data({ activeProposals }));
  };

  it("shows the gov v1 title when a REST endpoint answers", async () => {
    await viewerFor(jest.fn().mockResolvedValue(rest("TX Chain Mainnet Upgrade v8.0.0")));

    expect(screen.getByText("TX Chain Mainnet Upgrade v8.0.0")).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("keeps the kicker above the gov v1 title it copied on", async () => {
    await viewerFor(jest.fn().mockResolvedValue(rest("TX Chain Mainnet Upgrade v8.0.0")));

    expect(screen.getAllByText("Proposal #47")).toHaveLength(1); // the kicker
    expect(
      screen.getByRole("heading", { level: 4, name: "TX Chain Mainnet Upgrade v8.0.0" }),
    ).toBeInTheDocument();
  });

  it("lists 47 with 'Proposal #47' once when REST answers an empty list", async () => {
    await viewerFor(
      jest.fn().mockResolvedValue({ ok: true, json: async () => ({ proposals: [] }) }),
    );

    expect(screen.getAllByText("Proposal #47")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Vote Now" })).toBeEnabled();
  });

  it("does not put a finished proposal REST returns on the page, only the one v1beta1 lists", async () => {
    const finished = { ...v1("Old and done"), id: "46", status: "PROPOSAL_STATUS_PASSED" };
    await viewerFor(
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ proposals: [finished, v1("TX Chain Mainnet Upgrade v8.0.0")] }),
      }),
    );

    expect(screen.queryByText("Old and done")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Vote Now" })).toHaveLength(1);
  });

  it("shows 'Proposal #47' when REST is unreachable and v1beta1 has no title", async () => {
    await viewerFor(jest.fn().mockResolvedValue({ ok: false }));

    expect(screen.getByRole("heading", { level: 4, name: "Proposal #47" })).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("shows 'Proposal #47' when the gov v1 proposal has an empty title string", async () => {
    await viewerFor(jest.fn().mockResolvedValue(rest("")));

    expect(screen.getByRole("heading", { level: 4, name: "Proposal #47" })).toBeInTheDocument();
    expect(screen.queryByText(/Untitled/)).not.toBeInTheDocument();
  });

  it("hands the same proposal id to the vote dialog it always did", async () => {
    await viewerFor(jest.fn().mockResolvedValue(rest("TX Chain Mainnet Upgrade v8.0.0")));

    fireEvent.click(screen.getByRole("button", { name: "Vote Now" }));

    expect(screen.getByText("Select an option for Proposal #47")).toBeInTheDocument();
  });
});

describe("ProposalViewer past proposals drop-down: P1", () => {
  it("is closed by default: no past proposal title is on the page", () => {
    renderViewer();

    expect(trigger("latest 2")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Enable IBC hooks")).not.toBeInTheDocument();
    expect(screen.queryByText("Retire the old faucet")).not.toBeInTheDocument();
  });

  it("opens on click and lists the past proposals with their result", () => {
    renderViewer();

    fireEvent.click(trigger("latest 2"));

    expect(trigger("latest 2")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Enable IBC hooks")).toBeInTheDocument();
    expect(screen.getByText("Retire the old faucet")).toBeInTheDocument();
    expect(screen.getByText("PASSED")).toBeInTheDocument();
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
  });

  it("closes again on a second click", () => {
    renderViewer();

    fireEvent.click(trigger("latest 2"));
    fireEvent.click(trigger("latest 2"));

    expect(screen.queryByText("Enable IBC hooks")).not.toBeInTheDocument();
  });

  it("lists at most the latest 10 and says 'latest 10' when more exist", () => {
    const many = Array.from({ length: 14 }, (_, i) => proposal(100 - i, `Old proposal ${i}`));
    renderViewer(data({ pastProposals: many }));

    fireEvent.click(trigger("latest 10"));

    expect(screen.getAllByText(/^Old proposal \d+$/)).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Past proposals (14)" })).not.toBeInTheDocument();
  });

  it.each([
    [1, "latest 1"],
    [7, "latest 7"],
    [10, "latest 10"],
    [11, "latest 10"],
    [20, "latest 10"],
  ])("says 'latest N' for %i fetched proposals: %s, never a bare count", (fetched, label) => {
    const past = Array.from({ length: fetched }, (_, i) => proposal(100 - i, `Old proposal ${i}`));
    renderViewer(data({ pastProposals: past }));

    expect(trigger(label)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Past proposals (${fetched})` }),
    ).not.toBeInTheDocument();
  });

  it("gives the opened list its own scroll box, positioned like the stakers list", () => {
    const many = Array.from({ length: 10 }, (_, i) => proposal(100 - i, `Old proposal ${i}`));
    renderViewer(data({ pastProposals: many }));

    fireEvent.click(trigger("latest 10"));

    const scroller = screen.getByText("Old proposal 0").closest(".overflow-y-auto") as HTMLElement;
    expect(scroller).toHaveClass("relative", "max-h-[260px]", "overflow-y-auto");
  });

  it("says there are none when the list is empty", () => {
    renderViewer(data({ pastProposals: [] }));

    fireEvent.click(trigger("0"));

    expect(screen.getByText("No past proposals found.")).toBeInTheDocument();
  });

  it("says the history is unavailable when no endpoint answered", () => {
    renderViewer(data({ pastProposals: null }));

    expect(screen.queryByText(/Proposal history unavailable/)).not.toBeInTheDocument();
    fireEvent.click(trigger("unavailable"));

    expect(screen.getByText(/Proposal history unavailable/)).toBeInTheDocument();
  });
});

describe("ProposalViewer voting power sentences: P1", () => {
  it("says the validator's share in the help line and the vote dialog when it is known", () => {
    renderViewer();

    expect(screen.getByText(/Your validator represents/)).toHaveTextContent(
      "Voting Power: Your validator represents 2.74% of the network's voting power.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Vote Now" }));
    expect(screen.getByText(/Your voting power:/)).toHaveTextContent("Your voting power: 2.74%");
  });

  it("renders neither sentence when the share is null (the pool query failed)", () => {
    renderViewer(data({ votingPowerPercentage: null }));

    expect(screen.queryByText(/Your validator represents/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vote Now" }));
    expect(screen.getByText("Select an option for Proposal #11")).toBeInTheDocument();
    expect(screen.queryByText(/Your voting power:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/null%/)).not.toBeInTheDocument();
  });

  it("still renders both sentences for a real, measured 0", () => {
    renderViewer(data({ votingPowerPercentage: "0" }));

    expect(screen.getByText(/Your validator represents/)).toHaveTextContent(
      "Your validator represents 0% of the network's voting power.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Vote Now" }));
    expect(screen.getByText(/Your voting power:/)).toHaveTextContent("Your voting power: 0%");
  });
});
