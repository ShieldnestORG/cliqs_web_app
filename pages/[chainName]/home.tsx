/**
 * Chain Home Page
 *
 * File: pages/[chainName]/index.tsx
 *
 * Landing page for a specific chain with Cliq creation and discovery.
 */

import Head from "@/components/head";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardLabel,
} from "@/components/ui/card";
import { useChains } from "@/context/ChainsContext";
import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  FileCheck,
  ArrowRight,
  Search,
  Wallet,
  Layers,
  Globe,
  CheckCircle2,
  ShieldPlus,
  Award,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FindMultisigForm from "@/components/forms/FindMultisigForm";
import ListUserCliqs from "@/components/dataViews/ListUserCliqs";

const ChainHomePage = () => {
  const { chain } = useChains();
  const [activeTab, setActiveTab] = useState("find");

  const features = [
    {
      icon: Users,
      title: "Form Your Cliq",
      description:
        "Create a trusted cliq with verified members. Set your signing threshold for collective decision-making.",
    },
    {
      icon: FileCheck,
      title: "Create Transactions",
      description:
        "Propose transactions with multiple operations. Send tokens, stake, vote, or perform IBC transfers.",
    },
    {
      icon: Shield,
      title: "Sign & Execute",
      description:
        "Cliq members sign transactions with their wallets. Once threshold is reached, broadcast securely on-chain.",
    },
  ];

  const benefits = [
    {
      icon: CheckCircle2,
      title: "Multi-Signature Security",
      description:
        "No single point of failure. Require multiple approvals for sensitive transactions.",
    },
    {
      icon: Layers,
      title: "Team Treasury Management",
      description: "Perfect for DAOs, teams, and organizations managing shared funds.",
    },
    {
      icon: Globe,
      title: "Cross-Chain Ready",
      description: "Built-in IBC support for transfers across the Cosmos ecosystem.",
    },
    {
      icon: Wallet,
      title: "Easy Wallet Integration",
      description: "Connect your Keplr or Ledger wallet with a single click.",
    },
  ];

  return (
    <div className="flex w-full flex-col">
      <Head title={`${chain.chainDisplayName || "Cosmos"} CLIQ Manager`} />

      {/* Hero Section */}
      <section className="section-wrapper bg-pattern-dots">
        <div className="section-inner max-w-6xl space-y-6 py-8 text-center">
          {/* Label */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 animate-status-pulse rounded-full bg-green-accent" />
            {chain.chainDisplayName || "Cosmos"} Network
          </div>

          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {chain.chainDisplayName || "Cosmos"}{" "}
            <span className="cliqs-brand text-green-accent">CLIQS</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Create your CLIQ. A CLIQ is a shared wallet where multiple signatures are required—
            perfect for teams, DAOs, or shared treasuries.
          </p>

          <div className="flex flex-col justify-center gap-4 pt-6 sm:flex-row">
            {chain.registryName && (
              <Link href={`/${chain.registryName}/create`}>
                <Button variant="action" size="action-lg" className="group w-full gap-3 sm:w-auto">
                  <ShieldPlus className="h-4 w-4" />
                  Create <span className="cliqs-brand">CLIQ</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
            {chain.registryName && (
              <Link href={`/${chain.registryName}/validator`}>
                <Button
                  variant="action-outline"
                  size="action-lg"
                  className="w-full gap-2 sm:w-auto"
                >
                  <Award className="h-4 w-4" />
                  Validator Tools
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="section-wrapper bg-muted/20">
        <div className="section-inner max-w-6xl">
          <div className="mb-10 text-center">
            <CardLabel comment className="mb-3 justify-center">
              How It Works
            </CardLabel>
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Simple & Secure Process</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  variant="institutional"
                  bracket="green"
                  hover
                  className="bg-card/80 backdrop-blur"
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-accent text-sm font-bold text-background">
                        {index + 1}
                      </div>
                      <div className="icon-container rounded-lg">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="mb-2 text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Forms Section - Tabbed */}
      <section className="section-wrapper">
        <div className="section-inner max-w-4xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-3 p-1">
              <TabsTrigger
                value="find"
                className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Find</span> Cliq
              </TabsTrigger>
              <TabsTrigger
                value="cliqs"
                className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">My</span> Cliqs
              </TabsTrigger>
              {chain.registryName && (
                <TabsTrigger
                  value="validator"
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  asChild
                >
                  <Link href={`/${chain.registryName}/validator`}>
                    <Award className="h-4 w-4" />
                    Validator
                  </Link>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="find" className="space-y-6">
              <FindMultisigForm />
            </TabsContent>

            <TabsContent value="cliqs">
              <ListUserCliqs />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="section-wrapper bg-muted/10">
        <div className="section-inner max-w-6xl">
          <div className="mb-10 text-center">
            <CardLabel comment className="mb-3 justify-center">
              Benefits
            </CardLabel>
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Why Use a CLIQ?</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={index}
                  className="flex gap-4 rounded-lg border border-border/50 bg-card/50 p-5 transition-all hover:border-green-accent/30 hover:bg-card/80"
                >
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-accent/20">
                      <Icon className="h-5 w-5 text-green-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-1 font-heading font-semibold text-foreground">
                      {benefit.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ready to Get Started CTA */}
      <section className="section-wrapper">
        <div className="section-inner max-w-6xl">
          <Card
            variant="institutional"
            bracket="green"
            className="bg-gradient-to-br from-card to-muted/30"
          >
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="max-w-xl">
                  <h3 className="mb-3 font-heading text-2xl font-bold md:text-3xl">
                    Ready to create your cliq?
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    Create a new Cliq or find an existing one to manage your{" "}
                    {chain.chainDisplayName || "Cosmos"} assets securely with your team.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  {chain.registryName && (
                    <Link href={`/${chain.registryName}/create`}>
                      <Button variant="action" size="action-lg" className="w-full gap-2 sm:w-auto">
                        <ShieldPlus className="h-4 w-4" />
                        Create <span className="cliqs-brand">CLIQ</span>
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="action-outline"
                    size="action-lg"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setActiveTab("find");
                      document
                        .querySelector(".section-wrapper:nth-child(3)")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Find Existing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default ChainHomePage;
