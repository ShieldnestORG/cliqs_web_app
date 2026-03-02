import { EncodeObject } from "@cosmjs/proto-signing";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { displayCoinToBaseCoin } from "../../../../lib/coinHelpers";
import { trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { getMessageCategory } from "../../../../lib/msgCategoryHelpers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardLabel } from "@/components/ui/card";
import { DenomSelect, CUSTOM_DENOM_VALUE } from "./DenomSelect";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";
import BalanceDisplay from "../BalanceDisplay";
import { useBalance } from "@/lib/hooks/useBalance";
import { Decimal } from "@cosmjs/math";

interface MsgFundCommunityPoolFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number;
}

const MsgFundCommunityPoolForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
  gasLimit,
}: MsgFundCommunityPoolFormProps) => {
  const { chain } = useChains();
  const categoryInfo = getMessageCategory(MsgTypeUrls.FundCommunityPool);

  const [selectedDenomBase, setSelectedDenomBase] = useState(
    chain.assets?.length ? chain.assets[0].base : CUSTOM_DENOM_VALUE,
  );
  const [customDenom, setCustomDenom] = useState("");
  const [amount, setAmount] = useState("0");

  const [customDenomError, setCustomDenomError] = useState("");
  const [amountError, setAmountError] = useState("");

  const selectedAsset = chain.assets?.find((a) => a.base === selectedDenomBase);

  // Get the denom for balance checking
  const balanceDenom =
    selectedDenomBase === CUSTOM_DENOM_VALUE ? customDenom : (selectedAsset?.symbol ?? "");
  const { availableBalance } = useBalance({
    address: senderAddress,
    denom: balanceDenom || chain.displayDenom,
    gasLimit,
  });

  const trimmedInputs = trimStringsObj({ customDenom, amount });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { customDenom, amount } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setCustomDenomError("");
      setAmountError("");

      if (selectedDenomBase === CUSTOM_DENOM_VALUE && !customDenom && amount && amount !== "0") {
        setCustomDenomError("Custom denom must be set because of selection above");
        return false;
      }

      if (!amount || Number(amount) <= 0) {
        setAmountError("Amount must be greater than 0");
        return false;
      }

      if (selectedDenomBase === CUSTOM_DENOM_VALUE && !Number.isInteger(Number(amount))) {
        setAmountError("Amount cannot be decimal for custom denom");
        return false;
      }

      // Validate against available balance
      if (availableBalance && availableBalance.amount !== "0" && denom === balanceDenom) {
        try {
          const userAmountCoin = displayCoinToBaseCoin({ denom, amount }, chain.assets);
          const userAmountDecimal = Decimal.fromAtomics(userAmountCoin.amount, 0);
          const availableAmountDecimal = Decimal.fromAtomics(availableBalance.amount, 0);

          if (userAmountDecimal.isGreaterThan(availableAmountDecimal)) {
            setAmountError(`Amount exceeds available balance`);
            return false;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_: unknown) {
          // If conversion fails, continue with other validation
        }
      }

      try {
        displayCoinToBaseCoin({ denom, amount }, chain.assets);
      } catch (e: unknown) {
        setAmountError(e instanceof Error ? e.message : "Could not set decimals");
        return false;
      }

      return true;
    };

    const denom =
      selectedDenomBase === CUSTOM_DENOM_VALUE ? customDenom : (selectedAsset?.symbol ?? "");

    const microCoin = (() => {
      try {
        if (!denom || !amount || amount === "0") {
          return null;
        }

        return displayCoinToBaseCoin({ denom, amount }, chain.assets);
      } catch {
        return null;
      }
    })();

    const msgValue = MsgCodecs[MsgTypeUrls.FundCommunityPool].fromPartial({
      depositor: senderAddress,
      amount: microCoin ? [microCoin] : [],
    });

    const msg: EncodeObject = { typeUrl: MsgTypeUrls.FundCommunityPool, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chain.assets,
    selectedDenomBase,
    selectedAsset,
    senderAddress,
    trimmedInputs,
    balanceDenom,
    availableBalance,
  ]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

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
        <h2 className="font-heading text-xl font-semibold">MsgFundCommunityPool</h2>
      </div>
      <div className="space-y-4">
        {balanceDenom && (
          <BalanceDisplay
            treasuryAddress={senderAddress}
            denom={balanceDenom}
            gasLimit={gasLimit}
          />
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Choose a denom:</label>
          <DenomSelect
            assets={chain.assets}
            value={selectedDenomBase}
            onValueChange={(val) => {
              setSelectedDenomBase(val);
              if (val !== CUSTOM_DENOM_VALUE) {
                setCustomDenom("");
              }
              setCustomDenomError("");
            }}
          />
        </div>
        {selectedDenomBase === CUSTOM_DENOM_VALUE ? (
          <Input
            variant="institutional"
            label="Custom denom"
            name="custom-denom"
            value={customDenom}
            onChange={({ target }) => {
              setCustomDenom(target.value);
              setCustomDenomError("");
            }}
            placeholder="Enter custom denom"
            error={customDenomError}
          />
        ) : null}
        <Input
          variant="institutional"
          type="number"
          label="Amount"
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

export default MsgFundCommunityPoolForm;
