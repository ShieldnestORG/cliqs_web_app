import { MsgInstantiateContractEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { toUtf8 } from "@cosmjs/encoding";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { displayCoinToBaseCoin } from "../../../../lib/coinHelpers";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DenomSelect, CUSTOM_DENOM_VALUE } from "./DenomSelect";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

const JsonEditor = dynamic(() => import("../../../inputs/JsonEditor"), { ssr: false });

interface MsgInstantiateContractFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgInstantiateContractForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgInstantiateContractFormProps) => {
  const { chain } = useChains();

  const [codeId, setCodeId] = useState("");
  const [label, setLabel] = useState("");
  const [adminAddress, setAdminAddress] = useState("");
  const [msgContent, setMsgContent] = useState("{}");
  const [selectedDenomBase, setSelectedDenomBase] = useState(
    chain.assets?.length ? chain.assets[0].base : CUSTOM_DENOM_VALUE,
  );
  const [customDenom, setCustomDenom] = useState("");
  const [amount, setAmount] = useState("0");

  const selectedAsset = chain.assets?.find((a) => a.base === selectedDenomBase);

  const jsonError = useRef(false);
  const [codeIdError, setCodeIdError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [adminAddressError, setAdminAddressError] = useState("");
  const [customDenomError, setCustomDenomError] = useState("");
  const [amountError, setAmountError] = useState("");

  const trimmedInputs = trimStringsObj({ codeId, label, adminAddress, customDenom, amount });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { codeId, label, adminAddress, customDenom, amount } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setCodeIdError("");
      setLabelError("");
      setAdminAddressError("");
      setCustomDenomError("");
      setAmountError("");

      if (jsonError.current) {
        return false;
      }

      if (!codeId || !Number.isSafeInteger(Number(codeId)) || Number(codeId) <= 0) {
        setCodeIdError("Code ID must be a positive integer");
        return false;
      }

      if (!label) {
        setLabelError("Label is required");
        return false;
      }

      const addressErrorMsg = checkAddress(adminAddress, chain.addressPrefix);
      if (adminAddress && addressErrorMsg) {
        setAdminAddressError(`Invalid address for network ${chain.chainId}: ${addressErrorMsg}`);
        return false;
      }

      if (
        selectedDenomBase === CUSTOM_DENOM_VALUE &&
        !customDenom &&
        amount &&
        amount !== "0"
      ) {
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

    const msgContentUtf8Array = (() => {
      try {
        return toUtf8(JSON.stringify(JSON.parse(msgContent)));
      } catch {
        return undefined;
      }
    })();

    const safeBigIntCodeId = (() => {
      try {
        const n = BigInt(codeId);
        return n > 0n ? n : 0n;
      } catch {
        return 0n;
      }
    })();

    const msgValue = MsgCodecs[MsgTypeUrls.InstantiateContract].fromPartial({
      sender: senderAddress,
      codeId: safeBigIntCodeId,
      label,
      admin: adminAddress,
      msg: msgContentUtf8Array,
      funds: microCoin ? [microCoin] : [],
    });

    const msg: MsgInstantiateContractEncodeObject = {
      typeUrl: MsgTypeUrls.InstantiateContract,
      value: msgValue,
    };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chain.addressPrefix,
    chain.assets,
    chain.chainId,
    msgContent,
    selectedDenomBase,
    selectedAsset,
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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgInstantiateContract</h2>
      <div className="space-y-4">
        <Input
          variant="institutional"
          label="Code ID"
          name="code-id"
          value={codeId}
          onChange={({ target }) => {
            setCodeId(target.value);
            setCodeIdError("");
          }}
          error={codeIdError}
        />
        <Input
          variant="institutional"
          label="Label"
          name="label"
          value={label}
          onChange={({ target }) => {
            setLabel(target.value);
            setLabelError("");
          }}
          error={labelError}
        />
        <Input
          variant="institutional"
          label="Admin Address"
          name="admin-address"
          value={adminAddress}
          onChange={({ target }) => {
            setAdminAddress(target.value);
            setAdminAddressError("");
          }}
          error={adminAddressError}
          placeholder={`E.g. ${exampleAddress(0, chain.addressPrefix)}`}
        />
        <div>
          <JsonEditor
            label="Msg JSON"
            content={{ text: msgContent }}
            onChange={(newMsgContent, _, { contentErrors }) => {
              setMsgContent("text" in newMsgContent ? (newMsgContent.text ?? "{}") : "{}");
              jsonError.current = !!contentErrors;
            }}
          />
        </div>
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

export default MsgInstantiateContractForm;
