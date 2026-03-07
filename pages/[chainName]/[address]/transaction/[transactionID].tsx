import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { DbSignatureObj } from "@/graphql";
import { getTransaction } from "@/graphql/transaction";
import { cancelDbTx, updateDbTxHash } from "@/lib/api";
import { makeMultisignedTxBytesDirect, shouldUseDirectMode } from "@/lib/multisigDirect";
import { normalizePubkey, safeAminoMultisigTxBytes } from "@/lib/multisigAmino";
import { createMultiRpcVerifier, BroadcastResult } from "@/lib/rpc";
import { dispatchTransactionStatusChanged } from "@/lib/hooks/usePendingTransactions";
import { toastError, toastSuccess } from "@/lib/utils";
import { MultisigThresholdPubkey, pubkeyToAddress } from "@cosmjs/amino";
import { fromBase64 } from "@cosmjs/encoding";
import { Account, StargateClient } from "@cosmjs/stargate";
import { assert } from "@cosmjs/utils";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, MessageSquare, Users, Zap, CheckCircle2 } from "lucide-react";
import CompletedTransaction from "../../../../components/dataViews/CompletedTransaction";
import TransactionInfo from "../../../../components/dataViews/TransactionInfo";
import HashView from "../../../../components/dataViews/HashView";
import TransactionSigning from "../../../../components/forms/TransactionSigning";
import Button from "../../../../components/inputs/Button";
import Page from "../../../../components/layout/Page";
import { useChains } from "../../../../context/ChainsContext";
import { ensureChainMultisigInDb, getHostedMultisig, isAccount } from "../../../../lib/multisigHelpers";
import { dbTxFromJson, parseDbTxFromJson } from "../../../../lib/txMsgHelpers";
import { printableCoins } from "../../../../lib/displayHelpers";
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardTitle,
  BentoCardContent,
  BentoCardFooter,
} from "../../../../components/ui/bento-grid";
import { Card, CardContent, CardLabel } from "../../../../components/ui/card";

interface PageProps {
  transactionJSON: string | null;
  transactionID: string;
  txHash: string;
  signatures: readonly DbSignatureObj[];
  status: "pending" | "broadcast" | "cancelled";
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  // get transaction info
  const transactionID = context.params?.transactionID?.toString();
  assert(transactionID, "Transaction ID missing");
  const tx = await getTransaction(transactionID);

  if (!tx) {
    return {
      props: {
        transactionJSON: null,
        txHash: "",
        transactionID,
        signatures: [],
        status: "pending",
      },
    };
  }

  return {
    props: {
      transactionJSON: tx.dataJSON,
      txHash: tx.txHash || "",
      transactionID,
      signatures: tx.signatures ?? [],
      status:
        tx.status ||
        ((tx.txHash ? "broadcast" : "pending") as "pending" | "broadcast" | "cancelled"),
    },
  };
};

const TransactionPage = ({
  transactionJSON: initialTransactionJSON,
  transactionID,
  signatures: initialSignatures,
  txHash: initialTxHash,
  status: initialStatus,
}: PageProps) => {
  const { chain } = useChains();
  const router = useRouter();

  const [transactionJSON, setTransactionJSON] = useState<string | null>(initialTransactionJSON);
  const [currentSignatures, setCurrentSignatures] = useState([...initialSignatures]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [transactionHash, setTransactionHash] = useState(initialTxHash);
  const [transactionStatus, setTransactionStatus] = useState(initialStatus);
  const [isLoadingTx, setIsLoadingTx] = useState(!initialTransactionJSON);

  const [accountOnChain, setAccountOnChain] = useState<Account | null>(null);
  const [pubkey, setPubkey] = useState<MultisigThresholdPubkey>();
  const [sequenceMismatch, setSequenceMismatch] = useState<{
    expected: number;
    actual: number;
  } | null>(null);
  // Track whether sequence has been verified (starts false, set true after check passes)
  const [sequenceVerified, setSequenceVerified] = useState(false);
  // Phase 0: Multi-RPC verification state
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "verified" | "failed"
  >("idle");
  // Memoize txInfo to prevent recalculating on every render
  const txInfo = useMemo(() => transactionJSON ? dbTxFromJson(transactionJSON) : null, [transactionJSON]);

  useEffect(() => {
    if (initialTransactionJSON) return;

    (async () => {
      try {
        setIsLoadingTx(true);
        const { requestJson } = await import("../../../../lib/request");
        const tx = await requestJson(`/api/transaction/${transactionID}`);
        if (!tx) throw new Error("Not found");

        setTransactionJSON(tx.dataJSON);
        setCurrentSignatures(tx.signatures ?? []);
        setTransactionHash(tx.txHash || "");
        setTransactionStatus(
          tx.status || ((tx.txHash ? "broadcast" : "pending") as "pending" | "broadcast" | "cancelled")
        );
      } catch (err) {
        console.error("Fetch tx failed:", err);
        router.push("/404");
      } finally {
        setIsLoadingTx(false);
      }
    })();
  }, [initialTransactionJSON, transactionID, router]);


  const multisigAddress = router.query.address?.toString();

  const addSignature = (signature: DbSignatureObj) => {
    setCurrentSignatures((prevState) => [...prevState, signature]);
  };

  useEffect(() => {
    (async function fetchMultisig() {
      try {
        if (!multisigAddress || !isChainInfoFilled(chain) || !chain.nodeAddress) {
          return;
        }

        const resolved = await ensureChainMultisigInDb(multisigAddress, chain);
        if (!resolved.multisig) {
          throw new Error(resolved.reason ?? "Multisig address could not be resolved");
        }
        const hostedMultisig = await getHostedMultisig(multisigAddress, chain);

        assert(
          hostedMultisig.hosted === "db+chain" && isAccount(hostedMultisig.accountOnChain),
          "Multisig address could not be found",
        );

        // Normalize threshold to string — cosmjs 0.35.0-rc.0 calls
        // Uint53.fromString(threshold) which crashes with "str.match is not a
        // function" when threshold is a JS number from JSON.parse or protobuf decode.
        setPubkey(normalizePubkey(hostedMultisig.pubkeyOnDb));
        setAccountOnChain(hostedMultisig.accountOnChain);

        // Check for sequence mismatch - this happens when another tx was broadcast
        // from this account after this transaction was created
        if (txInfo && hostedMultisig.accountOnChain.sequence !== txInfo.sequence) {
          setSequenceMismatch({
            expected: txInfo.sequence,
            actual: hostedMultisig.accountOnChain.sequence,
          });
          setSequenceVerified(false);
        } else {
          setSequenceMismatch(null);
          setSequenceVerified(true);
        }
      } catch (e) {
        console.error("Failed to find multisig address:", e);
        toastError({
          title: "Failed to find multisig address",
          description: e instanceof Error ? e.message : "Could not resolve this multisig.",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    })();
  }, [chain, multisigAddress, txInfo]);

  const broadcastTx = async () => {
    const loadingToastId = toast.loading("Broadcasting transaction");
    let client: StargateClient | null = null;
    let verifier: ReturnType<typeof createMultiRpcVerifier> | null = null;

    try {
      setIsBroadcasting(true);

      assert(accountOnChain, "Account on chain value missing.");
      assert(
        typeof accountOnChain.accountNumber === "number",
        "Account on chain is missing an accountNumber",
      );
      assert(pubkey, "Pubkey not found on chain or in database");
      assert(txInfo, "Transaction not found in database");
      assert(multisigAddress, "Multisig address missing");

      // CRITICAL: Re-fetch the current on-chain account state right before broadcasting
      // This catches cases where the sequence changed since the page was loaded
      client = await StargateClient.connect(chain.nodeAddress);
      const currentAccountOnChain = await client.getAccount(multisigAddress);

      if (!currentAccountOnChain) {
        throw new Error("Could not fetch current account state from chain");
      }

      // Validate account number matches
      if (currentAccountOnChain.accountNumber !== txInfo.accountNumber) {
        throw new Error(
          `Account number mismatch! Transaction was created for account #${txInfo.accountNumber}, ` +
          `but the current on-chain account number is ${currentAccountOnChain.accountNumber}. ` +
          `This transaction's signatures are no longer valid. Please cancel this transaction and create a new one.`,
        );
      }

      // Validate sequence matches
      if (currentAccountOnChain.sequence !== txInfo.sequence) {
        // Update the mismatch state so the UI shows the warning
        setSequenceMismatch({
          expected: txInfo.sequence,
          actual: currentAccountOnChain.sequence,
        });

        throw new Error(
          `Sequence mismatch! Transaction was signed for sequence ${txInfo.sequence}, ` +
          `but the current on-chain sequence is ${currentAccountOnChain.sequence}. ` +
          `This typically means another transaction was broadcast from this multisig account. ` +
          `The collected signatures are no longer valid. Please cancel this transaction and create a new one.`,
        );
      }

      // Deduplicate signatures by address — last-in wins on accidental duplicates.
      // The DB blocks same-address dups, but in-memory React state can accumulate them
      // if the user double-signs during the same page session.
      const uniqueSignaturesMap = new Map<string, DbSignatureObj>();
      currentSignatures.forEach((s) => uniqueSignaturesMap.set(s.address, s));
      const uniqueSignatures = Array.from(uniqueSignaturesMap.values());

      // Hard-validate every signer address before passing it to cosmjs.
      // makeMultisignedTxBytes calls fromBech32() on the first address, which
      // throws "str.match is not a function" when the value is not a string.
      for (const s of uniqueSignatures) {
        if (!s.address || typeof s.address !== "string") {
          throw new Error(
            "A stored signature has a missing or invalid signer address. " +
            "The transaction data may be corrupt. Please cancel and create a new one.",
          );
        }
      }

      const bodyBytes = fromBase64(uniqueSignatures[0].bodyBytes);

      // Verify all signatures were produced for the same transaction body.
      const allSameBodyBytes = uniqueSignatures.every(
        (s) => s.bodyBytes === uniqueSignatures[0].bodyBytes,
      );
      if (!allSameBodyBytes) {
        throw new Error(
          "Signatures were produced for different transaction bodies — the transaction may " +
          "have been modified after some members signed. Please cancel and create a new one.",
        );
      }

      // Build signature map - cosmjs 0.35.0+ extracts prefix from first address automatically
      const detectedPrefix = uniqueSignatures[0]?.address?.split("1")[0] || "unknown";

      // CRITICAL: Verify pubkey -> address derivation matches signature addresses
      const derivedAddresses: string[] = [];
      pubkey.value.pubkeys.forEach((memberPubkey) => {
        const derivedAddress = pubkeyToAddress(memberPubkey, detectedPrefix);
        derivedAddresses.push(derivedAddress);
      });

      const signatureMap = new Map<string, Uint8Array>();
      uniqueSignatures.forEach((s) => {
        signatureMap.set(s.address, fromBase64(s.signature));
      });

      // Check if this transaction should use Direct mode
      const useDirectMode = shouldUseDirectMode(txInfo.msgs);

      let signedTxBytes: Uint8Array;
      if (useDirectMode) {
        // Use SIGN_MODE_DIRECT for MsgWithdrawValidatorCommission transactions
        signedTxBytes = makeMultisignedTxBytesDirect(
          pubkey,
          txInfo.sequence,
          txInfo.fee,
          bodyBytes,
          signatureMap,
        );
      } else {
        // Use SIGN_MODE_LEGACY_AMINO_JSON for other transactions.
        // safeAminoMultisigTxBytes normalizes threshold/fee types and validates
        // all inputs before calling cosmjs, preventing "str.match is not a function".
        signedTxBytes = safeAminoMultisigTxBytes(
          pubkey,
          txInfo.sequence,
          txInfo.fee,
          bodyBytes,
          signatureMap,
        );
      }

      // Import SignDoc debug utilities for comprehensive comparison
      const { generateSignDocDebugInfo, logSignDocDebug } = await import("@/lib/signDocDebug");
      const { makeDirectModeAuthInfo, makeDirectSignDoc, logDirectSignDocDebug } = await import(
        "@/lib/multisigDirect"
      );
      const { aminoConverters } = await import("@/lib/msg");
      const { makeSignDoc, serializeSignDoc } = await import("@cosmjs/amino");
      const { sha256 } = await import("@cosmjs/crypto");
      const { AminoTypes } = await import("@cosmjs/stargate");
      const { Secp256k1, Secp256k1Signature } = await import("@cosmjs/crypto");

      let expectedHash: Uint8Array;

      if (useDirectMode) {
        // For Direct mode, verify against Direct SignDoc hash
        const { authInfoBytes } = makeDirectModeAuthInfo(pubkey, txInfo.sequence, txInfo.fee);
        const { signDocHash } = makeDirectSignDoc(
          bodyBytes,
          authInfoBytes,
          txInfo.chainId,
          txInfo.accountNumber,
        );
        expectedHash = signDocHash;

        logDirectSignDocDebug(
          bodyBytes,
          authInfoBytes,
          txInfo.chainId,
          txInfo.accountNumber,
          "BROADCAST Direct SignDoc Analysis",
        );
      } else {
        // For Amino mode, use Amino SignDoc hash
        const aminoTypes = new AminoTypes(aminoConverters);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aminoMsgs = txInfo.msgs.map((msg: any) => aminoTypes.toAmino(msg));

        const expectedSignDoc = makeSignDoc(
          aminoMsgs,
          { amount: txInfo.fee.amount, gas: txInfo.fee.gas },
          txInfo.chainId,
          txInfo.memo,
          String(txInfo.accountNumber),
          String(txInfo.sequence),
        );
        const signDocBytes = serializeSignDoc(expectedSignDoc);
        expectedHash = sha256(signDocBytes);

        // Generate comprehensive debug info
        const debugInfo = generateSignDocDebugInfo(
          txInfo.msgs,
          txInfo.fee,
          txInfo.chainId,
          txInfo.memo,
          txInfo.accountNumber,
          txInfo.sequence,
          aminoTypes,
        );
        logSignDocDebug(debugInfo, "BROADCAST SignDoc Analysis");
      }

      // Verify signatures against expected hash before broadcast
      for (let i = 0; i < uniqueSignatures.length; i++) {
        const s = uniqueSignatures[i];
        const sig = Secp256k1Signature.fromFixedLength(fromBase64(s.signature));
        const pubkeyIndex = derivedAddresses.indexOf(s.address);
        if (pubkeyIndex === -1) {
          throw new Error(`Signature from ${s.address} has no matching pubkey`);
        }
        const memberPubkey = pubkey.value.pubkeys[pubkeyIndex];
        const pubkeyBytes = fromBase64(memberPubkey.value);
        const valid = await Secp256k1.verifySignature(sig, expectedHash, pubkeyBytes);
        if (!valid) {
          throw new Error(`Signature verification failed for ${s.address}`);
        }
      }

      // Phase 0: Use MultiRpcVerifier for hardened broadcast
      setVerificationStatus("verifying");
      verifier = createMultiRpcVerifier(
        chain.chainId,
        chain.nodeAddress,
        chain.nodeAddresses,
      );

      const verifiedResult = await verifier.broadcastAndVerify(signedTxBytes);
      setBroadcastResult(verifiedResult);

      if (!verifiedResult.success) {
        setVerificationStatus("failed");
        throw new Error(
          verifiedResult.error ||
          `Transaction broadcast succeeded but verification failed. ` +
          `Only ${verifiedResult.verifications.filter((v) => v.verified).length + 1} endpoints confirmed.`,
        );
      }

      setVerificationStatus("verified");
      await updateDbTxHash(transactionID, verifiedResult.txHash);
      toastSuccess("Transaction broadcasted and verified", verifiedResult.txHash);
      setTransactionHash(verifiedResult.txHash);
      setTransactionStatus("broadcast");

      // Notify pending transactions hook to refresh (removes the indicator)
      dispatchTransactionStatusChanged();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);

      // Emit sanitized diagnostic metadata (types and counts only, no sensitive values)
      console.error("[broadcastTx] Failed:", {
        error: errorMessage,
        pubkeyThresholdType: typeof pubkey?.value?.threshold,
        pubkeyThreshold: pubkey?.value?.threshold,
        pubkeyCount: pubkey?.value?.pubkeys?.length,
        feeGasType: typeof txInfo?.fee?.gas,
        feeGas: txInfo?.fee?.gas,
        signatureCount: currentSignatures.length,
        uniqueSignatureAddressTypes: [
          ...new Map(currentSignatures.map((s) => [s.address, s])).keys(),
        ].map((a) => typeof a),
        sequence: txInfo?.sequence,
      });

      // Check for sequence mismatch error from chain
      if (
        errorMessage.includes("signature verification failed") ||
        errorMessage.includes("sequence") ||
        errorMessage.includes("account sequence mismatch")
      ) {
        // Re-fetch the current sequence to update UI
        try {
          const refreshClient = await StargateClient.connect(chain.nodeAddress);
          try {
            const currentAccount = await refreshClient.getAccount(multisigAddress!);
            if (currentAccount && txInfo) {
              setAccountOnChain(currentAccount);
              if (currentAccount.sequence !== txInfo.sequence) {
                setSequenceMismatch({
                  expected: txInfo.sequence,
                  actual: currentAccount.sequence,
                });
                setSequenceVerified(false);
              }
            }
          } finally {
            refreshClient.disconnect();
          }
        } catch (fetchErr) {
          console.error("[broadcastTx] Failed to re-fetch account state:", fetchErr);
        }

        toastError({
          description:
            "Transaction rejected: the account's sequence number has changed. " +
            "This usually means another transaction was broadcast from this multisig. " +
            "Please cancel this transaction and create a new one.",
          fullError: e instanceof Error ? e : undefined,
        });
      } else if (
        errorMessage.includes("str.match") ||
        errorMessage.includes("is not a function") ||
        errorMessage.includes("Invalid string format") ||
        errorMessage.includes("threshold")
      ) {
        toastError({
          description:
            "Transaction assembly failed due to a data type error. " +
            "This has been logged for diagnostics. Please try refreshing the page. " +
            "If the error persists, cancel this transaction and create a new one.",
          fullError: e instanceof Error ? e : undefined,
        });
      } else {
        toastError({
          description: "Failed to broadcast tx",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    } finally {
      if (verifier) {
        await verifier.disconnect();
      }
      if (client) {
        client.disconnect();
      }
      setIsBroadcasting(false);
      toast.dismiss(loadingToastId);
    }
  };

  const cancelTx = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this transaction?\n\n" +
      "This will mark the transaction as cancelled and it won't be able to be signed or broadcast. " +
      "This action cannot be undone.",
    );

    if (!confirmed) return;

    const loadingToastId = toast.loading("Cancelling transaction");

    try {
      setIsCancelling(true);
      await cancelDbTx(transactionID);
      setTransactionStatus("cancelled");
      toastSuccess("Transaction cancelled");

      // Notify pending transactions hook to refresh (removes the indicator)
      dispatchTransactionStatusChanged();
    } catch (e) {
      console.error("Failed to cancel tx:", e);
      toastError({
        description: "Failed to cancel transaction",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setIsCancelling(false);
      toast.dismiss(loadingToastId);
    }
  };

  // Count unique signers by address so duplicate in-memory entries don't falsely satisfy threshold
  const uniqueSignerCount = useMemo(
    () => new Set(currentSignatures.map((s) => s.address)).size,
    [currentSignatures],
  );

  const isThresholdMet = pubkey
    ? uniqueSignerCount >= Number(pubkey.value.threshold)
    : false;

  return (
    <Page
      goBack={
        chain.registryName
          ? {
            pathname: `/${chain.registryName}/${multisigAddress}`,
            title: "multisig",
          }
          : undefined
      }
    >
      {/* Page Title */}
      <h1 className="mb-6 font-heading text-3xl font-bold">
        {isLoadingTx
          ? "Loading Transaction..."
          : transactionStatus === "cancelled"
            ? "Cancelled Transaction"
            : transactionHash
              ? "Completed Transaction"
              : "In Progress Transaction"}
      </h1>

      {isLoadingTx ? (
        <div className="mb-6 flex h-32 items-center justify-center rounded-lg border border-border bg-card/50 p-8 shadow-sm">
          <p className="animate-pulse text-sm text-muted-foreground">Fetching transaction details from database...</p>
        </div>
      ) : null}

      {/* Status Banners */}
      {!isLoadingTx && transactionStatus === "cancelled" ? (
        <div className="mb-6 rounded-lg border-2 border-border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div>
              <h3 className="mb-1 text-base font-semibold text-foreground">
                Transaction Cancelled
              </h3>
              <p className="text-sm text-muted-foreground">
                This transaction has been cancelled and cannot be signed or broadcast.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoadingTx && transactionHash ? (
        <div className="mb-6">
          <CompletedTransaction transactionHash={transactionHash} />

          {/* Phase 0: Multi-RPC verification status */}
          {broadcastResult && (
            <Card className="mt-4">
              <CardContent className="pt-4">
                <div className="mb-3 flex items-center gap-2">
                  {verificationStatus === "verified" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-accent" />
                  ) : verificationStatus === "failed" ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : null}
                  <CardLabel comment className="mb-0">
                    Multi-Endpoint Verification
                  </CardLabel>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primary endpoint:</span>
                    <span className="max-w-[200px] truncate font-mono text-xs">
                      {broadcastResult.broadcastEndpoint || "N/A"}
                    </span>
                  </div>

                  {broadcastResult.verifications.length > 0 && (
                    <>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Secondary verifications:
                      </div>
                      {broadcastResult.verifications.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 pl-2 text-xs">
                          {v.verified ? (
                            <CheckCircle2 className="h-3 w-3 text-green-accent" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                          <span className="max-w-[150px] truncate font-mono">
                            {new URL(v.endpoint).hostname}
                          </span>
                          <span className="text-muted-foreground">{v.responseTimeMs}ms</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {!isLoadingTx && sequenceMismatch ? (
        <Card variant="institutional" className="mb-6 border-red-500/50 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-red-400">
                  Sequence Mismatch Detected
                </h3>
                <p className="mb-2 text-sm">
                  This transaction was created with sequence{" "}
                  <strong>{sequenceMismatch.expected}</strong>, but the account's current sequence
                  is <strong>{sequenceMismatch.actual}</strong>.
                </p>
                <p className="mb-3 text-sm">
                  This usually means another transaction was broadcast from this multisig account
                  after this transaction was created. The signatures collected are no longer valid.
                </p>
                <div className="rounded-lg border border-border bg-card/50 p-3">
                  <p className="text-sm">
                    <strong>Solution:</strong> Cancel this transaction and create a new one with the
                    current sequence number.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Desktop-first Horizontal Layout for In Progress Transactions */}
      {!isLoadingTx && !transactionHash && transactionStatus !== "cancelled" && !sequenceMismatch && txInfo ? (
        <div className="flex flex-col gap-4 md:gap-6 lg:flex-row">
          {/* LEFT COLUMN: Signing Status Card */}
          <div className="w-full lg:w-[380px] lg:flex-shrink-0">
            <BentoCard variant="highlight" className="flex h-full flex-col p-6">
              <BentoCardHeader>
                <BentoCardTitle icon={<Users className="h-5 w-5 text-foreground" />}>
                  Signing Status
                </BentoCardTitle>
              </BentoCardHeader>
              <BentoCardContent className="flex-1 space-y-4">
                {pubkey ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="font-heading text-3xl font-bold">
                          {uniqueSignerCount}
                        </div>
                        <div className="text-muted-foreground">of</div>
                        <div className="font-heading text-3xl font-bold">
                          {pubkey.value.threshold}
                        </div>
                        <div className="text-sm text-muted-foreground">signatures</div>
                      </div>
                    </div>
                    {uniqueSignerCount < Number(pubkey.value.threshold) && (
                      <p className="text-sm text-muted-foreground">
                        {Number(pubkey.value.threshold) - uniqueSignerCount} remaining{" "}
                        {Number(pubkey.value.threshold) - uniqueSignerCount === 1
                          ? "signature"
                          : "signatures"}{" "}
                        needed
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Current Signers
                  </h4>
                  {currentSignatures.length > 0 ? (
                    <div className="space-y-2">
                      {currentSignatures.map((signature, i) => (
                        <div
                          key={`${signature.address}_${i}`}
                          className="break-all rounded-lg border border-border/50 bg-muted/20 p-3 font-mono text-sm"
                        >
                          {signature.address}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No signatures yet</p>
                  )}
                </div>
              </BentoCardContent>
              {pubkey && txInfo ? (
                <BentoCardFooter className="mt-auto flex-col gap-3">
                  <TransactionSigning
                    tx={txInfo}
                    transactionID={transactionID}
                    pubkey={pubkey}
                    signatures={currentSignatures}
                    addSignature={addSignature}
                    compact
                  />
                  {/* Integrated Actions */}
                  <div className="flex w-full flex-col gap-3 border-t border-border/50 pt-3">
                    {isThresholdMet && !sequenceMismatch && sequenceVerified ? (
                      <Button
                        label={isBroadcasting ? "Broadcasting..." : "Broadcast Transaction"}
                        onClick={broadcastTx}
                        primary
                        disabled={isBroadcasting}
                      />
                    ) : isThresholdMet && !sequenceMismatch && !sequenceVerified ? (
                      <Button label="Verifying sequence..." disabled />
                    ) : null}
                    <Button
                      label={isCancelling ? "Cancelling..." : "Cancel Transaction"}
                      onClick={cancelTx}
                      disabled={isCancelling || isBroadcasting}
                    />
                    <p className="text-center text-xs text-muted-foreground">
                      Cancelling marks this transaction as invalid. It won't affect any on-chain
                      state.
                    </p>
                  </div>
                </BentoCardFooter>
              ) : null}
            </BentoCard>
          </div>

          {/* RIGHT COLUMN: Transaction Details + Message stacked vertically */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6">
            {/* Transaction Details Card */}
            <BentoCard variant="default" className="p-6">
              <BentoCardHeader>
                <BentoCardTitle icon={<FileText className="h-5 w-5 text-foreground" />}>
                  Transaction Details
                </BentoCardTitle>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Chain ID
                    </span>
                    <span className="font-mono text-sm">{txInfo.chainId}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Account #
                    </span>
                    <span className="font-mono text-sm">{txInfo.accountNumber}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Tx Sequence
                    </span>
                    <span className="font-mono text-sm">{txInfo.sequence}</span>
                  </div>
                  {accountOnChain?.sequence !== undefined && (
                    <div className="space-y-1">
                      <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Chain Sequence
                      </span>
                      <span
                        className={`font-mono text-sm font-semibold ${accountOnChain.sequence === txInfo.sequence
                          ? "text-green-accent"
                          : "text-red-400"
                          }`}
                      >
                        {accountOnChain.sequence}{" "}
                        {accountOnChain.sequence === txInfo.sequence ? "✓ OK" : "✗ MISMATCH"}
                      </span>
                    </div>
                  )}
                  {txInfo.fee && (
                    <>
                      <div className="space-y-1">
                        <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          Gas
                        </span>
                        <span className="font-mono text-sm">{txInfo.fee.gas}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          Fee
                        </span>
                        <span className="font-mono text-sm">
                          {printableCoins(txInfo.fee.amount, chain) || "None"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {txInfo.memo && (
                  <div className="mt-4 border-t border-border/50 pt-4">
                    <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Memo
                    </span>
                    <span className="font-mono text-sm">{txInfo.memo}</span>
                  </div>
                )}
              </BentoCardContent>
            </BentoCard>

            {/* Message Details Card */}
            <BentoCard variant="accent" className="flex-1 p-6">
              <BentoCardHeader>
                <BentoCardTitle icon={<MessageSquare className="h-5 w-5 text-foreground" />}>
                  Message
                </BentoCardTitle>
              </BentoCardHeader>
              <BentoCardContent>
                <TransactionInfo
                  tx={txInfo}
                  currentOnChainSequence={accountOnChain?.sequence}
                  compact
                />
              </BentoCardContent>
            </BentoCard>
          </div>
        </div>
      ) : null}

      {/* Cancelled Transaction Layout - Clean, flat design without nested cards */}
      {txInfo && transactionStatus === "cancelled" ? (
        <div className="space-y-4">
          {/* Signing Info - Compact Grid Layout */}
          <Card variant="institutional" className="p-4 md:p-5">
            <CardLabel comment className="mb-3">
              Signing Info
            </CardLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
              <div className="space-y-1">
                <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Chain ID
                </div>
                <div className="font-mono text-sm text-foreground">{txInfo.chainId}</div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Account #
                </div>
                <div className="font-mono text-sm text-foreground">{txInfo.accountNumber}</div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Tx Sequence
                </div>
                <div className="font-mono text-sm text-foreground">{txInfo.sequence}</div>
              </div>
              {accountOnChain?.sequence !== undefined && (
                <div className="space-y-1">
                  <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Chain Sequence
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${accountOnChain.sequence === txInfo.sequence
                      ? "text-green-400"
                      : "text-red-400"
                      }`}
                  >
                    {accountOnChain.sequence}{" "}
                    {accountOnChain.sequence === txInfo.sequence ? "✓ OK" : "✗ MISMATCH"}
                  </div>
                </div>
              )}
              {txInfo.fee ? (
                <>
                  <div className="space-y-1">
                    <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Gas
                    </div>
                    <div className="font-mono text-sm text-foreground">{txInfo.fee.gas}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Fee
                    </div>
                    <div className="font-mono text-sm text-foreground">
                      {printableCoins(txInfo.fee.amount, chain) || "None"}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            {txInfo.memo && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Memo
                </div>
                <div className="break-words font-mono text-sm text-foreground">{txInfo.memo}</div>
              </div>
            )}
          </Card>

          {/* Message Details - Clean Format */}
          {txInfo.msgs.map((msg, index) => {
            const msgType = msg.typeUrl.split(".").pop()?.replace("Msg", "") || msg.typeUrl;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msgValue = msg.value as Record<string, any>;

            // Extract key fields based on message type
            const getMessageFields = () => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fields: Array<{ label: string; value: any; isAddress?: boolean }> = [];

              // Common address fields
              if (msgValue.validatorAddress) {
                fields.push({
                  label: "Validator Address",
                  value: msgValue.validatorAddress,
                  isAddress: true,
                });
              }
              if (msgValue.delegatorAddress) {
                fields.push({
                  label: "Delegator Address",
                  value: msgValue.delegatorAddress,
                  isAddress: true,
                });
              }
              if (msgValue.fromAddress) {
                fields.push({
                  label: "From Address",
                  value: msgValue.fromAddress,
                  isAddress: true,
                });
              }
              if (msgValue.toAddress) {
                fields.push({ label: "To Address", value: msgValue.toAddress, isAddress: true });
              }
              if (msgValue.sender) {
                fields.push({ label: "Sender", value: msgValue.sender, isAddress: true });
              }
              if (msgValue.receiver) {
                fields.push({ label: "Receiver", value: msgValue.receiver, isAddress: true });
              }

              // Amount fields
              if (msgValue.amount) {
                if (Array.isArray(msgValue.amount)) {
                  const amounts = msgValue.amount
                    .map((a: { amount: string; denom: string }) => `${a.amount} ${a.denom}`)
                    .join(", ");
                  fields.push({ label: "Amount", value: amounts });
                } else if (msgValue.amount.amount) {
                  fields.push({
                    label: "Amount",
                    value: `${msgValue.amount.amount} ${msgValue.amount.denom}`,
                  });
                }
              }

              // Other common fields
              if (msgValue.contract) {
                fields.push({ label: "Contract", value: msgValue.contract, isAddress: true });
              }
              if (msgValue.codeId) {
                fields.push({ label: "Code ID", value: String(msgValue.codeId) });
              }
              if (msgValue.proposalId) {
                fields.push({ label: "Proposal ID", value: String(msgValue.proposalId) });
              }
              if (msgValue.option) {
                fields.push({ label: "Option", value: String(msgValue.option) });
              }

              return fields;
            };

            const fields = getMessageFields();

            return (
              <Card key={index} variant="institutional" className="p-4 md:p-5">
                <CardLabel comment className="mb-3">
                  {msgType}
                </CardLabel>
                {fields.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
                    {fields.map((field, fieldIndex) => (
                      <div key={fieldIndex} className="space-y-1">
                        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          {field.label}
                        </div>
                        {field.isAddress ? (
                          <div className="break-all rounded-lg border border-border/50 bg-muted/20 p-2 font-mono text-sm">
                            <HashView hash={field.value} />
                          </div>
                        ) : (
                          <div className="break-words font-mono text-sm text-foreground">
                            {field.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm italic text-muted-foreground">No additional details</div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Bento Grid Layout for Completed/Sequence Mismatch Transactions - Horizontal Layout */}
      {!isLoadingTx && txInfo && (transactionHash || sequenceMismatch) && transactionStatus !== "cancelled" ? (
        <BentoGrid className="auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {/* Transaction Details Card - 1 col */}
          <BentoCard colSpan={1} variant="default" className="p-6">
            <BentoCardHeader>
              <BentoCardTitle icon={<FileText className="h-5 w-5 text-foreground" />}>
                Transaction Details
              </BentoCardTitle>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 py-2">
                  <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Chain ID
                  </span>
                  <span className="font-mono text-sm">{txInfo.chainId}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 py-2">
                  <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Account #
                  </span>
                  <span className="font-mono text-sm">{txInfo.accountNumber}</span>
                </div>
                <div
                  className={`flex items-center justify-between border-b border-border/50 py-2 ${sequenceMismatch ? "rounded bg-red-500/10 px-2" : ""
                    }`}
                >
                  <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Tx Sequence
                  </span>
                  <span
                    className={`font-mono text-sm ${sequenceMismatch ? "font-semibold text-red-400" : ""}`}
                  >
                    {txInfo.sequence}
                  </span>
                </div>
                {accountOnChain?.sequence !== undefined && (
                  <div
                    className={`flex items-center justify-between border-b border-border/50 py-2 ${sequenceMismatch ? "rounded bg-red-500/10 px-2" : ""
                      }`}
                  >
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Chain Sequence
                    </span>
                    <span
                      className={`font-mono text-sm font-semibold ${accountOnChain.sequence === txInfo.sequence
                        ? "text-green-accent"
                        : "text-red-400"
                        }`}
                    >
                      {accountOnChain.sequence}{" "}
                      {accountOnChain.sequence === txInfo.sequence ? "✓ OK" : "✗ MISMATCH"}
                    </span>
                  </div>
                )}
                {txInfo.fee && (
                  <>
                    <div className="flex items-center justify-between border-b border-border/50 py-2">
                      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Gas
                      </span>
                      <span className="font-mono text-sm">{txInfo.fee.gas}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Fee
                      </span>
                      <span className="font-mono text-sm">
                        {printableCoins(txInfo.fee.amount, chain) || "None"}
                      </span>
                    </div>
                  </>
                )}
                {txInfo.memo && (
                  <div className="mt-2 flex items-start justify-between border-t border-border/50 py-2 pt-2">
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Memo
                    </span>
                    <span className="text-right font-mono text-sm">{txInfo.memo}</span>
                  </div>
                )}
              </div>
            </BentoCardContent>
          </BentoCard>

          {/* Message Details Card - 1 col */}
          <BentoCard colSpan={1} variant="accent" className="p-6">
            <BentoCardHeader>
              <BentoCardTitle icon={<MessageSquare className="h-5 w-5 text-foreground" />}>
                Message
              </BentoCardTitle>
            </BentoCardHeader>
            <BentoCardContent>
              <TransactionInfo
                tx={txInfo}
                currentOnChainSequence={accountOnChain?.sequence}
                compact
              />
            </BentoCardContent>
          </BentoCard>

          {/* Actions Card - 1 col (only show cancel for completed/mismatch) */}
          {sequenceMismatch && (
            <BentoCard colSpan={1} variant="muted" className="p-6">
              <BentoCardHeader>
                <BentoCardTitle icon={<Zap className="h-5 w-5 text-foreground" />}>
                  Actions
                </BentoCardTitle>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="flex flex-col gap-3">
                  <Button
                    label={isCancelling ? "Cancelling..." : "Cancel Transaction"}
                    onClick={cancelTx}
                    disabled={isCancelling || isBroadcasting}
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Cancelling marks this transaction as invalid. It won't affect any on-chain
                    state.
                  </p>
                </div>
              </BentoCardContent>
            </BentoCard>
          )}
        </BentoGrid>
      ) : null}
    </Page>
  );
};

export default TransactionPage;
