/**
 * Upgrade Notice
 *
 * A notice at the top of the validator dashboard while a chain upgrade is proposed (a
 * MsgSoftwareUpgrade proposal in voting) or scheduled (the chain holds a plan). It says which
 * block the chain switches at and about when, and links TX's upgrade guide for staging the new
 * binary under cosmovisor. Owner, 2026-10-10: "an area to notify them of upcoming validator
 * upgrades and set up staging to be ready"; placement and links chosen by the owner 2026-10-11.
 * Info blue, never gold: gold is the testnet colour.
 */

import { Button } from "@/components/ui/button";
import { UpgradeNotice as UpgradeNoticeData } from "@/lib/validatorHelpers";
import { ArrowUpCircle, ExternalLink } from "lucide-react";

/** TX's own upgrade steps (download, verify, place the binary for cosmovisor) */
export const TX_UPGRADE_GUIDE_URL =
  "https://docs.tx.org/docs/next/nodes-and-validators/upgrades/upgrades-instructions";
/** The TOKNS site's governance page (mainnet) */
export const TOKNS_PROPOSALS_URL = "https://app.tokns.fi/proposals";
export const TX_MAINNET_CHAIN_ID = "coreum-mainnet-1";

/** "Oct 14, 14:57 UTC": always UTC, so every operator reads the same time */
export function formatUtc(date: Date): string {
  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${formatted} UTC`;
}

interface UpgradeNoticeProps {
  upgrade: UpgradeNoticeData;
  chainId: string;
}

export default function UpgradeNotice({ upgrade, chainId }: UpgradeNoticeProps) {
  const proposed = upgrade.state === "proposed";
  const height = upgrade.height.toLocaleString("en-US");
  const about = upgrade.eta ? `, about ${formatUtc(upgrade.eta)} (estimate)` : "";

  return (
    <section
      aria-label="Chain upgrade"
      className="rounded-xl border border-info/40 bg-info/10 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="font-medium text-info">
              {proposed ? "Upgrade proposed" : "Upgrade scheduled"} · {upgrade.name}
              {upgrade.proposalId !== null && ` (proposal #${upgrade.proposalId})`}
            </p>
            <p className="text-sm text-muted-foreground">
              {proposed ? (
                <>
                  {upgrade.votingEndTime && `Voting ends ${formatUtc(upgrade.votingEndTime)}. `}
                  If it passes, the chain switches at block {height}
                  {about}.
                </>
              ) : (
                <>
                  The chain switches at block {height}
                  {about}.
                </>
              )}{" "}
              Stage the new binary for cosmovisor before then, under upgrades/{upgrade.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={TX_UPGRADE_GUIDE_URL} target="_blank" rel="noopener noreferrer">
                TX upgrade guide
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            {proposed && chainId === TX_MAINNET_CHAIN_ID && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={TOKNS_PROPOSALS_URL} target="_blank" rel="noopener noreferrer">
                  Vote on TOKNS
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
