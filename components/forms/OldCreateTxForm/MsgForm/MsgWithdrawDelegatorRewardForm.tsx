import SelectValidator from "@/components/SelectValidator";
import { MsgWithdrawDelegatorRewardEncodeObject } from "@cosmjs/stargate";
import { useEffect, useMemo, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { getMessageCategory } from "../../../../lib/msgCategoryHelpers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardLabel } from "@/components/ui/card";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

interface MsgWithdrawDelegatorRewardFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgWithdrawDelegatorRewardForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgWithdrawDelegatorRewardFormProps) => {
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

    const msgValue = MsgCodecs[MsgTypeUrls.WithdrawDelegatorReward].fromPartial({
      delegatorAddress: senderAddress,
      validatorAddress,
    });

    const msg: MsgWithdrawDelegatorRewardEncodeObject = {
      typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
      value: msgValue,
    };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.addressPrefix, chain.chainId, senderAddress, trimmedInputs]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

  const categoryInfo = getMessageCategory(MsgTypeUrls.WithdrawDelegatorReward);

  return (
    <StackableContainer variant="institutional" lessPadding lessMargin accent={categoryInfo.accent}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteMsg()}
        className="absolute right-4 top-4 z-10 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="mb-4">
        <CardLabel comment>{categoryInfo.label}</CardLabel>
        <h2 className="font-heading text-xl font-semibold">MsgWithdrawDelegatorReward</h2>
      </div>
      <div className="space-y-4">
        <SelectValidator
          selectedValidatorAddress={validatorAddress}
          setValidatorAddress={setValidatorAddress}
        />
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
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgWithdrawDelegatorRewardForm;
