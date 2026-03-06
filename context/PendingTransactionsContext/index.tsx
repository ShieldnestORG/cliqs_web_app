/**
 * PendingTransactionsContext
 *
 * Single source of truth for pending transactions across all multisigs the
 * connected wallet is a member of. By wrapping the app in this provider,
 * Header, Sidebar, and ListUserCliqs all share one fetch cycle instead of
 * running three independent polling loops.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { getDbUserMultisigs, getPendingDbTxs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import type { DbTransaction } from "@/graphql";

const isClient = typeof window !== "undefined";
const REFRESH_INTERVAL_MS = 30000;

export const TRANSACTION_STATUS_CHANGED_EVENT = "transactionStatusChanged";

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

const defaultData: PendingTransactionsData = {
  hasPendingTransactions: false,
  totalPendingCount: 0,
  multisigsWithPending: [],
  isLoading: false,
  error: null,
};

const PendingTransactionsContext = createContext<PendingTransactionsData>(defaultData);

export function PendingTransactionsProvider({ children }: { children: ReactNode }) {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, isVerified } = useWallet();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef(false);
  const [data, setData] = useState<PendingTransactionsData>(defaultData);

  const fetchPendingTransactions = useCallback(async () => {
    if (!isClient) return;

    // Prevent concurrent overlapping fetches — last one wins would produce stale state
    if (fetchingRef.current) return;

    if (!walletInfo || walletInfo.type !== "Keplr") {
      setData((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    if (!chain?.chainId || !chain?.nodeAddress) {
      setData((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    try {
      fetchingRef.current = true;
      setData((prev) => ({ ...prev, isLoading: true, error: null }));

      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification && !isVerified) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          hasPendingTransactions: false,
          totalPendingCount: 0,
          multisigsWithPending: [],
        }));
        return;
      }

      const multisigs = await getDbUserMultisigs(chain, {
        signature: requiresVerification ? verificationSignature || undefined : undefined,
        address: walletInfo.address,
        pubkey: walletInfo.pubKey,
      });

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

      const pendingPromises = allMultisigs.map(async (multisig) => {
        try {
          const pendingTxs = await getPendingDbTxs(multisig.address, chain.chainId);
          return { address: multisig.address, pendingCount: pendingTxs.length, transactions: pendingTxs };
        } catch (error) {
          console.error(`Failed to fetch pending transactions for ${multisig.address}:`, error);
          return { address: multisig.address, pendingCount: 0, transactions: [] as readonly DbTransaction[] };
        }
      });

      const results = await Promise.all(pendingPromises);
      const multisigsWithPending = results.filter((r) => r.pendingCount > 0);
      const totalPendingCount = multisigsWithPending.reduce((sum, r) => sum + r.pendingCount, 0);

      setData({
        isLoading: false,
        error: null,
        hasPendingTransactions: totalPendingCount > 0,
        totalPendingCount,
        multisigsWithPending,
      });
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
    } finally {
      fetchingRef.current = false;
    }
  }, [chain, walletInfo, verificationSignature, isVerified]);

  // Fetch when wallet connects / verification state changes
  useEffect(() => {
    if (!isClient) return;

    if (walletInfo?.type === "Keplr") {
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;
      if (requiresVerification ? isVerified : true) {
        fetchPendingTransactions();
      }
    } else {
      setData(defaultData);
    }
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  // Periodic refresh
  useEffect(() => {
    if (!isClient) return;

    const chainReady = chain?.chainId && chain?.nodeAddress;
    if (walletInfo?.type === "Keplr" && chainReady) {
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;
      if (requiresVerification ? isVerified : true) {
        intervalRef.current = setInterval(fetchPendingTransactions, REFRESH_INTERVAL_MS);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [walletInfo, isVerified, chain?.chainId, chain?.nodeAddress, fetchPendingTransactions]);

  // Refresh on route change
  useEffect(() => {
    if (!isClient) return;

    const handleRouteChange = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        if (requiresVerification ? isVerified : true) {
          setTimeout(fetchPendingTransactions, 500);
        }
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events, walletInfo, isVerified, fetchPendingTransactions]);

  // Refresh on window focus
  useEffect(() => {
    if (!isClient) return;

    const handleFocus = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        if (requiresVerification ? isVerified : true) {
          fetchPendingTransactions();
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  // Refresh after broadcast / cancel
  useEffect(() => {
    if (!isClient) return;

    const handleTransactionStatusChange = () => {
      if (walletInfo?.type === "Keplr") {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;
        if (requiresVerification ? isVerified : true) {
          setTimeout(fetchPendingTransactions, 300);
        }
      }
    };

    window.addEventListener(TRANSACTION_STATUS_CHANGED_EVENT, handleTransactionStatusChange);
    return () =>
      window.removeEventListener(TRANSACTION_STATUS_CHANGED_EVENT, handleTransactionStatusChange);
  }, [walletInfo, isVerified, fetchPendingTransactions]);

  return (
    <PendingTransactionsContext.Provider value={data}>
      {children}
    </PendingTransactionsContext.Provider>
  );
}

export function usePendingTransactionsContext(): PendingTransactionsData {
  return useContext(PendingTransactionsContext);
}
