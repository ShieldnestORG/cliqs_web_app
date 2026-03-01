/**
 * Proposal Viewer
 * 
 * File: components/dataViews/ValidatorDashboard/ProposalViewer.tsx
 * 
 * Displays active governance proposals and the validator's voting status.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildVoteMsg } from "@/lib/validatorTx";
import { useChains } from "@/context/ChainsContext";
import { Vote as VoteIcon, CheckCircle2, AlertCircle, ExternalLink, ArrowRight, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { useWallet } from "@/context/WalletContext";
import { useRouter } from "next/router";
import { Proposal } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { explorerLinkTx } from "@/lib/displayHelpers";

// Helper to extract title from proposal content
function getProposalTitle(proposal: Proposal): string {
  if (!proposal.content) return "Untitled Proposal";
  
  // Content is an Any type, we need to handle the value field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = proposal.content as any;
  if (content.title) return content.title;
  if (content.value?.title) return content.value.title;
  
  return "Untitled Proposal";
}

interface ProposalViewerProps {
  data: ValidatorDashboardData;
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function ProposalViewer({ 
  data, 
  onTransactionComplete, 
  isCliqMode = false, 
  cliqAddress,
  readOnly = false,
}: ProposalViewerProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const router = useRouter();
  const { activeProposals, validatorVotes, validator } = data;

  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isVoteDialogOpen, setIsVoteDialogOpen] = useState(false);

  const getVoteLabel = (proposalId: number) => {
    const vote = validatorVotes[proposalId];
    if (!vote) return null;

    // Mapping vote options to labels
    const options: Record<number, { label: string; className: string }> = {
      1: { label: "YES", className: "bg-green-500/20 text-green-500 border-green-500/30" },
      2: { label: "ABSTAIN", className: "bg-muted text-muted-foreground" },
      3: { label: "NO", className: "bg-destructive/20 text-destructive border-destructive/30" },
      4: { label: "NO WITH VETO", className: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
    };

    const option = vote.option;
    return options[option] || { label: "VOTED", className: "bg-primary/20 text-primary border-primary/30" };
  };

  const submitVote = async (proposalId: number, option: number) => {
    // Prevent duplicate submissions
    if (isVoting) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    const voteOptionLabels: Record<number, string> = {
      1: "YES",
      2: "ABSTAIN",
      3: "NO",
      4: "NO_WITH_VETO",
    };

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsVoting(true);
        
        const loadingToast = toast.loading("Creating transaction...");
        
        const messages = buildVoteMsg(cliqAddress, proposalId, option);

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: `Vote ${voteOptionLabels[option] || option} on proposal #${proposalId}`,
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
          const txUrl = `/${chain.registryName}/${cliqAddress}/transaction/${result.txId}`;
          toast.success("Transaction created!", {
            description: "Ready for multisig signing",
            action: {
              label: "Sign Transaction",
              onClick: () => router.push(txUrl),
            },
          });
          setIsVoteDialogOpen(false);
          onTransactionComplete?.();
        } else {
          toast.error("Failed to create transaction", {
            description: result.error || "Unknown error",
          });
        }
      } catch (e) {
        console.error("Failed to create CLIQ transaction:", e);
        toast.error("Failed to create transaction", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        setIsVoting(false);
      }
      return;
    }

    // Direct signing mode
    try {
      setIsVoting(true);

      const signer = await getDirectSigner();
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      const client = await SigningStargateClient.connectWithSigner(
        chain.nodeAddress,
        signer,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      const messages = [{
        typeUrl: MsgTypeUrls.Vote,
        value: {
          proposalId: proposalId,
          voter: walletInfo.address,
          option: option,
        },
      }];

      // Calculate fee
      const gasPriceNum = parseFloat(chain.gasPrice) || 0.0625;
      const feeAmount = Math.ceil(gasPriceNum * 250_000).toString();

      const fee = {
        amount: [{ denom: chain.denom, amount: feeAmount }],
        gas: "250000",
      };

      const result = await client.signAndBroadcast(
        walletInfo.address,
        messages,
        fee,
        ""
      );

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      const txExplorerUrl = explorerLinkTx(chain.explorerLinks.tx, result.transactionHash);
      toast.success("Vote broadcasted successfully!", {
        description: `Tx: ${result.transactionHash.slice(0, 12)}...`,
        action: txExplorerUrl ? {
          label: "View on Explorer",
          onClick: () => window.open(txExplorerUrl, "_blank"),
        } : undefined,
      });

      setIsVoteDialogOpen(false);
      onTransactionComplete?.();
    } catch (e) {
      console.error("Failed to vote:", e);
      toast.error("Failed to vote", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const voteOptions = [
    { label: "Yes", value: 1, color: "bg-green-500 hover:bg-green-600" },
    { label: "Abstain", value: 2, color: "bg-muted hover:bg-muted/80 text-foreground" },
    { label: "No", value: 3, color: "bg-destructive hover:bg-destructive/80" },
    { label: "No with Veto", value: 4, color: "bg-orange-500 hover:bg-orange-600" },
  ];

  return (
    <Card variant="institutional" accent="left" className="h-full">
      <CardHeader>
        <CardLabel comment>Governance</CardLabel>
        <CardTitle className="text-xl font-heading font-bold">
          Active Proposals
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {activeProposals.length === 0 ? (
          <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border/50">
            <CheckCircle2 className="h-8 w-8 text-green-accent mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No active proposals in voting period.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeProposals.map((proposal) => {
              const proposalId = proposal.proposalId as unknown as number;
              const voteInfo = getVoteLabel(proposalId);
              const explorerLink = chain.explorerLinks.proposal?.replace(
                "${proposalId}",
                proposalId.toString()
              );

              return (
                <div 
                  key={proposalId}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-tighter text-muted-foreground">
                        Proposal #{proposalId}
                      </span>
                      <h4 className="text-sm font-heading font-semibold leading-tight line-clamp-2">
                        {getProposalTitle(proposal)}
                      </h4>
                    </div>
                    {voteInfo ? (
                      <Badge className={voteInfo.className}>
                        {voteInfo.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        NEEDS VOTE
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-primary font-medium hover:underline p-0 flex items-center gap-1"
                      onClick={() => {
                        setSelectedProposal(proposal);
                        setIsVoteDialogOpen(true);
                      }}
                    >
                      <VoteIcon className="h-3 w-3" />
                      Vote Now
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    
                    {explorerLink && (
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2" asChild>
                        <a href={explorerLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Details
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={isVoteDialogOpen} onOpenChange={setIsVoteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading font-bold">
                {isCliqMode ? "Propose Vote" : "Cast Your Vote"}
              </DialogTitle>
              <DialogDescription>
                {isCliqMode 
                  ? `Create a transaction to vote on Proposal #${selectedProposal?.proposalId as unknown as number}`
                  : `Select an option for Proposal #${selectedProposal?.proposalId as unknown as number}`
                }
              </DialogDescription>
            </DialogHeader>

            {isCliqMode && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                <Users className="h-4 w-4" />
                <span>This will create a transaction for multisig signing</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 py-4">
              {voteOptions.map((option) => (
                <Button
                  key={option.value}
                  disabled={readOnly || isVoting}
                  className={`${option.color} h-12 font-bold text-white`}
                  onClick={() => submitVote(selectedProposal?.proposalId as unknown as number, option.value)}
                >
                  {isVoting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    option.label
                  )}
                </Button>
              ))}
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Your voting power: <span className="text-foreground font-semibold">{data.votingPowerPercentage}%</span>
            </p>
          </DialogContent>
        </Dialog>

        {/* Info/Help */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Voting Power:</strong> Your validator represents <span className="text-foreground font-semibold">{data.votingPowerPercentage}%</span> of the network's voting power.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
