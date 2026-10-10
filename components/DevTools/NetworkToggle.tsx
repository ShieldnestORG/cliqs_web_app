import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DevNetwork } from "./types";

interface NetworkToggleProps {
  currentNetwork: DevNetwork;
  onNetworkChange: (network: DevNetwork) => void;
  testnetAvailable: boolean;
}

/**
 * Network control: two small outlined boxes, Mainnet | Testnet (36px tall, not a panel).
 *
 * "Testnet" is always gold (the warning token). While testnet is the active network its box gets
 * a gold outline and a gold TESTNET tag shows beside it, so it is obvious you are not on main.
 * While mainnet is active the control is just the two boxes: the "real assets" caption that sat
 * beside them was removed on 2026-10-10 (owner's call).
 * Until 2026-10-10 this was a bordered panel with a header, tabs and a red warning banner.
 * Used by the validator dashboard and by Dev Tools.
 */
export default function NetworkToggle({
  currentNetwork,
  onNetworkChange,
  testnetAvailable,
}: NetworkToggleProps) {
  const isTestnet = currentNetwork === "testnet";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
        <div role="group" aria-label="Network" className="inline-flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={!isTestnet}
            onClick={() => onNetworkChange("mainnet")}
            className={cn(
              "rounded-md max-sm:h-11",
              !isTestnet && "border-foreground/50 bg-secondary",
            )}
          >
            Mainnet
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={isTestnet}
            onClick={() => onNetworkChange("testnet")}
            className={cn(
              "rounded-md text-warning hover:text-warning max-sm:h-11",
              isTestnet && "border-warning bg-warning/10",
            )}
          >
            Testnet
          </Button>
        </div>
        {isTestnet && (
          <Badge variant="warning" mark="half">
            TESTNET
          </Badge>
        )}
      </div>

      {!testnetAvailable && (
        <p className="max-w-[22rem] text-xs text-muted-foreground">
          No testnet variant is registered for this chain. Mainnet mode remains active.
        </p>
      )}
    </div>
  );
}
