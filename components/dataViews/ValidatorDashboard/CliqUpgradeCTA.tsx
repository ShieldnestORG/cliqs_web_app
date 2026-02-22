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
import { 
  Shield, 
  Users, 
  Lock, 
  ArrowRight, 
  ShieldPlus,
  Info
} from "lucide-react";
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
    <Card variant="institutional" bracket="purple" className="bg-gradient-to-br from-card to-accent-purple/5">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/20 border border-accent-purple/30 text-xs font-mono uppercase tracking-wider text-accent-purple">
              <ShieldPlus className="h-3 w-3" />
              Security Upgrade
            </div>
            
            <h3 className="text-2xl md:text-3xl font-heading font-bold">
              Secure Your Validator Operations
            </h3>
            
            <p className="text-muted-foreground text-lg max-w-2xl">
              Your validator key is a single point of failure. Upgrade to a CLIQ (multi-signature wallet) 
              to protect your operations with team-based security.
            </p>

            {/* Benefits - Desktop */}
            <div className="hidden md:flex flex-wrap gap-4 pt-2">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="w-6 h-6 rounded bg-accent-purple/20 flex items-center justify-center">
                      <Icon className="h-3 w-3 text-accent-purple" />
                    </div>
                    <span>{benefit.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:w-auto shrink-0">
            {chain.registryName && (
              <Link href={`/${chain.registryName}/create`}>
                <Button variant="action" size="action-lg" className="w-full gap-2 group">
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
                  <DialogTitle className="text-2xl font-heading">
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
                        <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-accent-purple" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {benefit.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <h4 className="font-semibold text-foreground mb-2">
                      How It Works
                    </h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="font-mono text-accent-purple">1.</span>
                        <span>Create a CLIQ with your team members' addresses</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-accent-purple">2.</span>
                        <span>Set the signing threshold (e.g., 2-of-3)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-accent-purple">3.</span>
                        <span>Propose transactions that require multiple signatures</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-accent-purple">4.</span>
                        <span>Team members sign and broadcast securely</span>
                      </li>
                    </ol>
                  </div>

                  <div className="text-center pt-2">
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

