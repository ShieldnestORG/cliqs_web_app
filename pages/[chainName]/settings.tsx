/**
 * Settings Page
 *
 * File: pages/[chainName]/settings.tsx
 *
 * User settings page for managing security preferences, database
 * configuration (BYODB), and other options.
 */

import Head from "@/components/head";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useChains } from "@/context/ChainsContext";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";
import { Shield, Settings as SettingsIcon } from "lucide-react";
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
        ? "Additional security enabled. You'll need to sign in to access your Cliqs."
        : "Additional security disabled. You can access your Cliqs without signing in.",
    );
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="container mx-auto px-[0.75in] py-8 max-w-[1600px]">
      <Head title={`Settings - ${chain.chainDisplayName || "Cosmos Hub"}`} />

      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                {chain.registryName ? <Link href={`/${chain.registryName}`}>Home</Link> : null}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
              <SettingsIcon className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your security preferences, database configuration, and account settings
            </p>
          </div>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-accent" />
                Additional Security
              </CardTitle>
              <CardDescription>
                Configure additional security measures for accessing your Cliqs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="require-wallet-signin" className="text-base font-medium">
                    Require Wallet Sign-In for Cliqs
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, you&apos;ll need to sign a message with your wallet each time you
                    want to access your Cliqs. This provides an extra layer of security.
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

          {/* Database Settings (BYODB) */}
          <DatabaseSettings />
        </div>
      </div>
    </div>
  );
}
