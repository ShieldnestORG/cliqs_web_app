import { MsgTransferEncodeObject } from "@cosmjs/stargate";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
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

const humanTimestampOptions = [
  { label: "12 hours from now", value: 12 * 60 * 60 * 1000 },
  { label: "1 day from now", value: 24 * 60 * 60 * 1000 },
  { label: "2 days from now", value: 2 * 24 * 60 * 60 * 1000 },
  { label: "3 days from now", value: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 days from now", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "10 days from now", value: 10 * 24 * 60 * 60 * 1000 },
  { label: "2 weeks from now", value: 2 * 7 * 24 * 60 * 60 * 1000 },
  { label: "3 weeks from now", value: 3 * 7 * 24 * 60 * 60 * 1000 },
  { label: "1 month from now", value: 30 * 24 * 60 * 60 * 1000 },
];

interface MsgTransferFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgTransferForm = ({ senderAddress, setMsgGetter, deleteMsg }: MsgTransferFormProps) => {
  const { chain } = useChains();

  const [toAddress, setToAddress] = useState("");
  const [denom, setDenom] = useState("");
  const [amount, setAmount] = useState("0");
  const [sourcePort, setSourcePort] = useState("transfer");
  const [sourceChannel, setSourceChannel] = useState("");
  const [timeout, setTimeout] = useState(
    datetimeLocalFromTimestamp(Date.now() + humanTimestampOptions[0].value),
  );
  const [memo, setMemo] = useState("");

  const [toAddressError, setToAddressError] = useState("");
  const [denomError, setDenomError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [sourcePortError, setSourcePortError] = useState("");
  const [sourceChannelError, setSourceChannelError] = useState("");
  const [timeoutError, setTimeoutError] = useState("");

  const trimmedInputs = trimStringsObj({
    toAddress,
    denom,
    amount,
    sourcePort,
    sourceChannel,
    timeout,
    memo,
  });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { toAddress, denom, amount, sourcePort, sourceChannel, timeout, memo } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setToAddressError("");
      setDenomError("");
      setAmountError("");
      setSourcePortError("");
      setSourceChannelError("");
      setTimeoutError("");

      const addressErrorMsg = checkAddress(toAddress, null); // Allow address from any chain
      if (addressErrorMsg) {
        setToAddressError(`Invalid address for network ${chain.chainId}: ${addressErrorMsg}`);
        return false;
      }

      if (!denom) {
        setDenomError("Denom is required");
        return false;
      }

      if (!amount || Number(amount) <= 0) {
        setAmountError("Amount must be greater than 0");
        return false;
      }

      if (!sourcePort) {
        setSourcePortError("Source port is required");
        return false;
      }

      if (!sourceChannel) {
        setSourceChannelError("Source channel is required");
        return false;
      }

      const timeoutDate = new Date(Number(timestampFromDatetimeLocal(timeout, "ms")));
      if (timeoutDate <= new Date()) {
        setTimeoutError("Timeout must be a date in the future");
        return false;
      }

      return true;
    };

    const msgValue = MsgCodecs[MsgTypeUrls.Transfer].fromPartial({
      sender: senderAddress,
      receiver: toAddress,
      token: { denom, amount },
      sourcePort,
      sourceChannel,
      timeoutTimestamp: timestampFromDatetimeLocal(timeout, "ns"),
      memo,
    });

    const msg: MsgTransferEncodeObject = { typeUrl: MsgTypeUrls.Transfer, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.chainId, senderAddress, trimmedInputs]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

  useEffect(() => {
    if (!denom || !denom.startsWith("ibc/")) {
      return;
    }

    const foundDenom = chain.assets.find((asset) => asset.base === denom);
    if (!foundDenom) {
      return;
    }

    const trace = foundDenom.traces?.[0];
    if (!trace) {
      return;
    }

    setSourcePort(trace.chain?.path?.split("/")?.[0] || "transfer");
    setSourceChannel(trace.chain?.channel_id || "");
  }, [chain.assets, denom]);

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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgTransfer</h2>
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
          label="Denom"
          name="denom"
          value={denom}
          onChange={({ target }) => {
            setDenom(target.value);
            setDenomError("");
          }}
          error={denomError}
        />
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
        <Input
          variant="institutional"
          label="Source Port"
          name="source-port"
          value={sourcePort}
          onChange={({ target }) => {
            setSourcePort(target.value);
            setSourcePortError("");
          }}
          error={sourcePortError}
        />
        <Input
          variant="institutional"
          label="Source Channel"
          name="source-channel"
          value={sourceChannel}
          onChange={({ target }) => {
            setSourceChannel(target.value);
            setSourceChannelError("");
          }}
          error={sourceChannelError}
        />
        <Input
          variant="institutional"
          type="datetime-local"
          list="timestamp-options"
          label="Timeout"
          name="timeout"
          value={timeout}
          onChange={({ target }) => {
            setTimeout(target.value);
            setTimeoutError("");
          }}
          error={timeoutError}
        />
        <datalist id="timestamp-options">
          {humanTimestampOptions.map(({ label, value }) => (
            <option key={label} value={datetimeLocalFromTimestamp(Date.now() + value)}>
              {label}
            </option>
          ))}
        </datalist>
        <Input
          variant="institutional"
          label="Memo"
          name="memo"
          value={memo}
          onChange={({ target }) => setMemo(target.value)}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgTransferForm;
