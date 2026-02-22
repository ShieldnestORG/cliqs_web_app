/**
 * Withdraw Address Card
 *
 * File: components/dataViews/ValidatorDashboard/WithdrawAddressCard.tsx
 *
 * Displays and allows changing the reward withdraw address.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildSetWithdrawAddressMsg } from "@/lib/validatorTx";
import { ArrowRight, Loader2, Check, X, Users } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { toast } from "sonner";
import { useState } from "react";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { checkAddress } from "@/lib/displayHelpers";
import { useRouter } from "next/router";

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

  const truncateAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

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
        
        const messages = buildSetWithdrawAddressMsg(
          validator.delegatorAddress,
          newAddress
        );

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: `Set withdraw address to ${newAddress.slice(0, 12)}...`,
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
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

      const client = await SigningStargateClient.connectWithSigner(
        chain.nodeAddress,
        signer,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      const messages = [
        {
          typeUrl: MsgTypeUrls.SetWithdrawAddress,
          value: {
            delegatorAddress: validator.delegatorAddress,
            withdrawAddress: newAddress,
          },
        },
      ];

      // Calculate fee based on gas price
      const gasPriceNum = parseFloat(chain.gasPrice) || 0.0625;
      const feeAmount = Math.ceil(gasPriceNum * 100_000).toString();
      
      const fee = {
        amount: [{ denom: chain.denom, amount: feeAmount }],
        gas: "100000",
      };

      const result = await client.signAndBroadcast(
        validator.delegatorAddress,
        messages,
        fee,
        ""
      );

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
              result.transactionHash
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
    <Card variant="institutional" className="h-full">
      <CardHeader>
        <CardLabel comment>Distribution</CardLabel>
        <CardTitle className="text-lg font-heading font-bold">
          Withdraw Address
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            {/* Current Address Display */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSameAsOperator ? (
                  <span className="text-green-accent">Same as operator account</span>
                ) : (
                  <span>Custom withdraw address</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded truncate">
                  {truncateAddress(withdrawAddress)}
                </code>
                <CopyButton
                  value={withdrawAddress}
                  copyLabel="withdraw address"
                />
              </div>
            </div>

            {/* Change Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setIsEditing(true)}
            >
              {isCliqMode ? <Users className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              Change Withdraw Address
              {isCliqMode && <span className="text-xs opacity-70">(via CLIQ)</span>}
            </Button>
          </>
        ) : (
          <>
            {/* Edit Form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  New Withdraw Address
                </label>
                <Input
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

