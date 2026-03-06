import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChains } from "@/context/ChainsContext";
import { setChain } from "@/context/ChainsContext/helpers";
import { useWallet } from "@/context/WalletContext";
import { DbMultisig, DbTransactionParsedDataJson } from "@/graphql";
import { createDbTx, getDbUserMultisigs } from "@/lib/api";
import {
  appendDeploymentLog,
  clearDeploymentLog,
  DeploymentLogDraft,
  DeploymentLogEntry,
  loadDeploymentLog,
} from "@/lib/deploymentLog";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";
import { toastError, toastSuccess, ensureProtocol } from "@/lib/utils";
import { exportMsgToJson, gasOfTx } from "@/lib/txMsgHelpers";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { calculateFee, GasPrice, StargateClient } from "@cosmjs/stargate";
import { sleep } from "@cosmjs/utils";
import {
  ArrowRight,
  Code,
  FileCode,
  FileCode2,
  Layers,
  Loader2,
  SearchCode,
  Shield,
  Terminal,
  UploadCloud,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import MsgForm from "../forms/OldCreateTxForm/MsgForm";
import { MsgGetter } from "../forms/OldCreateTxForm";
import { ContractExecute } from "@/components/ContractExecute";
import DevToolsAuthz from "./DevToolsAuthz";
import DevToolsLog from "./DevToolsLog";
import DevToolsQuery from "./DevToolsQuery";
import DevToolsUploader from "./DevToolsUploader";
import NetworkToggle from "./NetworkToggle";
import { DevCommandType, DevNetwork, SelectedAccount } from "./types";
import { AddressDisplay } from "@/components/ui/address-display";

interface DevCommand {
  type: DevCommandType;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresAccount?: boolean;
}

const devCommands: DevCommand[] = [
  {
    type: "upload-wasm",
    name: "Upload WASM",
    description: "Upload contract bytecode to chain",
    icon: <UploadCloud className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: MsgTypeUrls.InstantiateContract,
    name: "Instantiate Contract",
    description: "Deploy a new smart contract",
    icon: <Code className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: MsgTypeUrls.InstantiateContract2,
    name: "Instantiate Contract 2",
    description: "Deploy contract with salt",
    icon: <FileCode className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: MsgTypeUrls.ExecuteContract,
    name: "Execute Contract",
    description: "Call a contract method",
    icon: <Zap className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: "query-contract",
    name: "Query Contract",
    description: "Run read-only JSON query messages",
    icon: <SearchCode className="h-6 w-6" />,
    requiresAccount: false,
  },
  {
    type: "execute-message",
    name: "Execute Message",
    description: "Send custom JSON messages to any contract",
    icon: <FileCode2 className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: MsgTypeUrls.MigrateContract,
    name: "Migrate Contract",
    description: "Upgrade contract code",
    icon: <Layers className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: MsgTypeUrls.UpdateAdmin,
    name: "Update Admin",
    description: "Change contract admin",
    icon: <Shield className="h-6 w-6" />,
    requiresAccount: true,
  },
  {
    type: "authz-manager",
    name: "Authz Manager",
    description: "Grant and revoke delegated permissions",
    icon: <Users className="h-6 w-6" />,
    requiresAccount: true,
  },
];

const isMsgCommand = (type: DevCommandType): type is MsgTypeUrl => type.startsWith("/");

export default function DevTools() {
  const router = useRouter();
  const { chain, chains, chainsDispatch } = useChains();
  const {
    walletInfo,
    getAminoSigner,
    getDirectSigner,
    loading: _walletLoading,
    connectKeplr,
    verify,
    verificationSignature,
    isVerified,
  } = useWallet();

  const [multisigs, setMultisigs] = useState<DbMultisig[]>([]);
  const [loadingMultisigs, setLoadingMultisigs] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SelectedAccount | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<DevCommandType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [memo, setMemo] = useState("");
  const [gasLimit, setGasLimit] = useState(gasOfTx([]));
  const msgGetters = useRef<MsgGetter[]>([]);
  const [msgKey, setMsgKey] = useState(crypto.randomUUID());
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [preferredNetworkApplied, setPreferredNetworkApplied] = useState(false);

  const currentNetwork: DevNetwork = chain.chainId.toLowerCase().includes("testnet")
    ? "testnet"
    : "mainnet";
  const mainnetVariant = chains.mainnets.get(chain.registryName);
  const testnetVariant = chains.testnets.get(chain.registryName);
  const hasTestnetVariant = Boolean(testnetVariant);

  const selectedCommandMeta = useMemo(
    () => devCommands.find((command) => command.type === selectedCommand),
    [selectedCommand],
  );

  const appendLog = (entry: DeploymentLogDraft) => {
    const next = appendDeploymentLog(entry);
    setLogs(next);
  };

  useEffect(() => {
    setLogs(loadDeploymentLog());
  }, []);

  useEffect(() => {
    if (preferredNetworkApplied || !chain.chainId) return;
    const preferred = getUserSettings().preferredDevNetwork;
    const target = preferred === "testnet" ? testnetVariant : mainnetVariant;
    if (target && target.chainId !== chain.chainId) {
      setChain(chainsDispatch, target);
    }
    setPreferredNetworkApplied(true);
  }, [chain.chainId, preferredNetworkApplied, mainnetVariant, testnetVariant, chainsDispatch]);

  const onNetworkChange = (network: DevNetwork) => {
    updateUserSettings({ preferredDevNetwork: network });
    const target = network === "testnet" ? testnetVariant : mainnetVariant;
    if (!target) {
      toast.error(`No ${network} chain variant available for ${chain.chainDisplayName}`);
      return;
    }
    if (target.chainId !== chain.chainId) {
      setChain(chainsDispatch, target);
      setSelectedCommand(null);
    }
  };

  useEffect(() => {
    const fetchMultisigs = async () => {
      if (!walletInfo || !isVerified || !verificationSignature) return;
      try {
        setLoadingMultisigs(true);
        const fetched = await getDbUserMultisigs(chain, { signature: verificationSignature });
        const all = [...fetched.created, ...fetched.belonged];
        const unique = all.filter(
          (value, idx, arr) => arr.findIndex((item) => item.address === value.address) === idx,
        );
        setMultisigs(unique);
      } catch (error) {
        console.error("Failed to fetch multisigs", error);
      } finally {
        setLoadingMultisigs(false);
      }
    };
    fetchMultisigs();
  }, [chain, walletInfo, isVerified, verificationSignature]);

  useEffect(() => {
    if (!walletInfo) return;
    setSelectedAccount((prev) => {
      if (prev && prev.type !== "wallet") return prev;
      return {
        type: "wallet",
        address: walletInfo.address,
        name: "My Wallet",
      };
    });
  }, [walletInfo]);

  useEffect(() => {
    if (!selectedCommand) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT")
        ) {
          return;
        }
        setSelectedCommand(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCommand]);

  const handleSelectCommand = (type: DevCommandType) => {
    const command = devCommands.find((entry) => entry.type === type);
    if (command?.requiresAccount && !selectedAccount) {
      toast.error("Select an account first");
      return;
    }
    setSelectedCommand(type);
    if (isMsgCommand(type)) {
      setGasLimit(gasOfTx([type]));
      setMsgKey(crypto.randomUUID());
      msgGetters.current = [];
    }
  };

  const parseChainError = (rawLog: string, msgType: MsgTypeUrl): string => {
    if (rawLog.includes("Missing export migrate")) {
      return (
        "Migration failed: The target code does not export a 'migrate' entry point. " +
        "The WASM binary must be compiled with a #[entry_point] migrate function. " +
        "Upload a contract binary that supports migration, or check your Code ID."
      );
    }
    if (rawLog.includes("no such contract")) {
      return "Contract not found on chain. Verify the contract address is correct.";
    }
    if (rawLog.includes("unauthorized") || rawLog.includes("Unauthorized")) {
      if (msgType === MsgTypeUrls.MigrateContract) {
        return "Unauthorized: Only the contract admin can migrate. Check that the sender is the admin.";
      }
      if (msgType === MsgTypeUrls.UpdateAdmin) {
        return "Unauthorized: Only the current admin can update the admin.";
      }
      return "Unauthorized: The sender does not have permission to perform this action.";
    }
    if (rawLog.includes("insufficient funds")) {
      return "Insufficient funds: The account does not have enough tokens to cover the transaction fee or the sent amount.";
    }
    if (rawLog.includes("out of gas")) {
      return "Out of gas: Increase the gas limit and try again.";
    }
    if (rawLog.includes("codespace wasm code 2") || rawLog.includes("no such code")) {
      return "Code ID not found on chain. Verify the code ID is correct and has been uploaded.";
    }
    if (
      rawLog.includes("execute wasm contract failed") ||
      rawLog.includes("Error calling the VM")
    ) {
      return `Contract execution error: ${rawLog}`;
    }
    return rawLog;
  };

  const executeMsgTx = async (msgType: MsgTypeUrl) => {
    if (!selectedAccount || !msgGetters.current[0]) return;
    const loadingToastId = toast.loading(
      selectedAccount.type === "wallet"
        ? "Broadcasting transaction..."
        : "Creating multisig transaction...",
    );
    setProcessing(true);
    await sleep(300);

    try {
      const msgGetter = msgGetters.current[0];
      if (!msgGetter.isMsgValid()) {
        toast.error("Please fill in all required fields correctly.");
        return;
      }

      const msgs = Array.isArray(msgGetter.msg) ? msgGetter.msg : [msgGetter.msg];
      const network = chain.chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";

      if (selectedAccount.type === "wallet") {
        const signer = await getAminoSigner();
        if (!signer) throw new Error("No signer available");
        const client = await SigningCosmWasmClient.connectWithSigner(
          ensureProtocol(chain.nodeAddress),
          signer,
          {
            gasPrice: GasPrice.fromString(chain.gasPrice),
          },
        );
        const fee = calculateFee(gasLimit, chain.gasPrice);
        const broadcastResult = await client.signAndBroadcast(
          selectedAccount.address,
          msgs,
          fee,
          memo,
        );
        if (broadcastResult.code !== 0) {
          throw new Error(parseChainError(broadcastResult.rawLog || "Transaction failed", msgType));
        }
        appendLog({
          stage:
            msgType === MsgTypeUrls.MigrateContract
              ? "migrate"
              : msgType === MsgTypeUrls.UpdateAdmin
                ? "update-admin"
                : msgType === MsgTypeUrls.InstantiateContract ||
                    msgType === MsgTypeUrls.InstantiateContract2
                  ? "instantiate"
                  : "execute",
          network,
          chainId: chain.chainId,
          wallet: selectedAccount.address,
          txHash: broadcastResult.transactionHash,
          detail: msgType,
        });
        toastSuccess("Transaction broadcasted successfully", broadcastResult.transactionHash);
        setSelectedCommand(null);
      } else {
        const client = await StargateClient.connect(ensureProtocol(chain.nodeAddress));
        const accountOnChain = await client.getAccount(selectedAccount.address);
        if (!accountOnChain) {
          throw new Error("Multisig account not found on chain. Send some tokens to it first.");
        }
        const fee = calculateFee(gasLimit, chain.gasPrice);
        const exportedMsgs = msgs.map((message) => exportMsgToJson(message));
        const txData: DbTransactionParsedDataJson = {
          accountNumber: accountOnChain.accountNumber,
          sequence: accountOnChain.sequence,
          chainId: chain.chainId,
          msgs: exportedMsgs,
          fee,
          memo,
        };
        const txId = await createDbTx(selectedAccount.address, chain.chainId, txData);
        appendLog({
          stage:
            msgType === MsgTypeUrls.MigrateContract
              ? "migrate"
              : msgType === MsgTypeUrls.UpdateAdmin
                ? "update-admin"
                : msgType === MsgTypeUrls.InstantiateContract ||
                    msgType === MsgTypeUrls.InstantiateContract2
                  ? "instantiate"
                  : "execute",
          network,
          chainId: chain.chainId,
          wallet: selectedAccount.address,
          detail: `multisig-tx:${txId}`,
        });
        toastSuccess("Multisig transaction created", txId);
        router.push(`/${chain.registryName}/${selectedAccount.address}/transaction/${txId}`);
      }
    } catch (error) {
      toastError({
        description: "Execution failed",
        fullError: error instanceof Error ? error : undefined,
      });
    } finally {
      setProcessing(false);
      toast.dismiss(loadingToastId);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 flex items-center gap-2 font-heading text-3xl font-bold tracking-tight">
          <Terminal className="h-8 w-8 text-green-accent" />
          Developer Tools
        </h1>
        <p className="text-muted-foreground">
          Perform developer operations using your connected wallet or a multisig account.
        </p>
      </div>

      <NetworkToggle
        currentNetwork={currentNetwork}
        onNetworkChange={onNetworkChange}
        testnetAvailable={hasTestnetVariant}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
        <div className="space-y-6 xl:col-span-1">
          <Card variant="institutional" bracket="green-round" className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Select Account</CardTitle>
              <CardDescription>Choose which account will perform the operation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!walletInfo ? (
                <div className="space-y-4">
                  <p className="text-sm italic text-muted-foreground">
                    Connect your wallet to see available accounts.
                  </p>
                  <Button onClick={connectKeplr} className="w-full gap-2" variant="outline">
                    <Image src="/assets/icons/keplr.svg" width={18} height={18} alt="Keplr" />
                    Connect Keplr
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      setSelectedAccount({
                        type: "wallet",
                        address: walletInfo.address,
                        name: "My Wallet",
                      })
                    }
                    className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                      selectedAccount?.type === "wallet"
                        ? "border-green-accent bg-green-accent/5"
                        : "border-border hover:border-border/80 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Single Wallet</p>
                        <AddressDisplay
                          address={walletInfo.address}
                          copyLabel="wallet address"
                          className="text-muted-foreground"
                        />
                      </div>
                    </div>
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or Multisig</span>
                    </div>
                  </div>

                  {!isVerified ? (
                    <Button onClick={verify} className="w-full" variant="ghost" size="sm">
                      Verify identity to see multisigs
                    </Button>
                  ) : loadingMultisigs ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : multisigs.length > 0 ? (
                    <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                      {multisigs.map((multisig) => (
                        <button
                          key={multisig.address}
                          onClick={() =>
                            setSelectedAccount({
                              type: "multisig",
                              address: multisig.address,
                              name: multisig.name || "Unnamed Multisig",
                            })
                          }
                          className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                            selectedAccount?.address === multisig.address
                              ? "border-green-accent bg-green-accent/5"
                              : "border-border hover:border-border/80 hover:bg-muted/50"
                          }`}
                        >
                          <p className="truncate text-sm font-semibold">
                            {multisig.name || "Unnamed Multisig"}
                          </p>
                          <AddressDisplay
                            address={multisig.address}
                            copyLabel="multisig address"
                            className="text-muted-foreground"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No multisigs found on this chain.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedAccount && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Selected Identity
              </p>
              <p className="truncate text-sm font-bold">{selectedAccount.name}</p>
              <AddressDisplay
                address={selectedAccount.address}
                copyLabel={`${selectedAccount.type} address`}
                className="text-muted-foreground"
              />
              <Badge
                className="mt-2 capitalize"
                variant={selectedAccount.type === "wallet" ? "default" : "outline"}
              >
                {selectedAccount.type}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-3">
          {!selectedCommand ? (
            <div className="space-y-6">
              <h2 className="font-heading text-xl font-semibold">Available Commands</h2>
              <BentoGrid className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {devCommands.map((command) => {
                  const isEnabled = !command.requiresAccount || Boolean(selectedAccount);
                  return (
                    <BentoCard
                      key={command.type}
                      variant="accent"
                      interactive={isEnabled}
                      onClick={() => isEnabled && handleSelectCommand(command.type)}
                      className={`p-5 ${!isEnabled ? "opacity-60" : ""}`}
                    >
                      <div className="flex h-full flex-col">
                        <div className="mb-3 flex items-center gap-3">
                          <div className="rounded-lg bg-green-accent/10 p-2 text-green-accent">
                            {command.icon}
                          </div>
                          <h4 className="font-heading text-lg font-bold leading-tight">
                            {command.name}
                          </h4>
                        </div>
                        <p className="mb-4 text-sm text-muted-foreground">{command.description}</p>
                        <div className="mt-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-green-accent opacity-0 transition-opacity group-hover:opacity-100">
                          Configure <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </BentoCard>
                  );
                })}
              </BentoGrid>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setSelectedCommand(null)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:border-green-accent/40 hover:bg-muted/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-green-accent/10">
                  <ArrowRight className="h-4 w-4 rotate-180 text-muted-foreground transition-colors group-hover:text-green-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Back to commands
                  </p>
                  <p className="truncate font-heading text-base font-semibold">
                    {selectedCommandMeta?.name}
                  </p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">ESC</span>
              </button>

              {selectedCommand === "upload-wasm" && (
                <DevToolsUploader
                  chain={chain}
                  selectedAccount={selectedAccount}
                  walletAddress={walletInfo?.address}
                  getAminoSigner={getAminoSigner}
                  onLog={appendLog}
                />
              )}

              {selectedCommand === "query-contract" && (
                <DevToolsQuery chain={chain} onLog={appendLog} />
              )}

              {selectedCommand === "authz-manager" && (
                <DevToolsAuthz
                  chain={chain}
                  selectedAccount={selectedAccount}
                  walletAddress={walletInfo?.address}
                  walletType={walletInfo?.type}
                  getAminoSigner={getAminoSigner}
                  getDirectSigner={getDirectSigner}
                  onLog={appendLog}
                />
              )}

              {selectedCommand === "execute-message" && (
                <ContractExecute selectedAccount={selectedAccount} />
              )}

              {selectedCommand && isMsgCommand(selectedCommand) && selectedAccount && (
                <div className="rounded-2xl border-2 border-border/60 bg-card p-6 shadow-sm">
                  <MsgForm
                    key={msgKey}
                    msgType={selectedCommand}
                    senderAddress={selectedAccount.address}
                    msgIndex={0}
                    setMsgGetter={(_, getter) => {
                      msgGetters.current = [getter];
                    }}
                    deleteMsg={() => setSelectedCommand(null)}
                  />

                  <div className="mt-8 space-y-6 border-t border-border pt-8">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="gas-limit">Gas Limit</Label>
                        <Input
                          id="gas-limit"
                          type="number"
                          value={gasLimit}
                          onChange={(event) => setGasLimit(Number(event.target.value))}
                          variant="institutional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="memo">Memo (Optional)</Label>
                        <Input
                          id="memo"
                          value={memo}
                          onChange={(event) => setMemo(event.target.value)}
                          variant="institutional"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setSelectedCommand(null)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="action"
                        size="lg"
                        onClick={() => executeMsgTx(selectedCommand)}
                        disabled={processing || !selectedAccount}
                        className="flex-[2] gap-2"
                      >
                        {processing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : selectedAccount.type === "wallet" ? (
                          <>
                            <Zap className="h-5 w-5" />
                            Sign & Broadcast
                          </>
                        ) : (
                          <>
                            <Shield className="h-5 w-5" />
                            Create Multisig Transaction
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DevToolsLog
        entries={logs}
        onClear={() => {
          clearDeploymentLog();
          setLogs([]);
        }}
      />
    </div>
  );
}
