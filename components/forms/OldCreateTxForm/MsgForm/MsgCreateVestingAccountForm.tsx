import { EncodeObject } from "@cosmjs/proto-signing";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { displayCoinToBaseCoin } from "../../../../lib/coinHelpers";
import {
  datetimeLocalFromTimestamp,
  timestampFromDatetimeLocal,
} from "../../../../lib/dateHelpers";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

interface MsgCreateVestingAccountFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgCreateVestingAccountForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgCreateVestingAccountFormProps) => {
  const { chain } = useChains();

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("0");
  const [endTime, setEndTime] = useState(
    datetimeLocalFromTimestamp(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default is one month from now
  );
  const [delayed, setDelayed] = useState(true);

  const [toAddressError, setToAddressError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [endTimeError, setEndTimeError] = useState("");

  const trimmedInputs = trimStringsObj({ toAddress, amount, endTime });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { toAddress, amount, endTime } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setToAddressError("");
      setAmountError("");
      setEndTimeError("");

      const addressErrorMsg = checkAddress(toAddress, chain.addressPrefix);
      if (addressErrorMsg) {
        setToAddressError(`Invalid address for network ${chain.chainId}: ${addressErrorMsg}`);
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

      const timeoutDate = new Date(Number(timestampFromDatetimeLocal(endTime, "ms")));
      if (timeoutDate <= new Date()) {
        setEndTimeError("End time must be a date in the future");
        return false;
      }

      return true;
    };

    const microCoin = (() => {
      try {
        if (!amount || amount === "0") {
          return null;
        }

        return displayCoinToBaseCoin({ denom: chain.displayDenom, amount }, chain.assets);
      } catch {
        return null;
      }
    })();

    const msgValue = MsgCodecs[MsgTypeUrls.CreateVestingAccount].fromPartial({
      fromAddress: senderAddress,
      toAddress,
      amount: microCoin ? [microCoin] : [],
      endTime: timestampFromDatetimeLocal(endTime, "s"),
      delayed,
    });

    const msg: EncodeObject = { typeUrl: MsgTypeUrls.CreateVestingAccount, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chain.addressPrefix,
    chain.assets,
    chain.chainId,
    chain.displayDenom,
    delayed,
    senderAddress,
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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgCreateVestingAccount</h2>
      <div className="space-y-4">
        <Input
          variant="institutional"
          label="Recipient Address"
          name="recipient-address"
          value={toAddress}
          onChange={({ target }) => {
            setToAddress(target.value);
            setToAddressError("");
          }}
          error={toAddressError}
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
        <Input
          variant="institutional"
          type="datetime-local"
          label="End time"
          name="end-time"
          value={endTime}
          onChange={({ target }) => {
            setEndTime(target.value);
            setEndTimeError("");
          }}
          error={endTimeError}
        />
        <div className="flex items-center gap-2">
          <Input
            variant="institutional"
            type="checkbox"
            label="Delayed"
            name="delayed"
            checked={delayed}
            value={String(delayed)}
            onChange={({ target }) => setDelayed(target.checked)}
          />
        </div>
      </div>
    </StackableContainer>
  );
};

export default MsgCreateVestingAccountForm;
