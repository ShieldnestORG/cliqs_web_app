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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useChains } from "@/context/ChainsContext";
import Link from "next/link";
import { useState } from "react";
import { Users, Key, FileCode2, Shield, RefreshCw, Wallet, Info, UserPlus } from "lucide-react";

type MultisigType = "pubkey" | "contract" | "flex";

export default function CreateCliqPage() {
  const { chain } = useChains();
  const [multisigType, setMultisigType] = useState<MultisigType>("pubkey");

  return (
    <div className="container mx-auto max-w-[1600px] px-[0.75in] py-8">
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create a CLIQ</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose your multisig type based on your security needs
                </p>
              </div>
            </div>

            {/* Type Comparison Card */}
            <Card className="border-border bg-muted/30">
              <CardContent className="p-4">
                <div className="grid gap-4 text-sm sm:grid-cols-3">
                  {/* PubKey Features */}
                  <div
                    onClick={() => setMultisigType("pubkey")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setMultisigType("pubkey")}
                    className={`cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "pubkey"
                        ? "border-primary bg-card shadow-sm"
                        : "border-border bg-background/50 hover:bg-background/80"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={`rounded-lg p-1.5 ${
                          multisigType === "pubkey"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Key className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">PubKey</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Shield
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "pubkey" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Maximum security</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Wallet
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "pubkey" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Cold storage ready</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                        <span>Address changes on rotation</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contract Fixed Features */}
                  <div
                    onClick={() => setMultisigType("contract")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setMultisigType("contract")}
                    className={`cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "contract"
                        ? "border-primary bg-card shadow-sm"
                        : "border-border bg-background/50 hover:bg-background/80"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={`rounded-lg p-1.5 ${
                          multisigType === "contract"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <FileCode2 className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">Fixed</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <RefreshCw
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "contract" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Stable address</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "contract" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Weighted voting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                        <span>Fixed member set</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contract Flex Features */}
                  <div
                    onClick={() => setMultisigType("flex")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setMultisigType("flex")}
                    className={`cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      multisigType === "flex"
                        ? "border-primary bg-card shadow-sm"
                        : "border-border bg-background/50 hover:bg-background/80"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={`rounded-lg p-1.5 ${
                          multisigType === "flex"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">Flex</h3>
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <RefreshCw
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Stable address</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <UserPlus
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
                        <span>Dynamic membership</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield
                          className={`mt-0.5 h-4 w-4 shrink-0 ${multisigType === "flex" ? "text-primary" : "text-muted-foreground/60"}`}
                        />
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
