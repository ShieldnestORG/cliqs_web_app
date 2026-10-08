/**
 * Unjail Action
 *
 * File: components/dataViews/ValidatorDashboard/UnjailAction.tsx
 *
 * One-click MsgUnjail for a jailed validator, rendered inside the jailed banner of the
 * identity card. Only shown while `validator.jailed`; the button is disabled while the
 * chain would reject the unjail (tombstoned, or still inside the jail period).
 *
 * Multisig operator ("CLIQ"): creates the CLIQ transaction and opens the signing page.
 * Single wallet: signs and broadcasts with the connected wallet.
 */

import { Button } from "@/components/ui/button";
import { ValidatorInfo, ValidatorSigningInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildUnjailMsg } from "@/lib/validatorTx";
import { formatJailedUntil, getUnjailGate } from "@/lib/validatorUnjail";
import { makeAppRegistry } from "@/lib/msg";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Loader2, Unlock, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { gasOfTx } from "@/lib/txMsgHelpers";
import { useRouter } from "next/router";

interface UnjailActionProps {
  validator: ValidatorInfo;
  /** null = the chain's signing info could not be read */
  signingInfo: ValidatorSigningInfo | null;
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function UnjailAction({
  validator,
  signingInfo,
  onTransactionComplete,
  isCliqMode = false,
  cliqAddress,
  readOnly = false,
}: UnjailActionProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gate = getUnjailGate({ jailed: validator.jailed, signingInfo, now: new Date() });

  if (gate.status === "hidden") {
    return null;
  }

  // "unverified": the chain decides, so the button stays usable (the notice says why)
  const canUnjail = gate.status === "ready" || gate.status === "unverified";

  const submitUnjail = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsSubmitting(true);

        const loadingToast = toast.loading("Creating transaction...");

        const messages = buildUnjailMsg(validator.operatorAddress);

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: "Unjail validator",
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
        setIsSubmitting(false);
      }
      return;
    }

    // Direct signing mode
    try {
      setIsSubmitting(true);

      const signer = await getDirectSigner();
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      // cosmjs' default registry has no MsgUnjail (unlike MsgEditValidator), so signing
      // fails with "Unregistered type url" unless the app registry is supplied.
      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
        registry: makeAppRegistry(),
      });

      const messages = buildUnjailMsg(validator.operatorAddress);

      // Calculate fee from the shared gas table
      const gasLimit = gasOfTx([MsgTypeUrls.Unjail]);
      const fee = calculateFee(gasLimit, chain.gasPrice);

      const result = await client.signAndBroadcast(validator.delegatorAddress, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      toast.success("Validator unjailed!", {
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
      console.error("Failed to unjail validator:", e);
      toast.error("Failed to unjail validator", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {gate.status === "tombstoned" && (
        <p className="text-sm font-medium text-destructive">
          This validator is tombstoned and can never be unjailed.
        </p>
      )}
      {gate.status === "waiting" && (
        <p className="text-sm font-medium text-warning">
          Jailed until {formatJailedUntil(gate.until)}. You can unjail after that.
        </p>
      )}
      {gate.status === "unverified" && (
        <p className="text-sm text-warning">
          Could not read the jail status from the chain. The unjail is rejected if the jail period
          has not ended.
        </p>
      )}

      <Button
        variant="action"
        size="action"
        className="w-full gap-2"
        onClick={submitUnjail}
        disabled={readOnly || isSubmitting || !canUnjail}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isCliqMode ? "Creating..." : "Unjailing..."}
          </>
        ) : (
          <>
            {isCliqMode ? <Users className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            Unjail validator
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Unjail only after your node is synced and signing again, or it is jailed and slashed again.
      </p>
    </div>
  );
}
