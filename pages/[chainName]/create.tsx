/**
 * Create Cliq Page
 * 
 * File: pages/[chainName]/create.tsx
 * 
 * Page for creating a new Cliq (multisig group).
 * Supports three multisig types:
 * - PubKey Multisig: Traditional Cosmos SDK multisig (address derived from pubkeys)
 * - Contract Fixed: CW3-Fixed smart contract multisig (stable address, fixed members)
 * - Contract Flex: CW3-Flex + CW4-Group multisig (stable address, dynamic membership)
 * 
 * Phase 2: Added Flex multisig support
 */

import CreateCliqForm from "@/components/forms/CreateCliqForm";
import CreateContractCliqForm from "@/components/forms/CreateContractCliqForm";
import CreateFlexCliqForm from "@/components/forms/CreateFlexCliqForm";
import Head from "@/components/head";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useChains } from "@/context/ChainsContext";
import Link from "next/link";
import { useState } from "react";
import { 
  Users, 
  Key, 
  FileCode2, 
  Shield, 
  RefreshCw, 
  Wallet,
  Info,
  UserPlus,
} from "lucide-react";

type MultisigType = "pubkey" | "contract" | "flex";

export default function CreateCliqPage() {
  const { chain } = useChains();
  const [multisigType, setMultisigType] = useState<MultisigType>("pubkey");

  return (
    <div className="container mx-auto px-[0.75in] py-8 max-w-[1600px]">
      <Head title={`Create Cliq - ${chain.chainDisplayName || "Cosmos"}`} />
      
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${chain.registryName || ""}`}>Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Create Cliq
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Multisig Type Selection */}
        <Tabs value={multisigType} onValueChange={(v) => setMultisigType(v as MultisigType)}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create a CLIQ</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your multisig type based on your security needs
                </p>
              </div>
            </div>

            {/* Type Comparison Card */}
            <Card className="bg-muted/30 border-border">
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  {/* PubKey Features */}
                  <div 
                    onClick={() => setMultisigType("pubkey")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setMultisigType("pubkey")}
                    className={`p-4 rounded-lg border transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "pubkey" 
                        ? "bg-card border-primary shadow-sm" 
                        : "bg-background/50 border-border hover:bg-background/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${
                        multisigType === "pubkey" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <Key className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">PubKey</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Shield className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "pubkey" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Maximum security</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Wallet className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "pubkey" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Cold storage ready</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                        <span>Address changes on rotation</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contract Fixed Features */}
                  <div 
                    onClick={() => setMultisigType("contract")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setMultisigType("contract")}
                    className={`p-4 rounded-lg border transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "contract" 
                        ? "bg-card border-primary shadow-sm" 
                        : "bg-background/50 border-border hover:bg-background/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${
                        multisigType === "contract" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <FileCode2 className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">Fixed</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <RefreshCw className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "contract" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Stable address</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "contract" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Weighted voting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                        <span>Fixed member set</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contract Flex Features */}
                  <div 
                    onClick={() => setMultisigType("flex")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setMultisigType("flex")}
                    className={`p-4 rounded-lg border transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "flex" 
                        ? "bg-card border-primary shadow-sm" 
                        : "bg-background/50 border-border hover:bg-background/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${
                        multisigType === "flex" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">Flex</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <RefreshCw className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Stable address</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <UserPlus className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Dynamic membership</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield className={`h-4 w-4 mt-0.5 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span>Audit-grade snapshots</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forms */}
            <TabsContent value="pubkey" className="mt-0">
              <CreateCliqForm />
            </TabsContent>

            <TabsContent value="contract" className="mt-0">
              <CreateContractCliqForm />
            </TabsContent>

            <TabsContent value="flex" className="mt-0">
              <CreateFlexCliqForm />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
