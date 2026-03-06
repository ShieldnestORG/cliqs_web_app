/**
 * Proposal Audit Trail
 *
 * File: components/dataViews/ProposalAuditTrail.tsx
 *
 * Displays the complete audit trail for a proposal, showing:
 * - Who approved with what weight at what time
 * - Member snapshot at proposal creation
 * - Credential validity (prepared for Phase 3)
 *
 * Phase 2: Group-Backed Multisig
 */

"use client";

import { useMemo } from "react";
import { CheckCircle, XCircle, Clock, Users, Shield, FileCheck, History } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AddressDisplay } from "@/components/ui/address-display";

// ============================================================================
// Types
// ============================================================================

interface VoteRecord {
  /** Voter address */
  voter: string;
  /** Vote option (yes/no/abstain/veto) */
  vote: "yes" | "no" | "abstain" | "veto";
  /** Weight at vote time */
  weightAtVote: number;
  /** Whether credential was valid at vote time (Phase 3) */
  credentialValid: boolean;
  /** Block height of the vote */
  voteHeight: number;
  /** Timestamp of the vote */
  voteTime: string;
  /** Transaction hash */
  txHash?: string;
}

interface MemberSnapshotMember {
  addr: string;
  weight: number;
}

interface ProposalAuditTrailProps {
  /** Proposal ID */
  proposalId: number;
  /** Proposal title */
  title?: string;
  /** Proposal status */
  status: string;
  /** Threshold required to pass */
  threshold: number;
  /** Vote records with snapshots */
  votes: VoteRecord[];
  /** Member snapshot at proposal creation */
  memberSnapshot?: {
    members: MemberSnapshotMember[];
    totalWeight: number;
    snapshotHeight: number;
    snapshotTime: string;
  };
  /** When the proposal was created */
  createdAt: string;
  /** When the proposal was executed (if applicable) */
  executedAt?: string;
  /** Execution transaction hash */
  executionTxHash?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function ProposalAuditTrail({
  proposalId,
  title,
  status,
  threshold,
  votes,
  memberSnapshot,
  createdAt,
  executedAt,
  executionTxHash,
}: ProposalAuditTrailProps) {
  // Calculate vote totals
  const voteTotals = useMemo(() => {
    const totals = { yes: 0, no: 0, abstain: 0, veto: 0 };

    for (const vote of votes) {
      totals[vote.vote] += vote.weightAtVote;
    }

    return totals;
  }, [votes]);

  const totalVoted = voteTotals.yes + voteTotals.no + voteTotals.abstain + voteTotals.veto;
  const thresholdMet = voteTotals.yes >= threshold;

  // Format timestamps
  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleString();
    } catch {
      return time;
    }
  };

  // Get vote icon
  const getVoteIcon = (vote: string) => {
    switch (vote) {
      case "yes":
        return <CheckCircle className="h-4 w-4 text-green-accent" />;
      case "no":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "abstain":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "veto":
        return <XCircle className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  // Get vote badge color
  const getVoteBadgeClass = (vote: string) => {
    switch (vote) {
      case "yes":
        return "bg-green-accent/20 text-green-accent";
      case "no":
        return "bg-red-100 text-red-800";
      case "abstain":
        return "bg-gray-100 text-gray-800";
      case "veto":
        return "bg-orange-100 text-orange-800";
      default:
        return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Complete voting history for proposal #{proposalId}
          {title && `: ${title}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={status === "executed" ? "default" : "secondary"}>{status}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Threshold</p>
            <p className="font-medium">
              {voteTotals.yes} / {threshold}
              {thresholdMet && <CheckCircle className="ml-1 inline h-4 w-4 text-green-accent" />}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Voted</p>
            <p className="font-medium">
              {totalVoted}
              {memberSnapshot && (
                <span className="ml-1 text-muted-foreground">/ {memberSnapshot.totalWeight}</span>
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Votes Cast</p>
            <p className="font-medium">{votes.length}</p>
          </div>
        </div>

        {/* Vote breakdown */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-accent" />
            <span className="text-sm">Yes: {voteTotals.yes}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm">No: {voteTotals.no}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-sm">Abstain: {voteTotals.abstain}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-sm">Veto: {voteTotals.veto}</span>
          </div>
        </div>

        <Separator />

        {/* Timeline */}
        <Accordion type="single" collapsible defaultValue="votes">
          {/* Proposal Creation */}
          <AccordionItem value="creation">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <span>Proposal Created</span>
                <span className="ml-2 text-sm text-muted-foreground">{formatTime(createdAt)}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pl-6 text-sm">
                <p>
                  <span className="text-muted-foreground">Time:</span> {formatTime(createdAt)}
                </p>
                {memberSnapshot && (
                  <>
                    <p>
                      <span className="text-muted-foreground">Block height:</span>{" "}
                      {memberSnapshot.snapshotHeight.toLocaleString()}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Eligible voters:</span>{" "}
                      {memberSnapshot.members.length}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Total weight:</span>{" "}
                      {memberSnapshot.totalWeight}
                    </p>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Votes */}
          <AccordionItem value="votes">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Votes ({votes.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voter</TableHead>
                    <TableHead>Vote</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Credential</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {votes.map((vote, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <AddressDisplay address={vote.voter} copyLabel="voter address" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getVoteIcon(vote.vote)}
                          <Badge className={getVoteBadgeClass(vote.vote)}>
                            {vote.vote.toUpperCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{vote.weightAtVote}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>{formatTime(vote.voteTime)}</TooltipTrigger>
                            <TooltipContent>
                              Block: {vote.voteHeight.toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {vote.credentialValid ? (
                          <Badge variant="outline" className="text-green-600">
                            <Shield className="mr-1 h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600">
                            <Shield className="mr-1 h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          {/* Member Snapshot */}
          {memberSnapshot && (
            <AccordionItem value="snapshot">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Member Snapshot</span>
                  <Badge variant="outline" className="ml-2">
                    {memberSnapshot.members.length} members
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>Voted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberSnapshot.members.map((member) => {
                      const memberVote = votes.find(
                        (v) => v.voter.toLowerCase() === member.addr.toLowerCase(),
                      );

                      return (
                        <TableRow key={member.addr}>
                          <TableCell>
                            <AddressDisplay address={member.addr} copyLabel="member address" />
                          </TableCell>
                          <TableCell className="text-right">{member.weight}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {((member.weight / memberSnapshot.totalWeight) * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            {memberVote ? (
                              <div className="flex items-center gap-2">
                                {getVoteIcon(memberVote.vote)}
                                <span className="text-sm">{memberVote.vote}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not voted</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Execution */}
          {executedAt && (
            <AccordionItem value="execution">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-accent" />
                  <span>Executed</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatTime(executedAt)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pl-6 text-sm">
                  <p>
                    <span className="text-muted-foreground">Time:</span> {formatTime(executedAt)}
                  </p>
                  {executionTxHash && (
                    <p>
                      <span className="text-muted-foreground">Transaction:</span>{" "}
                      <code className="text-xs">{executionTxHash}</code>
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
