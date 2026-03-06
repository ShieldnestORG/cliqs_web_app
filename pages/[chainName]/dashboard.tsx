/**
 * Chain Dashboard Page
 *
 * File: pages/[chainName]/dashboard.tsx
 *
 * Dashboard for managing Cliqs (multisigs) on a specific chain.
 */

import { Button } from "@/components/ui/button";
import { useChains } from "@/context/ChainsContext";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Shield,
  Users,
  ArrowRight,
  Plus,
  Search,
  Layers,
  Globe,
  Settings,
  LayoutGrid,
  ShieldPlus,
  RefreshCw,
  Info,
} from "lucide-react";
import { BentoGrid, BentoActionCard } from "@/components/ui/bento-grid";
import { Input } from "@/components/ui/input";
import DashboardLayout, {
  DashboardSection,
  QuickStat,
  QuickStatsRow,
} from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FindMultisigForm from "@/components/forms/FindMultisigForm";
import ListUserCliqs from "@/components/dataViews/ListUserCliqs";
import { useWallet } from "@/context/WalletContext";
import { getAssociatedValidators, ValidatorInfo } from "@/lib/validatorHelpers";
import { getDbUserMultisigs } from "@/lib/api";
import { getUserSettings } from "@/lib/settingsStorage";
import { AddressDisplay } from "@/components/ui/address-display";

const DashboardPage = () => {
  const { chain } = useChains();
  const { walletInfo, verificationSignature, verify } = useWallet();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("cliqs");
  const [associatedValidators, setAssociatedValidators] = useState<
    { address: string; validator: ValidatorInfo }[]
  >([]);
  const [isLoadingValidators, setIsLoadingValidators] = useState(false);
  const [cliqFetchError, setCliqFetchError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAddress.trim()) {
      router.push(`/${chain.registryName}/validator?address=${manualAddress.trim()}`);
    }
  };

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

  // Handle tab query parameter
  useEffect(() => {
    const tab = router.query.tab as string;
    if (tab && ["overview", "cliqs", "find"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [router.query.tab]);

  const quickActions = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Validator Dashboard",
      description: "Manage rewards and monitor performance",
      href: chain.registryName ? `/${chain.registryName}/validator` : undefined,
    },
    {
      icon: <ShieldPlus className="h-6 w-6" />,
      title: "Create CLIQ",
      description: "Create a new CLIQ with your team",
      href: chain.registryName ? `/${chain.registryName}/create` : undefined,
    },
    {
      icon: <Search className="h-6 w-6" />,
      title: "Find CLIQ",
      description: "Look up an existing CLIQ",
      action: () => setActiveTab("find"),
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "My CLIQS",
      description: "View your CLIQ wallets",
      action: () => setActiveTab("cliqs"),
    },
  ];

  return (
    <DashboardLayout title={`${chain.chainDisplayName || "Cosmos"} Dashboard`} variant="wide">
      {/* Hero Section - Compact */}
      <div className="mb-8">
        {associatedValidators.length > 0 ? (
          <div className="mb-6 space-y-3">
            {associatedValidators.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-between gap-4 rounded-xl border border-green-accent/30 bg-green-accent/10 p-4 animate-in fade-in slide-in-from-top-4 sm:flex-row"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-accent/20">
                    <Shield className="h-5 w-5 text-green-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground">
                      Validator Associated:{" "}
                      <span className="text-green-accent">{item.validator.moniker}</span>
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
          <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-foreground">
                  CLIQ Validators Not Loaded
                </h3>
                <p className="text-sm text-muted-foreground">
                  Could not load CLIQ-based validators. Verify your wallet in Settings or retry.
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
        {!associatedValidators.length && walletInfo && !isLoadingValidators ? (
          <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/30 p-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">No Validator Detected</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your validator manually by entering its account address.
                </p>
              </div>
            </div>
            <form onSubmit={handleManualSearch} className="flex w-full gap-2 sm:w-auto">
              <Input
                placeholder="Enter CLIQ or account address"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="h-9 max-w-[240px] font-mono text-xs"
              />
              <Button type="submit" variant="outline" size="sm">
                Check
              </Button>
            </form>
          </div>
        ) : null}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-accent/30 bg-green-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-green-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-accent" />
              {chain.chainDisplayName || "Cosmos"} Network
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Manage your CLIQS on {chain.chainDisplayName || "Cosmos"}. Create CLIQS, propose
              transactions, and coordinate with your team.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {chain.registryName && (
              <Link href={`/${chain.registryName}/create`}>
                <Button variant="action" size="action-lg" className="group gap-2">
                  <ShieldPlus className="h-4 w-4" />
                  New CLIQ
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <QuickStatsRow className="mb-6">
          <QuickStat
            label="Network"
            value={chain.chainDisplayName || "—"}
            icon={<Globe className="h-5 w-5 text-muted-foreground" />}
          />
          <QuickStat
            label="Chain ID"
            value={chain.chainId?.slice(0, 12) || "—"}
            icon={<Layers className="h-5 w-5 text-muted-foreground" />}
          />
          <QuickStat
            label="Status"
            value="Online"
            icon={<Shield className="h-5 w-5 text-green-accent" />}
            trend={{ value: "Connected", direction: "up" }}
          />
          <QuickStat
            label="Prefix"
            value={chain.addressPrefix || "—"}
            icon={<Settings className="h-5 w-5 text-muted-foreground" />}
          />
        </QuickStatsRow>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto bg-muted/50 p-1">
          <TabsTrigger
            value="cliqs"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">My CLIQS</span>
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="find"
            className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Find</span>
          </TabsTrigger>
        </TabsList>

        {/* My CLIQS Tab */}
        <TabsContent value="cliqs" className="mt-6">
          <div className="max-w-6xl">
            <ListUserCliqs />
          </div>
        </TabsContent>

        {/* Overview Tab - Bento Grid */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Quick Actions Grid */}
          <DashboardSection title="Quick Actions">
            <BentoGrid className="auto-rows-[140px] grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action, idx) =>
                action.href ? (
                  <Link key={idx} href={action.href} className="block">
                    <BentoActionCard
                      icon={action.icon}
                      title={action.title}
                      description={action.description}
                      className="h-full"
                    />
                  </Link>
                ) : (
                  <BentoActionCard
                    key={idx}
                    icon={action.icon}
                    title={action.title}
                    description={action.description}
                    onClick={action.action}
                    className="h-full"
                  />
                ),
              )}
            </BentoGrid>
          </DashboardSection>
        </TabsContent>

        {/* Find Tab */}
        <TabsContent value="find" className="mt-6" id="find">
          <div className="max-w-6xl space-y-6">
            <FindMultisigForm />

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldPlus className="h-4 w-4 text-green-accent" />
                  Don&apos;t have a CLIQ yet?
                </CardTitle>
                <CardDescription>
                  Create a new CLIQ to start managing shared funds with your team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chain.registryName && (
                  <Link href={`/${chain.registryName}/create`}>
                    <Button variant="action-outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create New CLIQ
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DashboardPage;
