import { EncodeObject } from "@cosmjs/proto-signing";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

interface MsgSetWithdrawAddressFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgSetWithdrawAddressForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgSetWithdrawAddressFormProps) => {
  const { chain } = useChains();

  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAddressError, setWithdrawAddressError] = useState("");

  const trimmedInputs = trimStringsObj({ withdrawAddress });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { withdrawAddress } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setWithdrawAddressError("");

      const addressErrorMsg = checkAddress(withdrawAddress, chain.addressPrefix);
      if (addressErrorMsg) {
        setWithdrawAddressError(`Invalid address for network ${chain.chainId}: ${addressErrorMsg}`);
        return false;
      }

      return true;
    };

    const msgValue = MsgCodecs[MsgTypeUrls.SetWithdrawAddress].fromPartial({
      delegatorAddress: senderAddress,
      withdrawAddress,
    });
    const msg: EncodeObject = { typeUrl: MsgTypeUrls.SetWithdrawAddress, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.addressPrefix, chain.chainId, senderAddress, trimmedInputs]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgSetWithdrawAddress</h2>
      <div className="space-y-4">
        <Input
          variant="institutional"
          label="Withdraw Address"
          name="withdraw-address"
          value={withdrawAddress}
          onChange={({ target }) => {
            setWithdrawAddress(target.value);
            setWithdrawAddressError("");
          }}
          error={withdrawAddressError}
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgSetWithdrawAddressForm;
