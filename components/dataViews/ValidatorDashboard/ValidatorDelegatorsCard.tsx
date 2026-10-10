/**
 * Validator Delegators
 *
 * The summary line is the tab list: "645 stakers · 0 unbonding". The top 5 stakers show at once;
 * "Show all" opens the rest in a drop-down with its own scroll. The Unbonding tab keeps its table.
 * Renders its content only; the Stakers panel (card) comes from ValidatorDashboard/index.tsx.
 * Until 2026-10-10 this was a card with a 300px scroll box of every staker.
 *
 * Each list is `null` when its fetch failed (since 2026-10-10): the section then says
 * "unavailable ... Use Refresh to try again" and shows NO count, never "0 stakers" / "0 unbonding"
 * (a failed fetch used to come back as an empty list, so it read as "nobody stakes here"). One
 * list failing does not hide the other: a loaded part still shows.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { useChains } from "@/context/ChainsContext";
import { ExternalLink } from "lucide-react";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { Button } from "@/components/ui/button";
import { AddressDisplay } from "@/components/ui/address-display";
import { KitIcon } from "@/components/icons/kit";
import { useState } from "react";

/** How many stakers show before "Show all". */
const TOP_STAKERS = 5;

type Staker = NonNullable<ValidatorDashboardData["delegations"]>[number];

interface ValidatorDelegatorsCardProps {
  data: ValidatorDashboardData;
}

export default function ValidatorDelegatorsCard({ data }: ValidatorDelegatorsCardProps) {
  const { chain } = useChains();
  const { delegations, unbondingDelegations } = data;
  const [showAll, setShowAll] = useState(false);

  const displayDenom = chain.displayDenom || chain.denom;
  const decimals = chain.displayDenomExponent || 6;

  const formatTokens = (amount: string): string => {
    if (!amount || amount === "0") return "0";
    const num = parseInt(amount, 10);
    const formatted = num / Math.pow(10, decimals);
    return formatted.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const totalUnbonding = (unbondingDelegations ?? []).reduce((acc, curr) => {
    const amount = curr.entries.reduce((eAcc, eCurr) => eAcc + BigInt(eCurr.balance), BigInt(0));
    return acc + amount;
  }, BigInt(0));

  // The data helper sorts delegations by amount, largest first, so the head of the list is the top.
  const stakers = delegations ?? [];
  const topStakers = stakers.slice(0, TOP_STAKERS);
  const otherStakers = stakers.slice(TOP_STAKERS);

  const stakerRow = (del: Staker, key: number) => {
    const explorerLink = explorerLinkAccount(
      chain.explorerLinks.account,
      del.delegation?.delegatorAddress || "",
    );
    return (
      <li key={key} className="flex items-center gap-3 py-1.5">
        <AddressDisplay
          address={del.delegation?.delegatorAddress || ""}
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 text-right font-mono text-sm tabular-nums">
          {formatTokens(del.balance?.amount || "0")} {displayDenom}
        </span>
        {explorerLink && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 max-sm:h-11 max-sm:w-11"
            asChild
          >
            <a
              href={explorerLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View staker in explorer"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </li>
    );
  };

  return (
    <Tabs defaultValue="active" className="w-full">
      <TabsList className="mb-3 h-auto w-full justify-start gap-2 bg-transparent p-0">
        <TabsTrigger
          value="active"
          className="gap-2 rounded-md px-2 py-1.5 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none max-sm:min-h-11"
        >
          <KitIcon name="stakers" size={22} />
          {delegations === null
            ? "Stakers"
            : `${delegations.length} ${delegations.length === 1 ? "staker" : "stakers"}`}
        </TabsTrigger>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <TabsTrigger
          value="unbonding"
          className="gap-2 rounded-md px-2 py-1.5 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none max-sm:min-h-11"
        >
          <KitIcon name="clock" size={22} />
          {unbondingDelegations === null ? "Unbonding" : `${unbondingDelegations.length} unbonding`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-0">
        {delegations === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Stakers unavailable right now. Use Refresh to try again.
          </p>
        ) : delegations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No stakers yet</p>
        ) : (
          <Collapsible open={showAll} onOpenChange={setShowAll}>
            <ul className="divide-y divide-border/[0.06]">{topStakers.map(stakerRow)}</ul>

            {otherStakers.length > 0 && (
              <>
                <CollapsibleContent>
                  {/* `relative` is load-bearing: every row's copy button holds an absolutely
                      positioned sr-only label. Without a positioned scroll box those labels use
                      <main> as their containing block, escape this box's clip and grew the page
                      from about 1,900px to about 29,800px with 645 stakers (measured 2026-10-10). */}
                  <ul className="relative max-h-[260px] divide-y divide-border/[0.06] overflow-y-auto border-t border-border/[0.06]">
                    {otherStakers.map((del, i) => stakerRow(del, TOP_STAKERS + i))}
                  </ul>
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-2 w-full max-sm:h-11">
                    {showAll ? "Show fewer" : `Show all ${delegations.length}`}
                  </Button>
                </CollapsibleTrigger>
              </>
            )}
          </Collapsible>
        )}
      </TabsContent>

      <TabsContent value="unbonding" className="mt-0">
        {unbondingDelegations === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Unbonding unavailable right now. Use Refresh to try again.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4">
              <span className="text-sm text-muted-foreground">Total Unbonding</span>
              <span className="font-heading text-lg font-bold">
                {formatTokens(totalUnbonding.toString())} {displayDenom}
              </span>
            </div>

            <div className="overflow-hidden rounded-md border border-border/50">
              <div className="max-h-[220px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/30">
                    <TableRow>
                      <TableHead>Staker</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unbondingDelegations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                          No unbonding delegations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      unbondingDelegations.map((unb, i) => {
                        const amount = unb.entries.reduce(
                          (acc, curr) => acc + BigInt(curr.balance),
                          BigInt(0),
                        );
                        // Get earliest completion time
                        const completionTime = unb.entries[0]?.completionTime;
                        const date = completionTime
                          ? new Date(Number(completionTime.seconds) * 1000)
                          : null;

                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <AddressDisplay address={unb.delegatorAddress} />
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatTokens(amount.toString())}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {date ? date.toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
