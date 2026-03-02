/**
 * Validator Delegators Card
 *
 * File: components/dataViews/ValidatorDashboard/ValidatorDelegatorsCard.tsx
 *
 * Displays active delegators, their amounts, and unbonding delegations.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { useChains } from "@/context/ChainsContext";
import { Users, Clock, ExternalLink } from "lucide-react";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { Button } from "@/components/ui/button";

interface ValidatorDelegatorsCardProps {
  data: ValidatorDashboardData;
}

export default function ValidatorDelegatorsCard({ data }: ValidatorDelegatorsCardProps) {
  const { chain } = useChains();
  const { delegations, unbondingDelegations } = data;

  const displayDenom = chain.displayDenom || chain.denom;
  const decimals = chain.displayDenomExponent || 6;

  const formatTokens = (amount: string): string => {
    if (!amount || amount === "0") return "0";
    const num = parseInt(amount, 10);
    const formatted = num / Math.pow(10, decimals);
    return formatted.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Calculate total unbonding
  const totalUnbonding = unbondingDelegations.reduce((acc, curr) => {
    const amount = curr.entries.reduce((eAcc, eCurr) => eAcc + BigInt(eCurr.balance), BigInt(0));
    return acc + amount;
  }, BigInt(0));

  return (
    <Card variant="institutional" className="h-full">
      <CardHeader>
        <CardLabel comment>Staking</CardLabel>
        <CardTitle className="font-heading text-xl font-bold">Delegators & Unbonding</CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <Users className="h-4 w-4" />
              Active Stakers ({delegations.length})
            </TabsTrigger>
            <TabsTrigger value="unbonding" className="gap-2">
              <Clock className="h-4 w-4" />
              Unbonding ({unbondingDelegations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            <div className="overflow-hidden rounded-md border border-border/50">
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[180px]">Delegator</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delegations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                          No active delegators found
                        </TableCell>
                      </TableRow>
                    ) : (
                      delegations.map((del, i) => {
                        const explorerLink = explorerLinkAccount(
                          chain.explorerLinks.account,
                          del.delegation?.delegatorAddress || "",
                        );
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              {del.delegation?.delegatorAddress?.slice(0, 8)}...
                              {del.delegation?.delegatorAddress?.slice(-8)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatTokens(del.balance?.amount || "0")} {displayDenom}
                            </TableCell>
                            <TableCell>
                              {explorerLink && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <a href={explorerLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="unbonding" className="mt-0">
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
                        <TableHead>Delegator</TableHead>
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
                              <TableCell className="font-mono text-xs">
                                {unb.delegatorAddress.slice(0, 6)}...
                                {unb.delegatorAddress.slice(-6)}
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
