/**
 * Upgrade Notice Test
 *
 * File: __tests__/components/upgrade-notice.test.tsx
 *
 * The notice at the top of the validator page while a chain upgrade is proposed or scheduled
 * (owner, 2026-10-10: "an area to notify them of upcoming validator upgrades and set up staging to
 * be ready"; 2026-10-11: top of the page, link TX's upgrade guide, TOKNS link on mainnet):
 *   - "proposed" says the vote's end, that the switch happens only if it passes, the block and
 *     the estimated time, in UTC;
 *   - "scheduled" says the block and time without a vote;
 *   - it links TX's upgrade guide always and the TOKNS proposals page only for a proposal on mainnet;
 *   - no estimate means no "about ..." claim;
 *   - it is info blue, not gold (gold is the testnet colour).
 *
 * Priority: P1
 */

import { render, screen } from "@testing-library/react";
import UpgradeNotice, {
  TOKNS_PROPOSALS_URL,
  TX_UPGRADE_GUIDE_URL,
} from "@/components/dataViews/ValidatorDashboard/UpgradeNotice";
import type { UpgradeNotice as UpgradeNoticeData } from "@/lib/validatorHelpers";

const MAINNET = "coreum-mainnet-1";
const TESTNET = "coreum-testnet-1";

const proposed: UpgradeNoticeData = {
  state: "proposed",
  name: "v8",
  height: 90_850_000,
  proposalId: 47,
  votingEndTime: new Date("2026-10-14T14:57:00Z"),
  eta: new Date("2026-10-20T12:24:56Z"),
};

const scheduled: UpgradeNoticeData = {
  ...proposed,
  state: "scheduled",
  proposalId: null,
  votingEndTime: null,
};

const notice = () => screen.getByRole("region", { name: "Chain upgrade" });

describe("UpgradeNotice: P1", () => {
  it("says a proposed upgrade is not decided yet, with the block and the time in UTC", () => {
    render(<UpgradeNotice upgrade={proposed} chainId={MAINNET} />);

    expect(screen.getByText("Upgrade proposed · v8 (proposal #47)")).toBeInTheDocument();
    expect(notice()).toHaveTextContent(
      "Voting ends Oct 14, 14:57 UTC. If it passes, the chain switches at block 90,850,000, " +
        "about Oct 20, 12:24 UTC (estimate).",
    );
    expect(notice()).toHaveTextContent("Stage the new binary for cosmovisor before then");
    expect(notice()).toHaveTextContent("upgrades/v8");
  });

  it("links TX's upgrade guide and, for a mainnet proposal, the TOKNS proposals page", () => {
    render(<UpgradeNotice upgrade={proposed} chainId={MAINNET} />);

    const guide = screen.getByRole("link", { name: /TX upgrade guide/ });
    expect(guide).toHaveAttribute("href", TX_UPGRADE_GUIDE_URL);
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /Vote on TOKNS/ })).toHaveAttribute(
      "href",
      TOKNS_PROPOSALS_URL,
    );
    expect(TX_UPGRADE_GUIDE_URL).toBe(
      "https://docs.tx.org/docs/next/nodes-and-validators/upgrades/upgrades-instructions",
    );
    expect(TOKNS_PROPOSALS_URL).toBe("https://app.tokns.fi/proposals");
  });

  it("has no TOKNS link on testnet", () => {
    render(<UpgradeNotice upgrade={proposed} chainId={TESTNET} />);

    expect(screen.getByRole("link", { name: /TX upgrade guide/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Vote on TOKNS/ })).not.toBeInTheDocument();
  });

  it("says a scheduled upgrade without a vote, and offers no vote link", () => {
    render(<UpgradeNotice upgrade={scheduled} chainId={MAINNET} />);

    expect(screen.getByText("Upgrade scheduled · v8")).toBeInTheDocument();
    expect(notice()).toHaveTextContent(
      "The chain switches at block 90,850,000, about Oct 20, 12:24 UTC (estimate).",
    );
    expect(notice()).not.toHaveTextContent(/voting|if it passes/i);
    expect(screen.queryByRole("link", { name: /Vote on TOKNS/ })).not.toBeInTheDocument();
  });

  it("makes no time claim when the block rate could not be measured", () => {
    render(<UpgradeNotice upgrade={{ ...proposed, eta: null }} chainId={MAINNET} />);

    expect(notice()).toHaveTextContent("the chain switches at block 90,850,000.");
    expect(notice()).not.toHaveTextContent(/about|estimate/);
  });

  it("is info blue, never the gold testnet colour", () => {
    render(<UpgradeNotice upgrade={proposed} chainId={MAINNET} />);

    expect(notice()).toHaveClass("border-info/40", "bg-info/10");
    expect(notice().outerHTML).not.toMatch(/warning|gold/);
  });
});
