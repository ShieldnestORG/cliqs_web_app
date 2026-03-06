import CreateTxForm from "@/components/forms/CreateTxForm";
import Head from "@/components/head";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { DbTransaction } from "@/graphql";
import { getPendingDbTxs } from "@/lib/api";
import { Account } from "@cosmjs/stargate";
import { assert } from "@cosmjs/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import OldCreateTxForm from "../../../../components/forms/OldCreateTxForm";
import { useChains } from "../../../../context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { ensureChainMultisigInDb, getHostedMultisig, isAccount } from "../../../../lib/multisigHelpers";
import { useMultisigType } from "@/lib/hooks/useMultisigType";
import { createSigningCW3ClientFromSigner } from "@/lib/contract/cw3-client";
import { getGasAdjustment } from "@/lib/contract/codeRegistry";
import { ensureProtocol } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Clock, Loader2, FileCode2, Send, Coins } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// CW3 Proposal Form (inline for contract multisigs)
// ============================================================================

function ContractProposalForm({
  contractAddress,
  chainName,
}: {
  contractAddress: string;
  chainName: string;
}) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner, getAminoSigner } = useWallet();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msgType, setMsgType] = useState<"bank_send" | "custom">("bank_send");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [customJson, setCustomJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletInfo) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a proposal title");
      return;
    }

    setIsSubmitting(true);

    try {
      const signer = (await getDirectSigner()) || (await getAminoSigner());
      if (!signer) {
        toast.error("Failed to get wallet signer");
        return;
      }

      const gasAdj = getGasAdjustment(chain.chainId);
      const cw3Client = await createSigningCW3ClientFromSigner(
        ensureProtocol(chain.nodeAddress),
        contractAddress,
        chain.chainId,
        signer,
        chain.gasPrice,
        gasAdj,
      );

      // Build messages based on type
      let msgs: unknown[] = [];

      if (msgType === "bank_send") {
        if (!toAddress.trim() || !amount.trim()) {
          toast.error("Please fill in recipient and amount");
          setIsSubmitting(false);
          return;
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          toast.error("Amount must be a positive number");
          setIsSubmitting(false);
          return;
        }

        const baseAmount = Math.floor(parsedAmount * Math.pow(10, chain.displayDenomExponent));
        if (baseAmount < 1) {
          toast.error(
            `Amount too small — minimum is ${Math.pow(10, -chain.displayDenomExponent)} ${chain.displayDenom}`,
          );
          setIsSubmitting(false);
          return;
        }

        msgs = [
          {
            bank: {
              send: {
                to_address: toAddress.trim(),
                amount: [
                  {
                    denom: chain.denom,
                    amount: String(baseAmount),
                  },
                ],
              },
            },
          },
        ];
      } else if (msgType === "custom") {
        try {
          msgs = JSON.parse(customJson);
          if (!Array.isArray(msgs)) {
            msgs = [msgs];
          }
        } catch {
          toast.error("Invalid JSON in custom messages");
          setIsSubmitting(false);
          return;
        }
      }

      toast.info("Submitting proposal...", {
        description: "Please approve the transaction in your wallet",
      });

      const result = await cw3Client.propose(
        title.trim(),
        description.trim(),
        msgs as Parameters<typeof cw3Client.propose>[2],
      );

      if (!result.success) {
        toast.error("Failed to create proposal", {
          description: result.error || "Unknown error",
        });
        return;
      }

      toast.success("Proposal created!", {
        description: result.proposalId
          ? `Proposal #${result.proposalId} — Tx: ${result.txHash.slice(0, 16)}...`
          : `Tx: ${result.txHash.slice(0, 16)}...`,
      });

      // Redirect back to the multisig dashboard
      router.push(`/${chainName}/${contractAddress}`);
    } catch (err) {
      console.error("Proposal creation failed:", err);
      toast.error("Failed to create proposal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            New Proposal
          </CardTitle>
          <CardDescription>
            Create a proposal for the contract multisig. Members will vote to approve or reject.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Proposal Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Transfer tokens to treasury"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this proposal does and why"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-20 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message Type</CardTitle>
          <CardDescription>Choose the type of transaction for this proposal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant={msgType === "bank_send" ? "default" : "outline"}
              onClick={() => setMsgType("bank_send")}
              className="flex-1 gap-2"
            >
              <Coins className="h-4 w-4" />
              Send Tokens
            </Button>
            <Button
              type="button"
              variant={msgType === "custom" ? "default" : "outline"}
              onClick={() => setMsgType("custom")}
              className="flex-1 gap-2"
            >
              <FileCode2 className="h-4 w-4" />
              Custom JSON
            </Button>
          </div>

          {msgType === "bank_send" && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="to">Recipient Address *</Label>
                <Input
                  id="to"
                  placeholder={`${chain.addressPrefix}1...`}
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({chain.displayDenom}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          {msgType === "custom" && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="customJson">CosmosMsg JSON (array or single object)</Label>
              <Textarea
                id="customJson"
                placeholder={`[\n  {\n    "bank": {\n      "send": {\n        "to_address": "...",\n        "amount": [{ "denom": "${chain.denom}", "amount": "1000000" }]\n      }\n    }\n  }\n]`}
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                className="h-40 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports bank, staking, distribution, wasm, ibc, and gov messages.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${chainName}/${contractAddress}`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !walletInfo || !title.trim()}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Proposal
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function CreateTxPage() {
  const { chain } = useChains();
  const [showOldForm, setShowOldForm] = useState(true);
  const [accountOnChain, setAccountOnChain] = useState<Account | null>(null);
  const [hasAccountError, setHasAccountError] = useState(false);
  const [accountErrorMessage, setAccountErrorMessage] = useState<string | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<readonly DbTransaction[]>([]);
  const router = useRouter();
  const multisigAddress = router.query.address?.toString();

  // Detect multisig type (contract vs pubkey)
  const multisigTypeResult = useMultisigType(
    multisigAddress || null,
    chain.nodeAddress || null,
    chain.chainId || null,
  );

  const isContractMultisig = multisigTypeResult.type === "contract";

  // Only fetch hosted multisig for pubkey multisigs
  useEffect(() => {
    if (isContractMultisig || multisigTypeResult.isLoading) return;

    (async function fetchAccount() {
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

        setAccountOnChain(hostedMultisig.accountOnChain);
        setHasAccountError(false);
        setAccountErrorMessage(null);

        // Fetch pending transactions
        try {
          const pending = await getPendingDbTxs(multisigAddress, chain.chainId);
          setPendingTransactions(pending);
        } catch (err) {
          console.error("Failed to fetch pending transactions:", err);
        }
      } catch (error: unknown) {
        setHasAccountError(true);
        setAccountErrorMessage(
          error instanceof Error ? error.message : "Multisig address could not be found",
        );
        console.error(
          error instanceof Error ? error.message : "Multisig address could not be found",
        );
      }
    })();
  }, [chain, multisigAddress, isContractMultisig, multisigTypeResult.isLoading]);

  const toggleOldNewForm = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === ".") {
      setShowOldForm((prev) => !prev);
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keyup", toggleOldNewForm);
    return () => {
      window.removeEventListener("keyup", toggleOldNewForm);
    };
  }, [toggleOldNewForm]);

  const breadcrumb = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {chain.registryName ? <Link href={`/${chain.registryName}`}>Home</Link> : null}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {chain.registryName ? (
              <Link href={`/${chain.registryName}/${multisigAddress}`}>Multisig</Link>
            ) : null}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{isContractMultisig ? "New Proposal" : "New Transaction"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  // Loading — detecting multisig type
  if (multisigTypeResult.isLoading) {
    return (
      <div className="container mx-auto max-w-[1800px] px-[0.75in] py-8">
        <Head title={`New Transaction - ${chain.chainDisplayName || "Cosmos Hub"}`} />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Detecting multisig type...</p>
          </div>
        </div>
      </div>
    );
  }

  // Contract Multisig — show CW3 proposal form
  if (isContractMultisig && multisigAddress) {
    return (
      <div className="container mx-auto max-w-3xl px-[0.75in] py-8">
        <Head title={`New Proposal - ${chain.chainDisplayName || "Cosmos Hub"}`} />
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${chain.registryName}/${multisigAddress}`)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to multisig
            </Button>
          </div>

          {breadcrumb}

          <ContractProposalForm
            contractAddress={multisigAddress}
            chainName={chain.registryName || ""}
          />
        </div>
      </div>
    );
  }

  // PubKey Multisig — existing form
  return showOldForm ? (
    <div className="container mx-auto max-w-[1800px] px-[0.75in] py-8">
      <Head title={`New Transaction - ${chain.chainDisplayName || "Cosmos Hub"}`} />

      <div className="space-y-6">
        {/* Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${chain.registryName}/${multisigAddress}`)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to multisig
          </Button>
        </div>

        {breadcrumb}

        {/* Error States */}
        {hasAccountError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Multisig Not Available</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              {accountErrorMessage ? <p>{accountErrorMessage}</p> : null}
              <p>
                This multisig address&apos;s pubkeys are not available, and so it cannot be used
                with this tool.
              </p>
              <p>
                You can recreate it with this tool here, or sign and broadcast a transaction with
                the tool you used to create it. Either option will make the pubkeys accessible and
                will allow this tool to use this multisig fully.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {!accountOnChain && !hasAccountError && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Account Not Found</AlertTitle>
            <AlertDescription>
              An account needs to be present on chain before creating a transaction. Send some
              tokens to the address first.
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Transactions Warning */}
        {pendingTransactions.length > 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <Clock className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">
              {pendingTransactions.length} Pending Transaction
              {pendingTransactions.length > 1 ? "s" : ""}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>
                You have pending transaction{pendingTransactions.length > 1 ? "s" : ""} that need to
                be completed or cancelled first. Creating a new transaction with the same sequence
                number will make only one of them broadcastable.
              </p>
              <div className="space-y-2">
                {pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-md bg-background/50 p-2"
                  >
                    <span className="text-sm">
                      Transaction {tx.id.substring(0, 8)}... ({tx.signatures?.length || 0} signature
                      {tx.signatures?.length !== 1 ? "s" : ""})
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${chain.registryName}/${multisigAddress}/transaction/${tx.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Complete pending transactions first, or cancel them if they're
                no longer needed.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Transaction Form */}
        {accountOnChain && multisigAddress && (
          <OldCreateTxForm senderAddress={multisigAddress} accountOnChain={accountOnChain} />
        )}
      </div>
    </div>
  ) : (
    <div className="container mx-auto max-w-2xl px-[0.75in] py-8">
      <Head title={`New Transaction - ${chain.chainDisplayName || "Cosmos Hub"}`} />

      <div className="space-y-6">
        {breadcrumb}
        <CreateTxForm />
      </div>
    </div>
  );
}
