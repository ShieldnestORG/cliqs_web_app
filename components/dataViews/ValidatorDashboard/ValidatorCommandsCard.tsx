/**
 * Validator Commands Card
 *
 * File: components/dataViews/ValidatorDashboard/ValidatorCommandsCard.tsx
 *
 * Allows validators to edit their metadata and commission settings.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction, buildEditValidatorMsg } from "@/lib/validatorTx";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import {
  Settings,
  Edit3,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Coins,
  Vote,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";
import { Decimal } from "@cosmjs/math";
import Link from "next/link";
import { useRouter } from "next/router";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

interface ValidatorCommandsCardProps {
  validator: ValidatorInfo;
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function ValidatorCommandsCard({
  validator,
  onTransactionComplete,
  isCliqMode = false,
  cliqAddress,
  readOnly = false,
}: ValidatorCommandsCardProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the target address for links (CLIQ or direct)
  const targetAddress = isCliqMode && cliqAddress ? cliqAddress : validator.delegatorAddress;

  // Enabled fields state
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    moniker: false,
    identity: false,
    website: false,
    securityContact: false,
    details: false,
    commissionRate: false,
    minSelfDelegation: false,
  });

  // Form state
  const [description, setDescription] = useState({
    moniker: validator.moniker || "",
    identity: validator.identity || "",
    website: validator.website || "",
    securityContact: validator.securityContact || "",
    details: validator.details || "",
  });
  const [commissionRate, setCommissionRate] = useState("");
  const [minSelfDelegation, setMinSelfDelegation] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if any fields are enabled
  const hasEnabledFields = () => {
    return Object.values(enabledFields).some((enabled) => enabled);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate commission rate if enabled
    if (enabledFields.commissionRate && commissionRate.trim()) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        newErrors.commissionRate = "Commission rate must be between 0 and 1";
      }
    }

    // Validate min self delegation if enabled
    if (enabledFields.minSelfDelegation && minSelfDelegation.trim()) {
      const minDelegation = parseFloat(minSelfDelegation);
      if (isNaN(minDelegation) || minDelegation <= 0) {
        newErrors.minSelfDelegation = "Min self delegation must be greater than 0";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit validator edit transaction
  const submitEdit = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!walletInfo) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!hasEnabledFields()) {
      toast.error("Please select at least one field to update");
      return;
    }

    if (!validateForm()) {
      return;
    }

    // CLIQ mode: create transaction directly and redirect to signing
    if (isCliqMode && cliqAddress) {
      try {
        setIsSubmitting(true);

        const loadingToast = toast.loading("Creating transaction...");

        const messages = buildEditValidatorMsg(
          validator.operatorAddress,
          enabledFields,
          description,
          commissionRate.trim() || undefined,
          minSelfDelegation.trim() || undefined,
        );

        const result = await createCliqTransaction({
          chain,
          cliqAddress,
          messages,
          memo: "Edit validator details",
        });

        toast.dismiss(loadingToast);

        if (result.success && result.txId) {
          toast.success("Transaction created!", {
            description: "Redirecting to sign...",
          });
          setIsEditing(false);
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

      // Sentinel value for MsgEditValidator - indicates field should not be modified
      const DO_NOT_MODIFY = "[do-not-modify]";

      // Build the message with ALL description fields
      // Fields that shouldn't change must use the sentinel value "[do-not-modify]"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageValue: any = {
        validatorAddress: validator.operatorAddress,
        description: {
          moniker: enabledFields.moniker ? description.moniker : DO_NOT_MODIFY,
          identity: enabledFields.identity ? description.identity : DO_NOT_MODIFY,
          website: enabledFields.website ? description.website : DO_NOT_MODIFY,
          securityContact: enabledFields.securityContact
            ? description.securityContact
            : DO_NOT_MODIFY,
          details: enabledFields.details ? description.details : DO_NOT_MODIFY,
        },
      };

      // Add commission rate if enabled and provided
      if (enabledFields.commissionRate && commissionRate.trim()) {
        messageValue.commissionRate = Decimal.fromUserInput(commissionRate, 18).atomics;
      }

      // Add min self delegation if enabled and provided
      if (enabledFields.minSelfDelegation && minSelfDelegation.trim()) {
        messageValue.minSelfDelegation = minSelfDelegation.trim();
      }

      const messages = [
        {
          typeUrl: MsgTypeUrls.EditValidator,
          value: messageValue,
        },
      ];

      // Calculate fee
      const gasPriceNum = parseFloat(chain.gasPrice) || 0.0625;
      const feeAmount = Math.ceil(gasPriceNum * 400_000).toString();

      const fee = {
        amount: [{ denom: chain.denom, amount: feeAmount }],
        gas: "400000",
      };

      const result = await client.signAndBroadcast(validator.delegatorAddress, messages, fee, "");

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      toast.success("Validator updated successfully!", {
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
      onTransactionComplete?.();
    } catch (e) {
      console.error("Failed to update validator:", e);
      toast.error("Failed to update validator", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog opens
  const openEditDialog = () => {
    setDescription({
      moniker: validator.moniker || "",
      identity: validator.identity || "",
      website: validator.website || "",
      securityContact: validator.securityContact || "",
      details: validator.details || "",
    });
    setCommissionRate("");
    setMinSelfDelegation("");
    // Reset enabled fields
    setEnabledFields({
      moniker: false,
      identity: false,
      website: false,
      securityContact: false,
      details: false,
      commissionRate: false,
      minSelfDelegation: false,
    });
    setErrors({});
    setIsEditing(true);
  };

  const toggleField = (field: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <Card variant="institutional" accent="left" className="h-full">
      <CardHeader>
        <CardLabel comment>Management</CardLabel>
        <CardTitle className="font-heading text-xl font-bold">Validator Commands</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* CLIQ mode indicator */}
        {isCliqMode && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Managing via CLIQ - actions will create transactions for multisig signing</span>
          </div>
        )}

        {/* Staking & Governance Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Staking & Governance`}</h3>
            <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Delegate */}
              <Link
                href={`/${chain.registryName}/${targetAddress}/transaction/new`}
                className="block"
              >
                <BentoCard variant="default" interactive className="min-h-0 p-4">
                  <div className="flex h-full flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp className="h-6 w-6" />
                      <h4 className="font-heading text-sm font-semibold leading-tight">Delegate</h4>
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Stake tokens to validator
                    </p>
                  </div>
                </BentoCard>
              </Link>

              {/* Undelegate */}
              <Link
                href={`/${chain.registryName}/${targetAddress}/transaction/new`}
                className="block"
              >
                <BentoCard variant="default" interactive className="min-h-0 p-4">
                  <div className="flex h-full flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp className="h-6 w-6" />
                      <h4 className="font-heading text-sm font-semibold leading-tight">
                        Undelegate
                      </h4>
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Unstake tokens from validator
                    </p>
                  </div>
                </BentoCard>
              </Link>

              {/* Redelegate */}
              <Link
                href={`/${chain.registryName}/${targetAddress}/transaction/new`}
                className="block"
              >
                <BentoCard variant="default" interactive className="min-h-0 p-4">
                  <div className="flex h-full flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp className="h-6 w-6" />
                      <h4 className="font-heading text-sm font-semibold leading-tight">
                        Redelegate
                      </h4>
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Move stake between validators
                    </p>
                  </div>
                </BentoCard>
              </Link>

              {/* Withdraw Rewards */}
              <Link
                href={`/${chain.registryName}/${targetAddress}/transaction/new`}
                className="block"
              >
                <BentoCard variant="default" interactive className="min-h-0 p-4">
                  <div className="flex h-full flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <Coins className="h-6 w-6" />
                      <h4 className="font-heading text-sm font-semibold leading-tight">
                        Withdraw Rewards
                      </h4>
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Claim staking rewards
                    </p>
                  </div>
                </BentoCard>
              </Link>

              {/* Vote */}
              <Link
                href={`/${chain.registryName}/${targetAddress}/transaction/new`}
                className="block"
              >
                <BentoCard variant="default" interactive className="min-h-0 p-4">
                  <div className="flex h-full flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <Vote className="h-6 w-6" />
                      <h4 className="font-heading text-sm font-semibold leading-tight">Vote</h4>
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Vote on governance proposals
                    </p>
                  </div>
                </BentoCard>
              </Link>
            </BentoGrid>
          </div>
        </div>

        <Separator />

        {/* Edit Metadata Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Edit3 className="h-4 w-4" />
            <span>Edit Validator Info</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Update your validator's name, description, website, and commission settings.
          </p>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-3">
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button
                variant="action"
                size="action"
                className="w-full gap-2"
                onClick={openEditDialog}
              >
                <Settings className="h-4 w-4" />
                Edit Validator Details
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl font-bold">
                  Edit Validator Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Select fields to update
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-moniker" className="flex-1">
                        Moniker (Name)
                      </Label>
                      <Switch
                        id="toggle-moniker"
                        checked={enabledFields.moniker}
                        onCheckedChange={() => toggleField("moniker")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-identity" className="flex-1">
                        Identity (Keybase)
                      </Label>
                      <Switch
                        id="toggle-identity"
                        checked={enabledFields.identity}
                        onCheckedChange={() => toggleField("identity")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-website" className="flex-1">
                        Website
                      </Label>
                      <Switch
                        id="toggle-website"
                        checked={enabledFields.website}
                        onCheckedChange={() => toggleField("website")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-security" className="flex-1">
                        Security Contact
                      </Label>
                      <Switch
                        id="toggle-security"
                        checked={enabledFields.securityContact}
                        onCheckedChange={() => toggleField("securityContact")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-details" className="flex-1">
                        Details
                      </Label>
                      <Switch
                        id="toggle-details"
                        checked={enabledFields.details}
                        onCheckedChange={() => toggleField("details")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-commission" className="flex-1">
                        Commission Rate
                      </Label>
                      <Switch
                        id="toggle-commission"
                        checked={enabledFields.commissionRate}
                        onCheckedChange={() => toggleField("commissionRate")}
                      />
                    </div>
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor="toggle-min-delegation" className="flex-1">
                        Min Self Delegation
                      </Label>
                      <Switch
                        id="toggle-min-delegation"
                        checked={enabledFields.minSelfDelegation}
                        onCheckedChange={() => toggleField("minSelfDelegation")}
                      />
                    </div>
                  </div>
                </div>

                {hasEnabledFields() && <Separator />}

                {/* Form Inputs for Enabled Fields */}
                <div className="space-y-4">
                  {enabledFields.moniker && (
                    <Input
                      label="Moniker (Name)"
                      value={description.moniker}
                      onChange={(e) =>
                        setDescription((prev) => ({ ...prev, moniker: e.target.value }))
                      }
                      placeholder="Enter validator name"
                    />
                  )}
                  {enabledFields.identity && (
                    <Input
                      label="Identity"
                      value={description.identity}
                      onChange={(e) =>
                        setDescription((prev) => ({ ...prev, identity: e.target.value }))
                      }
                      placeholder="Keybase identity"
                    />
                  )}
                  {enabledFields.website && (
                    <Input
                      label="Website"
                      value={description.website}
                      onChange={(e) =>
                        setDescription((prev) => ({ ...prev, website: e.target.value }))
                      }
                      placeholder="https://validator.com"
                    />
                  )}
                  {enabledFields.securityContact && (
                    <Input
                      label="Security Contact"
                      value={description.securityContact}
                      onChange={(e) =>
                        setDescription((prev) => ({ ...prev, securityContact: e.target.value }))
                      }
                      placeholder="security@validator.com"
                    />
                  )}
                  {enabledFields.details && (
                    <Input
                      label="Details"
                      value={description.details}
                      onChange={(e) =>
                        setDescription((prev) => ({ ...prev, details: e.target.value }))
                      }
                      placeholder="Validator description"
                    />
                  )}

                  {enabledFields.commissionRate && (
                    <div>
                      <Input
                        label="Commission Rate (0.0 - 1.0)"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        placeholder="Leave empty to keep current"
                        error={errors.commissionRate}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Current:{" "}
                        {validator.commissionRate
                          ? (parseFloat(validator.commissionRate) / 1000000000000000000).toFixed(4)
                          : "N/A"}
                      </p>
                    </div>
                  )}

                  {enabledFields.minSelfDelegation && (
                    <div>
                      <Input
                        label="Min Self Delegation"
                        value={minSelfDelegation}
                        onChange={(e) => setMinSelfDelegation(e.target.value)}
                        placeholder="Leave empty to keep current"
                        error={errors.minSelfDelegation}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Current: {validator.minSelfDelegation || "N/A"}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={readOnly || isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="action"
                    onClick={submitEdit}
                    disabled={readOnly || isSubmitting || !hasEnabledFields()}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isCliqMode ? "Creating..." : "Updating..."}
                      </>
                    ) : isCliqMode ? (
                      <>
                        <Users className="h-4 w-4" />
                        Create Transaction
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Update Validator
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info */}
        <div className="py-2 text-center">
          <p className="text-xs text-muted-foreground">
            Changes may take a few minutes to reflect on the network.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
