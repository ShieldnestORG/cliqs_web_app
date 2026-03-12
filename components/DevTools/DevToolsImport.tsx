import { ChainInfo } from "@/context/ChainsContext/types";
import { getNodeFromArray } from "@/context/ChainsContext/service";
import { DbTransactionParsedDataJson } from "@/graphql";
import { createDbTx } from "@/lib/api";
import { DeploymentLogDraft } from "@/lib/deploymentLog";
import {
  parseImportedTransactionInput,
  TransactionImportMetadata,
} from "@/lib/importedTransaction";
import { ensureChainMultisigInDb } from "@/lib/multisigHelpers";
import { isKnownMsgTypeUrl, msgsFromJson } from "@/lib/txMsgHelpers";
import { ensureProtocol, toastError, toastSuccess } from "@/lib/utils";
import { OfflineSigner, EncodeObject } from "@cosmjs/proto-signing";
import { SigningStargateClient, StargateClient } from "@cosmjs/stargate";
import { FileInput, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { SelectedAccount } from "./types";

interface DevToolsImportProps {
  chain: ChainInfo;
  mainnetVariant?: ChainInfo;
  testnetVariant?: ChainInfo;
  selectedAccount: SelectedAccount;
  getAminoSignerForChain: (chain: ChainInfo) => Promise<OfflineSigner | null>;
  onLog: (entry: DeploymentLogDraft) => void;
  onChainResolved?: (chain: ChainInfo) => void;
  onSuccess: (txId: string) => void;
}

const makeImportTemplate = (
  chainId: string,
  accountNumber: number,
  sequence: number,
): DbTransactionParsedDataJson => ({
  accountNumber,
  sequence,
  chainId,
  msgs: [{ typeUrl: "", value: {} }] as DbTransactionParsedDataJson["msgs"],
  fee: { amount: [], gas: "200000" },
  memo: "",
});

const collectStringValues = (value: unknown, strings: string[]) => {
  if (typeof value === "string") {
    strings.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, strings));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringValues(item, strings));
  }
};

const detectCoreumNetworkFromInput = (raw: string): "mainnet" | "testnet" | null => {
  try {
    const parsed = JSON.parse(raw);
    const strings: string[] = [];
    collectStringValues(parsed, strings);

    let hasMainnetHint = false;
    let hasTestnetHint = false;
    for (const value of strings) {
      if (
        value === "coreum-mainnet-1" ||
        value === "ucore" ||
        /\bcore(?:valoper|valcons)?1[0-9a-z]+\b/.test(value)
      ) {
        hasMainnetHint = true;
      }
      if (
        value === "coreum-testnet-1" ||
        value === "utestcore" ||
        /\btestcore(?:valoper|valcons)?1[0-9a-z]+\b/.test(value)
      ) {
        hasTestnetHint = true;
      }
    }

    if (hasMainnetHint && !hasTestnetHint) return "mainnet";
    if (hasTestnetHint && !hasMainnetHint) return "testnet";
    return null;
  } catch {
    return null;
  }
};

export default function DevToolsImport({
  chain,
  mainnetVariant,
  testnetVariant,
  selectedAccount,
  getAminoSignerForChain,
  onLog,
  onChainResolved,
  onSuccess,
}: DevToolsImportProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [accountNumberInput, setAccountNumberInput] = useState("");
  const [sequenceInput, setSequenceInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fetchingSequence, setFetchingSequence] = useState(false);
  const lastAutofilledAccountKey = useRef<string | null>(null);

  const resolveChainForSelectedAccount = (): ChainInfo => {
    const hintedNetwork = detectCoreumNetworkFromInput(jsonInput.trim());
    if (hintedNetwork === "mainnet" && mainnetVariant) {
      if (mainnetVariant.chainId !== chain.chainId) {
        onChainResolved?.(mainnetVariant);
      }
      return mainnetVariant;
    }
    if (hintedNetwork === "testnet" && testnetVariant) {
      if (testnetVariant.chainId !== chain.chainId) {
        onChainResolved?.(testnetVariant);
      }
      return testnetVariant;
    }

    if (selectedAccount.address.startsWith(chain.addressPrefix)) {
      return chain;
    }

    const matchingVariant = [mainnetVariant, testnetVariant].find(
      (candidate) =>
        candidate &&
        selectedAccount.address.startsWith(candidate.addressPrefix) &&
        candidate.chainId !== chain.chainId,
    );

    if (matchingVariant) {
      onChainResolved?.(matchingVariant);
      return matchingVariant;
    }

    throw new Error(
      `Selected account ${selectedAccount.address} does not match the active ${chain.addressPrefix} network.`,
    );
  };

  const getRpcEndpoint = async (targetChain: ChainInfo): Promise<string> => {
    if (targetChain.nodeAddress) {
      return ensureProtocol(targetChain.nodeAddress);
    }

    const nodeAddress = await getNodeFromArray(targetChain.nodeAddresses);
    return ensureProtocol(nodeAddress);
  };

  const fetchCurrentSequence = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    setFetchingSequence(true);
    try {
      const targetChain = resolveChainForSelectedAccount();
      const client = await StargateClient.connect(await getRpcEndpoint(targetChain));
      const account = await client.getAccount(selectedAccount.address);
      if (!account) {
        if (!silent) {
          toastError({
            description:
              "Account not found on chain yet. You can still import if your JSON already has valid accountNumber and sequence.",
          });
        }
        return;
      }

      lastAutofilledAccountKey.current = `${targetChain.chainId}:${selectedAccount.address}`;
      setAccountNumberInput(String(account.accountNumber));
      setSequenceInput(String(account.sequence));

      // If we already have canonical JSON, patch accountNumber and sequence in the editor too
      if (jsonInput.trim()) {
        try {
          const parsed = JSON.parse(jsonInput) as Record<string, unknown>;
          if ("msgs" in parsed && "fee" in parsed) {
            setJsonInput(
              JSON.stringify(
                {
                  ...parsed,
                  accountNumber: account.accountNumber,
                  sequence: account.sequence,
                  chainId: targetChain.chainId,
                },
                null,
                2,
              ),
            );
          }
          setValidationError(null);
        } catch {
          // Raw tx envelopes should keep their original shape; the metadata fields are the source of truth.
        }
      } else {
        setJsonInput(
          JSON.stringify(
            makeImportTemplate(targetChain.chainId, account.accountNumber, account.sequence),
            null,
            2,
          ),
        );
        setValidationError(null);
      }

      if (!silent) {
        toastSuccess(
          "Fetched on-chain account state",
          `Current on-chain values: accountNumber=${account.accountNumber}, sequence=${account.sequence}`,
        );
      }
    } catch (error) {
      if (!silent) {
        toastError({
          description: "Failed to fetch account state from chain",
          fullError: error instanceof Error ? error : undefined,
        });
      }
    } finally {
      setFetchingSequence(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const autoFillAccountState = async () => {
      let targetChain: ChainInfo;
      try {
        targetChain = resolveChainForSelectedAccount();
      } catch {
        return;
      }

      const autofillKey = `${targetChain.chainId}:${selectedAccount.address}`;
      if (lastAutofilledAccountKey.current === autofillKey) {
        return;
      }

      // Clear stale values immediately when switching to a different account/network.
      setAccountNumberInput("");
      setSequenceInput("");
      lastAutofilledAccountKey.current = autofillKey;

      try {
        const client = await StargateClient.connect(await getRpcEndpoint(targetChain));
        const account = await client.getAccount(selectedAccount.address);
        if (cancelled || !account) {
          if (!account) {
            lastAutofilledAccountKey.current = null;
          }
          return;
        }

        setAccountNumberInput(String(account.accountNumber));
        setSequenceInput(String(account.sequence));

        setJsonInput((current) => {
          if (!current.trim()) {
            return JSON.stringify(
              makeImportTemplate(targetChain.chainId, account.accountNumber, account.sequence),
              null,
              2,
            );
          }

          try {
            const parsed = JSON.parse(current) as Record<string, unknown>;
            if ("msgs" in parsed && "fee" in parsed) {
              return JSON.stringify(
                {
                  ...parsed,
                  accountNumber: account.accountNumber,
                  sequence: account.sequence,
                  chainId: targetChain.chainId,
                },
                null,
                2,
              );
            }
          } catch {
            // Leave raw tx envelopes untouched; metadata fields are enough.
          }

          return current;
        });
      } catch {
        lastAutofilledAccountKey.current = null;
      }
    };

    void autoFillAccountState();

    return () => {
      cancelled = true;
    };
  }, [
    chain.chainId,
    chain.addressPrefix,
    chain.nodeAddress,
    jsonInput,
    mainnetVariant,
    onChainResolved,
    selectedAccount.address,
    testnetVariant,
  ]);

  const handleImport = async () => {
    setValidationError(null);
    let targetChain: ChainInfo;
    try {
      targetChain = resolveChainForSelectedAccount();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not resolve import chain.");
      return;
    }

    const metadata: TransactionImportMetadata = {
      chainId: targetChain.chainId,
      accountNumber: accountNumberInput.trim() || undefined,
      sequence: sequenceInput.trim() || undefined,
      addressPrefix: targetChain.addressPrefix,
    };
    const parsedResult = parseImportedTransactionInput(jsonInput.trim(), metadata, {
      expectedChainId: targetChain.chainId,
      requireNonEmptyMsgs: true,
    });
    if (parsedResult.error || !parsedResult.tx) {
      setValidationError(parsedResult.error ?? "Invalid transaction JSON.");
      return;
    }

    for (let i = 0; i < parsedResult.tx.msgs.length; i++) {
      const msg = parsedResult.tx.msgs[i];
      if (!isKnownMsgTypeUrl(msg.typeUrl)) {
        setValidationError(
          `msg[${i}] has an unsupported typeUrl: "${msg.typeUrl}". Only known message types are supported.`,
        );
        return;
      }
    }

    setImporting(true);
    try {
      if (selectedAccount.type === "wallet" && parsedResult.importedSignatures.length > 0) {
        throw new Error(
          "Imported signatures are only supported for multisig transactions. Select or enter a multisig account to continue.",
        );
      }

      const tx = parsedResult.tx;
      const txData: DbTransactionParsedDataJson = {
        accountNumber: tx.accountNumber,
        sequence: tx.sequence,
        chainId: tx.chainId,
        msgs: tx.msgs as DbTransactionParsedDataJson["msgs"],
        fee: tx.fee,
        memo: tx.memo,
      };
      const network = targetChain.chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";
      if (selectedAccount.type === "multisig") {
        const resolved = await ensureChainMultisigInDb(selectedAccount.address, targetChain);
        if (!resolved.multisig) {
          throw new Error(resolved.reason ?? "Multisig address could not be resolved");
        }
        const txId = await createDbTx(
          selectedAccount.address,
          targetChain.chainId,
          txData,
          parsedResult.importedSignatures,
        );
        onLog({
          stage: "execute",
          network,
          chainId: targetChain.chainId,
          wallet: selectedAccount.address,
          detail: `imported-tx:${txId}`,
        });
        onSuccess(txId);
      } else {
        const signer = await getAminoSignerForChain(targetChain);
        if (!signer) {
          throw new Error("No Amino signer available for wallet account");
        }
        const signerAccounts = await signer.getAccounts();
        const signerAddress = signerAccounts[0]?.address;
        if (!signerAddress) {
          throw new Error("Wallet signer did not expose an account for the resolved chain");
        }
        const client = await SigningStargateClient.connectWithSigner(
          await getRpcEndpoint(targetChain),
          signer,
        );
        const broadcastResult = await client.signAndBroadcast(
          signerAddress,
          msgsFromJson(txData.msgs) as EncodeObject[],
          txData.fee,
          txData.memo,
        );
        if (broadcastResult.code !== 0) {
          throw new Error(broadcastResult.rawLog || "Transaction broadcast failed");
        }
        onLog({
          stage: "execute",
          network,
          chainId: targetChain.chainId,
          wallet: signerAddress,
          txHash: broadcastResult.transactionHash,
          detail: "imported-wallet-broadcast",
        });
        toastSuccess("Transaction broadcasted successfully", broadcastResult.transactionHash);
      }
    } catch (error) {
      toastError({
        title: "Failed to import transaction",
        description: error instanceof Error ? error.message : "Could not import transaction.",
        fullError: error instanceof Error ? error : undefined,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    if (validationError) setValidationError(null);
  };

  const canImport = jsonInput.trim().length > 0 && !importing;

  return (
    <Card variant="institutional" bracket="green-round" className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileInput className="h-5 w-5 text-green-accent" />
          Import Transaction
        </CardTitle>
        <CardDescription>
          Paste either a <code>DbTransactionParsedDataJson</code> object or a raw Cosmos
          transaction envelope with <code>body</code> and <code>auth_info</code>. Wallet accounts
          will sign and broadcast immediately; multisig accounts will create a signable transaction
          entry. Raw imports use the metadata fields below together with the active chain (
          <strong>{chain.chainId}</strong>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="import-account-number">Account Number</Label>
            <Input
              id="import-account-number"
              value={accountNumberInput}
              onChange={(e) => setAccountNumberInput(e.target.value)}
              placeholder="e.g. 123"
              variant="institutional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-sequence">Sequence</Label>
            <Input
              id="import-sequence"
              value={sequenceInput}
              onChange={(e) => setSequenceInput(e.target.value)}
              placeholder="e.g. 0"
              variant="institutional"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="import-json">Transaction JSON</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void fetchCurrentSequence();
              }}
              disabled={fetchingSequence}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {fetchingSequence ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Fill from current chain account
            </Button>
          </div>
          <Textarea
            id="import-json"
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder={`{\n  "body": {\n    "messages": [\n      {\n        "@type": "/cosmos.staking.v1beta1.MsgCreateValidator"\n      }\n    ],\n    "memo": ""\n  },\n  "auth_info": {\n    "signer_infos": [],\n    "fee": { "amount": [...], "gas_limit": "200000" }\n  },\n  "signatures": []\n}`}
            className="min-h-[260px] font-mono text-xs"
          />
        </div>

        {validationError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            {validationError}
          </div>
        )}

        <Button
          variant="action"
          className="w-full gap-2"
          onClick={handleImport}
          disabled={!canImport}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileInput className="h-4 w-4" />
          )}
          {importing
            ? "Importing..."
            : selectedAccount.type === "wallet"
              ? "Import, Sign & Broadcast"
              : "Import & Open for Signing"}
        </Button>
      </CardContent>
    </Card>
  );
}
