/**
 * CLIQ Upgrade CTA Card
 *
 * File: components/dataViews/ValidatorDashboard/CliqUpgradeCTA.tsx
 *
 * Call-to-action card encouraging validators to upgrade to multisig security.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChains } from "@/context/ChainsContext";
import Link from "next/link";
import { Shield, Users, Lock, ArrowRight, ShieldPlus, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CliqUpgradeCTA() {
  const { chain } = useChains();

  const benefits = [
    {
      icon: Shield,
      title: "No Single Point of Failure",
      description: "Protect your validator operations with multiple keys",
    },
    {
      icon: Users,
      title: "Team-Based Management",
      description: "Distribute signing authority among trusted team members",
    },
    {
      icon: Lock,
      title: "Works With Existing Validator",
      description: "Set up a CLIQ without changing your validator setup",
    },
  ];

  return (
    <Card
      variant="institutional"
      bracket="purple"
      className="to-accent-purple/5 bg-gradient-to-br from-card"
    >
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="bg-accent-purple/20 border-accent-purple/30 text-accent-purple inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider">
              <ShieldPlus className="h-3 w-3" />
              Security Upgrade
            </div>

            <h3 className="font-heading text-2xl font-bold md:text-3xl">
              Secure Your Validator Operations
            </h3>

            <p className="max-w-2xl text-lg text-muted-foreground">
              Your validator key is a single point of failure. Upgrade to a CLIQ (multi-signature
              wallet) to protect your operations with team-based security.
            </p>

            {/* Benefits - Desktop */}
            <div className="hidden flex-wrap gap-4 pt-2 md:flex">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="bg-accent-purple/20 flex h-6 w-6 items-center justify-center rounded">
                      <Icon className="text-accent-purple h-3 w-3" />
                    </div>
                    <span>{benefit.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col">
            {chain.registryName && (
              <Link href={`/${chain.registryName}/create`}>
                <Button variant="action" size="action-lg" className="group w-full gap-2">
                  <ShieldPlus className="h-4 w-4" />
                  Create Validator CLIQ
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="action-outline" size="action-lg" className="w-full gap-2">
                  <Info className="h-4 w-4" />
                  Learn More
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl">
                    Why Use a CLIQ for Your Validator?
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    Multi-signature security for professional validator operations
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {benefits.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <div key={index} className="flex gap-4">
                        <div className="bg-accent-purple/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="text-accent-purple h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{benefit.title}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <h4 className="mb-2 font-semibold text-foreground">How It Works</h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="text-accent-purple font-mono">1.</span>
                        <span>Create a CLIQ with your team members' addresses</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-accent-purple font-mono">2.</span>
                        <span>Set the signing threshold (e.g., 2-of-3)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-accent-purple font-mono">3.</span>
                        <span>Propose transactions that require multiple signatures</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-accent-purple font-mono">4.</span>
                        <span>Team members sign and broadcast securely</span>
                      </li>
                    </ol>
                  </div>

                  <div className="pt-2 text-center">
                    {chain.registryName && (
                      <Link href={`/${chain.registryName}/create`}>
                        <Button variant="action" size="action" className="gap-2">
                          <ShieldPlus className="h-4 w-4" />
                          Get Started
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
