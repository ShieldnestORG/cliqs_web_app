/**
 * Contract Proposal List
 *
 * File: components/dataViews/ContractProposalList.tsx
 *
 * Displays a list of proposals for a CW3 contract multisig
 * with status badges, vote counts, and action buttons.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface ContractProposalListProps {
  contractAddress: string;
  chainId: string;
  nodeAddress: string;
  threshold: number;
  onProposalClick?: (proposalId: number) => void;
  onVote?: (proposalId: number) => void;
  onExecute?: (proposalId: number) => void;
}

interface ProposalSummary {
  proposalId: number;
  title: string;
  description: string;
  status: string;
  proposer: string;
  expiresAt: string | null;
  yesWeight: number;
  createdAt: string;
  isConfirmed: boolean;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: React.ReactNode;
      label: string;
    }
  > = {
    pending: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Open" },
    open: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Open" },
    passed: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" />, label: "Passed" },
    executed: { variant: "default", icon: <PlayCircle className="h-3 w-3" />, label: "Executed" },
    rejected: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, label: "Rejected" },
    expired: { variant: "outline", icon: <Clock className="h-3 w-3" />, label: "Expired" },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ContractProposalList({
  contractAddress,
  chainId,
  nodeAddress,
  threshold,
  onProposalClick,
  onVote,
  onExecute,
}: ContractProposalListProps) {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch proposals from API
  const fetchProposals = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/chain/${chainId}/contract-multisig/${contractAddress}?nodeAddress=${encodeURIComponent(nodeAddress)}&proposals=true`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch proposals");
      }

      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (contractAddress && chainId && nodeAddress) {
      fetchProposals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, chainId, nodeAddress]);

  // Sync handler
  const handleSync = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/chain/${chainId}/contract-multisig/${contractAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          nodeAddress,
        }),
      });

      if (response.ok) {
        // Refetch proposals after sync
        await fetchProposals(true);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return "Never";

    try {
      const expiry = new Date(expiresAt);
      if (expiry < new Date()) {
        return "Expired";
      }
      return formatDistanceToNow(expiry, { addSuffix: true });
    } catch {
      return "—";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchProposals()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Proposals
          </CardTitle>
          <CardDescription>
            {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">No proposals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a proposal to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Votes</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => {
                const canExecute =
                  proposal.yesWeight >= threshold &&
                  (proposal.status === "pending" ||
                    proposal.status === "open" ||
                    proposal.status === "passed");
                const canVote = proposal.status === "pending" || proposal.status === "open";

                return (
                  <TableRow
                    key={proposal.proposalId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onProposalClick?.(proposal.proposalId)}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      {proposal.proposalId}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="max-w-[200px] truncate font-medium">{proposal.title}</p>
                        {!proposal.isConfirmed && (
                          <span className="text-xs text-yellow-500">Unconfirmed</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={proposal.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          proposal.yesWeight >= threshold ? "font-medium text-green-accent" : ""
                        }
                      >
                        {proposal.yesWeight}
                      </span>
                      <span className="text-muted-foreground"> / {threshold}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getTimeRemaining(proposal.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canVote && onVote && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onVote(proposal.proposalId);
                            }}
                          >
                            Vote
                          </Button>
                        )}
                        {canExecute && onExecute && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExecute(proposal.proposalId);
                            }}
                          >
                            Execute
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
