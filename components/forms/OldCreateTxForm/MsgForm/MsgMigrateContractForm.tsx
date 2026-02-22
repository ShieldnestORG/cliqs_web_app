import { CosmWasmClient, MsgMigrateContractEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { toUtf8 } from "@cosmjs/encoding";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { ensureProtocol } from "../../../../lib/utils";
import { checkAddress, exampleAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StackableContainer from "../../../layout/StackableContainer";
import { AlertTriangle, Info, X } from "lucide-react";

const JsonEditor = dynamic(() => import("../../../inputs/JsonEditor"), { ssr: false });

interface MsgMigrateContractFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgMigrateContractForm = ({
  senderAddress,
  setMsgGetter,
  deleteMsg,
}: MsgMigrateContractFormProps) => {
  const { chain } = useChains();

  const [contractAddress, setContractAddress] = useState("");
  const [codeId, setCodeId] = useState("");
  const [msgContent, setMsgContent] = useState("{}");

  const jsonError = useRef(false);
  const [contractAddressError, setContractAddressError] = useState("");
  const [codeIdError, setCodeIdError] = useState("");
  const [contractAdmin, setContractAdmin] = useState<string | null | undefined>(undefined);
  const [checkingContract, setCheckingContract] = useState(false);

  const checkContractAdmin = useCallback(
    async (address: string) => {
      const addressErr = checkAddress(address, chain.addressPrefix);
      if (addressErr) {
        setContractAdmin(undefined);
        return;
      }
      setCheckingContract(true);
      try {
        const client = await CosmWasmClient.connect(ensureProtocol(chain.nodeAddress));
        const info = await client.getContract(address);
        setContractAdmin(info.admin ?? null);
      } catch {
        setContractAdmin(undefined);
      } finally {
        setCheckingContract(false);
      }
    },
    [chain.addressPrefix, chain.nodeAddress],
  );

  useEffect(() => {
    const trimmed = contractAddress.trim();
    if (!trimmed) {
      setContractAdmin(undefined);
      return;
    }
    const timer = setTimeout(() => checkContractAdmin(trimmed), 500);
    return () => clearTimeout(timer);
  }, [contractAddress, checkContractAdmin]);

  const trimmedInputs = trimStringsObj({ contractAddress, codeId });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { contractAddress, codeId } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setContractAddressError("");
      setCodeIdError("");

      if (jsonError.current) {
        return false;
      }

      const addressErrorMsg = checkAddress(contractAddress, chain.addressPrefix);
      if (addressErrorMsg) {
        setContractAddressError(`Invalid address for network ${chain.chainId}: ${addressErrorMsg}`);
        return false;
      }

      if (contractAdmin === null) {
        setContractAddressError(
          "This contract has no admin set. Migration requires an admin. Set an admin first or use a different contract.",
        );
        return false;
      }

      if (!codeId || !Number.isSafeInteger(Number(codeId)) || Number(codeId) <= 0) {
        setCodeIdError("Code ID must be a positive integer");
        return false;
      }

      return true;
    };

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

    const msgValue = MsgCodecs[MsgTypeUrls.MigrateContract].fromPartial({
      sender: senderAddress,
      contract: contractAddress,
      codeId: safeBigIntCodeId,
      msg: msgContentUtf8Array,
    });

    const msg: MsgMigrateContractEncodeObject = {
      typeUrl: MsgTypeUrls.MigrateContract,
      value: msgValue,
    };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.addressPrefix, chain.chainId, contractAdmin, msgContent, senderAddress, trimmedInputs]);
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
      <h2 className="text-xl font-heading font-semibold mb-4">MsgMigrateContract</h2>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold">Migration requirements</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-200/80">
            <li>The contract must have an admin set (only the admin can migrate).</li>
            <li>
              The <strong>new</strong> code (target Code ID) must export a{" "}
              <code className="rounded bg-amber-900/40 px-1">migrate</code> entry point. If it
              does not, the chain will reject with &ldquo;Missing export migrate&rdquo;.
            </li>
            <li>The migrate JSON message must match what the new code expects.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div>
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
          {checkingContract && (
            <p className="mt-1 text-xs text-muted-foreground">Checking contract info...</p>
          )}
          {contractAdmin === null && !checkingContract && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              No admin set on this contract. Migration is not possible.
            </p>
          )}
          {contractAdmin && !checkingContract && (
            <p className="mt-1 flex items-center gap-1 text-xs text-green-accent">
              <Info className="h-3 w-3" />
              Admin: <span className="font-mono">{contractAdmin}</span>
              {contractAdmin !== senderAddress && (
                <span className="ml-1 text-amber-400">(not the sender address)</span>
              )}
            </p>
          )}
        </div>
        <Input
          variant="institutional"
          label="New Code ID"
          name="code-id"
          value={codeId}
          onChange={({ target }) => {
            setCodeId(target.value);
            setCodeIdError("");
          }}
          error={codeIdError}
          placeholder="The code ID of the new WASM binary to migrate to"
        />
        <div>
          <JsonEditor
            label="Migrate Msg JSON"
            content={{ text: msgContent }}
            onChange={(newMsgContent, _, { contentErrors }) => {
              setMsgContent("text" in newMsgContent ? (newMsgContent.text ?? "{}") : "{}");
              jsonError.current = !!contentErrors;
            }}
          />
        </div>
      </div>
    </StackableContainer>
  );
};

export default MsgMigrateContractForm;
