/**
 * PendingTransactionsContext
 *
 * Single source of truth for pending transactions across all multisigs the
 * connected wallet is a member of. By wrapping the app in this provider,
 * Header, Sidebar, Home and ListUserCliqs all share one fetch cycle instead of
 * running independent polling loops.
 *
 * It also exposes the de-duplicated CLIQ list (`cliqs`) and which pending
 * transactions still need the connected wallet's signature (`needsMe`,
 * `needsMyCount`). A non-Keplr wallet (Ledger) is served only while the
 * "require wallet sign-in for CLIQs" setting is off, because only Keplr can
 * produce the verification signature that setting demands.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { getDbUserMultisigs, getPendingDbTxs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import type { DbTransaction } from "@/graphql";
import type { WalletInfo } from "@/types/signing";

const isClient = typeof window !== "undefined";
const REFRESH_INTERVAL_MS = 30000;

export const TRANSACTION_STATUS_CHANGED_EVENT = "transactionStatusChanged";

export function dispatchTransactionStatusChanged() {
  if (isClient) {
    window.dispatchEvent(new CustomEvent(TRANSACTION_STATUS_CHANGED_EVENT));
  }
}

/** A pending transaction plus whether the connected wallet has yet to sign it. */
export type PendingTransaction = DbTransaction & { readonly needsMe: boolean };

/** One of the connected wallet's CLIQs (created and belonged, de-duplicated by address). */
export interface PendingCliq {
  address: string;
  name?: string;
  threshold: number;
  memberCount: number;
}

export interface PendingTransactionsData {
  hasPendingTransactions: boolean;
  /** Every pending transaction on the wallet's CLIQs, signed by me or not. */
  totalPendingCount: number;
  /** Pending transactions whose signatures do not yet include the connected wallet. */
  needsMyCount: number;
  multisigsWithPending: Array<{
    address: string;
    pendingCount: number;
    needsMeCount: number;
    transactions: readonly PendingTransaction[];
  }>;
  /** All of the wallet's CLIQs, de-duplicated by address. */
  cliqs: PendingCliq[];
  isLoading: boolean;
  /** True once the CLIQ list has loaded for the current wallet; false before and after a failure of that list. */
  hasLoaded: boolean;
  /** Set when the CLIQ list, or any one CLIQ's pending list, failed to load. Rows that did load are kept. */
  error: string | null;
  /** Fetch again now. No-op while a fetch is in flight. */
  refresh: () => Promise<void>;
}

const defaultData: Omit<PendingTransactionsData, "refresh"> = {
  hasPendingTransactions: false,
  totalPendingCount: 0,
  needsMyCount: 0,
  multisigsWithPending: [],
  cliqs: [],
  isLoading: false,
  hasLoaded: false,
  error: null,
};

const emptyData: PendingTransactionsData = { ...defaultData, refresh: async () => {} };

function parseMultisigPubkey(pubkeyJSON: string): { threshold: number; memberCount: number } {
  try {
    const parsed = JSON.parse(pubkeyJSON);
    return {
      threshold: parsed.value?.threshold || 0,
      memberCount: parsed.value?.pubkeys?.length || 0,
    };
  } catch {
    return { threshold: 0, memberCount: 0 };
  }
}

/**
 * Keplr always qualifies. Any other wallet qualifies only while the sign-in
 * requirement is off, since that requirement needs a Keplr verification signature.
 */
function canUseWallet(walletInfo: WalletInfo | null): walletInfo is WalletInfo {
  if (!walletInfo) return false;
  return walletInfo.type === "Keplr" || !getUserSettings().requireWalletSignInForCliqs;
}

const PendingTransactionsContext = createContext<PendingTransactionsData>(emptyData);

export function PendingTransactionsProvider({ children }: { children: ReactNode }) {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, isVerified } = useWallet();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef(false);
  const [data, setData] = useState<Omit<PendingTransactionsData, "refresh">>(defaultData);

  const fetchPendingTransactions = useCallback(async () => {
    if (!isClient) return;

    // Prevent concurrent overlapping fetches — last one wins would produce stale state
    if (fetchingRef.current) return;

    if (!canUseWallet(walletInfo)) {
      setData((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    if (!chain?.chainId || !chain?.nodeAddress) {
      setData((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    try {
      fetchingRef.current = true;
      // The previous error stays up while this fetch runs; it is replaced by the result, so a
      // failing CLIQ never flashes "all caught up" between polls.
      setData((prev) => ({ ...prev, isLoading: true }));

      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification && !isVerified) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          hasPendingTransactions: false,
          totalPendingCount: 0,
          needsMyCount: 0,
          multisigsWithPending: [],
          cliqs: [],
          hasLoaded: false,
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

      const cliqs: PendingCliq[] = allMultisigs.map((m) => ({
        address: m.address,
        name: m.name || undefined,
        ...parseMultisigPubkey(m.pubkeyJSON),
      }));

      if (allMultisigs.length === 0) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          hasLoaded: true,
          hasPendingTransactions: false,
          totalPendingCount: 0,
          needsMyCount: 0,
          multisigsWithPending: [],
          cliqs,
        }));
        return;
      }

      const pendingPromises = allMultisigs.map(async (multisig) => {
        try {
          const pendingTxs = await getPendingDbTxs(multisig.address, chain.chainId);
          const transactions: PendingTransaction[] = pendingTxs.map((tx) => ({
            ...tx,
            needsMe: !tx.signatures.some(({ address }) => address === walletInfo.address),
          }));
          return {
            address: multisig.address,
            pendingCount: transactions.length,
            needsMeCount: transactions.filter((tx) => tx.needsMe).length,
            transactions,
            failed: false,
          };
        } catch (error) {
          console.error(`Failed to fetch pending transactions for ${multisig.address}:`, error);
          return {
            address: multisig.address,
            pendingCount: 0,
            needsMeCount: 0,
            transactions: [] as readonly PendingTransaction[],
            failed: true,
          };
        }
      });

      const results = await Promise.all(pendingPromises);
      const failedCount = results.filter((r) => r.failed).length;
      const multisigsWithPending = results.filter((r) => r.pendingCount > 0);
      const totalPendingCount = multisigsWithPending.reduce((sum, r) => sum + r.pendingCount, 0);
      const needsMyCount = multisigsWithPending.reduce((sum, r) => sum + r.needsMeCount, 0);

      setData({
        isLoading: false,
        hasLoaded: true,
        // A CLIQ whose pending list failed to load is not an empty one: surface it as an error
        // so no screen reports "all caught up" while signatures may be waiting.
        error:
          failedCount > 0
            ? `Could not load pending transactions for ${failedCount} CLIQ${failedCount === 1 ? "" : "s"}.`
            : null,
        hasPendingTransactions: totalPendingCount > 0,
        totalPendingCount,
        needsMyCount,
        multisigsWithPending,
        cliqs,
      });
    } catch (error) {
      console.error("Failed to fetch pending transactions:", error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch pending transactions",
        hasLoaded: false,
        hasPendingTransactions: false,
        totalPendingCount: 0,
        needsMyCount: 0,
        multisigsWithPending: [],
        cliqs: [],
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, [chain, walletInfo, verificationSignature, isVerified]);

  // Fetch when wallet connects / verification state changes
  useEffect(() => {
    if (!isClient) return;

    if (canUseWallet(walletInfo)) {
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
    if (canUseWallet(walletInfo) && chainReady) {
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
      if (canUseWallet(walletInfo)) {
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
      if (canUseWallet(walletInfo)) {
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
      if (canUseWallet(walletInfo)) {
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

  const value = useMemo<PendingTransactionsData>(
    () => ({ ...data, refresh: fetchPendingTransactions }),
    [data, fetchPendingTransactions],
  );

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
}

export function usePendingTransactionsContext(): PendingTransactionsData {
  return useContext(PendingTransactionsContext);
}
