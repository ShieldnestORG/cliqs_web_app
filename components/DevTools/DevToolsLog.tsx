import { DeploymentLogEntry, DeploymentStage } from "@/lib/deploymentLog";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface DevToolsLogProps {
  entries: readonly DeploymentLogEntry[];
  onClear: () => void;
}

const STAGES: DeploymentStage[] = [
  "upload",
  "instantiate",
  "execute",
  "migrate",
  "update-admin",
  "query",
  "authz-grant",
  "authz-revoke",
];

const truncate = (value: string, size = 18) => {
  if (value.length <= size) return value;
  const head = Math.floor((size - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(-head)}`;
};

export default function DevToolsLog({ entries, onClear }: DevToolsLogProps) {
  const [networkFilter, setNetworkFilter] = useState<"all" | "mainnet" | "testnet">("all");
  const [stageFilter, setStageFilter] = useState<"all" | DeploymentStage>("all");

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (networkFilter !== "all" && entry.network !== networkFilter) return false;
      if (stageFilter !== "all" && entry.stage !== stageFilter) return false;
      return true;
    });
  }, [entries, networkFilter, stageFilter]);

  return (
    <Card variant="institutional" className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Developer Activity Log</CardTitle>
            <CardDescription>
              Local history of dev-console operations across upload, execute, query, and authz actions.
            </CardDescription>
          </div>
          {entries.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClear} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Log
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select value={networkFilter} onValueChange={(value: "all" | "mainnet" | "testnet") => setNetworkFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              <SelectItem value="mainnet">Mainnet</SelectItem>
              <SelectItem value="testnet">Testnet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={(value: "all" | DeploymentStage) => setStageFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">
            No matching developer activity.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Stage</th>
                  <th className="px-2 py-2">Network</th>
                  <th className="px-2 py-2">Code ID</th>
                  <th className="px-2 py-2">Address / Tx</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const value = entry.contractAddress || entry.txHash || entry.wallet || "";
                  return (
                    <tr key={entry.id} className="border-b border-border/40">
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="uppercase">
                          {entry.stage}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={entry.network === "mainnet" ? "destructive" : "secondary"}>
                          {entry.network}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{entry.codeId ?? "-"}</td>
                      <td className="px-2 py-2 font-mono text-xs">{value ? truncate(value, 24) : "-"}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{entry.detail || entry.label || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
