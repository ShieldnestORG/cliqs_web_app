import { Coin } from "@cosmjs/stargate";
import { StargateClient, calculateFee } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { fromBech32 } from "@cosmjs/encoding";
import { useEffect, useMemo, useState } from "react";
import { useChains } from "../../context/ChainsContext";

interface UseBalanceOptions {
  readonly address: string;
  readonly denom?: string; // If provided, only return balance for this denom
  readonly gasLimit?: number; // Gas limit for calculating fee buffer
  readonly gasFeeBufferPercent?: number; // Percentage buffer for gas fees (default: 10%)
}

interface BalanceInfo {
  readonly balances: readonly Coin[];
  readonly balance: Coin | null; // Balance for specific denom if provided
  readonly availableBalance: Coin | null; // Available balance after gas fee buffer
  readonly availableBalanceDisplay: string; // Human-readable available balance
  readonly loading: boolean;
  readonly error: Error | null;
}

/**
 * Hook to fetch and manage account balances
 * Calculates available balance accounting for gas fees
 */
export function useBalance({
  address,
  denom,
  gasLimit,
  gasFeeBufferPercent = 10,
}: UseBalanceOptions): BalanceInfo {
  const { chain } = useChains();
  const [balances, setBalances] = useState<readonly Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async function fetchBalances() {
      if (!address || !chain.nodeAddress) {
        setLoading(false);
        setBalances([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Validate address prefix matches the current chain before querying the node
        try {
          const { prefix } = fromBech32(address);
          if (prefix !== chain.addressPrefix) {
            setError(
              new Error(
                `Address prefix '${prefix}' does not match chain prefix '${chain.addressPrefix}'. ` +
                `This address belongs to a different network.`,
              ),
            );
            setLoading(false);
            return;
          }
        } catch {
          setError(new Error("Invalid address format"));
          setLoading(false);
          return;
        }

        const client = await StargateClient.connect(chain.nodeAddress);
        const fetchedBalances = await client.getAllBalances(address);
        setBalances(fetchedBalances);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Failed to fetch balances");
        console.error("Failed to get balances:", e);

        // Provide more specific error messages based on error type
        let errorMessage = "Failed to fetch balances";
        const errorMsgLower = err.message.toLowerCase();

        if (errorMsgLower.includes("failed to fetch") || errorMsgLower.includes("networkerror")) {
          errorMessage =
            "Network error - Unable to connect to RPC node. The node may be down or unreachable.";
        } else if (errorMsgLower.includes("cors")) {
          errorMessage = "CORS error - RPC node may not allow browser connections";
        } else if (errorMsgLower.includes("timeout") || errorMsgLower.includes("timed out")) {
          errorMessage = "Connection timeout - RPC node may be slow or unreachable";
        } else if (errorMsgLower.includes("aborted")) {
          errorMessage = "Request aborted - Connection was cancelled";
        }

        setError(new Error(errorMessage));
        // Only show toast error for treasury balance, not wallet balance
        // toastError({
        //   description: errorMessage,
        //   fullError: err,
        // });
      } finally {
        setLoading(false);
      }
    })();
  }, [address, chain.nodeAddress, chain.addressPrefix]);

  // Find balance for specific denom
  // Need to match against base denom, not display denom
  const balance = useMemo(
    () =>
      denom
        ? (() => {
          // First try exact match
          let found = balances.find((coin) => coin.denom === denom);
          if (found) return found;

          // If not found, try to find the asset and match against its base denom
          const asset = chain.assets.find(
            (a) => a.base === denom || a.symbol === denom || a.display === denom,
          );
          if (asset) {
            // Try matching against base denom
            found = balances.find((coin) => coin.denom === asset.base);
            if (found) return found;

            // Try matching against all denom units
            for (const unit of asset.denom_units) {
              found = balances.find((coin) => coin.denom === unit.denom);
              if (found) return found;
            }
          }

          return null;
        })()
        : null,
    [balances, denom, chain.assets],
  );

  // Calculate available balance (accounting for gas fees)
  const availableBalance = useMemo((): Coin | null => {
    if (!balance || !gasLimit) {
      return balance;
    }

    try {
      // Calculate gas fee
      const fee = calculateFee(gasLimit, chain.gasPrice);

      // Find gas fee amount for the same denom
      const gasFeeCoin = fee.amount.find((coin) => coin.denom === balance.denom);

      if (!gasFeeCoin) {
        // Gas fee is in different denom, return full balance
        return balance;
      }

      // Calculate buffer: gas fee + percentage buffer
      // Use integer math: buffer = gasFee * (100 + bufferPercent) / 100
      const gasFeeAmount = BigInt(gasFeeCoin.amount);
      const bufferAmount = (gasFeeAmount * BigInt(100 + gasFeeBufferPercent)) / BigInt(100);
      const bufferAmountStr = bufferAmount.toString();

      // Calculate available balance
      // Ensure balance.amount is a valid string
      let balanceAmountStr: string;
      const amount = balance.amount as string | number | bigint | { toString(): string };
      if (typeof amount === "string") {
        balanceAmountStr = amount.trim();
      } else if (typeof amount === "number") {
        balanceAmountStr = amount.toString();
      } else if (amount && typeof amount === "object" && "toString" in amount) {
        balanceAmountStr = amount.toString().trim();
      } else {
        balanceAmountStr = "0";
      }

      if (!balanceAmountStr || balanceAmountStr === "" || isNaN(Number(balanceAmountStr))) {
        console.warn("Invalid balance amount:", balance.amount, "converted to:", balanceAmountStr);
        return balance;
      }

      // Use BigInt arithmetic directly for better reliability
      try {
        const balanceAmountBigInt = BigInt(balanceAmountStr);
        const availableAmountBigInt =
          balanceAmountBigInt > bufferAmount ? balanceAmountBigInt - bufferAmount : BigInt(0);

        if (availableAmountBigInt <= BigInt(0)) {
          return { denom: balance.denom, amount: "0" };
        }

        return {
          denom: balance.denom,
          amount: availableAmountBigInt.toString(),
        };
      } catch (e) {
        console.error("Error calculating available balance with BigInt:", e);
        // Fallback to Decimal if BigInt fails
        try {
          const bufferDecimal = Decimal.fromAtomics(bufferAmountStr, 0);
          const balanceDecimal = Decimal.fromAtomics(balanceAmountStr, 0);

          // Validate Decimal instances
          if (!bufferDecimal || !balanceDecimal) {
            console.error("Failed to create Decimal instances");
            return balance;
          }

          const availableDecimal = balanceDecimal.minus(bufferDecimal);

          if (availableDecimal.isLessThanOrEqual(Decimal.fromUserInput("0", 0))) {
            return { denom: balance.denom, amount: "0" };
          }

          return {
            denom: balance.denom,
            amount: availableDecimal.atomics,
          };
        } catch (decimalError) {
          console.error("Error calculating available balance with Decimal:", decimalError);
          return balance;
        }
      }
    } catch (e) {
      console.error("Error calculating available balance:", e);
      // On error, return full balance
      return balance;
    }
  }, [balance, gasLimit, chain.gasPrice, gasFeeBufferPercent]);

  // Format available balance for display
  const availableBalanceDisplay = useMemo((): string => {
    if (!availableBalance || availableBalance.amount === "0") {
      return "0.000000";
    }

    try {
      const asset = chain.assets.find(
        (a) => a.base === availableBalance.denom || a.symbol === availableBalance.denom,
      );

      if (!asset) {
        return availableBalance.amount;
      }

      // Find the display unit (usually the one with the symbol like "core")
      const displayUnit =
        asset.denom_units.find(
          (unit) => unit.denom === asset.display || unit.denom === asset.symbol.toLowerCase(),
        ) ||
        asset.denom_units.find((unit) => unit.exponent > 0) ||
        asset.denom_units[0];

      if (!displayUnit) {
        return availableBalance.amount;
      }

      const decimal = Decimal.fromAtomics(availableBalance.amount, displayUnit.exponent);
      // Format with proper decimal places (pad with zeros if needed)
      const formatted = decimal.toString();
      const parts = formatted.split(".");
      if (parts.length === 1) {
        // No decimal point, add .000000
        return `${parts[0]}.${"0".repeat(displayUnit.exponent)}`;
      } else {
        // Has decimal point, pad to required decimal places
        const decimalPart = parts[1];
        const paddedDecimal = decimalPart.padEnd(displayUnit.exponent, "0");
        return `${parts[0]}.${paddedDecimal}`;
      }
    } catch (e) {
      console.error("Error formatting balance:", e);
      return availableBalance.amount;
    }
  }, [availableBalance, chain.assets]);

  return {
    balances,
    balance,
    availableBalance,
    availableBalanceDisplay,
    loading,
    error,
  };
}
