/**
 * Unified Operations Page
 * 
 * File: pages/[chainName]/operations.tsx
 * 
 * A unified view showing both CLIQ transactions and validator management in one place.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { getDbUserMultisigs, FetchedMultisigs, getPendingDbTxs } from "@/lib/api";
import { getAssociatedValidators, ValidatorInfo } from "@/lib/validatorHelpers";
import { DbTransaction } from "@/graphql/transaction";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardLabel, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Wallet,
  FileText,
  Activity,
  RefreshCw,
  Loader2,
  PenLine,
} from "lucide-react";
import Image from "next/image";

interface CliqWithValidator {
  address: string;
  threshold: number;
  memberCount: number;
  name?: string;
  isValidator: boolean;
  validator?: ValidatorInfo;
  pendingTxCount: number;
  pendingTxs: DbTransaction[];
}

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

interface OperationsData {
  cliqs: CliqWithValidator[];
  totalPendingTxs: number;
  validatorCount: number;
}

interface PendingTxWithCliq extends DbTransaction {
  cliqAddress: string;
  isValidator: boolean;
}

export default function OperationsPage() {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, connectKeplr, connectLedger, loading } = useWallet();
  const router = useRouter();

  const [operationsData, setOperationsData] = useState<OperationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Initialize tab from query parameter
  const queryTab = router.query.tab as string | undefined;
  const [activeTab, setActiveTab] = useState("overview");

  // Update active tab when query changes
  useEffect(() => {
    if (queryTab && ["overview", "pending", "validators", "cliqs"].includes(queryTab)) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!walletInfo?.address || !chain.nodeAddress) {
      setIsLoading(false);
      return;
    }

    try {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // 1. Get user's CLIQs
      let multisigs: FetchedMultisigs = { created: [], belonged: [] };
      try {
        multisigs = await getDbUserMultisigs(chain, {
          address: walletInfo.address,
          pubkey: walletInfo.pubKey,
          signature: verificationSignature || undefined,
        });
      } catch (e) {
        console.log("Could not fetch CLIQs:", e);
      }

      // Deduplicate CLIQs (user may both create and belong to same CLIQ)
      const cliqMap = new Map<string, (typeof multisigs.created)[number]>();
      for (const cliq of [...multisigs.created, ...multisigs.belonged]) {
        if (!cliqMap.has(cliq.address)) {
          cliqMap.set(cliq.address, cliq);
        }
      }
      const allCliqs = Array.from(cliqMap.values());
      const cliqAddresses = allCliqs.map((m) => m.address);

      // 2. Check which CLIQs are validators (always check wallet + CLIQs)
      let validators: { address: string; validator: ValidatorInfo }[] = [];
      try {
        validators = await getAssociatedValidators(
          chain.nodeAddress,
          walletInfo.address,
          cliqAddresses,
          chain.addressPrefix
        );
      } catch (e) {
        console.log("Could not check validators:", e);
      }

      const validatorMap = new Map(validators.map((v) => [v.address, v.validator]));

      // 3. Get pending transactions for each CLIQ
      const cliqsWithData: CliqWithValidator[] = await Promise.all(
        allCliqs.map(async (cliq) => {
          let pendingTxs: DbTransaction[] = [];
          try {
            pendingTxs = (await getPendingDbTxs(cliq.address, chain.chainId)) as DbTransaction[];
          } catch (e) {
            console.log(`Could not fetch pending txs for ${cliq.address}:`, e);
          }

          const { threshold, memberCount } = parseMultisigPubkey(cliq.pubkeyJSON);

          return {
            address: cliq.address,
            threshold,
            memberCount,
            name: cliq.name || undefined,
            isValidator: validatorMap.has(cliq.address),
            validator: validatorMap.get(cliq.address),
            pendingTxCount: pendingTxs.length,
            pendingTxs,
          };
        })
      );

      // Sort: validators first, then by pending tx count
      cliqsWithData.sort((a, b) => {
        if (a.isValidator && !b.isValidator) return -1;
        if (!a.isValidator && b.isValidator) return 1;
        return b.pendingTxCount - a.pendingTxCount;
      });

      setOperationsData({
        cliqs: cliqsWithData,
        totalPendingTxs: cliqsWithData.reduce((sum, c) => sum + c.pendingTxCount, 0),
        validatorCount: cliqsWithData.filter((c) => c.isValidator).length,
      });
    } catch (e) {
      console.error("Failed to fetch operations data:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [walletInfo?.address, walletInfo?.pubKey, verificationSignature, chain]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Not connected
  if (!walletInfo) {
    return (
      <DashboardLayout title="My Operations" variant="wide">
        <Card variant="institutional" bracket="green" className="max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-accent/20 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-green-accent" />
            </div>
            <CardLabel comment className="justify-center">Operations Hub</CardLabel>
            <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
            <CardDescription className="text-base">
              Connect your wallet to view your CLIQs, pending transactions, and validator operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={connectKeplr} 
                disabled={loading.keplr || loading.ledger} 
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
              >
                {loading.keplr ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Image
                    alt="Keplr"
                    src="/assets/icons/keplr.svg"
                    width={24}
                    height={24}
                  />
                )}
                <span className="text-sm">Keplr</span>
              </Button>
              <Button 
                onClick={connectLedger} 
                disabled={loading.keplr || loading.ledger} 
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
              >
                {loading.ledger ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Image
                    alt="Ledger"
                    src="/assets/icons/ledger.svg"
                    width={24}
                    height={24}
                    className="bg-white p-0.5 rounded"
                  />
                )}
                <span className="text-sm">Ledger</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout title="My Operations" variant="wide">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const { cliqs, totalPendingTxs, validatorCount } = operationsData || { cliqs: [], totalPendingTxs: 0, validatorCount: 0 };
  const pendingTxs: PendingTxWithCliq[] = cliqs.flatMap((c) =>
    c.pendingTxs.map((tx) => ({ ...tx, cliqAddress: c.address, isValidator: c.isValidator }))
  );

  return (
    <DashboardLayout title="My Operations" variant="wide">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">My Operations</h1>
            <p className="text-muted-foreground">
              Manage your CLIQs and validators in one place
            </p>
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="institutional" className="bg-gradient-to-br from-green-accent/10 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-accent/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-accent" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{cliqs.length}</p>
                  <p className="text-xs text-muted-foreground">Total CLIQs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="institutional" className="bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{validatorCount}</p>
                  <p className="text-xs text-muted-foreground">Validator CLIQs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="institutional" className={totalPendingTxs > 0 ? "bg-gradient-to-br from-orange-500/10 to-transparent" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalPendingTxs > 0 ? "bg-orange-500/20" : "bg-muted"}`}>
                  <Clock className={`h-5 w-5 ${totalPendingTxs > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{totalPendingTxs}</p>
                  <p className="text-xs text-muted-foreground">Pending Signatures</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="institutional">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-mono truncate max-w-[120px]" title={walletInfo.address}>
                    {walletInfo.address.slice(0, 8)}...{walletInfo.address.slice(-6)}
                  </p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger
              value="overview"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pending</span>
              {totalPendingTxs > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-orange-500/20 text-orange-500">
                  {totalPendingTxs}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="validators"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Validators</span>
              {validatorCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {validatorCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="cliqs"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">All CLIQs</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Pending Transactions Alert */}
            {totalPendingTxs > 0 && (
              <Card variant="institutional" className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold">Action Required</h3>
                        <p className="text-sm text-muted-foreground">
                          You have {totalPendingTxs} pending transaction{totalPendingTxs > 1 ? "s" : ""} awaiting signature
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("pending")} className="gap-2">
                      View All
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Access Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Validator CLIQs */}
              <Card variant="institutional" accent="left">
                <CardHeader>
                  <CardLabel>Quick Access</CardLabel>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-accent" />
                    Validator Operations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cliqs.filter(c => c.isValidator).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No validator CLIQs found</p>
                      <p className="text-xs mt-1">Create a CLIQ to manage your validator</p>
                    </div>
                  ) : (
                    cliqs.filter(c => c.isValidator).map((cliq) => (
                      <Link 
                        key={cliq.address} 
                        href={`/${chain.registryName}/validator?address=${cliq.address}`}
                        className="block"
                      >
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-green-accent/50 hover:bg-green-accent/5 transition-all group">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-green-accent/20 flex items-center justify-center shrink-0">
                                <Shield className="h-5 w-5 text-green-accent" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-heading font-bold truncate">
                                  {cliq.validator?.moniker || "Validator"}
                                </h4>
                                <p className="text-xs text-muted-foreground font-mono truncate">
                                  {cliq.address.slice(0, 10)}...{cliq.address.slice(-6)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {cliq.pendingTxCount > 0 && (
                                <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">
                                  {cliq.pendingTxCount} pending
                                </Badge>
                              )}
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-green-accent transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Recent Pending Transactions */}
              <Card variant="institutional">
                <CardHeader>
                  <CardLabel>Recent</CardLabel>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Pending Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingTxs.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50 text-green-accent" />
                      <p className="text-sm">All caught up!</p>
                      <p className="text-xs mt-1">No pending transactions</p>
                    </div>
                  ) : (
                    pendingTxs.slice(0, 3).map((tx) => (
                      <Link 
                        key={tx.id} 
                        href={`/${chain.registryName}/${tx.cliqAddress}/transaction/${tx.id}`}
                        className="block"
                      >
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/50 transition-all group">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <PenLine className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-heading font-semibold text-sm">
                                    Transaction
                                  </h4>
                                  {tx.isValidator && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-accent/50 text-green-accent">
                                      Validator
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground font-mono truncate">
                                  {tx.cliqAddress.slice(0, 10)}...{tx.cliqAddress.slice(-6)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-orange-500/20 text-orange-500 text-xs">
                                {tx.signatures?.length || 0} sig{(tx.signatures?.length || 0) !== 1 ? "s" : ""}
                              </Badge>
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                  {pendingTxs.length > 3 && (
                    <Button variant="ghost" className="w-full" onClick={() => setActiveTab("pending")}>
                      View all {pendingTxs.length} pending transactions
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pending Transactions Tab */}
          <TabsContent value="pending" className="space-y-4">
            {pendingTxs.length === 0 ? (
              <Card variant="institutional" className="max-w-4xl mx-auto">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-accent opacity-50" />
                  <h3 className="font-heading font-bold text-lg mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground">No pending transactions require your signature.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingTxs.map((tx) => {
                  const cliq = cliqs.find((c) => c.address === tx.cliqAddress);
                  let parsedData;
                  try {
                    parsedData = JSON.parse(tx.dataJSON);
                  } catch {}

                  return (
                    <Link 
                      key={tx.id} 
                      href={`/${chain.registryName}/${tx.cliqAddress}/transaction/${tx.id}`}
                      className="block"
                    >
                      <Card variant="institutional" className="hover:border-primary/50 transition-all">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tx.isValidator ? "bg-green-accent/20" : "bg-muted"}`}>
                                {tx.isValidator ? (
                                  <Shield className="h-6 w-6 text-green-accent" />
                                ) : (
                                  <FileText className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-heading font-bold">
                                    {tx.isValidator ? cliq?.validator?.moniker || "Validator Transaction" : "CLIQ Transaction"}
                                  </h4>
                                  {parsedData?.msgs?.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {parsedData.msgs.length} msg{parsedData.msgs.length > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground font-mono truncate">
                                  {tx.cliqAddress}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {cliq?.threshold || "?"}/{cliq?.memberCount || "?"} threshold
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <PenLine className="h-3 w-3" />
                                    {tx.signatures?.length || 0} signature{(tx.signatures?.length || 0) !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">
                                Pending
                              </Badge>
                              <Button variant="ghost" size="sm" className="gap-2">
                                Sign
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Validators Tab */}
          <TabsContent value="validators" className="space-y-4">
            {cliqs.filter(c => c.isValidator).length === 0 ? (
              <Card variant="institutional" className="max-w-4xl mx-auto">
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-heading font-bold text-lg mb-2">No Validator CLIQs</h3>
                  <p className="text-muted-foreground mb-4">
                    None of your CLIQs are operating as validators on this chain.
                  </p>
                  <Link href={`/${chain.registryName}/create`}>
                    <Button variant="action">Create a CLIQ</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cliqs.filter(c => c.isValidator).map((cliq) => (
                  <Card key={cliq.address} variant="institutional" bracket="green">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-green-accent/20 flex items-center justify-center">
                            <Shield className="h-6 w-6 text-green-accent" />
                          </div>
                          <div>
                            <CardTitle>{cliq.validator?.moniker || "Validator"}</CardTitle>
                            <p className="text-xs text-muted-foreground font-mono">
                              {cliq.address.slice(0, 12)}...{cliq.address.slice(-8)}
                            </p>
                          </div>
                        </div>
                        {cliq.pendingTxCount > 0 && (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">
                            {cliq.pendingTxCount} pending
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Threshold</p>
                          <p className="font-semibold">{cliq.threshold} of {cliq.memberCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Status</p>
                          <p className="font-semibold flex items-center gap-1">
                            {cliq.validator?.jailed ? (
                              <span className="text-destructive">Jailed</span>
                            ) : (
                              <span className="text-green-accent">Active</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/${chain.registryName}/validator?address=${cliq.address}`} className="flex-1">
                          <Button variant="action" className="w-full gap-2">
                            <Shield className="h-4 w-4" />
                            Manage Validator
                          </Button>
                        </Link>
                        <Link href={`/${chain.registryName}/${cliq.address}`}>
                          <Button variant="outline" className="gap-2">
                            <Users className="h-4 w-4" />
                            CLIQ
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* All CLIQs Tab */}
          <TabsContent value="cliqs" className="space-y-4">
            {cliqs.length === 0 ? (
              <Card variant="institutional" className="max-w-4xl mx-auto">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-heading font-bold text-lg mb-2">No CLIQs Found</h3>
                  <p className="text-muted-foreground mb-4">
                    You're not a member of any CLIQs on this chain yet.
                  </p>
                  <Link href={`/${chain.registryName}/create`}>
                    <Button variant="action">Create Your First CLIQ</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {cliqs.map((cliq) => (
                  <Link key={cliq.address} href={`/${chain.registryName}/${cliq.address}`} className="block">
                    <Card variant="institutional" className="hover:border-primary/50 transition-all">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cliq.isValidator ? "bg-green-accent/20" : "bg-muted"}`}>
                              {cliq.isValidator ? (
                                <Shield className="h-6 w-6 text-green-accent" />
                              ) : (
                                <Users className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-heading font-bold">
                                  {cliq.isValidator 
                                    ? cliq.validator?.moniker 
                                    : cliq.name || "CLIQ"}
                                </h4>
                                {cliq.isValidator && (
                                  <Badge variant="outline" className="text-xs border-green-accent/50 text-green-accent">
                                    Validator
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground font-mono truncate">
                                {cliq.address}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {cliq.threshold} of {cliq.memberCount} threshold
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {cliq.pendingTxCount > 0 && (
                              <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">
                                {cliq.pendingTxCount} pending
                              </Badge>
                            )}
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
