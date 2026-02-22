import { MsgCreateValidatorEncodeObject } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { encodePubkey } from "@cosmjs/proto-signing";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { useChains } from "../../../../context/ChainsContext";
import { displayCoinToBaseCoin } from "../../../../lib/coinHelpers";
import { checkAddress, trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { getMessageCategory } from "../../../../lib/msgCategoryHelpers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardLabel } from "@/components/ui/card";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";
import BalanceDisplay from "../BalanceDisplay";
import { useBalance } from "@/lib/hooks/useBalance";

/**
 * Converts a delegator address to a validator operator address
 * by re-encoding with the validator prefix and recalculating the checksum
 */
const convertToValidatorAddress = (delegatorAddress: string, addressPrefix: string): string => {
  try {
    const decoded = fromBech32(delegatorAddress);
    const validatorPrefix = addressPrefix.startsWith("cosmos") 
      ? "cosmosvaloper" 
      : `${addressPrefix}valoper`;
    return toBech32(validatorPrefix, decoded.data);
  } catch (e) {
    throw new Error(`Failed to convert to validator address: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
};

interface MsgCreateValidatorFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number;
}

const MsgCreateValidatorForm = ({ senderAddress, setMsgGetter, deleteMsg, gasLimit }: MsgCreateValidatorFormProps) => {
  const { chain } = useChains();
  const categoryInfo = getMessageCategory(MsgTypeUrls.CreateValidator);
  const { availableBalance } = useBalance({
    address: senderAddress,
    denom: chain.displayDenom,
    gasLimit,
  });

  const [description, setDescription] = useState({
    moniker: "",
    identity: "",
    website: "",
    securityContact: "",
    details: ""
  });
  const [commission, setCommission] = useState({
    rate: "0.200000000000000000",
    maxRate: "0.200000000000000000",
    maxChangeRate: "0.010000000000000000"
  });
  const [minSelfDelegation, setMinSelfDelegation] = useState("20000000000");
  const [validatorAddress, setValidatorAddress] = useState("");
  const [amount, setAmount] = useState("20300000000");
  const [pubkey, setPubkey] = useState("");

  const [validatorAddressError, setValidatorAddressError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [pubkeyError, setPubkeyError] = useState("");

  const trimmedInputs = trimStringsObj({
    validatorAddress,
    amount,
    minSelfDelegation,
    pubkey,
    ...description,
    ...commission
  });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { validatorAddress, amount, minSelfDelegation, pubkey, ...descAndComm } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setValidatorAddressError("");
      setAmountError("");
      setPubkeyError("");

      // Validate validator address format and checksum
      const validatorPrefix = chain.addressPrefix.startsWith("cosmos") 
        ? "cosmosvaloper" 
        : `${chain.addressPrefix}valoper`;
      
      if (!validatorAddress.startsWith(validatorPrefix)) {
        setValidatorAddressError(
          `Validator address must start with ${validatorPrefix}`,
        );
        return false;
      }

      // Check if the validator address has a valid checksum
      try {
        fromBech32(validatorAddress);
      } catch (e) {
        setValidatorAddressError(
          `Invalid validator address checksum. ${e instanceof Error ? e.message : ''}`,
        );
        return false;
      }

      const addressErrorMsg = checkAddress(validatorAddress, validatorPrefix);
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

      // Validate against available balance
      if (availableBalance && availableBalance.amount !== "0") {
        try {
          const userAmountCoin = displayCoinToBaseCoin({ denom: chain.displayDenom, amount }, chain.assets);
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

      if (!pubkey) {
        setPubkeyError("Pubkey is required");
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
        console.log("🔍 DECIMAL DEBUG: MsgCreateValidatorForm - converting delegation amount");
        console.log("  - amount:", amount);
        const result = displayCoinToBaseCoin({ denom: chain.displayDenom, amount }, chain.assets);
        console.log("  - microCoin result:", result);
        return result;
      } catch (error) {
        console.error("🔍 DECIMAL DEBUG: MsgCreateValidatorForm - delegation conversion error:", error);
        return { denom: chain.displayDenom, amount: "0" };
      }
    })();

    console.log("🔍 DECIMAL DEBUG: MsgCreateValidatorForm - converting commission rates");
    console.log("  - descAndComm.rate:", descAndComm.rate);
    console.log("  - descAndComm.maxRate:", descAndComm.maxRate);
    console.log("  - descAndComm.maxChangeRate:", descAndComm.maxChangeRate);

    const rateAtomics = Decimal.fromUserInput(descAndComm.rate, 18).atomics;
    const maxRateAtomics = Decimal.fromUserInput(descAndComm.maxRate, 18).atomics;
    const maxChangeRateAtomics = Decimal.fromUserInput(descAndComm.maxChangeRate, 18).atomics;

    console.log("🔍 DECIMAL DEBUG: commission conversion results");
    console.log("  - rateAtomics:", rateAtomics, typeof rateAtomics);
    console.log("  - maxRateAtomics:", maxRateAtomics, typeof maxRateAtomics);
    console.log("  - maxChangeRateAtomics:", maxChangeRateAtomics, typeof maxChangeRateAtomics);

    console.log("🔍 DECIMAL DEBUG: pubkey encoding");
    console.log("  - pubkey input (base64):", pubkey);
    
    // Properly encode the pubkey with protobuf wrapper
    // encodePubkey expects a base64 string and adds the protobuf wrapper (34 bytes)
    const encodedPubkey = encodePubkey({
      type: "tendermint/PubKeyEd25519",
      value: pubkey  // Pass base64 string directly
    });
    
    console.log("  - encodedPubkey.typeUrl:", encodedPubkey.typeUrl);
    console.log("  - encodedPubkey.value.length:", encodedPubkey.value.length, "(should be 34 bytes with protobuf wrapper)");

    const msgValue = MsgCodecs[MsgTypeUrls.CreateValidator].fromPartial({
      description: {
        moniker: descAndComm.moniker,
        identity: descAndComm.identity,
        website: descAndComm.website,
        securityContact: descAndComm.securityContact,
        details: descAndComm.details
      },
      commission: {
        rate: rateAtomics,
        maxRate: maxRateAtomics,
        maxChangeRate: maxChangeRateAtomics
      },
      minSelfDelegation,
      delegatorAddress: senderAddress,
      validatorAddress,
      pubkey: encodedPubkey,
      value: microCoin,
    });

    console.log("🔍 DECIMAL DEBUG: MsgCreateValidatorForm - msgValue created");
    console.log("  - msgValue.commission:", msgValue.commission);

    const msg: MsgCreateValidatorEncodeObject = { typeUrl: MsgTypeUrls.CreateValidator, value: msgValue };

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
    availableBalance,
  ]);

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
        <h2 className="text-xl font-heading font-semibold">MsgCreateValidator</h2>
      </div>
      <div className="space-y-4">
        <BalanceDisplay
          treasuryAddress={senderAddress}
          denom={chain.displayDenom}
          gasLimit={gasLimit}
        />
        <Input
          variant="institutional"
          label="Moniker"
          name="moniker"
          value={description.moniker}
          onChange={({ target }) => setDescription(prev => ({ ...prev, moniker: target.value }))}
          placeholder="Validator name"
        />
        <Input
          variant="institutional"
          label="Identity"
          name="identity"
          value={description.identity}
          onChange={({ target }) => setDescription(prev => ({ ...prev, identity: target.value }))}
          placeholder="Keybase identity"
        />
        <Input
          variant="institutional"
          label="Website"
          name="website"
          value={description.website}
          onChange={({ target }) => setDescription(prev => ({ ...prev, website: target.value }))}
          placeholder="https://validator.com"
        />
        <Input
          variant="institutional"
          label="Security Contact"
          name="security-contact"
          value={description.securityContact}
          onChange={({ target }) => setDescription(prev => ({ ...prev, securityContact: target.value }))}
          placeholder="security@validator.com"
        />
        <Input
          variant="institutional"
          label="Details"
          name="details"
          value={description.details}
          onChange={({ target }) => setDescription(prev => ({ ...prev, details: target.value }))}
          placeholder="Validator description"
        />
        <Input
          variant="institutional"
          label="Commission Rate"
          name="commission-rate"
          value={commission.rate}
          onChange={({ target }) => setCommission(prev => ({ ...prev, rate: target.value }))}
          placeholder="0.100000000000000000"
        />
        <Input
          variant="institutional"
          label="Max Commission Rate"
          name="max-commission-rate"
          value={commission.maxRate}
          onChange={({ target }) => setCommission(prev => ({ ...prev, maxRate: target.value }))}
          placeholder="0.200000000000000000"
        />
        <Input
          variant="institutional"
          label="Max Commission Change Rate"
          name="max-commission-change-rate"
          value={commission.maxChangeRate}
          onChange={({ target }) => setCommission(prev => ({ ...prev, maxChangeRate: target.value }))}
          placeholder="0.010000000000000000"
        />
        <Input
          variant="institutional"
          label="Min Self Delegation"
          name="min-self-delegation"
          value={minSelfDelegation}
          onChange={({ target }) => setMinSelfDelegation(target.value)}
          placeholder="20000000000"
        />
        <div className="space-y-2">
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
            placeholder={`E.g. ${chain.addressPrefix}valoper...`}
          />
          <Button 
            type="button"
            variant="action-outline"
            size="action-sm"
            onClick={() => {
              try {
                const converted = convertToValidatorAddress(senderAddress, chain.addressPrefix);
                setValidatorAddress(converted);
                setValidatorAddressError("");
              } catch (e) {
                setValidatorAddressError(e instanceof Error ? e.message : 'Conversion failed');
              }
            }}
            className="w-full"
          >
            Auto-convert from sender address
          </Button>
        </div>
        <Input
          variant="institutional"
          label="PubKey (base64)"
          name="pubkey"
          value={pubkey}
          onChange={({ target }) => {
            setPubkey(target.value);
            setPubkeyError("");
          }}
          error={pubkeyError}
          placeholder="UlQl1HTwfAq2f8+3alBb5GBzjsW7H+UkPZAeA5VlImY="
        />
        <Input
          variant="institutional"
          type="number"
          label={`Self Delegation Amount (${chain.displayDenom})`}
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

export default MsgCreateValidatorForm;
