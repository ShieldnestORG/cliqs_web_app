/**
 * Proposal Viewer
 *
 * Displays active governance proposals and the validator's voting status. Past proposals sit in
 * a drop-down that is closed by default. Renders its content only; the Governance panel (card)
 * comes from ValidatorDashboard/index.tsx. Until 2026-10-10 the past proposals were always listed
 * inline under the active ones.
 */

import { Badge, type BadgeMark, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KitIcon } from "@/components/icons/kit";
import { readProposalTitle, ValidatorDashboardData } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildVoteMsg } from "@/lib/validatorTx";
import { useChains } from "@/context/ChainsContext";
import { CheckCircle2, ChevronDown, ExternalLink, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { gasOfTx } from "@/lib/txMsgHelpers";
import { useWallet } from "@/context/WalletContext";
import { useRouter } from "next/router";
import { Proposal } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { explorerLinkTx } from "@/lib/displayHelpers";

/** How many finished proposals the "Past proposals" drop-down lists. */
const PAST_PROPOSALS_SHOWN = 10;

// The title to show. With no title to show it says "Proposal #47" (a fact) and never "Untitled
// Proposal" (a claim: the proposal has a title on chain, this view just did not carry it; until
// 2026-10-10 it said "Untitled Proposal"). What counts as a title is readProposalTitle's rule in
// lib/validatorHelpers.ts, the same one getActiveProposals uses to decide whom to fetch a title for.
function getProposalTitle(proposal: Proposal): string {
  return readProposalTitle(proposal) ?? `Proposal #${proposal.proposalId}`;
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
  const { activeProposals, pastProposals, validatorVotes, validator: _validator } = data;

  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  // Synchronous ref guard so rapid double-clicks can't enqueue two requests before
  // React re-renders with isVoting: true.
  const isVotingRef = useRef(false);
  const [isVoteDialogOpen, setIsVoteDialogOpen] = useState(false);

  const getVoteLabel = (proposalId: number) => {
    const vote = validatorVotes[proposalId];
    if (!vote) return null;

    // Mapping vote options to labels
    const options: Record<number, { label: string; variant: BadgeProps["variant"] }> = {
      1: { label: "YES", variant: "success" },
      2: { label: "ABSTAIN", variant: "secondary" },
      3: { label: "NO", variant: "destructive" },
      4: { label: "NO WITH VETO", variant: "warning" },
    };

    const option = vote.option;
    return options[option] || { label: "VOTED", variant: "default" as const };
  };

  // v1beta1 numeric statuses for finished proposals (see convertV1ToV1Beta1Proposal)
  const pastStatusBadges: Record<
    number,
    { label: string; variant: BadgeProps["variant"]; mark: BadgeMark }
  > = {
    3: { label: "PASSED", variant: "success", mark: "signal" },
    4: { label: "REJECTED", variant: "destructive", mark: "stripes" },
    5: { label: "FAILED", variant: "destructive", mark: "stripes" },
  };

  const formatVotingEnd = (proposal: Proposal): string | null => {
    const seconds = proposal.votingEndTime?.seconds;
    if (!seconds) return null;
    const ms = Number(seconds) * 1000;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms).toLocaleDateString();
  };

  const submitVote = async (proposalId: number, option: number) => {
    // Prevent duplicate submissions — check both the React state and the synchronous ref
    // so rapid double-clicks can't race before the state re-render takes effect.
    if (isVoting || isVotingRef.current) {
      return;
    }

    // Check the wallet before taking the lock: a return from here must not leave it set.
    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }
    isVotingRef.current = true;

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
          if (result.warning) {
            toast.warning(result.warning, { duration: 8000 });
          }
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
        isVotingRef.current = false;
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

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      const messages = [
        {
          typeUrl: MsgTypeUrls.Vote,
          value: {
            proposalId: proposalId,
            voter: walletInfo.address,
            option: option,
          },
        },
      ];

      // Calculate fee from the shared gas table
      const gasLimit = gasOfTx([MsgTypeUrls.Vote]);
      const fee = calculateFee(gasLimit, chain.gasPrice);

      const result = await client.signAndBroadcast(walletInfo.address, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      const txExplorerUrl = explorerLinkTx(chain.explorerLinks.tx, result.transactionHash);
      toast.success("Vote broadcasted successfully!", {
        description: `Tx: ${result.transactionHash.slice(0, 12)}...`,
        action: txExplorerUrl
          ? {
              label: "View on Explorer",
              onClick: () => window.open(txExplorerUrl, "_blank"),
            }
          : undefined,
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
      isVotingRef.current = false;
    }
  };

  const voteOptions = [
    {
      label: "Yes",
      value: 1,
      color:
        "border-transparent bg-success text-success-foreground hover:bg-success/80 active:bg-success/70",
    },
    {
      label: "Abstain",
      value: 2,
      color: "border-transparent bg-muted text-foreground hover:bg-muted/80 active:bg-muted/70",
    },
    {
      label: "No",
      value: 3,
      color:
        "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 active:bg-destructive/70",
    },
    {
      label: "No with Veto",
      value: 4,
      color:
        "border-transparent bg-warning text-warning-foreground hover:bg-warning/80 active:bg-warning/70",
    },
  ];

  // The drop-down lists the same rows the inline list used to: the latest 10 finished proposals
  const pastShown = pastProposals === null ? null : pastProposals.slice(0, PAST_PROPOSALS_SHOWN);
  // "latest N" whenever there is at least one row: the count comes from the newest 20 proposals of
  // any status (getPastProposals), so a bare "(7)" could be less than the real total while "latest
  // 7" is always true. Until 2026-10-10 the label said the real number up to 10 and "latest 10"
  // only above that.
  const pastLabel =
    pastShown === null
      ? "unavailable"
      : pastShown.length === 0
        ? "0"
        : `latest ${pastShown.length}`;

  return (
    <div className="space-y-4">
      {activeProposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 py-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-accent opacity-50" />
          <p className="text-sm text-muted-foreground">No active proposals in voting period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeProposals.map((proposal) => {
            const proposalId = proposal.proposalId as unknown as number;
            const voteInfo = getVoteLabel(proposalId);
            const explorerLink = chain.explorerLinks.proposal?.replace(
              "${proposalId}",
              proposalId.toString(),
            );

            return (
              <div
                key={proposalId}
                className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    {/* The small "Proposal #47" kicker only when the title is a real one: with no
                        title the heading itself reads "Proposal #47", so it would say it twice. */}
                    {readProposalTitle(proposal) !== null && (
                      <span className="font-mono text-[10px] uppercase tracking-tighter text-muted-foreground">
                        Proposal #{proposalId}
                      </span>
                    )}
                    <h4 className="line-clamp-2 font-heading text-sm font-semibold leading-tight">
                      {getProposalTitle(proposal)}
                    </h4>
                  </div>
                  {voteInfo ? (
                    <Badge variant={voteInfo.variant}>{voteInfo.label}</Badge>
                  ) : (
                    <Badge variant="warning" mark="half">
                      NEEDS VOTE
                    </Badge>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 max-sm:h-11"
                    onClick={() => {
                      setSelectedProposal(proposal);
                      setIsVoteDialogOpen(true);
                    }}
                  >
                    <KitIcon name="governance" size={20} />
                    Vote Now
                  </Button>

                  {explorerLink && (
                    <Button variant="ghost" size="sm" className="gap-1.5 max-sm:h-11" asChild>
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
            <DialogTitle className="font-heading text-xl font-bold">
              {isCliqMode ? "Propose Vote" : "Cast Your Vote"}
            </DialogTitle>
            <DialogDescription>
              {isCliqMode
                ? `Create a transaction to vote on Proposal #${selectedProposal?.proposalId as unknown as number}`
                : `Select an option for Proposal #${selectedProposal?.proposalId as unknown as number}`}
            </DialogDescription>
          </DialogHeader>

          {isCliqMode && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>This will create a transaction for multisig signing</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 py-4">
            {voteOptions.map((option) => (
              <Button
                key={option.value}
                disabled={readOnly || isVoting}
                className={`${option.color} h-12 font-bold`}
                onClick={() =>
                  submitVote(selectedProposal?.proposalId as unknown as number, option.value)
                }
              >
                {isVoting ? <Loader2 className="h-4 w-4 animate-spin" /> : option.label}
              </Button>
            ))}
          </div>

          {data.votingPowerPercentage !== null && (
            <p className="text-center text-xs text-muted-foreground">
              Your voting power:{" "}
              <span className="font-semibold text-foreground">{data.votingPowerPercentage}%</span>
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Past proposals: a drop-down, closed by default */}
      <Collapsible className="border-t border-border/[0.06] pt-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group w-full justify-between max-sm:h-11">
            <span>Past proposals ({pastLabel})</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-ui group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {pastShown === null ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Proposal history unavailable — no REST endpoint answered for this chain.
            </p>
          ) : pastShown.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No past proposals found.</p>
          ) : (
            // The opened list has its own scroll, like the stakers list, so the Governance panel
            // grows by one box instead of by ten rows (it went from 384px to 966px and dragged
            // the Stakers card with it, measured 2026-10-10). `relative` keeps the box positioned.
            <div className="relative mt-2 max-h-[260px] space-y-1.5 overflow-y-auto">
              {pastShown.map((proposal) => {
                const proposalId = proposal.proposalId as unknown as number;
                const badge = pastStatusBadges[proposal.status] ?? {
                  label: "CLOSED",
                  variant: "secondary" as const,
                  mark: "ring" as const,
                };
                const endDate = formatVotingEnd(proposal);
                const explorerLink = chain.explorerLinks.proposal?.replace(
                  "${proposalId}",
                  proposalId.toString(),
                );

                const row = (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40">
                    <div className="min-w-0 space-y-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{proposalId}
                        {endDate ? ` · ended ${endDate}` : ""}
                      </span>
                      <p className="truncate text-xs font-medium leading-tight">
                        {getProposalTitle(proposal)}
                      </p>
                    </div>
                    <Badge variant={badge.variant} mark={badge.mark} className="shrink-0">
                      {badge.label}
                    </Badge>
                  </div>
                );

                return explorerLink ? (
                  <a
                    key={proposalId}
                    href={explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {row}
                  </a>
                ) : (
                  <div key={proposalId}>{row}</div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Info/Help: said only when the share was measured (null = the pool query failed) */}
      {data.votingPowerPercentage !== null && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Voting Power:</strong> Your validator represents{" "}
          <span className="font-semibold text-foreground">{data.votingPowerPercentage}%</span> of
          the network's voting power.
        </p>
      )}
    </div>
  );
}
