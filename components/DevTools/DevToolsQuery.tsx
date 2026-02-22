import { ChainInfo } from "@/context/ChainsContext/types";
import { DeploymentLogDraft } from "@/lib/deploymentLog";
import { toastError } from "@/lib/utils";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Loader2, SearchCode } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface DevToolsQueryProps {
  chain: ChainInfo;
  onLog: (entry: DeploymentLogDraft) => void;
}

const QUERY_TEMPLATES: { id: string; label: string; body: string }[] = [
  { id: "raw", label: "Custom JSON", body: "{}" },
  { id: "config", label: "Config Query", body: '{\n  "config": {}\n}' },
  { id: "owner", label: "Owner Query", body: '{\n  "owner": {}\n}' },
  { id: "admin", label: "Admin Query", body: '{\n  "admin": {}\n}' },
];

export default function DevToolsQuery({ chain, onLog }: DevToolsQueryProps) {
  const [contractAddress, setContractAddress] = useState("");
  const [templateId, setTemplateId] = useState("raw");
  const [queryMsg, setQueryMsg] = useState("{}");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const network = chain.chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";
  const canRun = useMemo(() => Boolean(contractAddress.trim() && queryMsg.trim()), [contractAddress, queryMsg]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const found = QUERY_TEMPLATES.find((template) => template.id === id);
    if (found) setQueryMsg(found.body);
  };

  const runQuery = async () => {
    setLoading(true);
    try {
      const parsed = JSON.parse(queryMsg);
      const client = await CosmWasmClient.connect(chain.nodeAddress);
      const response = await client.queryContractSmart(contractAddress.trim(), parsed);
      const output = JSON.stringify(response, null, 2);
      setResult(output);
      onLog({
        stage: "query",
        network,
        chainId: chain.chainId,
        contractAddress: contractAddress.trim(),
        detail: queryMsg,
      });
    } catch (error) {
      toastError({
        description: "Query failed",
        fullError: error instanceof Error ? error : undefined,
      });
      setResult("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="institutional" bracket="purple-round" className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <SearchCode className="h-5 w-5 text-purple-accent" />
          Query Contract
        </CardTitle>
        <CardDescription>Run read-only CosmWasm queries against the active network.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="query-contract-address">Contract Address</Label>
            <Input
              id="query-contract-address"
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
              placeholder={`${chain.addressPrefix}1...`}
              variant="institutional"
            />
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUERY_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="query-msg">Query JSON</Label>
          <Textarea
            id="query-msg"
            value={queryMsg}
            onChange={(event) => setQueryMsg(event.target.value)}
            className="min-h-[160px] font-mono text-xs"
          />
        </div>

        <Button variant="action" className="w-full gap-2" onClick={runQuery} disabled={loading || !canRun}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCode className="h-4 w-4" />}
          {loading ? "Running Query..." : "Run Query"}
        </Button>

        <div className="space-y-2">
          <Label htmlFor="query-result">Result</Label>
          <Textarea
            id="query-result"
            value={result}
            readOnly
            className="min-h-[180px] font-mono text-xs"
            placeholder="Query response will appear here"
          />
        </div>
      </CardContent>
    </Card>
  );
}
