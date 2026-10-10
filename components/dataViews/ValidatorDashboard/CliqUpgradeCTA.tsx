/**
 * CLIQ Upgrade CTA Card
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
      title: "No Single Operator Key",
      description: "Commission claims, validator edits and votes need several approvals",
    },
    {
      icon: Users,
      title: "Team-Based Management",
      description: "Distribute signing authority among trusted team members",
    },
    {
      icon: Lock,
      title: "Starts a New Validator",
      description:
        "A CLIQ runs a validator it creates. An existing validator can't be moved into one.",
    },
  ];

  return (
    <Card
      variant="institutional"
      bracket="purple"
      className="bg-gradient-to-br from-card to-purple-accent/5"
    >
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-accent/30 bg-purple-accent/20 px-3 py-1 font-mono text-xs uppercase tracking-wider text-purple-accent">
              <ShieldPlus className="h-3 w-3" />
              Multisig Validator
            </div>

            <h3 className="font-heading text-2xl font-bold md:text-3xl">
              Run a Validator From a CLIQ
            </h3>

            <p className="max-w-2xl text-lg text-muted-foreground">
              Create a new validator controlled by a CLIQ (multi-signature wallet), so every
              operator action needs approval from several team members. This sets up a new
              validator. It does not convert an existing one.
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
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-accent/20">
                      <Icon className="h-3 w-3 text-purple-accent" />
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-accent/20">
                          <Icon className="h-5 w-5 text-purple-accent" />
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

                  <div className="rounded-lg border border-border/[0.06] bg-muted/50 p-4">
                    <h4 className="mb-2 font-semibold text-foreground">How It Works</h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="font-mono text-purple-accent">1.</span>
                        <span>
                          Create a CLIQ with your team members' addresses and a signing threshold
                          (e.g., 2-of-3)
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-purple-accent">2.</span>
                        <span>Fund the CLIQ with your self-delegation plus fees</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-purple-accent">3.</span>
                        <span>
                          From the CLIQ, propose a Create Validator transaction with your node's
                          consensus key. It must be a key no other validator uses.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-purple-accent">4.</span>
                        <span>
                          Once enough members sign, broadcast it. The CLIQ is now the validator's
                          operator.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-purple-accent">5.</span>
                        <span>
                          Moving from an old validator? Your delegators move their own stake by
                          redelegating to the new one.
                        </span>
                      </li>
                    </ol>
                  </div>

                  <div className="pt-2 text-center">
                    {chain.registryName && (
                      <Link href={`/${chain.registryName}/create`}>
                        <Button variant="action" size="action" className="gap-2">
                          <ShieldPlus className="h-4 w-4" />
                          Create Validator CLIQ
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
