/**
 * Withdraw Address
 *
 * One line under the rewards: "Paid to core1...asj6gw [copy] [Change]". Change reveals the
 * input and the submit button. Renders its content only; the Rewards panel (card) comes from
 * ValidatorDashboard/index.tsx. Until 2026-10-10 this was its own full-height "Distribution" card.
 *
 * It is ONE line (since 2026-10-10): the row already fills a half-width Rewards card, so
 * the fact "same as operator account" / "custom address" is no longer a second line of text. It
 * is the "Paid to" label's `title` (hover) and a screen-reader-only phrase after the label.
 */

import { Button } from "@/components/ui/button";
import { KitIcon } from "@/components/icons/kit";
import { Input } from "@/components/ui/input";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildSetWithdrawAddressMsg } from "@/lib/validatorTx";
import { Loader2, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { gasOfTx } from "@/lib/txMsgHelpers";
import { checkAddress } from "@/lib/displayHelpers";
import { useRouter } from "next/router";
import { AddressDisplay } from "@/components/ui/address-display";

interface WithdrawAddressCardProps {
  validator: ValidatorInfo;
  withdrawAddress: string;
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function WithdrawAddressCard({
  validator,
  withdrawAddress,
  onTransactionComplete,
  isCliqMode = false,
  cliqAddress,
  readOnly = false,
}: WithdrawAddressCardProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSameAsOperator = withdrawAddress === validator.delegatorAddress;
  const addressKind = isSameAsOperator ? "Same as operator account" : "Custom address";

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Validate address
    const addressError = checkAddress(newAddress, chain.addressPrefix);
    if (addressError) {
      toast.error("Invalid address", { description: addressError });
      return;
    }

    if (newAddress === withdrawAddress) {
      toast.error("New address is the same as current address");
      return;
    }

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsSubmitting(true);

        const loadingToast = toast.loading("Creating transaction...");

        const messages = buildSetWithdrawAddressMsg(validator.delegatorAddress, newAddress);

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: `Set withdraw address to ${newAddress.slice(0, 12)}...`,
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
          if (result.warning) {
            toast.warning(result.warning, { duration: 8000 });
          }
          toast.success("Transaction created!", {
            description: "Redirecting to sign...",
          });
          setIsEditing(false);
          setNewAddress("");
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

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      const messages = [
        {
          typeUrl: MsgTypeUrls.SetWithdrawAddress,
          value: {
            delegatorAddress: validator.delegatorAddress,
            withdrawAddress: newAddress,
          },
        },
      ];

      // Calculate fee from the shared gas table
      const gasLimit = gasOfTx([MsgTypeUrls.SetWithdrawAddress]);
      const fee = calculateFee(gasLimit, chain.gasPrice);

      const result = await client.signAndBroadcast(validator.delegatorAddress, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      toast.success("Withdraw address updated!", {
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

      setIsEditing(false);
      setNewAddress("");
      onTransactionComplete?.();
    } catch (e) {
      console.error("Failed to set withdraw address:", e);
      toast.error("Failed to update withdraw address", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setNewAddress("");
  };

  return (
    <div className="space-y-1.5">
      {/* Current address, one line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <KitIcon name="withdraw" size={24} className="shrink-0 text-foreground" />
        {/* `relative` contains the sr-only phrase (it is absolutely positioned) */}
        <span className="relative text-sm text-muted-foreground" title={addressKind}>
          Paid to
          <span className="sr-only">, {addressKind.toLowerCase()}</span>
        </span>
        <AddressDisplay address={withdrawAddress} copyLabel="withdraw address" />
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2 max-sm:h-11"
            onClick={() => setIsEditing(true)}
          >
            {isCliqMode && <Users className="h-4 w-4" />}
            Change
            {isCliqMode && <span className="text-xs opacity-70">(via CLIQ)</span>}
          </Button>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 pt-1.5">
          <div className="space-y-2">
            <label htmlFor="withdraw-address-input" className="text-sm font-medium">
              New Withdraw Address
            </label>
            <Input
              id="withdraw-address-input"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder={`${chain.addressPrefix}1...`}
              className="font-mono text-sm"
              disabled={readOnly || isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              All future rewards will be sent to this address.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="action"
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={readOnly || isSubmitting || !newAddress}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isCliqMode ? "Redirecting..." : "Updating..."}
                </>
              ) : isCliqMode ? (
                <>
                  <Users className="h-4 w-4" />
                  Create Transaction
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirm
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={cancelEdit}
              disabled={readOnly || isSubmitting}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
