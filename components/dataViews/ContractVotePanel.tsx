/**
 * Contract Vote Panel
 *
 * File: components/dataViews/ContractVotePanel.tsx
 *
 * Panel for viewing proposal details and casting votes.
 * Shows vote breakdown, current status, and voting buttons.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Clock,
  User,
  Loader2,
  ShieldCheck,
  PlayCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { VoteOption } from "@/lib/multisig/contract-types";
import { formatDistanceToNow } from "date-fns";
import {
  CredentialBadge,
  CredentialStatusType,
  mapVerificationResultToStatus,
} from "@/components/ui/credential-badge";
import { useWallet } from "@/context/WalletContext";
import { useChains } from "@/context/ChainsContext";
import { createSigningCW3ClientFromSigner } from "@/lib/contract/cw3-client";
import { getGasAdjustment } from "@/lib/contract/codeRegistry";
import { ensureProtocol } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ContractVotePanelProps {
  contractAddress: string;
  chainId: string;
  nodeAddress: string;
  proposalId: number;
  userAddress?: string;
  /** Whether this multisig requires credential verification (Phase 3) */
  isCredentialGated?: boolean;
  onVoteSuccess?: () => void;
  onExecuteSuccess?: () => void;
  onClose?: () => void;
}

interface ProposalDetails {
  id: number;
  title: string;
  description: string;
  status: string;
  proposer: string;
  expiresAt: string | null;
  threshold: number;
  totalWeight: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
  vetoWeight: number;
  userVote?: VoteOption;
  userWeight?: number;
  canVote: boolean;
  canExecute: boolean;
}

// ============================================================================
// Vote Button Component
// ============================================================================

function VoteButton({
  label,
  icon,
  variant,
  isSelected,
  isLoading,
  disabled,
  onClick,
}: {
  option: VoteOption;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary";
  isSelected: boolean;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={isSelected ? "default" : variant}
      className={`flex-1 gap-2 ${isSelected ? "ring-2 ring-offset-2" : ""}`}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ContractVotePanel({
  contractAddress,
  chainId,
  nodeAddress,
  proposalId,
  userAddress,
  isCredentialGated = false,
  onVoteSuccess,
  onExecuteSuccess,
  onClose,
}: ContractVotePanelProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner, getAminoSigner } = useWallet();
  const [proposal, setProposal] = useState<ProposalDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: Credential verification state
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatusType>("loading");
  const [credentialRole, setCredentialRole] = useState<string | undefined>(undefined);
  // Phase 3: tracks credential check loading (not rendered yet, prep for loading indicator)
  const [, setIsCheckingCredential] = useState(false);

  // Phase 3: Check credential validity
  const checkCredential = useCallback(async () => {
    if (!isCredentialGated || !userAddress) {
      setCredentialStatus("not_required");
      return;
    }

    setIsCheckingCredential(true);
    try {
      const response = await fetch(
        `/api/chain/${chainId}/credentials/verify?teamAddress=${contractAddress}&signerAddress=${userAddress}`,
      );

      if (!response.ok) {
        setCredentialStatus("missing");
        return;
      }

      const data = await response.json();
      const status = mapVerificationResultToStatus(
        { isValid: data.isValid, reason: data.reason },
        false,
        true,
      );
      setCredentialStatus(status);

      if (data.credential) {
        setCredentialRole(data.credential.role);
      }
    } catch (err) {
      console.error("Failed to check credential:", err);
      setCredentialStatus("missing");
    } finally {
      setIsCheckingCredential(false);
    }
  }, [isCredentialGated, userAddress, chainId, contractAddress]);

  // Check credential on mount and when user changes
  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  // Fetch proposal details and verify user can vote
  useEffect(() => {
    const fetchProposalDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify if user can vote
        if (userAddress) {
          const verifyResponse = await fetch(
            `/api/chain/${chainId}/contract-multisig/${contractAddress}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "verify-vote",
                nodeAddress,
                proposalId,
                voterAddress: userAddress,
              }),
            },
          );

          const verifyData = await verifyResponse.json();

          if (verifyData.result?.chainData) {
            const chainData = verifyData.result.chainData;
            setProposal({
              id: proposalId,
              title: chainData.proposal?.title || `Proposal #${proposalId}`,
              description: chainData.proposal?.description || "",
              status: chainData.proposal?.status || "pending",
              proposer: chainData.proposal?.proposer || "",
              expiresAt: chainData.proposal?.expires?.at_time
                ? new Date(
                    parseInt(chainData.proposal.expires.at_time, 10) / 1_000_000,
                  ).toISOString()
                : null,
              threshold: chainData.threshold || 0,
              totalWeight: chainData.totalWeight || 0,
              yesWeight: chainData.currentYesWeight || 0,
              noWeight: 0, // Would need to query votes
              abstainWeight: 0,
              vetoWeight: 0,
              userVote: chainData.existingVote,
              userWeight: chainData.voterWeight,
              canVote: verifyData.result.verified,
              canExecute: (chainData.currentYesWeight || 0) >= (chainData.threshold || 0),
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch proposal details:", err);
        setError(err instanceof Error ? err.message : "Failed to load proposal");
      } finally {
        setIsLoading(false);
      }
    };

    if (contractAddress && chainId && nodeAddress && proposalId) {
      fetchProposalDetails();
    }
  }, [contractAddress, chainId, nodeAddress, proposalId, userAddress]);

  // Handle vote — submits on-chain via CW3Client
  const handleVote = async (vote: VoteOption) => {
    if (!userAddress || !walletInfo) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    setIsVoting(true);
    setSelectedVote(vote);

    try {
      toast.info(`Submitting "${vote}" vote...`, {
        description: "Please approve the transaction in your wallet",
      });

      // Get signer from wallet context
      const signer = (await getDirectSigner()) || (await getAminoSigner());
      if (!signer) {
        toast.error("Failed to get wallet signer", {
          description: "Please reconnect your wallet and try again",
        });
        return;
      }

      // Create a signing CW3 client with chain-specific gas multiplier
      const gasAdj = getGasAdjustment(chainId);
      const cw3Client = await createSigningCW3ClientFromSigner(
        ensureProtocol(nodeAddress),
        contractAddress,
        chainId,
        signer,
        chain.gasPrice,
        gasAdj,
      );

      // Submit the vote on-chain
      const result = await cw3Client.vote(proposalId, vote);

      if (!result.success) {
        toast.error("Vote failed", {
          description: result.error || "Unknown error during vote submission",
        });
        return;
      }

      toast.success(`Vote "${vote}" submitted!`, {
        description: `Tx: ${result.txHash.slice(0, 16)}...`,
      });

      onVoteSuccess?.();
    } catch (err) {
      console.error("Vote failed:", err);
      toast.error("Failed to submit vote", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsVoting(false);
      setSelectedVote(null);
    }
  };

  // Handle execute — executes a passed proposal on-chain
  const handleExecute = async () => {
    if (!walletInfo) {
      toast.error("Please connect your wallet to execute");
      return;
    }

    setIsExecuting(true);

    try {
      toast.info(`Executing proposal #${proposalId}...`, {
        description: "Please approve the transaction in your wallet",
      });

      // Get signer from wallet context
      const signer = (await getDirectSigner()) || (await getAminoSigner());
      if (!signer) {
        toast.error("Failed to get wallet signer", {
          description: "Please reconnect your wallet and try again",
        });
        return;
      }

      // Create a signing CW3 client with chain-specific gas multiplier
      const gasAdj = getGasAdjustment(chainId);
      const cw3Client = await createSigningCW3ClientFromSigner(
        ensureProtocol(nodeAddress),
        contractAddress,
        chainId,
        signer,
        chain.gasPrice,
        gasAdj,
      );

      // Execute the proposal on-chain
      const result = await cw3Client.execute(proposalId);

      if (!result.success) {
        toast.error("Execution failed", {
          description: result.error || "Unknown error during execution",
        });
        return;
      }

      toast.success(`Proposal #${proposalId} executed!`, {
        description: `Tx: ${result.txHash.slice(0, 16)}...`,
      });

      onExecuteSuccess?.();
    } catch (err) {
      console.error("Execute failed:", err);
      toast.error("Failed to execute proposal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Calculate progress
  const getVoteProgress = (): number => {
    if (!proposal || proposal.threshold === 0) return 0;
    return Math.min(100, (proposal.yesWeight / proposal.threshold) * 100);
  };

  // Get time remaining
  const getTimeRemaining = (): string => {
    if (!proposal?.expiresAt) return "No expiration";

    try {
      const expiry = new Date(proposal.expiresAt);
      if (expiry < new Date()) {
        return "Expired";
      }
      return `Expires ${formatDistanceToNow(expiry, { addSuffix: true })}`;
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
  if (error || !proposal) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error || "Failed to load proposal"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                #{proposal.id}
              </Badge>
              <Badge variant={proposal.status === "passed" ? "default" : "secondary"}>
                {proposal.status}
              </Badge>
            </div>
            <CardTitle className="text-xl">{proposal.title}</CardTitle>
            <CardDescription className="mt-1">
              {proposal.description || "No description"}
            </CardDescription>
          </div>
        </div>

        {/* Proposer and Expiration */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span className="font-mono text-xs">
              {proposal.proposer.slice(0, 12)}...{proposal.proposer.slice(-6)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{getTimeRemaining()}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Vote Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Threshold Progress</span>
            <span className="font-medium">
              {proposal.yesWeight} / {proposal.threshold} votes
            </span>
          </div>
          <Progress value={getVoteProgress()} className="h-3" />
          {proposal.yesWeight >= proposal.threshold && (
            <Alert className="border-green-accent/30 bg-green-accent/10">
              <ShieldCheck className="h-4 w-4 text-green-accent" />
              <AlertDescription className="text-green-accent">
                Threshold reached! This proposal can be executed.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Vote Breakdown */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="mb-1 flex items-center justify-center gap-1 text-green-accent">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-bold">{proposal.yesWeight}</span>
            </div>
            <span className="text-xs text-muted-foreground">Yes</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-center gap-1 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="font-bold">{proposal.noWeight}</span>
            </div>
            <span className="text-xs text-muted-foreground">No</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-center gap-1 text-gray-500">
              <MinusCircle className="h-4 w-4" />
              <span className="font-bold">{proposal.abstainWeight}</span>
            </div>
            <span className="text-xs text-muted-foreground">Abstain</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-center gap-1 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-bold">{proposal.vetoWeight}</span>
            </div>
            <span className="text-xs text-muted-foreground">Veto</span>
          </div>
        </div>

        <Separator />

        {/* User Vote Status */}
        {proposal.userVote && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              You voted <strong>{proposal.userVote}</strong> with weight {proposal.userWeight}
            </AlertDescription>
          </Alert>
        )}

        {/* Phase 3: Credential Status for Credential-Gated Multisigs */}
        {isCredentialGated && userAddress && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Credential Status</span>
            </div>
            <CredentialBadge status={credentialStatus} role={credentialRole} showTooltip />
          </div>
        )}

        {/* Phase 3: Credential Warning */}
        {isCredentialGated &&
          credentialStatus !== "valid" &&
          credentialStatus !== "not_required" &&
          credentialStatus !== "loading" &&
          userAddress && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                {credentialStatus === "missing" &&
                  "You need a valid credential to vote on this proposal."}
                {credentialStatus === "expired" &&
                  "Your credential has expired. Please request a new one."}
                {credentialStatus === "frozen" && "Your credential is frozen and cannot be used."}
                {credentialStatus === "revoked" && "Your credential has been revoked."}
                {credentialStatus === "wrong_role" &&
                  "Your credential does not have the required role."}
              </AlertDescription>
            </Alert>
          )}

        {/* Voting Buttons */}
        {proposal.canVote && !proposal.userVote && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cast your vote (weight: {proposal.userWeight})
            </p>
            <div className="flex gap-2">
              <VoteButton
                option="yes"
                label="Yes"
                icon={<CheckCircle2 className="h-4 w-4" />}
                variant="default"
                isSelected={selectedVote === "yes"}
                isLoading={isVoting && selectedVote === "yes"}
                disabled={isVoting || (isCredentialGated && credentialStatus !== "valid")}
                onClick={() => handleVote("yes")}
              />
              <VoteButton
                option="no"
                label="No"
                icon={<XCircle className="h-4 w-4" />}
                variant="destructive"
                isSelected={selectedVote === "no"}
                isLoading={isVoting && selectedVote === "no"}
                disabled={isVoting || (isCredentialGated && credentialStatus !== "valid")}
                onClick={() => handleVote("no")}
              />
              <VoteButton
                option="abstain"
                label="Abstain"
                icon={<MinusCircle className="h-4 w-4" />}
                variant="secondary"
                isSelected={selectedVote === "abstain"}
                isLoading={isVoting && selectedVote === "abstain"}
                disabled={isVoting || (isCredentialGated && credentialStatus !== "valid")}
                onClick={() => handleVote("abstain")}
              />
            </div>
          </div>
        )}

        {/* Cannot Vote Message */}
        {!proposal.canVote && !proposal.userVote && userAddress && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You cannot vote on this proposal. You may not be a member or the proposal is closed.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}

        {proposal.canExecute && (
          <Button onClick={handleExecute} disabled={isExecuting} className="gap-2">
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Execute Proposal
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
