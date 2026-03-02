/**
 * Contract Multisig Dashboard
 *
 * File: components/dataViews/ContractMultisigDashboard.tsx
 *
 * Dashboard view for CW3 contract-based multisigs.
 * Shows members, proposals, voting, and execution.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DashboardLayout, { QuickStatsRow, QuickStat } from "@/components/layout/DashboardLayout";
import ContractProposalList from "./ContractProposalList";
import ContractVotePanel from "./ContractVotePanel";
import BalancesTable from "./BalancesTable";
import { CredentialManagerPanel } from "./CredentialManagerPanel";
import {
  FileCode2,
  Users,
  Shield,
  FileText,
  Clock,
  Wallet,
  Plus,
  ExternalLink,
  Loader2,
  Info,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/ui/copy-button";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface ContractMultisigDashboardProps {
  contractAddress: string;
  chainId: string;
  chainName: string;
  nodeAddress: string;
  userAddress?: string;
  explorerLink?: string;
  /** Whether this multisig uses credential gating (Phase 3) */
  isCredentialGated?: boolean;
  contractInfo?: {
    codeId: number;
    creator: string;
    admin?: string;
    label: string;
  };
}

interface ContractConfig {
  label: string;
  name: string | null;
  description: string | null;
  threshold: number;
  maxVotingPeriodSeconds: number;
  members: { addr: string; weight: number }[];
  creator: string;
}

// ============================================================================
// Component
// ============================================================================

export default function ContractMultisigDashboard({
  contractAddress,
  chainId,
  chainName,
  nodeAddress,
  userAddress,
  explorerLink,
  isCredentialGated = false,
  contractInfo,
}: ContractMultisigDashboardProps) {
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);

  // Fetch contract config
  useEffect(() => {
    async function fetchConfig() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/chain/${chainId}/contract-multisig/${contractAddress}?nodeAddress=${encodeURIComponent(nodeAddress)}&proposals=false`,
        );

        if (response.ok) {
          const data = await response.json();
          setConfig(data.multisig);
        }
      } catch (err) {
        console.error("Failed to fetch contract config:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (contractAddress && chainId && nodeAddress) {
      fetchConfig();
    }
  }, [contractAddress, chainId, nodeAddress]);

  // Calculate stats
  const totalWeight = config?.members.reduce((sum, m) => sum + m.weight, 0) || 0;
  const votingPeriodDays = config ? config.maxVotingPeriodSeconds / (24 * 60 * 60) : 0;

  // User's membership info
  const userMember = config?.members.find((m) => m.addr === userAddress);
  const isMember = !!userMember;

  // Handle proposal actions
  const handleProposalClick = (proposalId: number) => {
    setSelectedProposalId(proposalId);
    setShowVoteDialog(true);
  };

  const handleVote = (proposalId: number) => {
    setSelectedProposalId(proposalId);
    setShowVoteDialog(true);
  };

  const handleExecute = (proposalId: number) => {
    setSelectedProposalId(proposalId);
    setShowVoteDialog(true);
  };

  // Subheader
  const subheader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <FileCode2 className="h-3 w-3" />
          Contract Multisig
        </Badge>
        {contractInfo && (
          <Badge variant="secondary" className="font-mono text-xs">
            Code ID: {contractInfo.codeId}
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <CopyButton value={contractAddress} copyLabel="contract address" />
        {explorerLink && (
          <Button variant="ghost" size="sm" asChild>
            <a href={explorerLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout title="Contract Multisig" subheader={subheader}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout
        title={config?.name || config?.label || "Contract Multisig"}
        subheader={subheader}
      >
        {/* Quick Stats */}
        <QuickStatsRow>
          <QuickStat
            icon={<Users className="h-4 w-4" />}
            label={`Members (Weight: ${totalWeight})`}
            value={config?.members.length || 0}
          />
          <QuickStat
            icon={<Shield className="h-4 w-4" />}
            label="Threshold"
            value={`${config?.threshold || 0} / ${totalWeight}`}
          />
          <QuickStat
            icon={<Clock className="h-4 w-4" />}
            label="Voting Period"
            value={`${votingPeriodDays.toFixed(1)} days`}
          />
          <QuickStat
            icon={<Wallet className="h-4 w-4" />}
            label={isMember ? "Your Weight (Active)" : "Your Weight"}
            value={userMember?.weight || 0}
          />
        </QuickStatsRow>

        {/* Member Status Alert */}
        {userAddress && !isMember && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              You are not a member of this multisig. You can view proposals but cannot vote or
              create new ones.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <FileText className="h-4 w-4" />
              Proposals
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="balances" className="gap-2">
              <Wallet className="h-4 w-4" />
              Balances
            </TabsTrigger>
            {/* Phase 3: Credentials tab */}
            {isCredentialGated && (
              <TabsTrigger value="credentials" className="gap-2">
                <Key className="h-4 w-4" />
                Credentials
              </TabsTrigger>
            )}
          </TabsList>

          {/* Proposals Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Create Proposal Button */}
            {isMember && (
              <div className="flex justify-end">
                <Button asChild className="gap-2">
                  <Link href={`/${chainName}/${contractAddress}/transaction/new`}>
                    <Plus className="h-4 w-4" />
                    New Proposal
                  </Link>
                </Button>
              </div>
            )}

            {/* Proposals List */}
            <ContractProposalList
              contractAddress={contractAddress}
              chainId={chainId}
              nodeAddress={nodeAddress}
              threshold={config?.threshold || 0}
              onProposalClick={handleProposalClick}
              onVote={handleVote}
              onExecute={handleExecute}
            />
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Members
                </CardTitle>
                <CardDescription>
                  {config?.members.length} members with a total weight of {totalWeight}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config?.members.map((member) => (
                      <TableRow
                        key={member.addr}
                        className={member.addr === userAddress ? "bg-blue-500/5" : ""}
                      >
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {member.addr}
                            {member.addr === userAddress && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{member.weight}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {totalWeight > 0
                            ? `${((member.weight / totalWeight) * 100).toFixed(1)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Threshold Info */}
                <div className="mt-6 rounded-lg bg-muted/30 p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4" />
                    Threshold Configuration
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Proposals require <strong>{config?.threshold}</strong> out of{" "}
                    <strong>{totalWeight}</strong> total weight to pass (
                    {totalWeight > 0
                      ? `${(((config?.threshold || 0) / totalWeight) * 100).toFixed(1)}%`
                      : "—"}
                    )
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balances Tab */}
          <TabsContent value="balances">
            <BalancesTable walletAddress={contractAddress} />
          </TabsContent>

          {/* Phase 3: Credentials Tab */}
          {isCredentialGated && (
            <TabsContent value="credentials">
              <CredentialManagerPanel
                teamAddress={contractAddress}
                chainId={chainId}
                isAdmin={
                  isMember &&
                  userMember?.weight === Math.max(...(config?.members.map((m) => m.weight) || [0]))
                }
              />
            </TabsContent>
          )}
        </Tabs>
      </DashboardLayout>

      {/* Vote Dialog */}
      <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Proposal #{selectedProposalId}</DialogTitle>
            <DialogDescription>Review the proposal details and cast your vote</DialogDescription>
          </DialogHeader>
          {selectedProposalId !== null && (
            <ContractVotePanel
              contractAddress={contractAddress}
              chainId={chainId}
              nodeAddress={nodeAddress}
              proposalId={selectedProposalId}
              userAddress={userAddress}
              isCredentialGated={isCredentialGated}
              onVoteSuccess={() => {
                setShowVoteDialog(false);
                toast.success("Vote submitted successfully");
              }}
              onExecuteSuccess={() => {
                setShowVoteDialog(false);
                toast.success("Proposal executed successfully");
              }}
              onClose={() => setShowVoteDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
