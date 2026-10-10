/**
 * Pending Rewards
 *
 * Two rows, each with its amount and its own Claim button: validator commission and
 * self-delegation rewards, then one primary "Claim all" when both exist. Renders its content
 * only; the Rewards panel (card) and its ScaleRule heading come from ValidatorDashboard/index.tsx.
 * Until 2026-10-10 the amounts sat in one card and three stacked full-width buttons below them.
 */

import { Button } from "@/components/ui/button";
import { KitIcon } from "@/components/icons/kit";
import { formatDecCoinAmount, ValidatorInfo } from "@/lib/validatorHelpers";
import {
  createCliqTransaction,
  buildClaimCommissionMsg,
  buildClaimRewardsMsg,
} from "@/lib/validatorTx";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Loader2, CheckCircle2, Users } from "lucide-react";
import { DecCoin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { useState } from "react";
import { toast } from "sonner";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { gasOfTx } from "@/lib/txMsgHelpers";
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
          if (result.warning) {
            toast.warning(result.warning, { duration: 8000 });
          }
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

      // Calculate fee from the shared gas table based on the messages being sent
      const gasLimit = gasOfTx(messages.map((m) => m.typeUrl));
      const fee = calculateFee(gasLimit, chain.gasPrice);

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
          if (result.warning) {
            toast.warning(result.warning, { duration: 8000 });
          }
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

      // Calculate fee from the shared gas table
      const gasLimit = gasOfTx([MsgTypeUrls.WithdrawDelegatorReward]);
      const fee = calculateFee(gasLimit, chain.gasPrice);

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

  // One primary per view: "Claim all" when both amounts exist, otherwise the one row that can claim.
  const commissionVariant =
    hasCommission && !hasRewards
      ? isCliqMode
        ? "action-bronze"
        : "default"
      : isCliqMode
        ? "action-bronze-outline"
        : "outline";
  const rewardsVariant =
    hasRewards && !hasCommission
      ? isCliqMode
        ? "action-bronze"
        : "default"
      : isCliqMode
        ? "action-bronze-outline"
        : "outline";

  return (
    <div className="space-y-4">
      {/* CLIQ mode indicator */}
      {isCliqMode && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Actions will create a transaction for multisig signing</span>
        </div>
      )}

      <div className="divide-y divide-border/[0.06]">
        {/* Validator commission */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 pb-3">
          <KitIcon name="rewards" size={28} className="text-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Validator commission</p>
            <p className="break-words font-heading text-xl font-bold tabular-nums">
              {commissionFormatted.amount}{" "}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {commissionFormatted.denom}
              </span>
            </p>
          </div>
          {/* Claim commission only - useful for jailed validators with no self-delegation */}
          <Button
            variant={commissionVariant}
            size="sm"
            className="max-sm:h-11"
            aria-label={isCliqMode ? "Create: Claim commission" : "Claim commission"}
            onClick={() => claimCommission(false)}
            disabled={readOnly || isClaimingCommission || isClaimingRewards || !hasCommission}
          >
            {isClaimingCommission && !hasRewards ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCliqMode ? "Redirecting..." : "Claiming..."}
              </>
            ) : isCliqMode ? (
              "Create: Claim"
            ) : (
              "Claim"
            )}
          </Button>
        </div>

        {/* Self-delegation rewards */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 pt-3">
          <KitIcon name="stake" size={28} className="text-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Self-delegation rewards</p>
            <p className="break-words font-heading text-xl font-bold tabular-nums">
              {rewardsFormatted.amount}{" "}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {rewardsFormatted.denom}
              </span>
            </p>
          </div>
          <Button
            variant={rewardsVariant}
            size="sm"
            className="max-sm:h-11"
            aria-label={
              isCliqMode ? "Create: Claim self-delegation rewards" : "Claim self-delegation rewards"
            }
            onClick={claimRewards}
            disabled={readOnly || isClaimingCommission || isClaimingRewards || !hasRewards}
          >
            {isClaimingRewards ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCliqMode ? "Redirecting..." : "Claiming..."}
              </>
            ) : isCliqMode ? (
              "Create: Claim"
            ) : (
              "Claim"
            )}
          </Button>
        </div>
      </div>

      {/* Show "Claim all" only if there are both rewards and commission */}
      {hasRewards && hasCommission && (
        <Button
          variant={isCliqMode ? "action-bronze" : "default"}
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
              {isCliqMode ? <Users className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {isCliqMode ? "Create: Claim all" : "Claim all"}
            </>
          )}
        </Button>
      )}

      {/* No rewards message */}
      {!hasCommission && !hasRewards && (
        <p className="text-center text-sm text-muted-foreground">
          No pending rewards to claim at this time.
        </p>
      )}
    </div>
  );
}
