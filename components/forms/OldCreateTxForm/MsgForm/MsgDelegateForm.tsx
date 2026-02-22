import SelectValidator from "@/components/SelectValidator";
import { MsgDelegateEncodeObject } from "@cosmjs/stargate";
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
import { useBalance } from "@/lib/hooks/useBalance";
import { Decimal } from "@cosmjs/math";

interface MsgDelegateFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number;
}

const MsgDelegateForm = ({ senderAddress, setMsgGetter, deleteMsg, gasLimit }: MsgDelegateFormProps) => {
  const { chain } = useChains();
  const { availableBalance } = useBalance({
    address: senderAddress,
    denom: chain.displayDenom,
    gasLimit,
  });

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

      // Note: Balance validation moved to onChange handler to avoid reactive validation loops

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

    const msgValue = MsgCodecs[MsgTypeUrls.Delegate].fromPartial({
      delegatorAddress: senderAddress,
      validatorAddress,
      amount: microCoin,
    });

    const msg: MsgDelegateEncodeObject = { typeUrl: MsgTypeUrls.Delegate, value: msgValue };

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

  const categoryInfo = getMessageCategory(MsgTypeUrls.Delegate);

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
        <h2 className="text-xl font-heading font-semibold">MsgDelegate</h2>
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

            // Validate against available balance
            if (availableBalance && availableBalance.amount !== "0" && target.value) {
              try {
                const userAmountCoin = displayCoinToBaseCoin({ denom: chain.displayDenom, amount: target.value }, chain.assets);
                const userAmountDecimal = Decimal.fromAtomics(userAmountCoin.amount, 0);
                const availableAmountDecimal = Decimal.fromAtomics(availableBalance.amount, 0);

                if (userAmountDecimal.isGreaterThan(availableAmountDecimal)) {
                  setAmountError(`Amount exceeds available balance. Available: ${availableBalance.amount}`);
                }
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_: unknown) {
                // If conversion fails, don't set error
              }
            }
          }}
          error={amountError}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgDelegateForm;
