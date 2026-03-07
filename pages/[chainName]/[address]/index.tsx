/**
 * Cliq Dashboard Page
 *
 * File: pages/[chainName]/[address]/index.tsx
 *
 * Main dashboard for viewing and managing a Cliq (multisig).
 * Supports both PubKey multisigs and Contract multisigs (CW3).
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout, { QuickStatsRow, QuickStat } from "@/components/layout/DashboardLayout";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { checkAddress } from "@/lib/displayHelpers";
import { getKeplrKey } from "@/lib/keplr";
import {
  HostedMultisig,
  ensureChainMultisigInDb,
  getHostedMultisig,
} from "@/lib/multisigHelpers";
import { toastError } from "@/lib/utils";
import { isSecp256k1Pubkey, pubkeyToAddress } from "@cosmjs/amino";
import copy from "copy-to-clipboard";
import {
  AlertCircle,
  ArrowUpRightSquare,
  Copy,
  Loader2,
  Users,
  Wallet,
  FileText,
  Plus,
  Shield,
  ExternalLink,
  Info,
  Settings,
  History,
  ShieldPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/ui/copy-button";
import { useChains } from "@/context/ChainsContext";
import BalancesTable from "@/components/dataViews/BalancesTable";
import ListMultisigTxs from "@/components/dataViews/ListMultisigTxs";
import ContractMultisigDashboard from "@/components/dataViews/ContractMultisigDashboard";
import { useMultisigType } from "@/lib/hooks/useMultisigType";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function CliqDashboardPage() {
  const router = useRouter();
  const { chain } = useChains();
  const [hostedMultisig, setHostedMultisig] = useState<HostedMultisig>();
  const [activeTab, setActiveTab] = useState("overview");
  const [userAddress, setUserAddress] = useState<string>();

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

  useEffect(() => {
    (async function updateHostedMultisig() {
      try {
        if (!cliqAddress || !isChainInfoFilled(chain) || !chain.nodeAddress) {
          return;
        }

        const resolved = await ensureChainMultisigInDb(cliqAddress, chain);
        if (!resolved.multisig) {
          throw new Error(resolved.reason ?? "Failed to resolve multisig address");
        }
        const newHostedMultisig = await getHostedMultisig(cliqAddress, chain);

        setHostedMultisig(newHostedMultisig);
      } catch (e) {
        console.error("Failed to find cliq:", e);
        toastError({
          title: "Failed to find cliq",
          description: e instanceof Error ? e.message : "Could not resolve this multisig.",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    })();
  }, [chain, cliqAddress]);

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

  const copyAddress = () => {
    if (cliqAddress) {
      copy(cliqAddress);
      toast.success(`Copied address to clipboard`, { description: cliqAddress });
    }
  };

  // Subheader with breadcrumbs
  const subheader = (
    <div className="flex items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              {chain.registryName ? <Link href={`/${chain.registryName}`}>Dashboard</Link> : null}
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

      <div className="flex items-center gap-2">
        {explorerLink && (
          <Button asChild variant="ghost" size="sm" className="gap-2 text-xs">
            <a href={explorerLink} target="_blank">
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  // Loading state (both multisig detection and hosted check)
  if (multisigTypeResult.isLoading || (!hostedMultisig && multisigTypeResult.type !== "contract")) {
    return (
      <DashboardLayout
        title={`Cliq - ${chain.chainDisplayName || "Cosmos"}`}
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
              <p className="font-medium">Loading your Cliq...</p>
              <p className="text-sm text-muted-foreground">
                {multisigTypeResult.isLoading
                  ? "Detecting multisig type..."
                  : "Fetching cliq information"}
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
        title={`Cliq - ${chain.chainDisplayName || "Cosmos"}`}
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
                  This Cliq wasn&apos;t found on the network or in our database. You may need to
                  create it first.
                </p>
              )}
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldPlus className="h-5 w-5 text-green-accent" />
                Create a New CLIQ
              </CardTitle>
              <CardDescription>
                Create a CLIQ and start managing shared funds together.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chain.registryName && (
                <Link href={`/${chain.registryName}/create`}>
                  <Button variant="action" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Cliq
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Cliq - ${chain.chainDisplayName || "Cosmos"}`}
      variant="wide"
      subheader={subheader}
    >
      {/* Header Section */}
      <div className="mb-8">
        <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-accent/30 bg-gradient-to-br from-green-accent/20 to-green-accent/10">
                <Users className="h-7 w-7 text-green-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-2xl font-bold tracking-tight lg:text-3xl">
                    Your CLIQ
                  </h1>
                  <span className="rounded-full bg-green-accent/20 px-2 py-0.5 text-xs font-medium text-green-accent">
                    {memberCount} members
                  </span>
                </div>
                <button
                  onClick={copyAddress}
                  className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="max-w-[200px] truncate font-mono sm:max-w-none">
                    {cliqAddress}
                  </span>
                  <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                </button>
              </div>
            </div>
          </div>

          {hostedMultisig.hosted === "db+chain" && cliqAddress && (
            <div className="flex shrink-0 items-center gap-3">
              <Link href={`/${chain.registryName}/${cliqAddress}/transaction/new`}>
                <Button variant="action" size="action-lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Transaction
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <QuickStatsRow>
          <QuickStat
            label="Threshold"
            value={`${threshold}/${memberCount}`}
            icon={<Shield className="h-5 w-5 text-green-accent" />}
          />
          <QuickStat
            label="Members"
            value={memberCount}
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
          />
          <QuickStat
            label="Network"
            value={chain.chainDisplayName || "—"}
            icon={<Settings className="h-5 w-5 text-muted-foreground" />}
          />
          <QuickStat
            label="Status"
            value={hostedMultisig.hosted === "db+chain" ? "Active" : "Pending"}
            icon={
              <div
                className={`h-3 w-3 rounded-full ${hostedMultisig.hosted === "db+chain" ? "bg-green-accent" : "bg-yellow-500"
                  }`}
              />
            }
          />
        </QuickStatsRow>

        {/* Warning for DB-only cliq */}
        {hostedMultisig.hosted === "db" && (
          <Alert variant="warning" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your Cliq needs to be funded. Send some tokens to its address so it appears on the
              network and can start transacting.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto bg-muted/50 p-1">
          <TabsTrigger
            value="overview"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {hostedMultisig.hosted === "db+chain" && cliqAddress && (
            <>
              {/* Main Dashboard Grid - Asymmetric Layout */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                {/* Left Column - Treasury (compact) */}
                <div className="space-y-4 lg:col-span-3">
                  {/* Treasury Card */}
                  <Card className="card-bracket-corner border-green-accent/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-accent/20">
                          <Wallet className="h-4 w-4 text-green-accent" />
                        </div>
                        Treasury
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BalancesTable walletAddress={cliqAddress} />
                    </CardContent>
                  </Card>

                  {/* Quick Actions - Stacked on left */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                        {/* Label */} Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Link
                        href={`/${chain.registryName}/${cliqAddress}/transaction/new`}
                        className="block"
                      >
                        <Button variant="action" className="w-full justify-start gap-3">
                          <Plus className="h-4 w-4" />
                          New Transaction
                        </Button>
                      </Link>
                      <CopyButton
                        variant="outline"
                        className="h-auto w-full justify-start gap-3 px-4 py-3"
                        value={cliqAddress || ""}
                        copyLabel="Cliq address"
                      >
                        <span className="text-sm font-medium">Copy Address</span>
                      </CopyButton>
                      {explorerLink && (
                        <Button variant="outline" className="w-full justify-start gap-3" asChild>
                          <a href={explorerLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            View Explorer
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={() => setActiveTab("members")}
                      >
                        <Users className="h-4 w-4" />
                        View Members
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Center/Right - Pending Actions (larger area) */}
                <div className="lg:col-span-9">
                  <Card className="flex h-full min-h-[400px] flex-col">
                    <CardHeader className="flex-shrink-0 pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <History className="h-4 w-4" />
                          Pending Actions
                        </CardTitle>
                        <Link href={`/${chain.registryName}/${cliqAddress}/transaction/new`}>
                          <Button variant="action-outline" size="sm" className="gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            New
                          </Button>
                        </Link>
                      </div>
                      <CardDescription>
                        Transactions requiring signatures from cliq members
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                      <ListMultisigTxs
                        multisigAddress={cliqAddress}
                        multisigThreshold={Number(pubkey?.value.threshold || 1)}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Bottom Section - Activity & Info */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Recent Activity Summary */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                      {/* Label */} Recent Activity
                    </CardTitle>
                    <div className="font-heading text-lg font-semibold">Transaction History</div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        View all transactions in the Transactions tab
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 gap-1"
                        onClick={() => setActiveTab("transactions")}
                      >
                        View all <ArrowUpRightSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Cliq Info */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                      {/* Label */} Cliq Info
                    </CardTitle>
                    <div className="font-heading text-lg font-semibold">Configuration</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Threshold</span>
                      <span className="font-mono text-sm font-medium">
                        {threshold}/{memberCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Members</span>
                      <span className="text-sm font-medium">{memberCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Network</span>
                      <span className="text-sm font-medium">{chain.chainDisplayName}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Keyboard Shortcuts */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                      {/* Label */} Power User Tips
                    </CardTitle>
                    <div className="font-heading text-lg font-semibold">Shortcuts</div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quick Commands</span>
                      <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">⌘K</kbd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">New Transaction</span>
                      <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">N</kbd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Copy Address</span>
                      <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">C</kbd>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          {hostedMultisig.hosted === "db+chain" && cliqAddress && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>View and manage all transactions for this Cliq.</CardDescription>
                </div>
                <Link href={`/${chain.registryName}/${cliqAddress}/transaction/new`}>
                  <Button variant="action-outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
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
                Cliq Members ({memberCount})
              </CardTitle>
              <CardDescription>
                {threshold} of {memberCount} signatures required to approve transactions.
              </CardDescription>
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
                    className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
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

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cliq Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Address
                  </p>
                  <p className="break-all font-mono text-sm">{cliqAddress}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Network
                  </p>
                  <p className="text-sm">{chain.chainDisplayName}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Chain ID
                  </p>
                  <p className="font-mono text-sm">{chain.chainId}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${hostedMultisig.hosted === "db+chain" ? "bg-green-accent" : "bg-yellow-500"
                        }`}
                    />
                    <span className="text-sm">
                      {hostedMultisig.hosted === "db+chain" ? "Active on chain" : "Pending funding"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyButton
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 px-4 py-3"
                  value={cliqAddress || ""}
                  copyLabel="Cliq address"
                >
                  <span className="text-sm font-medium">Copy Cliq Address</span>
                </CopyButton>
                {explorerLink && (
                  <Button variant="outline" className="w-full justify-start gap-3" asChild>
                    <a href={explorerLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      View on Explorer
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab("members")}
                >
                  <Users className="h-4 w-4" />
                  View Members
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
