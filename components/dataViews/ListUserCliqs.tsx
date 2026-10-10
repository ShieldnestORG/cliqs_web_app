/**
 * List User CLIQs Component
 *
 * Home's "Your CLIQs" list: the CLIQs the user created or belongs to, merged and
 * de-duplicated by address. Ledger wallets (no verification signature) are
 * served from PendingTransactionsContext while the sign-in requirement is off.
 */

import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";
import { FetchedMultisigs, getDbUserMultisigs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import { toastError } from "@/lib/utils";
import { MultisigThresholdPubkey } from "@cosmjs/amino";
import { Loader2, MoveRightIcon, RefreshCw, Users, Shield, ShieldPlus, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/** One row of the list, whichever source it came from. */
interface CliqRow {
  readonly address: string;
  readonly name?: string | null;
  readonly threshold: number;
  readonly memberCount: number;
}

function rowFromPubkeyJSON(
  address: string,
  name: string | null | undefined,
  pubkeyJSON: string,
): CliqRow {
  const pubkey: MultisigThresholdPubkey = JSON.parse(pubkeyJSON);
  return {
    address,
    name,
    threshold: Number(pubkey.value.threshold),
    memberCount: pubkey.value.pubkeys.length,
  };
}

export default function ListUserCliqs() {
  const { chain } = useChains();
  const { walletInfo, verify, verificationSignature, isVerified, isVerifying } = useWallet();

  const {
    multisigsWithPending,
    cliqs: contextCliqs,
    hasLoaded: contextLoaded,
    isLoading: contextLoading,
    refresh: refreshContext,
  } = usePendingTransactions();

  const [loadingCliqs, setLoadingCliqs] = useState(false);
  const [cliqs, setCliqs] = useState<FetchedMultisigs | null>(null);
  const hasAttemptedFetch = useRef<string | null>(null);
  const fetchError = useRef<Error | null>(null);

  // Stable chain values for callbacks
  const chainId = chain.chainId;
  const chainRegistryName = chain.registryName;

  const fetchCliqs = useCallback(async () => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      return;
    }

    // Wait for chain RPC to be ready
    if (!chain.nodeAddress) {
      return;
    }

    // Create a unique key for this fetch attempt
    const fetchKey = `${walletInfo.address}-${chainId}`;

    // Prevent infinite retries - if we've already attempted this fetch, don't retry automatically
    if (hasAttemptedFetch.current === fetchKey && fetchError.current) {
      return;
    }

    try {
      setLoadingCliqs(true);
      fetchError.current = null;

      // Check user settings to see if verification is required
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification) {
        // Get or request verification signature (cached in context)
        let signature = verificationSignature;
        if (!signature) {
          signature = await verify();
          if (!signature) {
            // User cancelled verification
            return;
          }
        }

        // Fetch with signature (verified)
        const fetchedCliqs = await getDbUserMultisigs(chain, { signature });
        setCliqs(fetchedCliqs);
        hasAttemptedFetch.current = fetchKey; // Mark as successfully attempted
        fetchError.current = null;
      } else {
        // Fetch without signature (unverified) - use address and pubkey directly
        const fetchedCliqs = await getDbUserMultisigs(chain, {
          address: walletInfo.address,
          pubkey: walletInfo.pubKey,
        });
        setCliqs(fetchedCliqs);
        hasAttemptedFetch.current = fetchKey; // Mark as successfully attempted
        fetchError.current = null;
      }
    } catch (e: unknown) {
      console.error("Failed to fetch cliqs:", e);
      fetchError.current = e instanceof Error ? e : new Error(String(e));
      hasAttemptedFetch.current = fetchKey; // Mark as attempted (even if failed)
      toastError({
        description: "Failed to fetch your CLIQS",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setLoadingCliqs(false);
    }
    // Use stable primitive dependencies - chain object is needed for API call but
    // we track changes via chainId to avoid unnecessary rerenders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chainId,
    chain.nodeAddress,
    walletInfo?.address,
    walletInfo?.type,
    walletInfo?.pubKey,
    verify,
    verificationSignature,
  ]);

  // Auto-fetch cliqs when wallet connects and chain is ready (check settings first)
  useEffect(() => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      // Reset attempts when wallet disconnects
      hasAttemptedFetch.current = null;
      fetchError.current = null;
      return;
    }

    // Wait for chain nodeAddress before fetching
    if (!chain.nodeAddress) {
      return;
    }

    // Only attempt fetch if we haven't already attempted it for this wallet/chain combo
    const walletKey = `${walletInfo.address}-${chainId}`;
    const hasAlreadyAttempted = hasAttemptedFetch.current === walletKey;

    if (!cliqs && !loadingCliqs && !hasAlreadyAttempted) {
      const settings = getUserSettings();
      const requiresVerification = settings.requireWalletSignInForCliqs;

      if (requiresVerification) {
        // Auto-fetch cliqs when wallet is verified (user must manually verify first)
        if (isVerified) {
          fetchCliqs();
        }
      } else {
        // No verification required - fetch directly
        fetchCliqs();
      }
    }
  }, [walletInfo, isVerified, loadingCliqs, cliqs, fetchCliqs, chainId, chain.nodeAddress]);

  // Clear cliqs when wallet disconnects
  useEffect(() => {
    if (!walletInfo) {
      setCliqs(null);
      hasAttemptedFetch.current = null;
      fetchError.current = null;
    }
  }, [walletInfo]);

  // Another account or chain: the CLIQs and the fetch bookkeeping belong to the previous one.
  // Clearing them lets the auto-fetch above load the new account's CLIQs.
  useEffect(() => {
    setCliqs(null);
    hasAttemptedFetch.current = null;
    fetchError.current = null;
  }, [walletInfo?.address, chainId]);

  const handleVerifyAndFetch = useCallback(async () => {
    await fetchCliqs();
  }, [fetchCliqs]);

  const requiresSignIn = getUserSettings().requireWalletSignInForCliqs;
  const isLedger = walletInfo?.type === "Ledger";
  // Ledger cannot produce the verification signature, so it reads the context's list
  // (which the context only fills while the sign-in requirement is off).
  const useContextRows = isLedger && !requiresSignIn;

  const rows = useMemo<CliqRow[]>(() => {
    if (cliqs) {
      const byAddress = new Map<string, CliqRow>();
      for (const m of [...cliqs.created, ...cliqs.belonged]) {
        if (!byAddress.has(m.address)) {
          byAddress.set(m.address, rowFromPubkeyJSON(m.address, m.name, m.pubkeyJSON));
        }
      }
      return Array.from(byAddress.values());
    }
    return useContextRows ? contextCliqs : [];
  }, [cliqs, useContextRows, contextCliqs]);

  const listLoaded = cliqs !== null || (useContextRows && contextLoaded);
  const listLoading = loadingCliqs || (useContextRows && contextLoading && !contextLoaded);

  const handleRefresh = () => {
    if (useContextRows) {
      refreshContext();
      return;
    }
    // Reset fetch attempt flag to allow manual refresh
    const walletKey =
      walletInfo?.address && walletInfo?.type === "Keplr"
        ? `${walletInfo.address}-${chainId}`
        : null;
    if (walletKey) {
      hasAttemptedFetch.current = null;
      fetchError.current = null;
    }
    fetchCliqs();
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        {/* Connected but not verified - Keplr only (only show if verification is required by settings, and chain is ready) */}
        {walletInfo &&
        walletInfo.type === "Keplr" &&
        chain.nodeAddress &&
        requiresSignIn &&
        !isVerified &&
        !cliqs &&
        !loadingCliqs &&
        !isVerifying ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Verify your identity to see your CLIQs.</p>
            <Button
              onClick={handleVerifyAndFetch}
              disabled={loadingCliqs || isVerifying}
              variant="outline"
              className="gap-2"
            >
              <Image alt="" src="/assets/icons/keplr.svg" width={20} height={20} />
              Verify identity to see CLIQs
            </Button>
          </div>
        ) : null}

        {/* Ledger with the sign-in requirement on - it cannot verify */}
        {isLedger && requiresSignIn ? (
          <div className="rounded-lg border border-border/[0.06] p-4 text-sm text-muted-foreground">
            <p>
              Ledger can&apos;t verify identity. Turn off the sign-in requirement in Settings, or
              use Keplr.
            </p>
          </div>
        ) : null}

        {/* Chain initializing - waiting for RPC */}
        {walletInfo && walletInfo.type === "Keplr" && chain.chainId && !chain.nodeAddress && (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin text-green-accent" />
            <p>Connecting to chain...</p>
          </div>
        )}

        {/* Loading states */}
        {(listLoading || isVerifying) && chain.nodeAddress && (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">
              {isVerifying ? "Verifying wallet..." : "Loading your CLIQs..."}
            </span>
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {listLoaded && !rows.length && (
          <div className="py-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ShieldPlus className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              You don&apos;t have any CLIQs on {chain.chainDisplayName} yet.
            </p>
            {chainRegistryName && (
              <Link href={`/${chainRegistryName}/create`}>
                <Button variant="action" size="action-lg" className="gap-2">
                  <Users className="h-4 w-4" />
                  Create your first CLIQ
                </Button>
              </Link>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Or{" "}
              <Link href="#open-by-address" className="underline underline-offset-4">
                open one you were added to
              </Link>
            </p>
          </div>
        )}

        {/* CLIQ list */}
        {rows.length ? (
          <>
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={listLoading || isVerifying}
              >
                <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((cliq) => {
                const needsMeCount =
                  multisigsWithPending.find((m) => m.address === cliq.address)?.needsMeCount || 0;

                return (
                  <Link
                    key={cliq.address}
                    href={`/${chainRegistryName}/${cliq.address}`}
                    className="group flex items-center gap-3 rounded-lg border border-border/[0.06] p-3 transition-all hover:border-green-accent/50 hover:bg-muted/50"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-accent/30 bg-gradient-to-br from-green-accent/20 to-green-accent/10">
                      <Users className="h-5 w-5 text-green-accent" />
                      {needsMeCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-warning text-[10px] font-bold text-warning-foreground">
                          {needsMeCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {cliq.name || cliq.address}
                          </p>
                          {cliq.name && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {cliq.address}
                            </p>
                          )}
                        </div>
                        {needsMeCount > 0 && (
                          <Badge variant="warning" className="ml-auto h-5 gap-1 px-1.5 sm:ml-0">
                            <Clock className="h-3 w-3" />
                            {needsMeCount} waiting for you
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Shield className="h-3 w-3" />
                              {cliq.threshold}/{cliq.memberCount}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p>Threshold: {cliq.threshold} signatures required</p>
                              <p>Members: {cliq.memberCount}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <MoveRightIcon className="w-5 text-muted-foreground transition-colors group-hover:text-green-accent" />
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
