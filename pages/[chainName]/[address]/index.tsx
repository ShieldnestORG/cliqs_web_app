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
import DashboardLayout, {
  QuickStatsRow,
  QuickStat,
} from "@/components/layout/DashboardLayout";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { checkAddress } from "@/lib/displayHelpers";
import { getKeplrKey } from "@/lib/keplr";
import {
  HostedMultisig,
  createMultisigFromCompressedSecp256k1Pubkeys,
  getHostedMultisig,
} from "@/lib/multisigHelpers";
import { toastError } from "@/lib/utils";
import { isMultisigThresholdPubkey, isSecp256k1Pubkey, pubkeyToAddress } from "@cosmjs/amino";
import { assert } from "@cosmjs/utils";
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

        const newHostedMultisig = await getHostedMultisig(cliqAddress, chain);

        // If the cliq is on chain and not on DB, automatically create it on DB and reload the view
        if (newHostedMultisig.hosted === "chain" && newHostedMultisig.accountOnChain?.pubkey) {
          assert(
            isMultisigThresholdPubkey(newHostedMultisig.accountOnChain.pubkey),
            "Pubkey on chain is not of type MultisigThreshold",
          );

          const { bech32Address: address } = await getKeplrKey(chain.chainId);

          await createMultisigFromCompressedSecp256k1Pubkeys(
            newHostedMultisig.accountOnChain.pubkey.value.pubkeys.map((p) => p.value),
            Number(newHostedMultisig.accountOnChain.pubkey.value.threshold),
            chain.addressPrefix,
            chain.chainId,
            address,
          );

          router.reload();
        }

        setHostedMultisig(newHostedMultisig);
      } catch (e) {
        console.error("Failed to find cliq:", e);
        toastError({
          description: "Failed to find cliq",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    })();
    // Note: router is intentionally excluded from deps - it changes on every render
    // and we only use router.reload() which doesn't depend on router state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.chainId, chain.nodeAddress, chain.addressPrefix, cliqAddress]);

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
            <BreadcrumbPage className="font-mono text-xs flex items-center gap-1.5">
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-accent/20 to-green-accent/10 animate-pulse" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-green-accent" />
            </div>
            <div>
              <p className="font-medium">Loading your Cliq...</p>
              <p className="text-sm text-muted-foreground">
                {multisigTypeResult.isLoading ? "Detecting multisig type..." : "Fetching cliq information"}
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
        <div className="max-w-4xl mx-auto py-12">
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {checkAddress(cliqAddress || "", chain.addressPrefix) ? (
                <p>
                  This address doesn&apos;t appear to belong to {chain.chainDisplayName}{" "}
                  and wasn&apos;t found on the network or in our database.
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-accent/20 to-green-accent/10 border border-green-accent/30">
                <Users className="h-7 w-7 text-green-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">
                    Your CLIQ
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-accent/20 text-green-accent rounded-full">
                    {memberCount} members
                  </span>
                </div>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="font-mono truncate max-w-[200px] sm:max-w-none">
                    {cliqAddress}
                  </span>
                  <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                </button>
              </div>
            </div>
          </div>
          
          {hostedMultisig.hosted === "db+chain" && cliqAddress && (
            <div className="flex items-center gap-3 shrink-0">
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
                className={`h-3 w-3 rounded-full ${
                  hostedMultisig.hosted === "db+chain" ? "bg-green-accent" : "bg-yellow-500"
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
              Your Cliq needs to be funded. Send some tokens to its address so it appears on
              the network and can start transacting.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
                {/* Left Column - Treasury (compact) */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Treasury Card */}
                  <Card className="border-green-accent/50 card-bracket-corner">
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
                      <CardTitle className="text-sm text-muted-foreground font-normal uppercase tracking-wide">
                        {/* Label */} Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Link href={`/${chain.registryName}/${cliqAddress}/transaction/new`} className="block">
                        <Button variant="action" className="w-full justify-start gap-3">
                          <Plus className="h-4 w-4" />
                          New Transaction
                        </Button>
                      </Link>
                      <CopyButton
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-3 px-4"
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
                  <Card className="h-full min-h-[400px] flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Recent Activity Summary */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-normal uppercase tracking-wide">
                      {/* Label */} Recent Activity
                    </CardTitle>
                    <div className="text-lg font-heading font-semibold">Transaction History</div>
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
                    <CardTitle className="text-sm text-muted-foreground font-normal uppercase tracking-wide">
                      {/* Label */} Cliq Info
                    </CardTitle>
                    <div className="text-lg font-heading font-semibold">Configuration</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Threshold</span>
                      <span className="text-sm font-mono font-medium">{threshold}/{memberCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Members</span>
                      <span className="text-sm font-medium">{memberCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Network</span>
                      <span className="text-sm font-medium">{chain.chainDisplayName}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Keyboard Shortcuts */}
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-normal uppercase tracking-wide">
                      {/* Label */} Power User Tips
                    </CardTitle>
                    <div className="text-lg font-heading font-semibold">Shortcuts</div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Quick Commands</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">⌘K</kbd>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">New Transaction</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">N</kbd>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Copy Address</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">C</kbd>
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
                  <CardDescription>
                    View and manage all transactions for this Cliq.
                  </CardDescription>
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
                    className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-accent/20 to-green-accent/10 border border-green-accent/30 shrink-0">
                      <span className="text-sm font-bold text-green-accent">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm truncate">{memberAddress}</p>
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-accent/20 text-green-accent rounded">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Address
                  </p>
                  <p className="font-mono text-sm break-all">{cliqAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Network
                  </p>
                  <p className="text-sm">{chain.chainDisplayName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Chain ID
                  </p>
                  <p className="font-mono text-sm">{chain.chainId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        hostedMultisig.hosted === "db+chain"
                          ? "bg-green-accent"
                          : "bg-yellow-500"
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
                  className="w-full justify-start gap-3 h-auto py-3 px-4"
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
