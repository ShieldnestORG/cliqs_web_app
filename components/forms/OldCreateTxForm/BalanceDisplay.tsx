import { useBalance } from "@/lib/hooks/useBalance";
import { printableCoin, thinSpace } from "@/lib/displayHelpers";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, AlertCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Coin } from "@cosmjs/stargate";

interface BalanceDisplayProps {
  readonly treasuryAddress: string; // Multisig/treasury address (the balance that will be used for transactions)
  readonly denom?: string; // If provided, only show balance for this denom
  readonly gasLimit?: number; // Gas limit for calculating fee buffer
  readonly className?: string;
  readonly showAvailableOnly?: boolean; // If true, only show available balance
}

/**
 * Component to display account balances in transaction forms
 * Shows both connected wallet balance and treasury (multisig) balance
 * Treasury balance is what will be used for transactions
 */
export default function BalanceDisplay({
  treasuryAddress,
  denom,
  gasLimit,
  className,
  showAvailableOnly = false,
}: BalanceDisplayProps) {
  const { chain } = useChains();
  const { walletInfo } = useWallet();

  // Get treasury balance (multisig address - this is what transactions will use)
  const {
    balance: treasuryBalance,
    availableBalance: treasuryAvailableBalance,
    availableBalanceDisplay: treasuryAvailableDisplay,
    loading: treasuryLoading,
    error: treasuryError,
  } = useBalance({
    address: treasuryAddress,
    denom: denom || chain.displayDenom,
    gasLimit,
  });

  // Get connected wallet balance (user's personal wallet)
  // Only fetch if wallet is connected and has an address
  const {
    balance: walletBalance,
    loading: walletLoading,
    error: walletError,
  } = useBalance({
    address: walletInfo?.address || "",
    denom: denom || chain.displayDenom,
    gasLimit: 0, // Don't calculate gas buffer for wallet display
  });

  const loading = treasuryLoading || (walletInfo && walletLoading);
  const displayDenom = denom || chain.displayDenom;
  const asset = chain.assets.find(
    (a) => a.base === displayDenom || a.symbol === displayDenom || a.display === displayDenom,
  );

  // Get the display unit (e.g., "TX" with exponent 6) for formatting
  const displayUnit =
    asset?.denom_units.find(
      (unit) =>
        unit.denom === asset?.display?.toLowerCase() || unit.denom === asset?.symbol?.toLowerCase(),
    ) || asset?.denom_units.find((unit) => unit.exponent > 0);
  const displayExponent = displayUnit?.exponent || 6;

  // Use display unit denom (e.g., "TX") instead of symbol (e.g., "TX")
  const displaySymbol = displayUnit?.denom || asset?.display || asset?.symbol || displayDenom;

  // Debug logging removed to prevent potential re-render loops

  if (loading) {
    return (
      <Card className={cn("border-muted bg-muted/30", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 animate-pulse" />
            <span>Loading balances...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (treasuryError) {
    return (
      <Card className={cn("border-destructive/50 bg-destructive/10", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load treasury balance</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format treasury balance with proper decimals
  const treasuryBalanceDisplay = treasuryBalance
    ? (() => {
        const formatted = printableCoin(treasuryBalance, chain);
        // Ensure it shows proper decimal places
        const parts = formatted.split(thinSpace);
        if (parts.length === 2) {
          const [amount, _symbol] = parts;
          const amountParts = amount.split(".");
          if (amountParts.length === 1) {
            return `${amount}.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`;
          } else {
            const paddedDecimal = amountParts[1].padEnd(displayExponent, "0");
            return `${amountParts[0]}.${paddedDecimal}${thinSpace}${displaySymbol}`;
          }
        }
        return formatted;
      })()
    : `0.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`;

  // Format wallet balance - show actual balance or "0" if no balance found for the denom
  // If wallet has balances but not for the requested denom, show "0" for that denom
  const walletBalanceDisplay = walletInfo
    ? walletBalance
      ? (() => {
          const formatted = printableCoin(walletBalance, chain);
          // Ensure it shows proper decimal places
          const parts = formatted.split(thinSpace);
          if (parts.length === 2) {
            const [amount, _symbol] = parts;
            const amountParts = amount.split(".");
            if (amountParts.length === 1) {
              return `${amount}.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`;
            } else {
              const paddedDecimal = amountParts[1].padEnd(displayExponent, "0");
              return `${amountParts[0]}.${paddedDecimal}${thinSpace}${displaySymbol}`;
            }
          }
          return formatted;
        })()
      : `0.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`
    : null;

  const treasuryAvailableCoin: Coin | null =
    treasuryAvailableBalance && treasuryAvailableBalance.amount !== "0"
      ? treasuryAvailableBalance
      : null;

  return (
    <Card className={cn("border-muted bg-muted/30", className)}>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Treasury Balance - This is what will be used for transactions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4" />
              <span>Treasury Balance</span>
            </div>

            {showAvailableOnly ? (
              <div className="text-lg font-semibold">
                {treasuryAvailableCoin
                  ? (() => {
                      // Format with proper decimal places
                      const parts = treasuryAvailableDisplay.split(".");
                      if (parts.length === 1) {
                        return `${parts[0]}.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`;
                      } else {
                        const paddedDecimal = parts[1].padEnd(displayExponent, "0");
                        return `${parts[0]}.${paddedDecimal}${thinSpace}${displaySymbol}`;
                      }
                    })()
                  : `0.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-lg font-semibold">
                  {treasuryAvailableCoin
                    ? (() => {
                        // Format with proper decimal places
                        const parts = treasuryAvailableDisplay.split(".");
                        if (parts.length === 1) {
                          return `${parts[0]}.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`;
                        } else {
                          const paddedDecimal = parts[1].padEnd(displayExponent, "0");
                          return `${parts[0]}.${paddedDecimal}${thinSpace}${displaySymbol}`;
                        }
                      })()
                    : `0.${"0".repeat(displayExponent)}${thinSpace}${displaySymbol}`}
                </div>
                {treasuryAvailableCoin && gasLimit && (
                  <div className="text-xs text-muted-foreground">
                    Total: {treasuryBalanceDisplay} (gas fee reserved)
                  </div>
                )}
                {!treasuryAvailableCoin && treasuryBalance && gasLimit && (
                  <div className="text-xs text-destructive">Insufficient balance for gas fees</div>
                )}
              </div>
            )}
          </div>

          {/* Connected Wallet Balance - For reference */}
          <div className="space-y-2 border-l border-border pl-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span>Your Wallet Balance</span>
            </div>
            {walletInfo ? (
              <>
                {walletLoading ? (
                  <div className="animate-pulse text-sm text-muted-foreground">Loading...</div>
                ) : walletError ? (
                  <>
                    <div className="text-lg font-semibold text-muted-foreground">Error</div>
                    <div className="text-xs text-destructive">
                      {walletError.message || "Could not load wallet balance"}
                    </div>
                  </>
                ) : (
                  <div className="text-lg font-semibold">{walletBalanceDisplay || "0"}</div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Not connected</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
