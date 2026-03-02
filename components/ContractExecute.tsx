import { useState } from "react";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Coin, GasPrice } from "@cosmjs/stargate";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { SelectedAccount } from "@/components/DevTools/types";
import { ensureProtocol } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileCode2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Settings,
  Play,
  Eye,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ContractExecuteProps {
  client?: SigningCosmWasmClient | null;
  selectedAccount?: SelectedAccount | null;
}

type MessageType = "execute" | "query";

interface ExecuteResult {
  txHash: string;
  gasUsed: string;
  response?: unknown;
}

interface QueryResult {
  data: unknown;
}

// Common message templates
const MESSAGE_TEMPLATES: Record<string, { name: string; template: object; description: string }> = {
  update_config: {
    name: "Update Config",
    template: {
      update_config: {
        treasury: "core1...",
        fee_bps: 100,
      },
    },
    description: "Update contract configuration (treasury, fees, etc.)",
  },
  transfer_ownership: {
    name: "Transfer Ownership",
    template: {
      transfer_ownership: {
        new_owner: "core1...",
      },
    },
    description: "Transfer contract ownership to a new address",
  },
  update_admin: {
    name: "Update Admin",
    template: {
      update_admin: {
        admin: "core1...",
      },
    },
    description: "Update the contract admin address",
  },
  pause: {
    name: "Pause Contract",
    template: {
      pause: {},
    },
    description: "Pause the contract (if supported)",
  },
  unpause: {
    name: "Unpause Contract",
    template: {
      unpause: {},
    },
    description: "Unpause the contract (if supported)",
  },
  query_config: {
    name: "Query Config",
    template: {
      config: {},
    },
    description: "Query the contract configuration",
  },
  query_state: {
    name: "Query State",
    template: {
      state: {},
    },
    description: "Query the contract state",
  },
};

export function ContractExecute({ client: externalClient, selectedAccount }: ContractExecuteProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner, getAminoSigner } = useWallet();

  const senderAddress = selectedAccount?.address || walletInfo?.address;

  const [contractAddress, setContractAddress] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("execute");
  const [message, setMessage] = useState("");
  const [funds, setFunds] = useState("");
  const [showFunds, setShowFunds] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [client, setClient] = useState<SigningCosmWasmClient | null>(null);

  const ensureClient = async (): Promise<SigningCosmWasmClient | null> => {
    if (externalClient) return externalClient;
    if (client) return client;

    if (!walletInfo || !chain.nodeAddress) return null;

    try {
      const signer = (await getAminoSigner()) || (await getDirectSigner());
      if (!signer) return null;

      const newClient = await SigningCosmWasmClient.connectWithSigner(
        ensureProtocol(chain.nodeAddress),
        signer,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      setClient(newClient);
      return newClient;
    } catch (err) {
      console.error("Failed to create CosmWasm client:", err);
      return null;
    }
  };

  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(message);
      setMessage(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore if not valid JSON
    }
  };

  const applyTemplate = (templateKey: string) => {
    const template = MESSAGE_TEMPLATES[templateKey];
    if (template) {
      setMessage(JSON.stringify(template.template, null, 2));
      // Set message type based on template
      if (templateKey.startsWith("query_")) {
        setMessageType("query");
      } else {
        setMessageType("execute");
      }
    }
  };

  const handleExecute = async () => {
    if (!contractAddress || !message) return;

    if (!senderAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    const activeClient = await ensureClient();
    if (!activeClient) {
      toast.error("Failed to create signing client");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setExecuteResult(null);
    setQueryResult(null);

    try {
      const parsedMsg = JSON.parse(message);

      if (messageType === "query") {
        const result = await activeClient.queryContractSmart(contractAddress, parsedMsg);
        setQueryResult({ data: result });
        toast.success("Query executed successfully");
      } else {
        const fundsArray: Coin[] = [];
        if (showFunds && funds) {
          const fundsAmount = Math.floor(
            parseFloat(funds) * Math.pow(10, chain.displayDenomExponent),
          );
          if (fundsAmount > 0) {
            fundsArray.push({
              denom: chain.denom,
              amount: fundsAmount.toString(),
            });
          }
        }

        const result = await activeClient.execute(
          senderAddress,
          contractAddress,
          parsedMsg,
          "auto",
          "",
          fundsArray,
        );

        setExecuteResult({
          txHash: result.transactionHash,
          gasUsed: result.gasUsed.toString(),
        });
        toast.success("Message executed successfully");
      }
    } catch (err) {
      console.error("Execution error:", err);
      const raw = err instanceof Error ? err.message : "Execution failed";
      let errorMessage = raw;
      if (raw.includes("Unauthorized") || raw.includes("unauthorized")) {
        errorMessage =
          `Unauthorized: The sender (${senderAddress}) is not permitted to execute this message on the contract. ` +
          `Verify the sender is the contract admin/owner, or that the correct account is selected.`;
      }
      setError(errorMessage);
      toast.error("Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const isDisabled = !senderAddress;
  const isValidJson = message.trim() && validateJson(message);
  const isValidContract = contractAddress.trim().length > 10;
  const canExecute = isValidJson && isValidContract && !isExecuting;

  const explorerTxUrl =
    chain.explorerLinks?.tx && executeResult?.txHash
      ? chain.explorerLinks.tx.replace("${txHash}", executeResult.txHash)
      : null;

  return (
    <Card
      className={`transition-all duration-300 ${isDisabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <CardHeader>
        <CardTitle
          className={`flex items-center gap-2 ${isDisabled ? "text-gray-500" : "text-secondary"}`}
        >
          <FileCode2 className={`h-6 w-6 ${isDisabled ? "" : "text-secondary"}`} />
          Execute Custom Message
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Send custom JSON messages to any CosmWasm contract. Update configs, execute functions, or
          query state.
        </div>

        {senderAddress && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Sender</span>
            <Badge
              variant={selectedAccount?.type === "multisig" ? "outline" : "default"}
              className="text-xs capitalize"
            >
              {selectedAccount?.type || "wallet"}
            </Badge>
            <code className="ml-auto truncate font-mono text-xs text-muted-foreground">
              {senderAddress}
            </code>
          </div>
        )}

        {/* Contract Address */}
        <div className="space-y-2">
          <Label htmlFor="contract-address">Contract Address</Label>
          <Input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder={`${chain.addressPrefix}1...`}
          />
        </div>

        {/* Message Type Toggle */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label>Message Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={messageType === "execute" ? "default" : "outline"}
                onClick={() => setMessageType("execute")}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Execute
              </Button>
              <Button
                type="button"
                size="sm"
                variant={messageType === "query" ? "default" : "outline"}
                onClick={() => setMessageType("query")}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Query
              </Button>
            </div>
          </div>

          {/* Info about message types */}
          <Alert
            className={
              messageType === "execute"
                ? "border-secondary/30 bg-secondary/5"
                : "border-info/30 bg-info/5"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {messageType === "execute"
                ? "Execute messages modify state and require wallet signature + gas fees"
                : "Query messages are read-only and free (no signature or gas needed)"}
            </AlertDescription>
          </Alert>
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <Label>Quick Templates</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={key.startsWith("query_") ? "outline" : "outline"}
                onClick={() => applyTemplate(key)}
                className="text-xs"
                title={template.description}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>

        {/* JSON Message */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="json-message">JSON Message</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={formatJson}
              className="text-xs"
            >
              <Settings className="mr-1 h-3 w-3" />
              Format
            </Button>
          </div>
          <Textarea
            id="json-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`{\n  "update_config": {\n    "treasury": "${chain.addressPrefix}1...",\n    "fee_bps": 100\n  }\n}`}
            className={`h-48 font-mono text-sm ${message && !isValidJson ? "border-destructive" : ""}`}
          />
          {message && !isValidJson && (
            <p className="text-sm text-destructive">Invalid JSON format</p>
          )}
        </div>

        {/* Funds (only for execute) */}
        {messageType === "execute" && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-funds"
                checked={showFunds}
                onChange={(e) => setShowFunds(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="show-funds">Send funds with message</Label>
            </div>

            {showFunds && (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={funds}
                  onChange={(e) => setFunds(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  min="0"
                  className="flex-1"
                />
                <Badge variant="secondary">{chain.displayDenom}</Badge>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="break-all">{error}</AlertDescription>
          </Alert>
        )}

        {/* Execute Result */}
        {executeResult && (
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="font-semibold text-green-600">Message Executed Successfully</div>

                <div className="space-y-2 rounded bg-muted/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gas Used:</span>
                    <span className="font-mono">{executeResult.gasUsed}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Transaction Hash</div>
                    <div className="select-all break-all rounded bg-background/50 p-2 font-mono text-xs">
                      {executeResult.txHash}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {explorerTxUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(explorerTxUrl, "_blank")}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Transaction
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(executeResult.txHash);
                      toast.success("Transaction hash copied");
                    }}
                    className="gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Hash
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Query Result */}
        {queryResult && (
          <Alert className="border-info/30 bg-info/5">
            <CheckCircle2 className="text-info h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="text-info font-semibold">Query Result</div>

                <div className="rounded bg-muted/50 p-3">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                    {JSON.stringify(queryResult.data, null, 2)}
                  </pre>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(queryResult.data, null, 2));
                    toast.success("Result copied");
                  }}
                  className="gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy Result
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Execute Button */}
        <Button onClick={handleExecute} disabled={!canExecute} className="w-full gap-2" size="lg">
          {isExecuting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {messageType === "execute" ? "Executing... (Sign in your wallet)" : "Querying..."}
            </>
          ) : messageType === "execute" ? (
            <>
              <Play className="h-4 w-4" />
              Execute Message
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Query Contract
            </>
          )}
        </Button>

        {!senderAddress && (
          <p className="text-center text-sm text-muted-foreground">Connect your wallet first</p>
        )}
      </CardContent>
    </Card>
  );
}
