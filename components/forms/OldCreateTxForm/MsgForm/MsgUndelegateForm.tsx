import SelectValidator from "@/components/SelectValidator";
import { MsgUndelegateEncodeObject } from "@cosmjs/stargate";
import { useEffect, useMemo, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { displayCoinToBaseCoin } from "../../../../lib/coinHelpers";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { getMessageCategory } from "../../../../lib/msgCategoryHelpers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardLabel } from "@/components/ui/card";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";
import BalanceDisplay from "../BalanceDisplay";

interface MsgUndelegateFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number;
}

const MsgUndelegateForm = ({ senderAddress, setMsgGetter, deleteMsg, gasLimit }: MsgUndelegateFormProps) => {
  const { chain } = useChains();
  const categoryInfo = getMessageCategory(MsgTypeUrls.Undelegate);

  const [validatorAddress, setValidatorAddress] = useState("");
  const [amount, setAmount] = useState("0");

  const [validatorAddressError, setValidatorAddressError] = useState("");
  const [amountError, setAmountError] = useState("");

  const trimmedInputs = useMemo(() => trimStringsObj({ validatorAddress, amount }), [validatorAddress, amount]);

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { validatorAddress, amount } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setValidatorAddressError("");
      setAmountError("");

      const addressErrorMsg = checkAddress(validatorAddress, chain.addressPrefix);
      if (addressErrorMsg) {
        setValidatorAddressError(
          `Invalid address for network ${chain.chainId}: ${addressErrorMsg}`,
        );
        return false;
      }

      if (!amount || Number(amount) <= 0) {
        setAmountError("Amount must be greater than 0");
        return false;
      }

      try {
        displayCoinToBaseCoin({ denom: chain.displayDenom, amount }, chain.assets);
      } catch (e: unknown) {
        setAmountError(e instanceof Error ? e.message : "Could not set decimals");
        return false;
      }

      return true;
    };

    const microCoin = (() => {
      try {
        return displayCoinToBaseCoin({ denom: chain.displayDenom, amount }, chain.assets);
      } catch {
        return { denom: chain.displayDenom, amount: "0" };
      }
    })();

    const msgValue = MsgCodecs[MsgTypeUrls.Undelegate].fromPartial({
      delegatorAddress: senderAddress,
      validatorAddress,
      amount: microCoin,
    });

    const msg: MsgUndelegateEncodeObject = { typeUrl: MsgTypeUrls.Undelegate, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chain.addressPrefix,
    chain.assets,
    chain.chainId,
    chain.displayDenom,
    senderAddress,
    // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs
    trimmedInputs,
  ]);

  return (
    <StackableContainer 
      variant="institutional" 
      lessPadding 
      lessMargin
      accent={categoryInfo.accent}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteMsg()}
        className="absolute right-4 top-4 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="mb-4">
        <CardLabel comment>{categoryInfo.label}</CardLabel>
        <h2 className="text-xl font-heading font-semibold">MsgUndelegate</h2>
      </div>
      <div className="space-y-4">
        <BalanceDisplay
          treasuryAddress={senderAddress}
          denom={chain.displayDenom}
          gasLimit={gasLimit}
        />
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
        <Input
          variant="institutional"
          type="number"
          label={`Amount (${chain.displayDenom})`}
          name="amount"
          value={amount}
          onChange={({ target }) => {
            setAmount(target.value);
            setAmountError("");
          }}
          error={amountError}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgUndelegateForm;
