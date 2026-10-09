/**
 * Settings Page
 *
 * Wallet (absorbs the former Account page), the sign-in requirement for
 * CLIQs, and database configuration (BYODB). Sections 2 and 3 work without a
 * connected wallet; only the Wallet section asks to connect.
 */

import AccountView from "@/components/dataViews/AccountView";
import DashboardLayout, { DashboardSection } from "@/components/layout/DashboardLayout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useChains } from "@/context/ChainsContext";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toastSuccess } from "@/lib/utils";
import DatabaseSettings from "@/components/DatabaseSettings";

export default function SettingsPage() {
  const { chain } = useChains();
  const [requireWalletSignIn, setRequireWalletSignIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setMounted(true);
    const settings = getUserSettings();
    setRequireWalletSignIn(settings.requireWalletSignInForCliqs);
  }, []);

  const handleToggleRequireWalletSignIn = (checked: boolean) => {
    setRequireWalletSignIn(checked);
    updateUserSettings({ requireWalletSignInForCliqs: checked });
    toastSuccess(
      checked
        ? "Additional security enabled. You'll need to sign in to access your CLIQs."
        : "Additional security disabled. You can access your CLIQs without signing in.",
    );
  };

  const subheader = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {chain.registryName ? (
              <Link href={`/${chain.registryName}/dashboard`}>Home</Link>
            ) : null}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Settings</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <DashboardLayout
      title={`Settings - ${chain.chainDisplayName || "Cosmos Hub"}`}
      subheader={subheader}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
          <p className="mt-2 text-muted-foreground">Wallet, security and database.</p>
        </div>

        {!mounted ? (
          <div className="space-y-6" data-testid="settings-loading">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* Wallet (absorbs the former Account page) */}
            <div id="wallet" className="scroll-mt-8">
              <DashboardSection title="Wallet">
                <AccountView />
              </DashboardSection>
            </div>

            {/* Security */}
            <DashboardSection title="Security">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center justify-between space-x-2 rounded-lg border border-border/[0.06] p-4">
                    <div className="flex-1 space-y-0.5">
                      <Label htmlFor="require-wallet-signin" className="text-base font-medium">
                        Require wallet sign-in for CLIQs
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When on, your CLIQs and waiting signatures appear only after you verify your
                        identity.
                      </p>
                    </div>
                    <Switch
                      id="require-wallet-signin"
                      checked={requireWalletSignIn}
                      onCheckedChange={handleToggleRequireWalletSignIn}
                    />
                  </div>
                </CardContent>
              </Card>
            </DashboardSection>

            {/* Database (BYODB) */}
            <div id="database-config" className="scroll-mt-8">
              <DashboardSection title="Your own database (BYODB)">
                <p className="text-sm text-muted-foreground">
                  New to using your own database?{" "}
                  <Link
                    href={
                      chain.registryName
                        ? `/${chain.registryName}/get-started?journey=setup-byodb`
                        : "#"
                    }
                    className="underline hover:text-foreground"
                  >
                    See our step-by-step guide
                  </Link>
                </p>
                <DatabaseSettings />
              </DashboardSection>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
