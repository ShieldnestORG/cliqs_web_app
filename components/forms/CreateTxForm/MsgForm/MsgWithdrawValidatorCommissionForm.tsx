import SelectValidator from "@/components/SelectValidator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLabel,
  CardTitle,
} from "@/components/ui/card";
import { EncodeObject } from "@cosmjs/proto-signing";
import { toBech32, fromBech32 } from "@cosmjs/encoding";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";

interface MsgWithdrawValidatorCommissionFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgWithdrawValidatorCommissionForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgWithdrawValidatorCommissionFormProps) => {
  const { chain } = useChains();

  const [validatorAddress, setValidatorAddress] = useState("");
  const [validatorAddressError, setValidatorAddressError] = useState("");

  const trimmedInputs = useMemo(() => trimStringsObj({ validatorAddress }), [validatorAddress]);

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { validatorAddress } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setValidatorAddressError("");

      const addressErrorMsg = checkAddress(validatorAddress, chain.addressPrefix);
      if (addressErrorMsg) {
        setValidatorAddressError(
          `Invalid address for network ${chain.chainId}: ${addressErrorMsg}`,
        );
        return false;
      }

      return true;
    };

    // CLI bundles MsgWithdrawDelegatorReward + MsgWithdrawValidatorCommission together
    // when using --commission flag. We replicate this behavior.
    // For validator commission withdrawal, the delegator address must be the validator's account address,
    // not the multisig address. Convert validator operator address to account address.
    let delegatorAddress = senderAddress;
    try {
      if (validatorAddress) {
        const { data } = fromBech32(validatorAddress);
        delegatorAddress = toBech32(chain.addressPrefix, data);
      }
    } catch {
      // If conversion fails, use sender address as fallback
      console.warn(
        "Failed to convert validator operator address to account address, using sender address",
      );
    }

    const delegatorRewardMsgValue = MsgCodecs[MsgTypeUrls.WithdrawDelegatorReward].fromPartial({
      delegatorAddress,
      validatorAddress,
    });

    const delegatorRewardMsg: EncodeObject = {
      typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
      value: delegatorRewardMsgValue,
    };

    // Second, create MsgWithdrawValidatorCommission
    const commissionMsgValue = MsgCodecs[MsgTypeUrls.WithdrawValidatorCommission].fromPartial({
      validatorAddress,
    });

    const commissionMsg: EncodeObject = {
      typeUrl: MsgTypeUrls.WithdrawValidatorCommission,
      value: commissionMsgValue,
    };

    // Return BOTH messages bundled together (like CLI does with --commission flag)
    const msgs: EncodeObject[] = [delegatorRewardMsg, commissionMsg];

    setMsgGetter({ isMsgValid, msg: msgs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.addressPrefix, chain.chainId, senderAddress, trimmedInputs]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

  return (
    <Card variant="institutional" bracket="green" className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={deleteMsg}
        className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader>
        <CardLabel comment>Transaction Type</CardLabel>
        <CardTitle className="text-xl">Withdraw Validator Commission</CardTitle>
        <CardDescription className="mt-2">
          Claim accumulated commission rewards for your validator. This creates both delegator
          rewards and validator commission withdrawal messages in a single transaction, matching the
          TX CLI behavior with the --commission flag.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-4">
          <SelectValidator
            selectedValidatorAddress={validatorAddress}
            setValidatorAddress={setValidatorAddress}
          />
          <Input
            variant="institutional"
            label="Validator Address (valoper)"
            name="validator-address"
            value={validatorAddress}
            onChange={({ target }) => {
              setValidatorAddress(target.value);
              setValidatorAddressError("");
            }}
            error={validatorAddressError}
            placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}valoper...`}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MsgWithdrawValidatorCommissionForm;
