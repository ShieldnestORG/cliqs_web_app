import SelectValidator from "@/components/SelectValidator";
import { MsgBeginRedelegateEncodeObject } from "@cosmjs/stargate";
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

interface MsgBeginRedelegateFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number;
}

const MsgBeginRedelegateForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
  gasLimit,
}: MsgBeginRedelegateFormProps) => {
  const { chain } = useChains();
  const categoryInfo = getMessageCategory(MsgTypeUrls.BeginRedelegate);

  const [validatorSrcAddress, setValidatorSrcAddress] = useState("");
  const [validatorDstAddress, setValidatorDstAddress] = useState("");
  const [amount, setAmount] = useState("0");

  const [validatorSrcAddressError, setValidatorSrcAddressError] = useState("");
  const [validatorDstAddressError, setValidatorDstAddressError] = useState("");
  const [amountError, setAmountError] = useState("");

  const trimmedInputs = useMemo(
    () => trimStringsObj({ validatorSrcAddress, validatorDstAddress, amount }),
    [validatorSrcAddress, validatorDstAddress, amount],
  );

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { validatorSrcAddress, validatorDstAddress, amount } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setValidatorSrcAddressError("");
      setValidatorDstAddressError("");
      setAmountError("");

      const srcAddressErrorMsg = checkAddress(validatorSrcAddress, chain.addressPrefix);
      if (srcAddressErrorMsg) {
        setValidatorSrcAddressError(
          `Invalid address for network ${chain.chainId}: ${srcAddressErrorMsg}`,
        );
        return false;
      }

      const dstAddressErrorMsg = checkAddress(validatorDstAddress, chain.addressPrefix);
      if (dstAddressErrorMsg) {
        setValidatorDstAddressError(
          `Invalid address for network ${chain.chainId}: ${dstAddressErrorMsg}`,
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

    const msgValue = MsgCodecs[MsgTypeUrls.BeginRedelegate].fromPartial({
      delegatorAddress: senderAddress,
      validatorSrcAddress,
      validatorDstAddress,
      amount: microCoin,
    });

    const msg: MsgBeginRedelegateEncodeObject = {
      typeUrl: MsgTypeUrls.BeginRedelegate,
      value: msgValue,
    };

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
        <h2 className="font-heading text-xl font-semibold">MsgBeginRedelegate</h2>
      </div>
      <div className="space-y-4">
        <BalanceDisplay
          treasuryAddress={senderAddress}
          denom={chain.displayDenom}
          gasLimit={gasLimit}
        />
        <SelectValidator
          selectedValidatorAddress={validatorSrcAddress}
          setValidatorAddress={setValidatorSrcAddress}
        />
        <Input
          variant="institutional"
          label="Source Validator Address"
          name="src-validator-address"
          value={validatorSrcAddress}
          onChange={({ target }) => {
            setValidatorSrcAddress(target.value);
            setValidatorSrcAddressError("");
          }}
          error={validatorSrcAddressError}
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
        <SelectValidator
          selectedValidatorAddress={validatorDstAddress}
          setValidatorAddress={setValidatorDstAddress}
        />
        <Input
          variant="institutional"
          label="Destination Validator Address"
          name="dst-validator-address"
          value={validatorDstAddress}
          onChange={({ target }) => {
            setValidatorDstAddress(target.value);
            setValidatorDstAddressError("");
          }}
          error={validatorDstAddressError}
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

export default MsgBeginRedelegateForm;
