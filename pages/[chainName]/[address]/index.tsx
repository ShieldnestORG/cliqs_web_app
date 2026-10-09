/**
 * CLIQ Page
 *
 * One page per CLIQ: header (status, address, New transaction), then the tabs
 * Transactions, Members, Balances and Data & Privacy. Supports both PubKey
 * multisigs and Contract multisigs (CW3).
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { checkAddress } from "@/lib/displayHelpers";
import { getKeplrKey } from "@/lib/keplr";
import { HostedMultisig, ensureChainMultisigInDb, getHostedMultisig } from "@/lib/multisigHelpers";
import { toastError } from "@/lib/utils";
import { isSecp256k1Pubkey, pubkeyToAddress } from "@cosmjs/amino";
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Shield,
  Users,
  Wallet,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { useChains } from "@/context/ChainsContext";
import BalancesTable from "@/components/dataViews/BalancesTable";
import ListMultisigTxs from "@/components/dataViews/ListMultisigTxs";
import ContractMultisigDashboard from "@/components/dataViews/ContractMultisigDashboard";
import TransactionPrivacy from "@/components/dataViews/TransactionPrivacy";
import { useMultisigType } from "@/lib/hooks/useMultisigType";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Tab values are mirrored to ?tab= so a tab can be linked to.
const TAB_VALUES = ["transactions", "members", "balances", "privacy"] as const;
type TabValue = (typeof TAB_VALUES)[number];

export default function CliqDashboardPage() {
  const router = useRouter();
  const { chain } = useChains();
  const [hostedMultisig, setHostedMultisig] = useState<HostedMultisig>();
  const [userAddress, setUserAddress] = useState<string>();
  // Set when the hosted multisig fetch fails — without it the loading guard below
  // never clears for a pubkey multisig, so surface a retry card instead
  const [multisigError, setMultisigError] = useState<string | null>(null);

  const cliqAddress = typeof router.query.address === "string" ? router.query.address : null;

  // Detect multisig type (pubkey vs contract)
  const multisigTypeResult = useMultisigType(
    cliqAddress,
    chain.nodeAddress || null,
    chain.chainId || null,
  );

  // Get user's address on mount
  useEffect(() => {
    (async function getUserAddress() {
      try {
        if (chain.chainId) {
          const { bech32Address } = await getKeplrKey(chain.chainId);
          setUserAddress(bech32Address);
        }
      } catch {
        // User not connected
      }
    })();
  }, [chain.chainId]);

  // Extracted so the error card below can re-invoke it — a thrown fetch would
  // otherwise leave hostedMultisig undefined forever, pinning the loading spinner.
  const fetchMultisig = useCallback(async () => {
    try {
      if (!cliqAddress || !isChainInfoFilled(chain) || !chain.nodeAddress) {
        return;
      }
      setMultisigError(null);

      const resolved = await ensureChainMultisigInDb(cliqAddress, chain);
      if (!resolved.multisig) {
        throw new Error(resolved.reason ?? "Failed to resolve multisig address");
      }
      const newHostedMultisig = await getHostedMultisig(cliqAddress, chain);

      setHostedMultisig(newHostedMultisig);
    } catch (e) {
      console.error("Failed to find cliq:", e);
      setMultisigError(e instanceof Error ? e.message : "Could not resolve this multisig.");
      toastError({
        title: "Failed to find cliq",
        description: e instanceof Error ? e.message : "Could not resolve this multisig.",
        fullError: e instanceof Error ? e : undefined,
      });
    }
  }, [chain, cliqAddress]);

  useEffect(() => {
    fetchMultisig();
  }, [fetchMultisig]);

  // For pubkey multisigs, use the hosted multisig's explorer link.
  // For contract multisigs, construct from chain's explorer config.
  const explorerLink =
    hostedMultisig?.hosted === "chain" || hostedMultisig?.hosted === "db+chain"
      ? hostedMultisig.explorerLink
      : multisigTypeResult.type === "contract" && cliqAddress && chain.explorerLinks?.account
        ? chain.explorerLinks.account.replace("${accountAddress}", cliqAddress)
        : null;

  const pubkey =
    hostedMultisig?.hosted === "db" || hostedMultisig?.hosted === "db+chain"
      ? hostedMultisig.pubkeyOnDb
      : null;

  const threshold = pubkey?.value.threshold || "—";
  const memberCount = pubkey?.value.pubkeys.length || 0;

  const defaultTab: TabValue = hostedMultisig?.hosted === "db" ? "members" : "transactions";
  const queryTab = typeof router.query.tab === "string" ? router.query.tab : undefined;
  const activeTab: TabValue = TAB_VALUES.includes(queryTab as TabValue)
    ? (queryTab as TabValue)
    : defaultTab;

  const handleTabChange = (tab: string) => {
    router.replace({ pathname: router.pathname, query: { ...router.query, tab } }, undefined, {
      shallow: true,
    });
  };

  // Subheader with breadcrumbs
  const subheader = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {chain.registryName ? (
              <Link href={`/${chain.registryName}/dashboard`}>Home</Link>
            ) : null}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-1.5 font-mono text-xs">
            <Users className="h-3 w-3" />
            {cliqAddress?.slice(0, 12)}...{cliqAddress?.slice(-6)}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  // Hosted multisig fetch failure — without it the loading guard below never clears
  // for a pubkey multisig, so surface the error with a retry instead of a spinner
  if (
    !multisigTypeResult.isLoading &&
    multisigError &&
    !hostedMultisig &&
    multisigTypeResult.type !== "contract"
  ) {
    return (
      <DashboardLayout
        title={`CLIQ - ${chain.chainDisplayName || "Cosmos"}`}
        variant="wide"
        subheader={subheader}
      >
        <div className="mx-auto max-w-4xl py-12">
          <Card variant="institutional" className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-destructive">
                    Could not load this CLIQ
                  </h3>
                  <p className="mb-2 text-sm">{multisigError}</p>
                  <p className="mb-3 text-sm">
                    Balances, transactions and members are unavailable until the CLIQ is loaded.
                  </p>
                  <Button variant="outline" onClick={fetchMultisig}>
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Loading state (both multisig detection and hosted check)
  if (multisigTypeResult.isLoading || (!hostedMultisig && multisigTypeResult.type !== "contract")) {
    return (
      <DashboardLayout
        title={`CLIQ - ${chain.chainDisplayName || "Cosmos"}`}
        variant="wide"
        subheader={subheader}
      >
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 animate-pulse rounded-full bg-gradient-to-br from-green-accent/20 to-green-accent/10" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-green-accent" />
            </div>
            <div>
              <p className="font-medium">Loading your CLIQ...</p>
              <p className="text-sm text-muted-foreground">
                {multisigTypeResult.isLoading
                  ? "Detecting CLIQ type..."
                  : "Fetching CLIQ information"}
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Contract Multisig Dashboard
  if (multisigTypeResult.type === "contract" && cliqAddress && chain.nodeAddress && chain.chainId) {
    return (
      <ContractMultisigDashboard
        contractAddress={cliqAddress}
        chainId={chain.chainId}
        chainName={chain.registryName || ""}
        nodeAddress={chain.nodeAddress}
        userAddress={userAddress}
        explorerLink={explorerLink || undefined}
        contractInfo={multisigTypeResult.contractInfo}
      />
    );
  }

  // Not found state (for pubkey multisig)
  if (!hostedMultisig || hostedMultisig.hosted === "nowhere") {
    return (
      <DashboardLayout
        title={`CLIQ - ${chain.chainDisplayName || "Cosmos"}`}
        variant="wide"
        subheader={subheader}
      >
        <div className="mx-auto max-w-4xl py-12">
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {checkAddress(cliqAddress || "", chain.addressPrefix) ? (
                <p>
                  This address doesn&apos;t appear to belong to {chain.chainDisplayName} and
                  wasn&apos;t found on the network or in our database.
                </p>
              ) : (
                <p>
                  This CLIQ wasn&apos;t found on the network or in our database. You may need to
                  create it first.
                </p>
              )}
            </AlertDescription>
          </Alert>
          {chain.registryName && (
            <div className="flex flex-wrap items-center gap-4">
              <Button asChild variant="action" size="action-lg">
                <Link href={`/${chain.registryName}/dashboard`}>Go Home</Link>
              </Button>
              <Link
                href={`/${chain.registryName}/create`}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Create a CLIQ
              </Link>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const isFunded = hostedMultisig.hosted === "db+chain";

  return (
    <DashboardLayout
      title={`CLIQ - ${chain.chainDisplayName || "Cosmos"}`}
      variant="wide"
      subheader={subheader}
    >
      {/* Header Section */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">CLIQ</h1>
              <Badge variant="outline" title="Signatures required / members">
                {threshold}/{memberCount}
              </Badge>
              <Badge variant={isFunded ? "success" : "warning"}>
                {isFunded ? "Funded" : "Needs funding"}
              </Badge>
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate font-mono text-sm text-muted-foreground">
                {cliqAddress}
              </span>
              <CopyButton value={cliqAddress || ""} copyLabel="CLIQ address" />
              {explorerLink && (
                <Button asChild variant="icon" size="icon-sm" className="shrink-0">
                  <a
                    href={explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {cliqAddress && (
            <div className="shrink-0">
              {isFunded ? (
                <Button asChild variant="action" size="action-lg" className="gap-2">
                  <Link href={`/${chain.registryName}/${cliqAddress}/transaction/new`}>
                    <Plus className="h-4 w-4" />
                    New transaction
                  </Link>
                </Button>
              ) : (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block">
                        <Button variant="action" size="action-lg" className="gap-2" disabled>
                          <Plus className="h-4 w-4" />
                          New transaction
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Fund this CLIQ first</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>

        {/* Warning for DB-only CLIQ */}
        {hostedMultisig.hosted === "db" && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your CLIQ needs to be funded. Send some tokens to its address so it appears on the
              network and can start transacting.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-muted/50 p-1">
          <TabsTrigger
            value="transactions"
            aria-label="Transactions"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            aria-label={`Members (${memberCount})`}
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members ({memberCount})</span>
          </TabsTrigger>
          <TabsTrigger
            value="balances"
            aria-label="Balances"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Balances</span>
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            aria-label="Data & Privacy"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Data &amp; Privacy</span>
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab: the one place transactions are listed */}
        <TabsContent value="transactions" className="mt-6">
          {isFunded && cliqAddress && (
            <Card>
              <CardContent className="pt-6">
                <ListMultisigTxs
                  multisigAddress={cliqAddress}
                  multisigThreshold={Number(pubkey?.value.threshold || 1)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-accent" />
                Members ({memberCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pubkey?.value.pubkeys.map((member, index) => {
                const memberAddress = pubkeyToAddress(member, chain.addressPrefix);
                const simplePubkey = isSecp256k1Pubkey(member)
                  ? member.value
                  : `${member.type} pubkey`;

                return (
                  <div
                    key={memberAddress}
                    className="group flex items-center gap-4 rounded-lg border border-border/[0.06] bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-accent/30 bg-gradient-to-br from-green-accent/20 to-green-accent/10">
                      <span className="text-sm font-bold text-green-accent">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-mono text-sm">{memberAddress}</p>
                        {index === 0 && (
                          <span className="rounded bg-green-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-green-accent">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {simplePubkey}
                      </p>
                    </div>
                    <CopyButton value={memberAddress} copyLabel="member address" />
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <p>
                  {threshold} {Number(threshold) === 1 ? "signature" : "signatures"} needed to
                  approve a transaction.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="mt-6">
          {isFunded && cliqAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-accent" />
                  Balances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BalancesTable walletAddress={cliqAddress} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Data & Privacy Tab */}
        <TabsContent value="privacy" className="mt-6 space-y-4">
          {isFunded && cliqAddress && (
            <>
              <TransactionPrivacy multisigAddress={cliqAddress} memberCount={memberCount} />
              <p className="text-sm text-muted-foreground">
                To export your whole database, open{" "}
                <Link
                  href={`/${chain.registryName}/settings#database-config`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Settings
                </Link>
                .
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
