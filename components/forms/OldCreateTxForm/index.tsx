import { loadValidators } from "@/context/ChainsContext/helpers";
import { DbTransactionParsedDataJson } from "@/graphql";
import { createDbTx } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/utils";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { EncodeObject } from "@cosmjs/proto-signing";
import { Account, calculateFee } from "@cosmjs/stargate";
import { assert, sleep } from "@cosmjs/utils";
import { NextRouter, withRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChains } from "../../../context/ChainsContext";
import { exportMsgToJson, gasOfTx } from "../../../lib/txMsgHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OldButton from "../../inputs/Button";
import MsgForm from "./MsgForm";
import TransactionTypeSelector from "./TransactionTypeSelector";

export interface MsgGetter {
  readonly isMsgValid: () => boolean;
  readonly msg: EncodeObject | EncodeObject[];  // Support single or multiple messages
}

interface OldCreateTxFormProps {
  readonly router: NextRouter;
  readonly senderAddress: string;
  readonly accountOnChain: Account;
}

const OldCreateTxForm = ({ router, senderAddress, accountOnChain }: OldCreateTxFormProps) => {
  const {
    chain,
    validatorState: { validators },
    chainsDispatch,
  } = useChains();

  const [processing, setProcessing] = useState(false);
  const [msgTypes, setMsgTypes] = useState<readonly MsgTypeUrl[]>([]);
  const [msgKeys, setMsgKeys] = useState<readonly string[]>([]);
  const msgGetters = useRef<MsgGetter[]>([]);
  const [memo, setMemo] = useState("");
  const [gasLimit, setGasLimit] = useState(gasOfTx([]));
  const [gasLimitError, setGasLimitError] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);
  // Use a ref for validation trigger to avoid re-renders when msgGetter is updated
  const validationTriggerRef = useRef(0);
  const [validationTrigger, setValidationTrigger] = useState(0);
  // Ref to track debounce timeout to prevent infinite update loops
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to prevent duplicate submissions (works synchronously, unlike state)
  const isSubmittingRef = useRef(false);

  // Stable callback for updating msgGetters - uses ref to avoid re-render loops
  // The callback is stable (same reference) across renders to prevent infinite loops
  // in child components that have setMsgGetter in their useEffect dependencies
  const updateMsgGetter = useCallback((index: number, msgGetter: MsgGetter) => {
    msgGetters.current = [
      ...msgGetters.current.slice(0, index),
      msgGetter,
      ...msgGetters.current.slice(index + 1),
    ];
    // Use ref to batch validation triggers and avoid excessive re-renders
    validationTriggerRef.current += 1;
    
    // Debounce the state update using setTimeout to prevent infinite loops
    // Cancel any pending update before scheduling a new one
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setValidationTrigger(validationTriggerRef.current);
      debounceTimeoutRef.current = null;
    }, 0);
  }, []);

  const addMsgType = (newMsgType: MsgTypeUrl) => {
    setMsgKeys((oldMsgKeys) => [...oldMsgKeys, crypto.randomUUID()]);
    setMsgTypes((oldMsgTypes) => {
      const newMsgTypes = [...oldMsgTypes, newMsgType];
      setGasLimit(gasOfTx(newMsgTypes));
      return newMsgTypes;
    });
  };

  const addMsgWithValidator = (newMsgType: MsgTypeUrl) => {
    const validatorsLoaded = !!validators.bonded.length;
    if (!validatorsLoaded) {
      loadValidators(chainsDispatch);
    }

    addMsgType(newMsgType);
  };

  const handleSelectTransactionType = (typeUrl: MsgTypeUrl) => {
    // Check if this message type requires validators
    const requiresValidator = ([
      MsgTypeUrls.Delegate,
      MsgTypeUrls.Undelegate,
      MsgTypeUrls.BeginRedelegate,
      MsgTypeUrls.WithdrawDelegatorReward,
      MsgTypeUrls.WithdrawValidatorCommission,
    ] as readonly MsgTypeUrl[]).includes(typeUrl);

    if (requiresValidator) {
      addMsgWithValidator(typeUrl);
    } else {
      addMsgType(typeUrl);
    }
  };


  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Update validation state whenever relevant state changes
  useEffect(() => {
    // Check if all fields are properly filled
    let isValid = true;

    // Check if at least one message is added
    if (!msgTypes.length) {
      isValid = false;
    }

    // Check if all message forms are loaded
    if (msgGetters.current.length !== msgTypes.length) {
      isValid = false;
    }

    // Check if all message forms are valid
    const allMessagesValid = msgGetters.current.every(({ isMsgValid }) => isMsgValid());
    if (!allMessagesValid) {
      isValid = false;
    }

    // Check if gas limit is valid
    if (!Number.isSafeInteger(gasLimit) || gasLimit <= 0) {
      isValid = false;
    }

    setIsFormValid(isValid);

    // Also update gas limit error state
    if (gasLimit > 0 && Number.isSafeInteger(gasLimit)) {
      setGasLimitError("");
    } else if (msgTypes.length > 0) {
      // Only show error if there are messages (form is being used)
      setGasLimitError(gasLimit <= 0 ? "Gas limit must be positive" : "Gas limit must be an integer");
    } else {
      setGasLimitError("");
    }
  }, [msgTypes.length, gasLimit, validationTrigger]);

  const createTx = async () => {
    // Guard against duplicate submissions (ref check is synchronous, unlike state)
    if (isSubmittingRef.current || processing) {
      console.log("DEBUG: createTx already in progress, ignoring duplicate call");
      return;
    }
    
    console.log("DEBUG: createTx called with", msgTypes.length, "message types");

    // Basic validation before proceeding (before showing loading state)
    if (!msgTypes.length) {
      toast.error("Please add at least one message to the transaction");
      return;
    }

    if (!msgGetters.current.length) {
      toast.error("Message forms are not loaded yet. Please wait a moment.");
      return;
    }

    // Set ref immediately (synchronous) to prevent race conditions
    isSubmittingRef.current = true;
    const loadingToastId = toast.loading("Creating transaction");
    setProcessing(true);
    // If it fails too fast, toast.dismiss does not work
    await sleep(500);

    try {
      console.log("DEBUG: creating tx...", {
        accountNumber: accountOnChain.accountNumber,
        sequence: accountOnChain.sequence,
        chainId: chain.chainId,
        gasLimit,
        gasPrice: chain.gasPrice,
      });

      assert(typeof accountOnChain.accountNumber === "number", "accountNumber missing");
      assert(msgGetters.current.length, "form filled incorrectly");

      // Collect and flatten messages (some forms may return multiple messages)
      const validGetters = msgGetters.current.filter(({ isMsgValid }) => isMsgValid());
      const msgs = validGetters.flatMap(({ msg }) => {
        // Handle both single message and array of messages
        const msgsArray = Array.isArray(msg) ? msg : [msg];
        return msgsArray.map(m => exportMsgToJson(m));
      });

      console.log("DEBUG: msgs exported", msgs);
      console.log("DEBUG: msgGetters.current length", msgGetters.current.length);
      console.log("DEBUG: msgTypes length", msgTypes.length);
      console.log("DEBUG: valid msgs count", msgs.length);
      console.log("DEBUG: valid getters count", validGetters.length);

      if (!validGetters.length || validGetters.length !== msgTypes.length) {
        console.error("DEBUG: msgs validation failed - some message forms are incomplete or invalid");
        toastError({
          description: "Please complete all message forms before creating the transaction. Check for validation errors in red.",
        });
        return;
      }

      if (!Number.isSafeInteger(gasLimit) || gasLimit <= 0) {
        setGasLimitError("gas limit must be a positive integer");
        return;
      }

      console.log("DEBUG: calculating fee", { gasLimit, gasPrice: chain.gasPrice });
      const fee = calculateFee(gasLimit, chain.gasPrice);
      console.log("DEBUG: fee calculated", fee);

      const txData: DbTransactionParsedDataJson = {
        accountNumber: accountOnChain.accountNumber,
        sequence: accountOnChain.sequence,
        chainId: chain.chainId,
        msgs,
        fee,
        memo,
      };

      console.log("DEBUG: sending createDbTx request");
      const txId = await createDbTx(accountOnChain.address, chain.chainId, txData);
      console.log("DEBUG: createDbTx success", txId);
      
      toastSuccess("Transaction created with ID", txId);
      const chainName = chain.registryName || router.query.chainName?.toString();
      
      if (chainName && senderAddress && txId) {
        router.push(`/${chainName}/${senderAddress}/transaction/${txId}`);
      } else {
        console.error("DEBUG: Missing redirect info", { chainName, senderAddress, txId });
        toast.error("Transaction created, but could not redirect. Please find it in your dashboard.");
      }
    } catch (e) {
      console.error("Failed to create transaction:", e);
      toastError({
        description: "Failed to create transaction",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      // Always clean up in finally block
      toast.dismiss(loadingToastId);
      isSubmittingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-semibold tracking-tight mb-2">Create New Transaction</h2>
        <p className="text-sm text-muted-foreground">Select a command type and fill in the transaction details below</p>
      </div>

      {/* Command Selector - Always visible */}
      <div className="w-full">
        <TransactionTypeSelector 
          onSelect={(typeUrl) => {
            handleSelectTransactionType(typeUrl);
          }} 
        />
      </div>

      {/* Transaction Forms - Show below selector when commands are selected */}
      {msgTypes.length > 0 && (
        <div className="space-y-6 mt-8">
          {msgTypes.map((msgType, index) => (
            <div key={msgKeys[index]} className="space-y-4">
              <MsgForm
                msgType={msgType}
                senderAddress={senderAddress}
                gasLimit={gasLimit}
                msgIndex={index}
                setMsgGetter={updateMsgGetter}
                deleteMsg={() => {
                  msgGetters.current.splice(index, 1);
                  setMsgKeys((oldMsgKeys) => [
                    ...oldMsgKeys.slice(0, index),
                    ...oldMsgKeys.slice(index + 1),
                  ]);
                  setMsgTypes((oldMsgTypes) => {
                    const newMsgTypes: MsgTypeUrl[] = oldMsgTypes.slice();
                    newMsgTypes.splice(index, 1);
                    setGasLimit(gasOfTx(newMsgTypes));
                    return newMsgTypes;
                  });
                  // Validation will be triggered by useEffect when msgTypes.length changes
                }}
              />
            </div>
          ))}
          
          {/* Transaction Settings */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  variant="institutional"
                  type="number"
                  label="Gas Limit"
                  name="gas-limit"
                  value={gasLimit}
                  onChange={({ target }) => {
                    const newGasLimit = Number(target.value);
                    setGasLimit(newGasLimit);
                    // Validation will be triggered by useEffect when gasLimit changes
                  }}
                  error={gasLimitError}
                />
              </div>
              <div>
                <Input
                  variant="institutional"
                  label="Gas Price"
                  name="gas-price"
                  value={chain.gasPrice}
                  disabled={true}
                  error={gasLimitError}
                />
              </div>
              <div>
                <Input
                  variant="institutional"
                  label="Memo"
                  name="memo"
                  value={memo}
                  onChange={({ target }) => setMemo(target.value)}
                />
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              variant="action-outline"
              size="action"
              onClick={() => {
                // Scroll to top to show selector
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:flex-1"
            >
              Add Another Transaction
            </Button>
            <OldButton
              label="Create Transaction"
              onClick={createTx}
              disabled={!isFormValid || processing}
              loading={processing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default withRouter(OldCreateTxForm);
