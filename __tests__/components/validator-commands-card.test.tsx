/**
 * Validator Commands Card + CLIQ Upgrade CTA Test
 *
 * File: __tests__/components/validator-commands-card.test.tsx
 *
 *   - no Vote tile (ProposalViewer already lists proposals with the vote dialog)
 *   - the delegator-side reward tile is "Claim delegation rewards" and keeps its ?type= link
 *   - Delegate / Undelegate / Redelegate links are unchanged: the four CLIQ action links keep their
 *     exact hrefs (and there are no others)
 *   - the Manage card was restyled only (2026-10-10): each tile has its own icon and a corner arrow,
 *     the two sub-headings use the section-label type (mono, 11px, uppercase, 0.14em), "Edit
 *     validator" is one row (words on the left, the button on the right) and the sentence "Changes may
 *     take a few minutes to reflect on the network." sits under the description, not centred apart
 *   - "Edit validator" is one section heading and one button
 *   - the "Managing via CLIQ" mode line is gone from the card (the page's "Acting as" sentences are
 *     gone too)
 *   - both CliqUpgradeCTA buttons read "Create Validator CLIQ"
 *
 * Priority: P1
 */

// jest.setup.js replaces the bento grid with a stub that drops every className; the tile styling
// pinned below (the quiet surface, the group hover, the padding) needs the real one.
jest.unmock("@/components/ui/bento-grid");

import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("no longer carries the muted mode line", () => {
    expect(screen.queryByText(/managing via cliq/i)).not.toBeInTheDocument();
  });

  it("keeps exactly the four action links, with their exact hrefs and no others", () => {
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));

    expect(hrefs).toEqual([
      typeLink(MsgTypeUrls.Delegate),
      typeLink(MsgTypeUrls.Undelegate),
      typeLink(MsgTypeUrls.BeginRedelegate),
      typeLink(MsgTypeUrls.WithdrawDelegatorReward),
    ]);
  });

  it("gives each tile its own icon and a corner arrow", () => {
    // jest mocks lucide icons as a span with data-testid="icon-<Name>"
    const tiles: [string, string][] = [
      ["Delegate", "icon-TrendingUp"],
      ["Undelegate", "icon-TrendingDown"],
      ["Redelegate", "icon-ArrowLeftRight"],
      ["Claim delegation rewards", "icon-Coins"],
    ];
    const leading: (string | null)[] = [];

    for (const [name, icon] of tiles) {
      const tile = screen.getByRole("heading", { name }).closest("a") as HTMLElement;
      const icons = within(tile).getAllByTestId(/^icon-/);
      // the leading icon, then the one corner arrow, and nothing else
      expect(icons.map((i) => i.getAttribute("data-testid"))).toEqual([icon, "icon-ArrowUpRight"]);
      // the arrow is muted and turns coral while the tile (a `group`) is hovered
      expect(icons[1]).toHaveClass("text-muted-foreground", "group-hover:text-primary");
      expect(tile.querySelector(".group")).not.toBeNull();
      leading.push(icons[0].getAttribute("data-testid"));
    }
    // the three staking tiles used to share one icon
    expect(new Set(leading).size).toBe(4);
  });

  it("gives the tiles the quiet raised surface and room to breathe", () => {
    for (const name of ["Delegate", "Undelegate", "Redelegate", "Claim delegation rewards"]) {
      const tile = screen.getByRole("heading", { name }).closest(".group") as HTMLElement;
      expect(tile).toHaveClass(
        "bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]",
        "shadow-btn-quiet",
        "p-5",
      );
      expect(tile).not.toHaveClass("p-4");
    }
  });

  it("sets both sub-headings in the section-label type, with no icon on Edit validator", () => {
    for (const name of ["// Staking & Governance", "Edit validator"]) {
      const heading = screen.getByRole("heading", { name });
      expect(heading).toHaveClass(
        "font-mono",
        "text-[11px]",
        "font-medium",
        "uppercase",
        "leading-4",
        "tracking-[0.14em]",
        "text-muted-foreground",
      );
      // not the old section-heading type
      expect(heading).not.toHaveClass("text-sm");
      expect(heading).not.toHaveClass("tracking-wide");
      expect(within(heading).queryByTestId(/^icon-/)).not.toBeInTheDocument();
    }
  });

  it("lays Edit validator out as one row: the words on the left, the button on the right", () => {
    const heading = screen.getByRole("heading", { name: "Edit validator" });
    const button = screen.getByRole("button", { name: "Edit validator" });
    const words = heading.parentElement as HTMLElement;
    const row = words.parentElement as HTMLElement;

    expect(button.parentElement).toBe(row);
    expect(Array.from(row.children)).toEqual([words, button]);
    expect(row).toHaveClass(
      "flex",
      "flex-col",
      "sm:flex-row",
      "sm:items-center",
      "sm:justify-between",
    );
    // full width on a phone, its own width from sm up, and it never shrinks beside the words
    expect(button).toHaveClass("w-full", "sm:w-auto", "shrink-0");
    expect(words).toHaveClass("min-w-0");
  });

  it("puts the network-delay sentence under the description, not centred on its own", () => {
    const heading = screen.getByRole("heading", { name: "Edit validator" });
    const description = screen.getByText(/Update your validator's name, description, website/);
    const sentence = screen.getByText("Changes may take a few minutes to reflect on the network.");

    expect(screen.getAllByText(/Changes may take a few minutes/)).toHaveLength(1);
    expect(Array.from((heading.parentElement as HTMLElement).children)).toEqual([
      heading,
      description,
      sentence,
    ]);
    expect(sentence.closest(".text-center")).toBeNull();
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

  it("sets the sub-headings in the section-label type and keeps Edit validator as one row", () => {
    render(<ValidatorCommandsCard validator={validator} />);

    for (const name of ["// Staking & Governance", "Edit validator"]) {
      expect(screen.getByRole("heading", { name })).toHaveClass(
        "font-mono",
        "text-[11px]",
        "uppercase",
        "tracking-[0.14em]",
      );
    }
    const words = screen.getByRole("heading", { name: "Edit validator" }).parentElement;
    expect(Array.from(words?.parentElement?.children ?? [])).toEqual([
      words,
      screen.getByRole("button", { name: "Edit validator" }),
    ]);
    // no action tiles outside a CLIQ view
    expect(document.querySelector("a")).toBeNull();
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
