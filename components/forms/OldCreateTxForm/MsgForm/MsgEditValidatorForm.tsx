import { MsgEditValidatorEncodeObject } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { trimStringsObj, checkAddress } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

interface MsgEditValidatorFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgEditValidatorForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgEditValidatorFormProps) => {
  const { chain } = useChains();
  const isTX =
    chain.registryName.toLowerCase() === "tx" ||
    chain.registryName.toLowerCase().includes("coreum");

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

  const [description, setDescription] = useState({
    moniker: "",
    identity: "",
    website: "",
    securityContact: "",
    details: "",
  });
  const [commissionRate, setCommissionRate] = useState("");
  const [minSelfDelegation, setMinSelfDelegation] = useState("");
  const [validatorAddress, setValidatorAddress] = useState("");

  const [validatorAddressError, setValidatorAddressError] = useState("");

  const toggleField = (field: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  /**
   * Converts a delegator address to a validator operator address
   * by re-encoding with the validator prefix and recalculating the checksum
   */
  const convertToValidatorAddress = (delegatorAddress: string, addressPrefix: string): string => {
    try {
      const decoded = fromBech32(delegatorAddress);
      const validatorPrefix = addressPrefix.startsWith("cosmos")
        ? "cosmosvaloper"
        : `${addressPrefix}valoper`;
      return toBech32(validatorPrefix, decoded.data);
    } catch (e) {
      throw new Error(
        `Failed to convert to validator address: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  };

  const trimmedInputs = trimStringsObj({
    validatorAddress,
    commissionRate,
    minSelfDelegation,
    ...description,
  });

  // Check if any fields are enabled
  const hasEnabledFields = () => {
    return Object.values(enabledFields).some((enabled) => enabled);
  };

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { validatorAddress, commissionRate, minSelfDelegation, ...desc } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setValidatorAddressError("");

      // Validate validator address format and checksum
      const validatorPrefix = chain.addressPrefix.startsWith("cosmos")
        ? "cosmosvaloper"
        : `${chain.addressPrefix}valoper`;

      if (!validatorAddress.startsWith(validatorPrefix)) {
        setValidatorAddressError(`Validator address must start with ${validatorPrefix}`);
        return false;
      }

      // Check if the validator address has a valid checksum
      try {
        fromBech32(validatorAddress);
      } catch (e) {
        setValidatorAddressError(
          `Invalid validator address checksum. ${e instanceof Error ? e.message : ""}`,
        );
        return false;
      }

      const addressErrorMsg = checkAddress(validatorAddress, validatorPrefix);
      if (addressErrorMsg) {
        setValidatorAddressError(
          `Invalid address for network ${chain.chainId}: ${addressErrorMsg}`,
        );
        return false;
      }

      // Validate commission rate if enabled
      if (
        enabledFields.commissionRate &&
        commissionRate &&
        (Number(commissionRate) < 0 || Number(commissionRate) > 1)
      ) {
        return false;
      }

      // Validate min self delegation if enabled
      if (enabledFields.minSelfDelegation && minSelfDelegation && Number(minSelfDelegation) <= 0) {
        return false;
      }

      // Must have at least one field enabled to be a meaningful update (technically chain allows empty but UX wise we want intention)
      if (!hasEnabledFields()) {
        return false;
      }

      return true;
    };

    // Convert commission rate to atomic units if provided
    let commissionRateAtomics = "";
    if (enabledFields.commissionRate && commissionRate) {
      try {
        commissionRateAtomics = Decimal.fromUserInput(commissionRate, 18).atomics;
      } catch {
        return; // Invalid commission rate format
      }
    }

    const msgValue = MsgCodecs[MsgTypeUrls.EditValidator].fromPartial({
      description: {
        moniker: enabledFields.moniker ? desc.moniker || undefined : undefined,
        identity: enabledFields.identity ? desc.identity || undefined : undefined,
        website: enabledFields.website ? desc.website || undefined : undefined,
        securityContact: enabledFields.securityContact
          ? desc.securityContact || undefined
          : undefined,
        details: enabledFields.details ? desc.details || undefined : undefined,
      },
      validatorAddress,
      commissionRate: enabledFields.commissionRate ? commissionRateAtomics : undefined,
      minSelfDelegation: enabledFields.minSelfDelegation
        ? minSelfDelegation || undefined
        : undefined,
    });

    const msg: MsgEditValidatorEncodeObject = {
      typeUrl: MsgTypeUrls.EditValidator,
      value: msgValue,
    };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chain.addressPrefix,
    chain.chainId,
    senderAddress,
    enabledFields,
    // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs
    trimmedInputs,
  ]);

  return (
    <StackableContainer variant="institutional" lessPadding lessMargin>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteMsg()}
        className="absolute right-4 top-4 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
      <h2 className="mb-4 font-heading text-xl font-semibold">MsgEditValidator</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <Input
            variant="institutional"
            label="Validator Address"
            name="validator-address"
            value={validatorAddress}
            onChange={({ target }) => {
              setValidatorAddress(target.value);
              setValidatorAddressError("");
            }}
            error={validatorAddressError}
            placeholder={`E.g. ${chain.addressPrefix}valoper...`}
          />
          <Button
            type="button"
            variant="action-outline"
            size="action-sm"
            onClick={() => {
              try {
                const converted = convertToValidatorAddress(senderAddress, chain.addressPrefix);
                setValidatorAddress(converted);
                setValidatorAddressError("");
              } catch (e) {
                setValidatorAddressError(e instanceof Error ? e.message : "Conversion failed");
              }
            }}
            className="w-full"
          >
            Auto-convert from sender address
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Select fields to update
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-moniker" className="flex-1 cursor-pointer">
                Moniker (Name)
              </Label>
              <Switch
                id="toggle-moniker"
                checked={enabledFields.moniker}
                onCheckedChange={() => toggleField("moniker")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-identity" className="flex-1 cursor-pointer">
                Identity (Keybase)
              </Label>
              <Switch
                id="toggle-identity"
                checked={enabledFields.identity}
                onCheckedChange={() => toggleField("identity")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-website" className="flex-1 cursor-pointer">
                Website
              </Label>
              <Switch
                id="toggle-website"
                checked={enabledFields.website}
                onCheckedChange={() => toggleField("website")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-security" className="flex-1 cursor-pointer">
                Security Contact
              </Label>
              <Switch
                id="toggle-security"
                checked={enabledFields.securityContact}
                onCheckedChange={() => toggleField("securityContact")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-details" className="flex-1 cursor-pointer">
                Details
              </Label>
              <Switch
                id="toggle-details"
                checked={enabledFields.details}
                onCheckedChange={() => toggleField("details")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-commission" className="flex-1 cursor-pointer">
                Commission Rate
              </Label>
              <Switch
                id="toggle-commission"
                checked={enabledFields.commissionRate}
                onCheckedChange={() => toggleField("commissionRate")}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="toggle-min-delegation" className="flex-1 cursor-pointer">
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

        {/* Dynamic Inputs */}
        <div className="space-y-4">
          {enabledFields.moniker && (
            <Input
              variant="institutional"
              label="Moniker"
              name="moniker"
              value={description.moniker}
              onChange={({ target }) =>
                setDescription((prev) => ({ ...prev, moniker: target.value }))
              }
              placeholder="Validator name"
            />
          )}
          {enabledFields.identity && (
            <Input
              variant="institutional"
              label="Identity"
              name="identity"
              value={description.identity}
              onChange={({ target }) =>
                setDescription((prev) => ({ ...prev, identity: target.value }))
              }
              placeholder="Keybase identity"
            />
          )}
          {enabledFields.website && (
            <Input
              variant="institutional"
              label="Website"
              name="website"
              value={description.website}
              onChange={({ target }) =>
                setDescription((prev) => ({ ...prev, website: target.value }))
              }
              placeholder="https://validator.com"
            />
          )}
          {enabledFields.securityContact && (
            <Input
              variant="institutional"
              label="Security Contact"
              name="security-contact"
              value={description.securityContact}
              onChange={({ target }) =>
                setDescription((prev) => ({ ...prev, securityContact: target.value }))
              }
              placeholder="security@validator.com"
            />
          )}
          {enabledFields.details && (
            <Input
              variant="institutional"
              label="Details"
              name="details"
              value={description.details}
              onChange={({ target }) =>
                setDescription((prev) => ({ ...prev, details: target.value }))
              }
              placeholder="Validator description"
            />
          )}

          {enabledFields.commissionRate && (
            <div className="space-y-4 pb-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Commission Rate</Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {(Number(commissionRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <Slider
                value={[Number(commissionRate || (isTX ? "0.05" : "0")) * 100]}
                min={isTX ? 5 : 0}
                max={isTX ? 20 : 100}
                step={0.1}
                onValueChange={(vals) => setCommissionRate((vals[0] / 100).toString())}
                className="py-2"
              />

              <p className="text-xs text-muted-foreground">
                {isTX
                  ? "TX requires a commission rate between 5% and 20%."
                  : "Set the commission rate for your validator."}
              </p>

              <div className="relative">
                <Input
                  variant="institutional"
                  label="Manual Rate (Decimal)"
                  name="commission-rate"
                  value={commissionRate}
                  onChange={({ target }) => setCommissionRate(target.value)}
                  placeholder={isTX ? "0.05" : "0.10"}
                />
              </div>
            </div>
          )}

          {enabledFields.minSelfDelegation && (
            <Input
              variant="institutional"
              label="Min Self Delegation"
              name="min-self-delegation"
              value={minSelfDelegation}
              onChange={({ target }) => setMinSelfDelegation(target.value)}
              placeholder="20000000000"
            />
          )}
        </div>
      </div>
    </StackableContainer>
  );
};

export default MsgEditValidatorForm;
