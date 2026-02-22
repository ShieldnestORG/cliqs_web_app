/**
 * Chain Dashboard Page
 * 
 * File: pages/[chainName]/dashboard.tsx
 * 
 * Dashboard for managing Cliqs (multisigs) on a specific chain.
 */

import { Button } from "@/components/ui/button";
import { useChains } from "@/context/ChainsContext";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  BentoGrid,
  BentoActionCard,
} from "@/components/ui/bento-grid";
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
import { 
  getValidatorInfo, 
  delegatorToValidatorAddress, 
  getAssociatedValidators,
  ValidatorInfo 
} from "@/lib/validatorHelpers";
import { getDbUserMultisigs } from "@/lib/api";

const DashboardPage = () => {
  const { chain } = useChains();
  const { walletInfo, verificationSignature } = useWallet();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("cliqs");
  const [associatedValidators, setAssociatedValidators] = useState<{ address: string; validator: ValidatorInfo }[]>([]);
  const [isLoadingValidators, setIsLoadingValidators] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAddress.trim()) {
      router.push(`/${chain.registryName}/validator?address=${manualAddress.trim()}`);
    }
  };

  // Check for associated validators
  useEffect(() => {
    async function checkValidators() {
      if (!walletInfo?.address || !chain.nodeAddress || !chain.addressPrefix) {
        setAssociatedValidators([]);
        return;
      }

      try {
        setIsLoadingValidators(true);
        
        // 1. Try to get multisigs for this user from DB
        // This can fail if the account isn't on-chain yet, which is okay
        let cliqAddresses: string[] = [];
        try {
          const multisigs = await getDbUserMultisigs(chain, {
            address: walletInfo.address,
            pubkey: walletInfo.pubKey,
            signature: verificationSignature || undefined,
          });
          
          cliqAddresses = [
            ...multisigs.created.map(m => m.address),
            ...multisigs.belonged.map(m => m.address)
          ];
        } catch (e) {
          // Account might not be on chain - that's okay, we'll still check the wallet address
          console.log("Could not fetch CLIQs (account may not be on chain):", e);
        }

        // 2. Check each address (direct and multisig) if it's a validator
        const validators = await getAssociatedValidators(
          chain.nodeAddress,
          walletInfo.address,
          cliqAddresses,
          chain.addressPrefix
        );
        
        setAssociatedValidators(validators);
      } catch (e) {
        console.error("Failed to check validators:", e);
      } finally {
        setIsLoadingValidators(false);
      }
    }
    checkValidators();
  }, [walletInfo?.address, chain.nodeAddress, chain.addressPrefix, walletInfo?.pubKey, chain, verificationSignature]);

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
              <div key={idx} className="p-4 rounded-xl bg-green-accent/10 border border-green-accent/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-accent/20 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-green-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground">
                      Validator Associated: <span className="text-green-accent">{item.validator.moniker}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {item.address === walletInfo?.address 
                        ? "Detected via your connected wallet." 
                        : `Detected via CLIQ: ${item.address.slice(0, 8)}...${item.address.slice(-8)}`}
                    </p>
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
        ) : walletInfo && !isLoadingValidators ? (
          <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">No Validator Detected</h3>
                <p className="text-sm text-muted-foreground">Manage your validator manually by entering its account address.</p>
              </div>
            </div>
            <form onSubmit={handleManualSearch} className="flex gap-2 w-full sm:w-auto">
              <Input 
                placeholder="Enter CLIQ or account address" 
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="max-w-[240px] h-9 text-xs font-mono"
              />
              <Button type="submit" variant="outline" size="sm">
                Check
              </Button>
            </form>
          </div>
        ) : null}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-accent/10 border border-green-accent/30 text-xs font-mono uppercase tracking-wider text-green-accent mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-accent animate-pulse" />
              {chain.chainDisplayName || "Cosmos"} Network
            </div>
            <h1 className="text-3xl lg:text-4xl font-heading font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Manage your CLIQS on {chain.chainDisplayName || "Cosmos"}. Create CLIQS, propose transactions, and coordinate with your team.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {chain.registryName && (
              <Link href={`/${chain.registryName}/create`}>
                <Button variant="action" size="action-lg" className="gap-2 group">
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
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger
            value="cliqs"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">My CLIQS</span>
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="find"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5"
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
            <BentoGrid className="grid-cols-2 lg:grid-cols-4 auto-rows-[140px]">
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
                )
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
                <CardTitle className="text-base flex items-center gap-2">
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
