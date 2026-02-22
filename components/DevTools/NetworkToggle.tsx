import { Badge } from "@/components/ui/badge";
import { DashboardTab, DashboardTabs } from "@/components/layout/DashboardLayout";
import { AlertTriangle, Network } from "lucide-react";
import { DevNetwork } from "./types";

interface NetworkToggleProps {
  currentNetwork: DevNetwork;
  onNetworkChange: (network: DevNetwork) => void;
  testnetAvailable: boolean;
}

export default function NetworkToggle({
  currentNetwork,
  onNetworkChange,
  testnetAvailable,
}: NetworkToggleProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Network Mode</p>
        </div>
        <Badge variant={currentNetwork === "mainnet" ? "destructive" : "outline"} className="uppercase">
          {currentNetwork}
        </Badge>
      </div>

      <DashboardTabs>
        <DashboardTab active={currentNetwork === "testnet"} onClick={() => onNetworkChange("testnet")}>
          Testnet
        </DashboardTab>
        <DashboardTab
          active={currentNetwork === "mainnet"}
          onClick={() => onNetworkChange("mainnet")}
        >
          Mainnet
        </DashboardTab>
      </DashboardTabs>

      {!testnetAvailable && (
        <p className="text-xs text-muted-foreground">
          No testnet variant is registered for this chain. Mainnet mode remains active.
        </p>
      )}

      {currentNetwork === "mainnet" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>Mainnet actions use real assets. Verify all addresses and messages before signing.</span>
        </div>
      )}
    </div>
  );
}
