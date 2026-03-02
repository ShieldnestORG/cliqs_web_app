/**
 * List User Cliqs Component
 * 
 * File: components/dataViews/ListUserCliqs.tsx
 * 
 * Displays a list of Cliqs (multisigs) that the user has created or is a member of.
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
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function ListUserCliqs() {
  const { chain } = useChains();
  const { 
    walletInfo, 
    loading: walletLoading, 
    connectKeplr, 
    isConnecting,
    verify,
    verificationSignature,
    isVerified,
    isVerifying 
  } = useWallet();
  
  const { multisigsWithPending } = usePendingTransactions();
  
  const [loadingCliqs, setLoadingCliqs] = useState(false);
  const [showBelonged, setShowBelonged] = useState(false);
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
  }, [chainId, walletInfo?.address, walletInfo?.type, walletInfo?.pubKey, verify, verificationSignature]);

  // Auto-fetch cliqs when wallet connects (check settings first)
  useEffect(() => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      // Reset attempts when wallet disconnects
      hasAttemptedFetch.current = null;
      fetchError.current = null;
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
  }, [walletInfo, isVerified, loadingCliqs, cliqs, fetchCliqs, chainId]);

  // Clear cliqs when wallet disconnects
  useEffect(() => {
    if (!walletInfo) {
      setCliqs(null);
      hasAttemptedFetch.current = null;
      fetchError.current = null;
    }
  }, [walletInfo]);

  const handleConnect = useCallback(async () => {
    await connectKeplr();
  }, [connectKeplr]);

  const handleVerifyAndFetch = useCallback(async () => {
    await fetchCliqs();
  }, [fetchCliqs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-accent" />
          Your Cliqs
        </CardTitle>
        <CardDescription>
          Your cliqs on {chain.chainDisplayName}.
          {!walletInfo && " Connect your wallet to see your Cliqs."}
          {walletInfo && getUserSettings().requireWalletSignInForCliqs && !isVerified && " Verify your identity to see your Cliqs."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Not connected state */}
        {!walletInfo ? (
          <Button onClick={handleConnect} disabled={isConnecting} variant="outline" className="gap-2">
            {walletLoading.keplr ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Image
                alt=""
                src="/assets/icons/keplr.svg"
                width={20}
                height={20}
              />
            )}
            Connect Keplr
          </Button>
        ) : null}
        
        {/* Connected but not verified - Keplr only (only show if verification is required by settings) */}
        {walletInfo && 
         walletInfo.type === "Keplr" && 
         getUserSettings().requireWalletSignInForCliqs &&
         !isVerified && 
         !cliqs && 
         !loadingCliqs && 
         !isVerifying ? (
          <Button onClick={handleVerifyAndFetch} disabled={loadingCliqs || isVerifying} variant="outline" className="gap-2">
            <Image
              alt=""
              src="/assets/icons/keplr.svg"
              width={20}
              height={20}
            />
            Verify identity to see Cliqs
          </Button>
        ) : null}
        
        {/* Ledger connected - can't easily verify */}
        {walletInfo && walletInfo.type === "Ledger" && !cliqs ? (
          <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
            <p>Ledger wallet connected. To view your Cliqs, please use Keplr to verify your identity.</p>
          </div>
        ) : null}
        
        {/* Loading states */}
        {(loadingCliqs || isVerifying) && (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin text-green-accent" />
            <p>{isVerifying ? "Verifying wallet..." : "Loading your Cliqs..."}</p>
          </div>
        )}
        
        {/* Empty states */}
        {cliqs && !showBelonged && !cliqs.created.length && (
          <div className="text-center py-6">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <ShieldPlus className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">You haven&apos;t created any Cliqs yet</p>
            {chainRegistryName && (
              <Link href={`/${chainRegistryName}/create`}>
                <Button variant="action-outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Create Your First Cliq
                </Button>
              </Link>
            )}
          </div>
        )}
        {cliqs && showBelonged && !cliqs.belonged.length && (
          <p className="text-sm text-muted-foreground">You are not a member of any Cliq</p>
        )}
        
        {/* Cliq list */}
        {(cliqs?.created.length || cliqs?.belonged.length) ? (
          <>
            <div className="flex items-center justify-between">
              {cliqs.created.length !== cliqs.belonged.length ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="cliqs-type"
                    checked={showBelonged}
                    onCheckedChange={setShowBelonged}
                  />
                  <Label htmlFor="cliqs-type">Show all Cliqs I&apos;m a member of</Label>
                </div>
              ) : <div />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Reset fetch attempt flag to allow manual refresh
                  const walletKey = walletInfo?.address && walletInfo?.type === "Keplr" 
                    ? `${walletInfo.address}-${chainId}` 
                    : null;
                  if (walletKey) {
                    hasAttemptedFetch.current = null;
                    fetchError.current = null;
                  }
                  fetchCliqs();
                }}
                disabled={loadingCliqs || isVerifying}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingCliqs ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {(showBelonged ? cliqs.belonged : cliqs.created).map((cliq) => {
                const pubkey: MultisigThresholdPubkey = JSON.parse(cliq.pubkeyJSON);
                const pendingData = multisigsWithPending.find(m => m.address === cliq.address);
                const pendingCount = pendingData?.pendingCount || 0;

                return (
                  <Link
                    key={cliq.address}
                    href={`/${chainRegistryName}/${cliq.address}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:border-green-accent/50 hover:bg-muted/50 group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-accent/20 to-emerald-600/10 border border-green-accent/30 shrink-0 relative">
                      <Users className="h-5 w-5 text-green-accent" />
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white border-2 border-card">
                          {pendingCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {cliq.name || cliq.address}
                          </p>
                          {cliq.name && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {cliq.address}
                            </p>
                          )}
                        </div>
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="h-5 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 px-1.5 ml-auto sm:ml-0">
                            <Clock className="h-3 w-3" />
                            {pendingCount} pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs gap-1">
                              <Shield className="h-3 w-3" />
                              {pubkey.value.threshold}/{pubkey.value.pubkeys.length}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p>Threshold: {pubkey.value.threshold} signatures required</p>
                              <p>Members: {pubkey.value.pubkeys.length}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <MoveRightIcon className="w-5 text-muted-foreground group-hover:text-green-accent transition-colors" />
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
