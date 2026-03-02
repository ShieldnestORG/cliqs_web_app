/**
 * Validator Dashboard
 *
 * File: components/dataViews/ValidatorDashboard/index.tsx
 *
 * Main validator dashboard component that orchestrates all cards.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardLabel,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useChains } from "@/context/ChainsContext";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { useWallet } from "@/context/WalletContext";
import {
  getValidatorDashboardData,
  ValidatorDashboardData,
  delegatorToValidatorAddress,
  getAssociatedValidators,
  ValidatorInfo,
} from "@/lib/validatorHelpers";
import { getDbUserMultisigs } from "@/lib/api";
import { getKeplrKey } from "@/lib/keplr";
import {
  createMultisigFromCompressedSecp256k1Pubkeys,
  getHostedMultisig,
} from "@/lib/multisigHelpers";
import { getUserSettings } from "@/lib/settingsStorage";
import { toastError } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  AlertCircle,
  Shield,
  Users,
  Loader2,
  ArrowRight,
  CheckCircle,
  Info,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";
import { assert } from "@cosmjs/utils";
import ValidatorIdentityCard from "./ValidatorIdentityCard";
import PendingRewardsCard from "./PendingRewardsCard";
import ValidatorPerformanceCard from "./ValidatorPerformanceCard";
import CliqUpgradeCTA from "./CliqUpgradeCTA";
import WithdrawAddressCard from "./WithdrawAddressCard";
import ValidatorCommandsCard from "./ValidatorCommandsCard";
import ValidatorDelegatorsCard from "./ValidatorDelegatorsCard";
import ProposalViewer from "./ProposalViewer";

type LoadingState = "idle" | "loading" | "loaded" | "error" | "not-validator";

interface AssociatedValidator {
  address: string;
  validator: ValidatorInfo;
  isCliq: boolean;
}

export default function ValidatorDashboard() {
  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, verificationSignature, verify } =
    useWallet();
  const router = useRouter();

  const addressParam = router.query.address as string;
  const effectiveAddress = addressParam || walletInfo?.address;

  // Detect if we're managing via CLIQ (address param differs from connected wallet)
  const isCliqMode = Boolean(
    addressParam && walletInfo?.address && addressParam !== walletInfo.address,
  );
  const cliqAddress = isCliqMode ? addressParam : undefined;

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [dashboardData, setDashboardData] = useState<ValidatorDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");

  // Associated validators (CLIQs that are validators)
  const [associatedValidators, setAssociatedValidators] = useState<AssociatedValidator[]>([]);
  const [isLoadingAssociated, setIsLoadingAssociated] = useState(false);
  const [cliqLookupError, setCliqLookupError] = useState<string | null>(null);

  // CLIQ mode membership verification
  const [isCliqMember, setIsCliqMember] = useState<boolean | null>(null);
  const [isVerifyingMembership, setIsVerifyingMembership] = useState(false);

  // Race condition guard for async effects
  const associatedFetchId = useRef(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchAddress.trim()) {
      router.push(`/${chain.registryName}/validator?address=${searchAddress.trim()}`);
    }
  };

  // Fetch validator data
  const fetchData = useCallback(
    async (showRefreshIndicator = false) => {
      if (!effectiveAddress || !chain.nodeAddress || !chain.addressPrefix) {
        return;
      }

      try {
        if (showRefreshIndicator) {
          setIsRefreshing(true);
        } else {
          setLoadingState("loading");
        }
        setError(null);

        const data = await getValidatorDashboardData(
          chain.nodeAddress,
          effectiveAddress,
          chain.addressPrefix,
        );

        if (!data) {
          setLoadingState("not-validator");
          setDashboardData(null);
        } else {
          setDashboardData(data);
          setLoadingState("loaded");
        }
      } catch (e) {
        console.error("Failed to fetch validator data:", e);
        setError(e instanceof Error ? e.message : "Failed to fetch validator data");
        setLoadingState("error");
      } finally {
        setIsRefreshing(false);
      }
    },
    [effectiveAddress, chain.nodeAddress, chain.addressPrefix],
  );

  // Fetch data when wallet connects or address param changes
  useEffect(() => {
    if (effectiveAddress) {
      fetchData();
    } else {
      setLoadingState("idle");
      setDashboardData(null);
    }
  }, [effectiveAddress, fetchData]);

  // Verification is triggered lazily by CLIQ-related effects (associated validator
  // lookup and CLIQ membership check) rather than eagerly on every wallet connect.
  // This avoids a second Keplr signing popup appearing immediately after the
  // connection approval popup when the user navigates to the validator page.

  // Verify CLIQ membership when in CLIQ mode.
  // Lazily requests a verification signature only when actually needed.
  useEffect(() => {
    let cancelled = false;

    async function verifyCliqMembership() {
      if (!isCliqMode || !walletInfo?.address || !walletInfo.pubKey) {
        setIsCliqMember(null);
        return;
      }

      try {
        setIsVerifyingMembership(true);

        const sig = verificationSignature ?? (await verify());
        if (cancelled) return;

        const multisigs = await getDbUserMultisigs(chain, {
          address: walletInfo.address,
          pubkey: walletInfo.pubKey,
          signature: sig || undefined,
        });

        if (cancelled) return;

        const allAddresses = [
          ...multisigs.created.map((m) => m.address),
          ...multisigs.belonged.map((m) => m.address),
        ];

        setIsCliqMember(allAddresses.includes(addressParam));
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to verify CLIQ membership:", e);
        setIsCliqMember(null);
      } finally {
        if (!cancelled) setIsVerifyingMembership(false);
      }
    }

    verifyCliqMembership();
    return () => {
      cancelled = true;
    };
  }, [addressParam, chain, isCliqMode, verificationSignature, verify, walletInfo?.address, walletInfo?.pubKey]);

  // Register chain-only multisig in DB when viewing validator in CLIQ mode.
  // Users can land here directly from "Manage Validator" without visiting the CLIQ page,
  // so we must ensure the multisig is in DB before they click "Create: Claim All".
  useEffect(() => {
    (async function ensureCliqInDb() {
      try {
        if (
          !isCliqMode ||
          !cliqAddress ||
          !walletInfo ||
          !isChainInfoFilled(chain) ||
          !chain.nodeAddress
        ) {
          return;
        }

        const hostedMultisig = await getHostedMultisig(cliqAddress, chain);

        if (hostedMultisig.hosted === "chain" && hostedMultisig.accountOnChain?.pubkey) {
          assert(
            isMultisigThresholdPubkey(hostedMultisig.accountOnChain.pubkey),
            "Pubkey on chain is not of type MultisigThreshold",
          );

          const { bech32Address: creatorAddress } = await getKeplrKey(chain.chainId);

          await createMultisigFromCompressedSecp256k1Pubkeys(
            hostedMultisig.accountOnChain.pubkey.value.pubkeys.map((p) => p.value),
            Number(hostedMultisig.accountOnChain.pubkey.value.threshold),
            chain.addressPrefix,
            chain.chainId,
            creatorAddress,
          );
          // Multisig is now in DB; "Create: Claim All" will succeed. No reload needed.
        }
      } catch (e) {
        console.error("Failed to register chain multisig:", e);
        toastError({
          description: "Failed to register multisig",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    })();
  }, [isCliqMode, cliqAddress, walletInfo, chain.chainId, chain.nodeAddress, chain.addressPrefix]);

  // Fetch associated validators (CLIQs) when:
  // - "not-validator" state (wallet is not a validator - show CLIQ validators to pick from), or
  // - "loaded" state with direct wallet (wallet IS a validator - show CLIQ validators so user can switch).
  // Lazily requests a verification signature only when actually needed.
  const shouldFetchAssociated =
    !addressParam &&
    !!walletInfo?.address &&
    (loadingState === "not-validator" ||
      (loadingState === "loaded" && effectiveAddress === walletInfo.address));

  const cliqOnlyValidators = useMemo(
    () => associatedValidators.filter((v) => v.address !== effectiveAddress),
    [associatedValidators, effectiveAddress],
  );

  useEffect(() => {
    if (!shouldFetchAssociated) return;

    const fetchId = ++associatedFetchId.current;

    async function fetchAssociatedValidators() {
      try {
        setIsLoadingAssociated(true);
        setCliqLookupError(null);

        const settings = getUserSettings();
        const requiresVerification = settings.requireWalletSignInForCliqs;

        let sig = verificationSignature ?? undefined;
        if (requiresVerification && !sig) {
          sig = (await verify()) ?? undefined;
          if (fetchId !== associatedFetchId.current) return;
          if (!sig) {
            setAssociatedValidators([]);
            return;
          }
        }

        if (!walletInfo?.pubKey) {
          setAssociatedValidators([]);
          return;
        }

        const multisigs = await getDbUserMultisigs(
          chain,
          sig ? { signature: sig } : { address: walletInfo.address, pubkey: walletInfo.pubKey },
        );

        if (fetchId !== associatedFetchId.current) return;

        const cliqAddresses = [
          ...multisigs.created.map((m) => m.address),
          ...multisigs.belonged.map((m) => m.address),
        ];

        if (cliqAddresses.length === 0) {
          setAssociatedValidators([]);
          return;
        }

        const validators = await getAssociatedValidators(
          chain.nodeAddress,
          walletInfo.address,
          cliqAddresses,
          chain.addressPrefix,
        );

        if (fetchId !== associatedFetchId.current) return;

        const associated: AssociatedValidator[] = validators.map((v) => ({
          address: v.address,
          validator: v.validator,
          isCliq: v.address !== walletInfo.address,
        }));

        setAssociatedValidators(associated);
      } catch (e) {
        if (fetchId !== associatedFetchId.current) return;

        const errorMsg = e instanceof Error ? e.message : "Failed to look up CLIQs";
        console.error("Failed to fetch associated validators:", e);
        setCliqLookupError(errorMsg);
        setAssociatedValidators([]);
      } finally {
        if (fetchId === associatedFetchId.current) {
          setIsLoadingAssociated(false);
        }
      }
    }

    fetchAssociatedValidators();
  }, [
    shouldFetchAssociated,
    loadingState,
    walletInfo?.address,
    walletInfo?.pubKey,
    effectiveAddress,
    chain,
    verificationSignature,
    verify,
  ]);

  // Refresh data after transaction
  const handleTransactionComplete = () => {
    // Wait a bit for the chain to update
    setTimeout(() => {
      fetchData(true);
    }, 3000);
  };

  // Chain initializing (waiting for nodeAddress / RPC)
  const isChainInitializing = effectiveAddress && chain.chainId && !chain.nodeAddress;
  if (isChainInitializing) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card variant="institutional" className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card variant="institutional" className="lg:col-span-3">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Connecting to chain...</span>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!effectiveAddress && !walletInfo) {
    return (
      <div className="space-y-6">
        <Card variant="institutional" bracket="green" className="mx-auto max-w-4xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-accent/20">
              <Shield className="h-8 w-8 text-green-accent" />
            </div>
            <CardLabel comment className="justify-center">
              Validator Tools
            </CardLabel>
            <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
            <CardDescription className="text-base">
              Connect your validator operator wallet to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={connectKeplr}
                disabled={loading.keplr || loading.ledger}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
              >
                {loading.keplr ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Image alt="Keplr" src="/assets/icons/keplr.svg" width={24} height={24} />
                )}
                <span className="text-sm">Keplr</span>
              </Button>
              <Button
                onClick={connectLedger}
                disabled={loading.keplr || loading.ledger}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
              >
                {loading.ledger ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Image
                    alt="Ledger"
                    src="/assets/icons/ledger.svg"
                    width={24}
                    height={24}
                    className="rounded bg-white p-0.5"
                  />
                )}
                <span className="text-sm">Ledger</span>
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Connect the wallet associated with your validator operator address.
            </p>
          </CardContent>
        </Card>

        {/* Show CLIQ CTA even before connecting */}
        <CliqUpgradeCTA />
      </div>
    );
  }

  // Loading state
  if (loadingState === "loading") {
    return (
      <div className="space-y-6">
        {/* Identity Card Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card variant="institutional" className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>

          <Card variant="institutional" className="lg:col-span-3">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading validator data...</span>
        </div>
      </div>
    );
  }

  // Not a validator state
  if (loadingState === "not-validator") {
    const validatorAddress = delegatorToValidatorAddress(
      effectiveAddress || "",
      chain.addressPrefix,
    );

    return (
      <div className="space-y-6">
        {/* Show associated validators (CLIQs) if found */}
        {associatedValidators.length > 0 && (
          <Card variant="institutional" bracket="green" className="mx-auto max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-accent/20">
                  <CheckCircle className="h-6 w-6 text-green-accent" />
                </div>
                <div>
                  <CardLabel className="text-green-accent">Validators Found</CardLabel>
                  <CardTitle>Your CLIQ Validators</CardTitle>
                </div>
              </div>
              <CardDescription>
                Your connected wallet is a member of{" "}
                {associatedValidators.length === 1
                  ? "a CLIQ that is"
                  : `${associatedValidators.length} CLIQs that are`}{" "}
                operating as {associatedValidators.length === 1 ? "a validator" : "validators"}.
                Select one to manage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {associatedValidators.map((item, idx) => (
                <Link
                  key={idx}
                  href={`/${chain.registryName}/validator?address=${item.address}`}
                  className="block"
                >
                  <div className="group flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:border-green-accent/50 hover:bg-green-accent/5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-accent/20">
                        <Shield className="h-5 w-5 text-green-accent" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-heading font-bold text-foreground">
                          {item.validator.moniker}
                        </h4>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {item.isCliq ? "CLIQ: " : ""}
                          {item.address.slice(0, 12)}...{item.address.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-2 group-hover:bg-green-accent/10 group-hover:text-green-accent"
                    >
                      Manage
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Loading associated validators */}
        {isLoadingAssociated && (
          <Card variant="institutional" className="mx-auto max-w-4xl">
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Checking your CLIQs for validators...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CLIQ lookup error - show so user knows why discovery may have failed */}
        {cliqLookupError && !isLoadingAssociated && associatedValidators.length === 0 && (
          <Card variant="institutional" className="mx-auto max-w-4xl border-yellow-500/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">CLIQ Lookup Issue</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Could not check your CLIQs for associated validators: {cliqLookupError}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    If you are a multisig member, try entering the CLIQ address manually below.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Original "Not a Validator" card - only show if no associated validators found */}
        {!isLoadingAssociated && associatedValidators.length === 0 && (
          <Card variant="institutional" className="mx-auto max-w-4xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardLabel comment className="justify-center">
                Info
              </CardLabel>
              <CardTitle className="text-2xl">Not a Validator</CardTitle>
              <CardDescription className="text-base">
                The connected wallet is not associated with a validator on{" "}
                {chain.chainDisplayName || "this chain"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <p className="mb-2 text-sm text-muted-foreground">Checked Address:</p>
                  <code className="break-all font-mono text-xs text-foreground">
                    {effectiveAddress}
                  </code>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <p className="mb-2 text-sm text-muted-foreground">Expected Validator Address:</p>
                  <code className="break-all font-mono text-xs text-foreground">
                    {validatorAddress}
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-heading text-sm font-bold">Search by Account Address</h4>
                <p className="text-xs text-muted-foreground">
                  If your validator is managed via a CLIQ (multisig), please enter the CLIQ address
                  below.
                </p>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter account or CLIQ address"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button type="submit" variant="outline">
                    Search
                  </Button>
                </form>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                If you are a validator, make sure you&apos;re connecting with the correct wallet or
                providing the correct address.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Still show CLIQ CTA */}
        <CliqUpgradeCTA />
      </div>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <div className="space-y-6">
        <Card variant="institutional" className="mx-auto max-w-xl border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/20">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Failed to Load Data</CardTitle>
            <CardDescription className="text-base">
              {error || "An error occurred while fetching validator data."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => fetchData()} variant="outline" className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard loaded
  if (!dashboardData) {
    return null;
  }

  // In CLIQ mode, determine whether write actions should be enabled.
  // Read-only view is shown when membership verification failed (isCliqMember === false).
  const cliqReadOnly = isCliqMode && isCliqMember === false;

  return (
    <div className="space-y-6">
      {/* CLIQ membership warning */}
      {isCliqMode && isCliqMember === false && !isVerifyingMembership && (
        <Card variant="institutional" className="border-yellow-500/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Read-Only Mode</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your connected wallet could not be verified as a member of this CLIQ. Transaction
                  actions are disabled. If you believe this is an error, reconnect with the correct
                  wallet or ensure the CLIQ is registered in the database.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* You also manage via CLIQ - when viewing direct validator and user has CLIQ validators */}
      {!isCliqMode &&
        effectiveAddress === walletInfo?.address &&
        chain.registryName &&
        cliqOnlyValidators.length > 0 && (
          <Card variant="institutional" bracket="green" className="border-green-accent/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-accent/20">
                  <Users className="h-5 w-5 text-green-accent" />
                </div>
                <div>
                  <CardLabel className="text-green-accent">Also Manage Via CLIQ</CardLabel>
                  <CardTitle className="text-base">Your CLIQ Validators</CardTitle>
                </div>
              </div>
              <CardDescription>
                You are also a member of{" "}
                {cliqOnlyValidators.length === 1 ? "a CLIQ that operates" : "CLIQs that operate"} as{" "}
                {cliqOnlyValidators.length === 1 ? "a validator" : "validators"}. Manage rewards
                from any of them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {cliqOnlyValidators.map((item, idx) => (
                <Link
                  key={idx}
                  href={`/${chain.registryName}/validator?address=${item.address}`}
                  className="block"
                >
                  <div className="group flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/30 p-3 transition-all hover:border-green-accent/50 hover:bg-green-accent/5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-accent/20">
                        <Shield className="h-4 w-4 text-green-accent" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-heading text-sm font-semibold text-foreground">
                          {item.validator.moniker}
                        </h4>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          CLIQ: {item.address.slice(0, 12)}...{item.address.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-2 group-hover:bg-green-accent/10 group-hover:text-green-accent"
                    >
                      Manage
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Validator Dashboard</h1>
          <p className="text-muted-foreground">Manage rewards and monitor performance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Identity Card - 2 cols */}
        <div className="lg:col-span-2">
          <ValidatorIdentityCard validator={dashboardData.validator} />
        </div>

        {/* Performance Card - 3 cols */}
        <div className="lg:col-span-3">
          <ValidatorPerformanceCard data={dashboardData} />
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Pending Rewards Card - 2 cols */}
        <div className="lg:col-span-2">
          <PendingRewardsCard
            validator={dashboardData.validator}
            commission={dashboardData.commission}
            selfDelegationRewards={dashboardData.selfDelegationRewards}
            onTransactionComplete={handleTransactionComplete}
            isCliqMode={isCliqMode}
            cliqAddress={cliqAddress}
            readOnly={cliqReadOnly}
          />
        </div>

        {/* Withdraw Address Card - 3 cols */}
        <div className="lg:col-span-3">
          <WithdrawAddressCard
            validator={dashboardData.validator}
            withdrawAddress={dashboardData.withdrawAddress}
            onTransactionComplete={handleTransactionComplete}
            isCliqMode={isCliqMode}
            cliqAddress={cliqAddress}
            readOnly={cliqReadOnly}
          />
        </div>
      </div>

      {/* Third Row - Stakers & Governance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Delegators Card - 3 cols */}
        <div className="lg:col-span-3">
          <ValidatorDelegatorsCard data={dashboardData} />
        </div>

        {/* Proposal Viewer - 2 cols */}
        <div className="lg:col-span-2">
          <ProposalViewer
            data={dashboardData}
            onTransactionComplete={handleTransactionComplete}
            isCliqMode={isCliqMode}
            cliqAddress={cliqAddress}
            readOnly={cliqReadOnly}
          />
        </div>
      </div>

      {/* Fourth Row - Validator Commands */}
      <div className="grid grid-cols-1 gap-6">
        <ValidatorCommandsCard
          validator={dashboardData.validator}
          onTransactionComplete={handleTransactionComplete}
          isCliqMode={isCliqMode}
          cliqAddress={cliqAddress}
          readOnly={cliqReadOnly}
        />
      </div>

      {/* CLIQ Upgrade CTA - Full Width */}
      <CliqUpgradeCTA />
    </div>
  );
}
