/**
 * Hook to check for pending transactions across all user's multisigs
 *
 * File: lib/hooks/usePendingTransactions.ts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { getDbUserMultisigs, getPendingDbTxs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import { DbTransaction } from "@/graphql";

const isClient = typeof window !== "undefined";
const REFRESH_INTERVAL_MS = 30000; // Refresh every 30 seconds

// Custom event name for transaction status changes
export const TRANSACTION_STATUS_CHANGED_EVENT = "transactionStatusChanged";

// Helper function to dispatch transaction status change event
export function dispatchTransactionStatusChanged() {
  if (isClient) {
    window.dispatchEvent(new CustomEvent(TRANSACTION_STATUS_CHANGED_EVENT));
  }
}

export interface PendingTransactionsData {
  hasPendingTransactions: boolean;
  totalPendingCount: number;
  multisigsWithPending: Array<{
    address: string;
    pendingCount: number;
    transactions: readonly DbTransaction[];
  }>;
  isLoading: boolean;
  error: string | null;
}

export function usePendingTransactions(): PendingTransactionsData {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, isVerified } = useWallet();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [data, setData] = useState<PendingTransactionsData>({
    hasPendingTransactions: false,
    totalPendingCount: 0,
    multisigsWithPending: [],
    isLoading: false,
    error: null,
  });

  const fetchPendingTransactions = useCallback(async () => {
    // Only run on client side
    if (!isClient) return;

    if (!walletInfo || walletInfo.type !== "Keplr") {
      setData((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    // Ensure chain has required properties including nodeAddress
    if (!chain?.chainId || !chain?.nodeAddress) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: null, // Not an error, just waiting for chain to load
      }));
      return;
    }

    try {
      setData((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check user settings to see if verification is required
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification && !isVerified) {
        // Can't fetch without verification
        setData((prev) => ({
          ...prev,
          isLoading: false,
          hasPendingTransactions: false,
          totalPendingCount: 0,
          multisigsWithPending: [],
        }));
        return;
      }

      // Fetch user's multisigs
      const multisigs = await getDbUserMultisigs(chain, {
        signature: requiresVerification ? verificationSignature || undefined : undefined,
        address: walletInfo.address,
        pubkey: walletInfo.pubKey,
      });

      // Combine created and belonged multisigs, deduplicating by address
      // (a user who creates a multisig is typically also a member)
      const allMultisigsMap = new Map<string, (typeof multisigs.created)[number]>();
      for (const m of [...multisigs.created, ...multisigs.belonged]) {
        if (!allMultisigsMap.has(m.address)) {
          allMultisigsMap.set(m.address, m);
        }
      }
      const allMultisigs = Array.from(allMultisigsMap.values());

      if (allMultisigs.length === 0) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          hasPendingTransactions: false,
          totalPendingCount: 0,
          multisigsWithPending: [],
        }));
        return;
      }

      // Fetch pending transactions for each multisig
      const pendingPromises = allMultisigs.map(async (multisig) => {
        try {
          const pendingTxs = await getPendingDbTxs(multisig.address, chain.chainId);
          return {
            address: multisig.address,
            pendingCount: pendingTxs.length,
            transactions: pendingTxs,
          };
        } catch (error) {
          console.error(`Failed to fetch pending transactions for ${multisig.address}:`, error);
          return {
            address: multisig.address,
            pendingCount: 0,
            transactions: [],
          };
        }
      });

      const results = await Promise.all(pendingPromises);

      // Filter out multisigs with no pending transactions
      const multisigsWithPending = results.filter((result) => result.pendingCount > 0);
      const totalPendingCount = multisigsWithPending.reduce(
        (sum, result) => sum + result.pendingCount,
        0,
      );

      setData((prev) => ({
        ...prev,
        isLoading: false,
        hasPendingTransactions: totalPendingCount > 0,
        totalPendingCount,
        multisigsWithPending,
      }));
    } catch (error) {
      console.error("Failed to fetch pending transactions:", error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch pending transactions",
        hasPendingTransactions: false,
        totalPendingCount: 0,
        multisigsWithPending: [],
      }));
    }
  }, [chain, walletInfo, verificationSignature, isVerified]);

  // Auto-fetch when wallet connects and is verified (if required)
  useEffect(() => {
    // Only run on client side
    if (!isClient) return;

    if (walletInfo?.type === "Keplr") {
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification) {
        if (isVerified) {
          fetchPendingTransactions();
        }
      } else {
        fetchPendingTransactions();
      }
    } else {
      // Reset when wallet disconnects
      setData({
        hasPendingTransactions: false,
        totalPendingCount: 0,
        multisigsWithPending: [],
        isLoading: false,
        error: null,
      });
    }
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  // Set up periodic refresh when wallet is connected and chain is ready
  useEffect(() => {
    if (!isClient) return;

    const chainReady = chain?.chainId && chain?.nodeAddress;
    if (walletInfo?.type === "Keplr" && chainReady) {
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;
      const canFetch = requiresVerification ? isVerified : true;

      if (canFetch) {
        // Set up interval to refresh pending transactions
        intervalRef.current = setInterval(() => {
          fetchPendingTransactions();
        }, REFRESH_INTERVAL_MS);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [walletInfo, isVerified, chain?.chainId, chain?.nodeAddress, fetchPendingTransactions]);

  // Refresh on route change (e.g., after broadcasting or cancelling a transaction)
  useEffect(() => {
    if (!isClient) return;

    const handleRouteChange = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        const canFetch = requiresVerification ? isVerified : true;

        if (canFetch) {
          // Small delay to ensure transaction updates are saved
          setTimeout(() => {
            fetchPendingTransactions();
          }, 500);
        }
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events, walletInfo, isVerified, fetchPendingTransactions]);

  // Refresh when window gains focus (user comes back to tab)
  useEffect(() => {
    if (!isClient) return;

    const handleFocus = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        const canFetch = requiresVerification ? isVerified : true;

        if (canFetch) {
          fetchPendingTransactions();
        }
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  // Listen for transaction status change events (e.g., after broadcast or cancel)
  useEffect(() => {
    if (!isClient) return;

    const handleTransactionStatusChange = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        const canFetch = requiresVerification ? isVerified : true;

        if (canFetch) {
          // Small delay to ensure database updates are complete
          setTimeout(() => {
            fetchPendingTransactions();
          }, 300);
        }
      }
    };

    window.addEventListener(TRANSACTION_STATUS_CHANGED_EVENT, handleTransactionStatusChange);

    return () => {
      window.removeEventListener(TRANSACTION_STATUS_CHANGED_EVENT, handleTransactionStatusChange);
    };
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  return data;
}
