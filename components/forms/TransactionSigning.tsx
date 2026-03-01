import { DbSignatureObj, DbSignatureObjDraft, DbTransactionParsedDataJson } from "@/graphql";
import { createDbSignature } from "@/lib/api";
import { getKeplr } from "@/lib/keplr";
import { useWallet } from "@/context/WalletContext";
import { aminoConverters } from "@/lib/msg";
import { makeDirectModeAuthInfo, makeDirectSignDoc, logDirectSignDocDebug, shouldUseDirectMode } from "@/lib/multisigDirect";
import { generateSignDocDebugInfo, logSignDocDebug } from "@/lib/signDocDebug";
import { toastError, toastSuccess } from "@/lib/utils";
import { SigningStatus } from "@/types/signing";
import { MultisigThresholdPubkey } from "@cosmjs/amino";
import { wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { toBase64, fromBase64 } from "@cosmjs/encoding";
import { Registry, TxBodyEncodeObject } from "@cosmjs/proto-signing";
import { AminoTypes, SigningStargateClient, defaultRegistryTypes } from "@cosmjs/stargate";
import { assert } from "@cosmjs/utils";
import Long from "long";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Shield } from "lucide-react";
import { useChains } from "../../context/ChainsContext";
import HashView from "../dataViews/HashView";
import { ProposalIntentView } from "../dataViews/ProposalIntentView";
import Button from "../inputs/Button";
import StackableContainer from "../layout/StackableContainer";

type TxSignMode = "amino" | "direct";

interface TransactionSigningProps {
  readonly signatures: DbSignatureObj[];
  readonly tx: DbTransactionParsedDataJson;
  readonly pubkey: MultisigThresholdPubkey;
  readonly transactionID: string;
  readonly addSignature: (signature: DbSignatureObj) => void;
  readonly compact?: boolean;
}

const TransactionSigning = (props: TransactionSigningProps) => {
  const memberPubkeys = props.pubkey.value.pubkeys.map(({ value }) => value);

  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, getAminoSigner } = useWallet();
  const [signing, setSigning] = useState<SigningStatus>("not_signed");
  const [signingInProgress, setSigningInProgress] = useState(false);
  
  // Phase 0: Intent verification state
  const [intentVerified, setIntentVerified] = useState(false);
  const [showIntentView, setShowIntentView] = useState(false);

  // Check if this transaction requires Direct mode based on message types.
  // Direct mode is required for certain messages like MsgWithdrawValidatorCommission
  // on some chains (e.g., Coreum).
  //
  // IMPORTANT: Direct mode has a constraint - the authInfoBytes include a bitarray
  // indicating which members signed. We pre-construct this assuming ALL threshold
  // members will sign. This works for N-of-N multisigs where all members sign.
  // For partial signing (e.g., 2-of-3), Amino mode is required.
  const requiresDirectMode = shouldUseDirectMode(props.tx.msgs);
  
  // Auto-select the appropriate sign mode based on transaction content
  const signMode: TxSignMode = requiresDirectMode ? "direct" : "amino";

  // Check wallet membership status whenever walletInfo changes
  useEffect(() => {
    if (!walletInfo) {
      setSigning("not_signed");
      return;
    }

    const isMember = memberPubkeys.includes(walletInfo.pubKey);
    const hasSigned = isMember
      ? props.signatures.some((sig) => sig.address === walletInfo.address)
      : false;

    if (!isMember) {
      setSigning("not_a_member");
    } else if (hasSigned) {
      setSigning("signed");
    } else {
      setSigning("not_signed");
    }
  }, [walletInfo, memberPubkeys, props.signatures]);

  const signTransaction = async (mode: TxSignMode = signMode) => {
    const loadingToastId = toast.loading(`Signing transaction (${mode.toUpperCase()} mode)`);

    try {
      setSigningInProgress(true);

      const signerAddress = walletInfo?.address;
      assert(signerAddress, "Missing signer address");

      console.log("🔍 SIGN DEBUG: TransactionSigning - about to sign transaction");
      console.log("  - SIGN MODE:", mode.toUpperCase());
      console.log("  - signerAddress:", signerAddress);
      console.log("  - tx.accountNumber:", props.tx.accountNumber);
      console.log("  - tx.sequence:", props.tx.sequence);
      console.log("  - tx.chainId:", props.tx.chainId);
      console.log("  - chain.chainId (context):", chain.chainId);

      // CRITICAL: Verify chainId matches to prevent invalid signatures
      if (props.tx.chainId && props.tx.chainId !== chain.chainId) {
        throw new Error(
          `Chain ID mismatch! Transaction was created for chain "${props.tx.chainId}" ` +
          `but you're connected to "${chain.chainId}". Please switch to the correct chain.`
        );
      }

      console.log("  - tx.msgs count:", props.tx.msgs?.length || 0);
      if (props.tx.msgs && props.tx.msgs.length > 0) {
        const aminoTypesDebug = new AminoTypes(aminoConverters);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.tx.msgs.forEach((msg: any, index: number) => {
          console.log(`🔍 SIGN DEBUG: signing msg[${index}]`);
          console.log(`  - typeUrl:`, msg.typeUrl);
          console.log(`  - value (raw):`, JSON.stringify(msg.value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
          try {
            const aminoMsg = aminoTypesDebug.toAmino(msg);
            console.log(`  - aminoType:`, aminoMsg.type);
            console.log(`  - aminoValue:`, JSON.stringify(aminoMsg.value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
          } catch (e) {
            console.error(`  - ❌ Failed to convert to Amino:`, e);
          }
        });
      }

      console.log("  - tx.fee:", props.tx.fee);
      console.log("  - tx.memo:", props.tx.memo);

      let bodyBytes: Uint8Array;
      let signatureBytes: Uint8Array;

      if (mode === "direct") {
        // DIRECT MODE: Sign the multisig's Direct SignDoc
        // This is different from Amino - we construct the SignDoc for the MULTISIG account,
        // not for the individual signer
        console.log("🔍 SIGN DEBUG: Using DIRECT mode for multisig");

        const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
        
        // 1. Construct bodyBytes (same as Amino)
        const txBodyEncodeObject: TxBodyEncodeObject = {
          typeUrl: "/cosmos.tx.v1beta1.TxBody",
          value: {
            messages: props.tx.msgs,
            memo: props.tx.memo,
          },
        };
        bodyBytes = registry.encode(txBodyEncodeObject);

        // 2. Construct AuthInfo with MULTISIG pubkey and SIGN_MODE_DIRECT
        const { authInfoBytes } = makeDirectModeAuthInfo(
          props.pubkey,
          props.tx.sequence,
          props.tx.fee,
        );

        // 3. Construct the Direct SignDoc for the multisig
        const { signDocHash } = makeDirectSignDoc(
          bodyBytes,
          authInfoBytes,
          props.tx.chainId,
          props.tx.accountNumber,
        );

        // Log the Direct SignDoc debug info
        logDirectSignDocDebug(
          bodyBytes,
          authInfoBytes,
          props.tx.chainId,
          props.tx.accountNumber,
          "SIGNING Direct SignDoc (MULTISIG)"
        );

        console.log("🔍 SIGN DEBUG: Direct SignDoc Hash:", toBase64(signDocHash));

        // 4. Get configured Keplr (sets defaultOptions before enable to avoid double popup)
        const keplr = await getKeplr(props.tx.chainId);

        // Create the SignDoc in the format Keplr expects
        const signDoc = {
          bodyBytes,
          authInfoBytes,
          chainId: props.tx.chainId,
          accountNumber: Long.fromNumber(props.tx.accountNumber),
        };

        console.log("🔍 SIGN DEBUG: Calling Keplr signDirect with multisig SignDoc");
        const signResponse = await keplr.signDirect(
          props.tx.chainId,
          signerAddress,
          signDoc,
        );

        signatureBytes = fromBase64(signResponse.signature.signature);
        console.log("🔍 SIGN DEBUG: Direct signing completed");
        console.log("  - signature length:", signatureBytes.length);
      } else {
        // AMINO MODE: Use SigningStargateClient.sign() as before
        console.log("🔍 SIGN DEBUG: Using AMINO mode");

        const offlineSigner = await getAminoSigner();
        if (!offlineSigner) {
          throw new Error("Offline signer not found. Please connect your wallet first.");
        }

        const signingClient = await SigningStargateClient.offline(offlineSigner, {
          registry: new Registry([...defaultRegistryTypes, ...wasmTypes]),
          aminoTypes: new AminoTypes(aminoConverters),
        });

        const signerData = {
          accountNumber: props.tx.accountNumber,
          sequence: props.tx.sequence,
          chainId: props.tx.chainId,
        };

        // Log the Amino SignDoc for comparison
        const aminoTypesForDebug = new AminoTypes(aminoConverters);
        const signTimeDebugInfo = generateSignDocDebugInfo(
          props.tx.msgs,
          props.tx.fee,
          props.tx.chainId,
          props.tx.memo,
          props.tx.accountNumber,
          props.tx.sequence,
          aminoTypesForDebug
        );
        logSignDocDebug(signTimeDebugInfo, "SIGNING SignDoc (AMINO mode)");
        console.log("🔍 SIGN DEBUG: Expected SignDoc Hash at sign time:", signTimeDebugInfo.signDocHashBase64);

        console.log("🔍 SIGN DEBUG: calling signingClient.sign");
        const signResult = await signingClient.sign(
          signerAddress,
          props.tx.msgs,
          props.tx.fee,
          props.tx.memo,
          signerData,
        );

        bodyBytes = signResult.bodyBytes;
        signatureBytes = signResult.signatures[0];

        console.log("🔍 SIGN DEBUG: Amino signing completed");
        console.log("  - bodyBytes length:", bodyBytes.length);
        console.log("  - signature length:", signatureBytes.length);
      }

      // Check for duplicate signatures
      const base64EncodedSignature = toBase64(signatureBytes);
      const base64EncodedBodyBytes = toBase64(bodyBytes);
      const prevSigMatch = props.signatures.findIndex(
        (signature) => signature.signature === base64EncodedSignature,
      );

      if (prevSigMatch > -1) {
        throw new Error("This account has already signed");
      }

      // Store the signature
      const signature: Omit<DbSignatureObjDraft, "transaction"> = {
        bodyBytes: base64EncodedBodyBytes,
        signature: base64EncodedSignature,
        address: signerAddress,
      };
      await createDbSignature(props.transactionID, signature);
      toastSuccess("Transaction signed by", signerAddress);
      props.addSignature(signature);
      setSigning("signed");
    } catch (e) {
      console.error("Failed to sign the tx:", e);
      toastError({
        description: "Failed to sign the tx",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setSigningInProgress(false);
      toast.dismiss(loadingToastId);
    }
  };

  // Compact mode for bento card layout
  if (props.compact) {
    return (
      <div className="space-y-3">
        {signing === "signed" ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-accent/10 border border-green-accent/30">
            <CheckCircle2 className="h-4 w-4 text-green-accent" />
            <p className="text-sm text-green-accent m-0">You've signed this transaction</p>
          </div>
        ) : null}
        {signing === "not_a_member" ? (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400 m-0">You don't belong to this multisig</p>
          </div>
        ) : null}
        {signing === "not_signed" ? (
          <>
            {walletInfo ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground m-0">
                  Sign with {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-6)}
                </p>
                {/* Info banner when Direct mode is auto-selected */}
                {requiresDirectMode && (
                  <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 mb-2">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-blue-400" />
                      <span className="text-xs text-blue-400">Using Direct signing mode</span>
                    </div>
                    <p className="text-xs text-muted-foreground m-0 mt-1">
                      Required for validator commission withdrawal
                    </p>
                  </div>
                )}
                
                {/* Phase 0: Intent verification (compact) */}
                {!intentVerified && (
                  <ProposalIntentView
                    msgs={props.tx.msgs}
                    fee={props.tx.fee}
                    memo={props.tx.memo}
                    chainId={props.tx.chainId}
                    accountNumber={props.tx.accountNumber}
                    sequence={props.tx.sequence}
                    onVerified={setIntentVerified}
                    requireVerification={true}
                    compact={true}
                    signMode={signMode}
                  />
                )}
                
                <Button
                  label="Sign transaction"
                  onClick={() => signTransaction(signMode)}
                  loading={signingInProgress}
                  disabled={!intentVerified}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground m-0 mb-2">Connect wallet to sign</p>
                <div className="flex flex-col gap-2">
                  <Button label="Connect Keplr" onClick={connectKeplr} loading={loading.keplr} />
                  <Button
                    label="Connect Ledger"
                    onClick={connectLedger}
                    loading={loading.ledger}
                  />
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  }

  // Full mode (original layout)
  return (
    <>
      <StackableContainer lessPadding lessMargin lessRadius>
        <h2>Current Signers</h2>
        {props.signatures.map((signature, i) => (
          <StackableContainer lessPadding lessRadius lessMargin key={`${signature.address}_${i}`}>
            <HashView hash={signature.address} />
          </StackableContainer>
        ))}
        {!props.signatures.length ? <p>No signatures yet</p> : null}
      </StackableContainer>
      <StackableContainer lessPadding lessMargin lessRadius>
        {signing === "signed" ? (
          <div className="confirmation">
            <svg viewBox="0 0 77 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 30L26 51L72 5" stroke="white" strokeWidth="12" />
            </svg>
            <p>You've signed this transaction</p>
          </div>
        ) : null}
        {signing === "not_a_member" ? (
          <div className="multisig-error">
            <p>You don't belong to this multisig</p>
          </div>
        ) : null}
        {signing === "not_signed" ? (
          <>
            {walletInfo ? (
              <>
                <p>
                  You can sign this transaction with {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-6)} (
                  {walletInfo.type ?? "Unknown wallet type"})
                </p>
                {/* Info banner when Direct mode is auto-selected */}
                {requiresDirectMode && (
                  <div style={{ 
                    padding: "12px", 
                    borderRadius: "8px", 
                    background: "rgba(59, 130, 246, 0.1)", 
                    border: "1px solid rgba(59, 130, 246, 0.3)", 
                    marginBottom: "12px" 
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <CheckCircle2 size={14} color="#3b82f6" />
                      <span style={{ fontSize: "13px", color: "#3b82f6", fontWeight: 500 }}>
                        Using Direct signing mode
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", margin: 0, color: "#9ca3af" }}>
                      Required for validator commission withdrawal on TX
                    </p>
                  </div>
                )}
                
                {/* Phase 0: Intent verification toggle */}
                {!showIntentView && !intentVerified && (
                  <Button
                    label="Verify Transaction Intent"
                    onClick={() => setShowIntentView(true)}
                  />
                )}
                
                {/* Phase 0: Intent verification view */}
                {showIntentView && !intentVerified && (
                  <div style={{ marginBottom: "16px" }}>
                    <ProposalIntentView
                      msgs={props.tx.msgs}
                      fee={props.tx.fee}
                      memo={props.tx.memo}
                      chainId={props.tx.chainId}
                      accountNumber={props.tx.accountNumber}
                      sequence={props.tx.sequence}
                      onVerified={setIntentVerified}
                      requireVerification={true}
                      compact={false}
                      signMode={signMode}
                    />
                  </div>
                )}
                
                {/* Show verified badge when verified */}
                {intentVerified && (
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px", 
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "hsl(var(--accent-green) / 0.1)",
                    border: "1px solid hsl(var(--accent-green) / 0.3)",
                    marginBottom: "12px"
                  }}>
                    <Shield size={16} color="hsl(var(--accent-green))" />
                    <span style={{ fontSize: "13px", color: "hsl(var(--accent-green))" }}>
                      Transaction intent verified
                    </span>
                  </div>
                )}
                
                <Button
                  label={intentVerified ? "Sign transaction" : "Verify intent to sign"}
                  onClick={() => intentVerified ? signTransaction(signMode) : setShowIntentView(true)}
                  loading={signingInProgress}
                />
              </>
            ) : (
              <>
                <h2>Choose wallet to sign</h2>
                <Button label="Connect Keplr" onClick={connectKeplr} loading={loading.keplr} />
                <Button
                  label="Connect Ledger (WebUSB)"
                  onClick={connectLedger}
                  loading={loading.ledger}
                />
              </>
            )}
          </>
        ) : null}
      </StackableContainer>
      <style jsx>{`
        p {
          text-align: center;
          max-width: none;
        }
        h2 {
          margin-top: 1em;
        }
        h2:first-child {
          margin-top: 0;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .confirmation {
          display: flex;
          justify-content: center;
        }
        .confirmation svg {
          height: 0.8em;
          margin-right: 0.5em;
        }
        .multisig-error p {
          color: red;
          font-size: 16px;
        }
      `}</style>
    </>
  );
};

export default TransactionSigning;
