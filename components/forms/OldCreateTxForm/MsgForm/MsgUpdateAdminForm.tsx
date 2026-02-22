import { MsgUpdateAdminEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

interface MsgUpdateAdminFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgUpdateAdminForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgUpdateAdminFormProps) => {
  const { chain } = useChains();

  const [contractAddress, setContractAddress] = useState("");
  const [newAdminAddress, setNewAdminAddress] = useState("");

  const [contractAddressError, setContractAddressError] = useState("");
  const [newAdminAddressError, setNewAdminAddressError] = useState("");

  const trimmedInputs = trimStringsObj({ contractAddress, newAdminAddress });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { contractAddress, newAdminAddress } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setContractAddressError("");
      setNewAdminAddressError("");

      const contractAddressErrorMsg = checkAddress(contractAddress, chain.addressPrefix);
      if (contractAddressErrorMsg) {
        setContractAddressError(
          `Invalid address for network ${chain.chainId}: ${contractAddressErrorMsg}`,
        );
        return false;
      }

      const newAdminAddressErrorMsg = checkAddress(newAdminAddress, chain.addressPrefix);
      if (newAdminAddressErrorMsg) {
        setNewAdminAddressError(
          `Invalid address for network ${chain.chainId}: ${newAdminAddressErrorMsg}`,
        );
        return false;
      }

      return true;
    };

    const msgValue = MsgCodecs[MsgTypeUrls.UpdateAdmin].fromPartial({
      sender: senderAddress,
      contract: contractAddress,
      newAdmin: newAdminAddress,
    });

    const msg: MsgUpdateAdminEncodeObject = { typeUrl: MsgTypeUrls.UpdateAdmin, value: msgValue };

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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgUpdateAdmin</h2>
      <div className="space-y-4">
        <Input
          variant="institutional"
          label="Contract Address"
          name="contract-address"
          value={contractAddress}
          onChange={({ target }) => {
            setContractAddress(target.value);
            setContractAddressError("");
          }}
          error={contractAddressError}
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
        <Input
          variant="institutional"
          label="New Admin"
          name="new-admin"
          value={newAdminAddress}
          onChange={({ target }) => {
            setNewAdminAddress(target.value);
            setNewAdminAddressError("");
          }}
          error={newAdminAddressError}
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
      </div>
    </StackableContainer>
  );
};

export default MsgUpdateAdminForm;
