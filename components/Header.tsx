import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";
import {
  LayoutDashboard,
  ShieldPlus,
  Menu,
  X,
  Wallet,
  Unplug,
  Loader2,
  Settings,
  AlertCircle,
  Terminal,
  BookOpen,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import ChainConnect from "./ChainConnect";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AddressDisplay } from "@/components/ui/address-display";

export default function Header() {
  const { pathname } = useRouter();
  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, disconnect, isConnecting } =
    useWallet();
  const { hasPendingTransactions, totalPendingCount } = usePendingTransactions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // We are now locked to dark theme
  const logoPath = "/assets/icons/cliq LIGHT.svg";

  const isOnChain = pathname.includes(chain.registryName);

  const navItems = [
    { href: `/${chain.registryName}/get-started`, label: "Get Started", icon: BookOpen },
    { href: `/${chain.registryName}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${chain.registryName}/create`, label: "Create", icon: ShieldPlus },
    { href: `/${chain.registryName}/dev`, label: "Dev Tools", icon: Terminal },
  ];

  // Truncate address for display (first 6 and last 6 characters)
  const truncatedAddress = walletInfo?.address
    ? `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-6)}`
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <div className="container mx-auto flex h-16 items-center justify-between px-[0.75in]">
        {/* Logo / Brand */}
        <div className="flex items-center gap-4">
          <Link
            href={chain.registryName ? `/${chain.registryName}` : "/"}
            className="group flex items-center gap-3 font-heading text-lg font-bold transition-opacity hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105">
              <Image
                src={logoPath}
                alt="CLIQ Logo"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <span className="cliqs-brand hidden sm:inline">CLIQS</span>
          </Link>

          {/* Back to TOKNS */}
          <a
            href="https://app.tokns.fi"
            className="hidden items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to TOKNS
          </a>

          {/* Chain Connect - Desktop */}
          <div className="hidden md:block">
            <ChainConnect />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {chain.registryName &&
            navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 transition-all duration-200 ${
                      isActive
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}

          {/* Pending Transactions Notification */}
          {hasPendingTransactions && chain.registryName && (
            <Link href={`/${chain.registryName}/dashboard?tab=cliqs`}>
              <Button
                variant="ghost"
                size="sm"
                className="relative gap-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/20"
                title={`${totalPendingCount} pending transaction${totalPendingCount !== 1 ? "s" : ""}`}
              >
                <AlertCircle className="h-4 w-4" />
                <span className="hidden lg:inline">Pending</span>
                {/* Blinking dot */}
                <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              </Button>
            </Link>
          )}

          {/* Separator */}
          {chain.registryName && <div className="mx-2 h-6 w-px bg-border" />}

          {/* Wallet Connection Button/Dropdown */}
          {walletInfo ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Image
                    alt=""
                    src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                    width={16}
                    height={16}
                    className={cn(walletInfo.type === "Ledger" && "rounded-sm bg-white p-0.5")}
                  />
                  <span className="hidden font-mono text-xs lg:inline">{truncatedAddress}</span>
                  <span className="lg:hidden">Connected</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">Connected with {walletInfo.type}</p>
                  <AddressDisplay address={walletInfo.address} copyLabel="wallet address" />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      isOnChain
                        ? {
                            pathname: "account",
                            query: { chainName: chain.registryName },
                          }
                        : `/${chain.registryName}/account`
                    }
                    className="cursor-pointer"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Account Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      isOnChain
                        ? {
                            pathname: "settings",
                            query: { chainName: chain.registryName },
                          }
                        : `/${chain.registryName}/settings`
                    }
                    className="cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={disconnect}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="action" size="action-sm" className="gap-2" disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  <span className="hidden lg:inline">Connect Wallet</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={connectKeplr}
                  disabled={loading.keplr || loading.ledger}
                  className="cursor-pointer"
                >
                  {loading.keplr ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Image
                      alt=""
                      src="/assets/icons/keplr.svg"
                      width={16}
                      height={16}
                      className="mr-2"
                    />
                  )}
                  Keplr
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={connectLedger}
                  disabled={loading.keplr || loading.ledger}
                  className="cursor-pointer"
                >
                  {loading.ledger ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Image
                      alt=""
                      src="/assets/icons/ledger.svg"
                      width={16}
                      height={16}
                      className="mr-2 rounded-sm bg-white p-0.5"
                    />
                  )}
                  Ledger
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link
                    href={
                      isOnChain
                        ? {
                            pathname: "account",
                            query: { chainName: chain.registryName },
                          }
                        : `/${chain.registryName}/account`
                    }
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Account Page
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ChainConnect />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="slide-up fixed left-0 right-0 top-16 z-50 border-b-2 border-border bg-card shadow-lg animate-in md:hidden">
            <nav className="container mx-auto space-y-2 px-[0.75in] py-4">
              <a
                href="https://app.tokns.fi"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Back to TOKNS</span>
              </a>
              <div className="my-3 h-px bg-border" />
              {chain.registryName &&
                navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                          isActive
                            ? "border-l-4 border-l-green-accent bg-muted font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}

              {/* Pending Transactions Notification - Mobile */}
              {hasPendingTransactions && chain.registryName && (
                <Link
                  href={`/${chain.registryName}/dashboard?tab=cliqs`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="relative flex items-center gap-3 rounded-lg px-4 py-3 text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20">
                    <AlertCircle className="h-5 w-5" />
                    <span>Pending Transactions ({totalPendingCount})</span>
                    {/* Blinking dot */}
                    <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  </div>
                </Link>
              )}

              {/* Separator */}
              <div className="my-3 h-px bg-border" />

              {/* Wallet Section - Mobile */}
              {walletInfo ? (
                <>
                  <Link
                    href={
                      isOnChain
                        ? {
                            pathname: "account",
                            query: { chainName: chain.registryName },
                          }
                        : `/${chain.registryName}/account`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                      <Image
                        alt=""
                        src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                        width={20}
                        height={20}
                        className={cn(walletInfo.type === "Ledger" && "rounded-sm bg-white p-0.5")}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Connected to {walletInfo.type}</p>
                        <AddressDisplay
                          address={walletInfo.address}
                          copyLabel="wallet address"
                          className="text-muted-foreground"
                          showCopy={false}
                        />
                      </div>
                    </div>
                  </Link>
                  <Link
                    href={
                      isOnChain
                        ? {
                            pathname: "settings",
                            query: { chainName: chain.registryName },
                          }
                        : `/${chain.registryName}/settings`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                      <Settings className="h-5 w-5" />
                      <span>Settings</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      disconnect();
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Unplug className="h-5 w-5" />
                    <span>Disconnect Wallet</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      connectKeplr();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isConnecting}
                    className="flex w-full items-center gap-3 rounded-lg bg-foreground px-4 py-3 font-medium text-background transition-all disabled:opacity-50"
                  >
                    {loading.keplr ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Image alt="" src="/assets/icons/keplr.svg" width={20} height={20} />
                    )}
                    <span>Connect Keplr</span>
                  </button>
                  <button
                    onClick={() => {
                      connectLedger();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isConnecting}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 font-medium text-foreground transition-all hover:bg-muted/50 disabled:opacity-50"
                  >
                    {loading.ledger ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Image
                        alt=""
                        src="/assets/icons/ledger.svg"
                        width={20}
                        height={20}
                        className="rounded-sm bg-white p-0.5"
                      />
                    )}
                    <span>Connect Ledger</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
