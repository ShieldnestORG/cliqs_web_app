/**
 * Pending Rewards Card
 *
 * File: components/dataViews/ValidatorDashboard/PendingRewardsCard.tsx
 *
 * Displays pending commission and staking rewards with claim actions.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDecCoinAmount, ValidatorInfo } from "@/lib/validatorHelpers";
import {
  createCliqTransaction,
  buildClaimCommissionMsg,
  buildClaimRewardsMsg,
} from "@/lib/validatorTx";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Coins, Wallet, Loader2, CheckCircle2, Users } from "lucide-react";
import { DecCoin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { useState } from "react";
import { toast } from "sonner";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { useRouter } from "next/router";

interface PendingRewardsCardProps {
  validator: ValidatorInfo;
  commission: readonly DecCoin[];
  selfDelegationRewards: readonly DecCoin[];
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function PendingRewardsCard({
  validator,
  commission,
  selfDelegationRewards,
  onTransactionComplete,
  isCliqMode = false,
  cliqAddress,
  readOnly = false,
}: PendingRewardsCardProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const router = useRouter();
  const [isClaimingCommission, setIsClaimingCommission] = useState(false);
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);

  // Get the display denom and decimals
  const displayDenom = chain.displayDenom || chain.denom;
  const decimals = chain.displayDenomExponent || 6;

  // Format reward amounts
  const formatReward = (coins: readonly DecCoin[]): { amount: string; denom: string } => {
    const primaryCoin = coins.find((c) => c.denom === chain.denom);
    if (!primaryCoin) {
      return { amount: "0", denom: displayDenom };
    }
    return {
      amount: formatDecCoinAmount(primaryCoin.amount, decimals),
      denom: displayDenom,
    };
  };

  const commissionFormatted = formatReward(commission);
  const rewardsFormatted = formatReward(selfDelegationRewards);

  // Check if there are rewards to claim
  const hasCommission = parseFloat(commissionFormatted.amount) > 0;
  const hasRewards = parseFloat(rewardsFormatted.amount) > 0;

  // Claim commission (includes self-delegation rewards only if they exist)
  const claimCommission = async (includeRewards: boolean = true) => {
    // Prevent duplicate submissions
    if (isClaimingCommission || isClaimingRewards) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsClaimingCommission(true);

        const loadingToast = toast.loading("Creating transaction...");

        const messages = buildClaimCommissionMsg(
          validator.operatorAddress,
          validator.delegatorAddress,
          includeRewards && hasRewards,
        );

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: `Claim ${includeRewards && hasRewards ? "commission + rewards" : "commission"} from validator`,
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
          toast.success("Transaction created!", {
            description: "Redirecting to sign...",
          });
          router.push(`/${chain.registryName}/${cliqAddress}/transaction/${result.txId}`);
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
        setIsClaimingCommission(false);
      }
      return;
    }

    // Direct signing mode
    try {
      setIsClaimingCommission(true);

      const signer = await getDirectSigner();
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      // Build messages dynamically based on what rewards exist
      // For jailed validators with no self-delegation, only send MsgWithdrawValidatorCommission
      const messages = [];

      // Only include self-delegation rewards if they exist AND we want to include them
      if (includeRewards && hasRewards) {
        messages.push({
          typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
          value: {
            delegatorAddress: validator.delegatorAddress,
            validatorAddress: validator.operatorAddress,
          },
        });
      }

      // Always include commission withdrawal
      messages.push({
        typeUrl: MsgTypeUrls.WithdrawValidatorCommission,
        value: {
          validatorAddress: validator.operatorAddress,
        },
      });

      // Calculate fee based on number of messages
      const gasPriceNum = parseFloat(chain.gasPrice) || 0.0625;
      const gasLimit = messages.length > 1 ? 1_100_000 : 600_000;
      const feeAmount = Math.ceil(gasPriceNum * gasLimit).toString();

      const fee = {
        amount: [{ denom: chain.denom, amount: feeAmount }],
        gas: gasLimit.toString(),
      };

      const result = await client.signAndBroadcast(validator.delegatorAddress, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      const claimedWhat = messages.length > 1 ? "Commission + Rewards" : "Commission";
      toast.success(`${claimedWhat} claimed successfully!`, {
        description: `Transaction hash: ${result.transactionHash}`,
        action: {
          label: "View",
          onClick: () => {
            const explorerLink = chain.explorerLinks.tx?.replace(
              "${txHash}",
              result.transactionHash,
            );
            if (explorerLink) {
              window.open(explorerLink, "_blank");
            }
          },
        },
      });

      onTransactionComplete?.();
    } catch (e) {
      console.error("Failed to claim commission:", e);
      toast.error("Failed to claim commission", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsClaimingCommission(false);
    }
  };

  // Claim only staking rewards (without commission)
  const claimRewards = async () => {
    // Prevent duplicate submissions
    if (isClaimingCommission || isClaimingRewards) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsClaimingRewards(true);

        const loadingToast = toast.loading("Creating transaction...");

        const messages = buildClaimRewardsMsg(
          validator.operatorAddress,
          validator.delegatorAddress,
        );

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: "Claim staking rewards from validator",
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
          toast.success("Transaction created!", {
            description: "Redirecting to sign...",
          });
          router.push(`/${chain.registryName}/${cliqAddress}/transaction/${result.txId}`);
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
        setIsClaimingRewards(false);
      }
      return;
    }

    // Direct signing mode
    try {
      setIsClaimingRewards(true);

      const signer = await getDirectSigner();
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      const messages = [
        {
          typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
          value: {
            delegatorAddress: validator.delegatorAddress,
            validatorAddress: validator.operatorAddress,
          },
        },
      ];

      // Calculate fee based on gas price
      const gasPriceNum = parseFloat(chain.gasPrice) || 0.0625;
      const feeAmount = Math.ceil(gasPriceNum * 500_000).toString();

      const fee = {
        amount: [{ denom: chain.denom, amount: feeAmount }],
        gas: "500000",
      };

      const result = await client.signAndBroadcast(validator.delegatorAddress, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      toast.success("Rewards claimed successfully!", {
        description: `Transaction hash: ${result.transactionHash}`,
        action: {
          label: "View",
          onClick: () => {
            const explorerLink = chain.explorerLinks.tx?.replace(
              "${txHash}",
              result.transactionHash,
            );
            if (explorerLink) {
              window.open(explorerLink, "_blank");
            }
          },
        },
      });

      onTransactionComplete?.();
    } catch (e) {
      console.error("Failed to claim rewards:", e);
      toast.error("Failed to claim rewards", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsClaimingRewards(false);
    }
  };

  return (
    <Card variant="institutional" accent="left" className="h-full">
      <CardHeader>
        <CardLabel comment>Pending</CardLabel>
        <CardTitle className="font-heading text-xl font-bold">Rewards & Commission</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Commission */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span>Validator Commission</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold tabular-nums">
              {commissionFormatted.amount}
            </span>
            <span className="font-mono text-lg text-muted-foreground">
              {commissionFormatted.denom}
            </span>
          </div>
        </div>

        <Separator />

        {/* Self-Delegation Rewards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span>Self-Delegation Rewards</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold tabular-nums">
              {rewardsFormatted.amount}
            </span>
            <span className="font-mono text-lg text-muted-foreground">
              {rewardsFormatted.denom}
            </span>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-3">
          {/* CLIQ mode indicator */}
          {isCliqMode && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Actions will create a transaction for multisig signing</span>
            </div>
          )}

          {/* Show "Claim All" only if there are both rewards and commission */}
          {hasRewards && hasCommission && (
            <Button
              variant={isCliqMode ? "action-bronze" : "action"}
              size="action"
              className="w-full gap-2"
              onClick={() => claimCommission(true)}
              disabled={readOnly || isClaimingCommission || isClaimingRewards}
            >
              {isClaimingCommission ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isCliqMode ? "Redirecting..." : "Claiming..."}
                </>
              ) : (
                <>
                  {isCliqMode ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isCliqMode ? "Create: Claim All" : "Claim All (Commission + Rewards)"}
                </>
              )}
            </Button>
          )}

          {/* Claim Commission Only - useful for jailed validators with no self-delegation */}
          <Button
            variant={
              isCliqMode
                ? hasRewards
                  ? "action-bronze-outline"
                  : "action-bronze"
                : hasRewards
                  ? "action-outline"
                  : "action"
            }
            size="action"
            className="w-full gap-2"
            onClick={() => claimCommission(false)}
            disabled={readOnly || isClaimingCommission || isClaimingRewards || !hasCommission}
          >
            {isClaimingCommission && !hasRewards ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCliqMode ? "Redirecting..." : "Claiming..."}
              </>
            ) : (
              <>
                {isCliqMode ? <Users className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                {isCliqMode ? "Create: Claim Commission" : "Claim Commission Only"}
              </>
            )}
          </Button>

          {/* Claim Rewards Only */}
          <Button
            variant={isCliqMode ? "action-bronze-outline" : "action-outline"}
            size="action"
            className="w-full gap-2"
            onClick={claimRewards}
            disabled={readOnly || isClaimingCommission || isClaimingRewards || !hasRewards}
          >
            {isClaimingRewards ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCliqMode ? "Redirecting..." : "Claiming..."}
              </>
            ) : (
              <>
                {isCliqMode ? <Users className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {isCliqMode ? "Create: Claim Rewards" : "Claim Rewards Only"}
              </>
            )}
          </Button>
        </div>

        {/* No rewards message */}
        {!hasCommission && !hasRewards && (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No pending rewards to claim at this time.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
