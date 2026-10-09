/**
 * Home (/[chainName]/dashboard)
 *
 * The one landing page for a signed-in user: signatures waiting for them,
 * their CLIQs, open-by-address, and (only when detected) their validators.
 * Old `?tab=` links still land here; the page no longer reads the query.
 */

import { Button } from "@/components/ui/button";
import { useChains } from "@/context/ChainsContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Info, RefreshCw, Shield } from "lucide-react";
import DashboardLayout, { DashboardSection } from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import FindMultisigForm from "@/components/forms/FindMultisigForm";
import ListUserCliqs from "@/components/dataViews/ListUserCliqs";
import { TransactionCard } from "@/components/dataViews/ListMultisigTxs";
import WalletConnectPrompt from "@/components/WalletConnectPrompt";
import { useWallet } from "@/context/WalletContext";
import { getAssociatedValidators, ValidatorInfo } from "@/lib/validatorHelpers";
import { getDbUserMultisigs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import { truncateAddress } from "@/lib/displayHelpers";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";
import type { PendingTransaction } from "@/context/PendingTransactionsContext";
import { AddressDisplay } from "@/components/ui/address-display";

interface InboxRow {
  readonly tx: PendingTransaction;
  readonly cliqAddress: string;
  readonly cliqLabel: string;
  readonly threshold: number;
}

const InboxSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading signatures waiting for you">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-20 w-full" />
    ))}
  </div>
);

const DashboardPage = () => {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, verify, isVerified } = useWallet();
  const { multisigsWithPending, cliqs, isLoading, hasLoaded, error, refresh } =
    usePendingTransactions();
  const [associatedValidators, setAssociatedValidators] = useState<
    { address: string; validator: ValidatorInfo }[]
  >([]);
  const [isLoadingValidators, setIsLoadingValidators] = useState(false);
  const [cliqFetchError, setCliqFetchError] = useState<string | null>(null);

  const checkValidators = useCallback(async () => {
    if (!walletInfo?.address || !chain.nodeAddress || !chain.addressPrefix) {
      setAssociatedValidators([]);
      setCliqFetchError(null);
      return;
    }

    try {
      setIsLoadingValidators(true);
      setCliqFetchError(null);

      // 1. Try to get multisigs for this user from DB
      // Align with ListUserCliqs: honor requireWalletSignInForCliqs and trigger verify when needed
      let cliqAddresses: string[] = [];
      try {
        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;

        let signature = verificationSignature ?? undefined;
        if (requiresVerification && !signature) {
          const sig = await verify();
          if (!sig) {
            // User cancelled verification - skip multisig fetch, will only check direct wallet
          } else {
            signature = sig;
          }
        }

        if (signature || (!requiresVerification && walletInfo.pubKey)) {
          const multisigs = await getDbUserMultisigs(
            chain,
            signature ? { signature } : { address: walletInfo.address, pubkey: walletInfo.pubKey },
          );

          cliqAddresses = [
            ...multisigs.created.map((m) => m.address),
            ...multisigs.belonged.map((m) => m.address),
          ];
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not fetch CLIQs";
        console.log("Could not fetch CLIQs (account may not be on chain):", e);
        setCliqFetchError(msg);
      }

      // 2. Check each address (direct and multisig) if it's a validator
      const validators = await getAssociatedValidators(
        chain.nodeAddress,
        walletInfo.address,
        cliqAddresses,
        chain.addressPrefix,
      );

      setAssociatedValidators(validators);
    } catch (e) {
      console.error("Failed to check validators:", e);
    } finally {
      setIsLoadingValidators(false);
    }
  }, [walletInfo?.address, walletInfo?.pubKey, chain, verificationSignature, verify]);

  useEffect(() => {
    if (!walletInfo?.address || !chain.nodeAddress || !chain.addressPrefix) return;
    checkValidators();
  }, [checkValidators, walletInfo?.address, chain.nodeAddress, chain.addressPrefix]);

  const requiresSignIn = Boolean(walletInfo) && getUserSettings().requireWalletSignInForCliqs;
  const chainReady = Boolean(chain.nodeAddress);

  // Every pending transaction on my CLIQs, split by whether it still needs my signature.
  // The API returns a CLIQ's transactions oldest first and the client has no timestamp,
  // so "newest first" is reversed API order within each CLIQ.
  const { needsMeRows, waitingRows } = useMemo(() => {
    const needsMe: InboxRow[] = [];
    const waiting: InboxRow[] = [];
    for (const entry of multisigsWithPending) {
      const cliq = cliqs.find((c) => c.address === entry.address);
      const cliqLabel = cliq?.name || truncateAddress(entry.address, 8, 6);
      for (const tx of [...entry.transactions].reverse()) {
        const row = { tx, cliqAddress: entry.address, cliqLabel, threshold: cliq?.threshold ?? 0 };
        (tx.needsMe ? needsMe : waiting).push(row);
      }
    }
    return { needsMeRows: needsMe, waitingRows: waiting };
  }, [multisigsWithPending, cliqs]);

  const renderRow = ({ tx, cliqAddress, cliqLabel, threshold }: InboxRow) => (
    <TransactionCard
      key={tx.id}
      tx={tx}
      multisigAddress={cliqAddress}
      multisigThreshold={threshold}
      chainName={chain.registryName}
      walletAddress={walletInfo?.address}
      cliqLabel={cliqLabel}
    />
  );

  const renderInbox = () => {
    if (!chainReady) return <InboxSkeleton />;

    if (requiresSignIn && !isVerified) {
      return walletInfo?.type === "Ledger" ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Signatures waiting for you can&apos;t load with a Ledger while the sign-in requirement
            is on. Turn it off in Settings, or use Keplr.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Verify your identity to see signatures waiting for you. Use Verify in Your CLIQs below.
          </AlertDescription>
        </Alert>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Could not load signatures waiting for you. {error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={isLoading}
              className="shrink-0 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (!hasLoaded) return <InboxSkeleton />;

    return (
      <div className="space-y-3">
        {needsMeRows.length > 0 ? (
          needsMeRows.map(renderRow)
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" />
            You&apos;re all caught up.
          </p>
        )}
        {waitingRows.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="waiting-on-others" className="border-b-0">
              <AccordionTrigger className="text-sm text-muted-foreground">
                Waiting on other signers ({waitingRows.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">{waitingRows.map(renderRow)}</div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    );
  };

  const showValidators =
    associatedValidators.length > 0 ||
    Boolean(cliqFetchError && walletInfo && !isLoadingValidators);

  return (
    <DashboardLayout title={`Home - ${chain.chainDisplayName || "Cosmos"}`}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Home</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Signatures waiting for you and your CLIQs on {chain.chainDisplayName || "Cosmos"}.
          </p>
        </div>

        {walletInfo ? (
          <>
            <DashboardSection
              title="Needs your signature"
              description={
                chainReady && hasLoaded && !error && !(requiresSignIn && !isVerified)
                  ? `${needsMeRows.length} waiting for you`
                  : undefined
              }
            >
              {renderInbox()}
            </DashboardSection>

            <DashboardSection title="Your CLIQs">
              <ListUserCliqs />
            </DashboardSection>
          </>
        ) : (
          <WalletConnectPrompt
            label="Home"
            description="Connect your wallet to see signatures waiting for you."
          />
        )}

        <div id="open-by-address">
          <DashboardSection title="Open by address">
            <FindMultisigForm />
          </DashboardSection>
        </div>

        {walletInfo && showValidators && (
          <DashboardSection title="Validators">
            <div className="space-y-3">
              {associatedValidators.length > 0 ? (
                <div className="mb-6 space-y-3">
                  {associatedValidators.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center justify-between gap-4 rounded-xl border border-info/30 bg-info/10 p-4 animate-in fade-in slide-in-from-top-4 sm:flex-row"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/20">
                          <Shield className="h-5 w-5 text-info" />
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-foreground">
                            Validator Associated:{" "}
                            <span className="text-info">{item.validator.moniker}</span>
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {item.address === walletInfo?.address ? (
                              <span>Detected via your connected wallet.</span>
                            ) : (
                              <>
                                <span>Detected via CLIQ:</span>
                                <AddressDisplay
                                  address={item.address}
                                  copyLabel="CLIQ address"
                                  className="text-muted-foreground"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link href={`/${chain.registryName}/validator?address=${item.address}`}>
                        <Button variant="action" size="sm" className="gap-2">
                          Manage Validator
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
              {cliqFetchError && walletInfo && !isLoadingValidators && (
                <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20">
                      <Info className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">
                        CLIQ Validators Not Loaded
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Could not load CLIQ-based validators. Retry.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkValidators()}
                    className="shrink-0 gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </DashboardSection>
        )}

        {!walletInfo && chain.registryName && (
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href={`/${chain.registryName}/get-started`}
              className="underline underline-offset-4"
            >
              Read the Guides
            </Link>
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
