import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DevNetwork } from "./types";

const REAL_ASSETS_SHORT = "Real assets. Check before you sign.";
const REAL_ASSETS_FULL =
  "Mainnet actions use real assets. Verify all addresses and messages before signing.";

interface NetworkToggleProps {
  currentNetwork: DevNetwork;
  onNetworkChange: (network: DevNetwork) => void;
  testnetAvailable: boolean;
}

/**
 * Network control: two small outlined boxes, Mainnet | Testnet (36px tall, not a panel).
 *
 * "Testnet" is always gold (the warning token). While testnet is the active network its box gets
 * a gold outline and a gold TESTNET badge shows beside it, so it is obvious you are not on main.
 * While mainnet is active, one short muted caption on the SAME row says the assets are real
 * (from 640px up the row does not wrap; on a phone the caption drops under the boxes).
 * Until 2026-10-10 this was a bordered panel with a header, tabs and a red warning banner, and the
 * caption was a 22rem-wide sentence under the boxes that wrapped to two lines, so the control
 * measured 352x74px. The long sentence is the caption's `title` AND
 * screen-reader-only text beside the short caption (a `title` alone does not reach a screen reader).
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
        {isTestnet ? (
          <Badge variant="warning" className="font-mono tracking-wider">
            TESTNET
          </Badge>
        ) : (
          // `relative` contains the sr-only sentence (it is absolutely positioned). A screen reader
          // gets the full sentence; the short caption is what shows.
          <p
            title={REAL_ASSETS_FULL}
            className="relative whitespace-nowrap text-xs text-muted-foreground"
          >
            <span aria-hidden="true">{REAL_ASSETS_SHORT}</span>
            <span className="sr-only">{REAL_ASSETS_FULL}</span>
          </p>
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
