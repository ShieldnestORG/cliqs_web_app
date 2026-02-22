import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";
import { LayoutDashboard, ShieldPlus, Menu, X, Wallet, Unplug, Loader2, Settings, AlertCircle, Terminal, BookOpen } from "lucide-react";
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

export default function Header() {
  const { pathname } = useRouter();
  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, disconnect, isConnecting } = useWallet();
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
            className="flex items-center gap-3 font-heading font-bold text-lg hover:opacity-80 transition-opacity group"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <Image
                src={logoPath}
                alt="CLIQ Logo"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <span className="hidden sm:inline cliqs-brand">CLIQS</span>
          </Link>
          
          {/* Chain Connect - Desktop */}
          <div className="hidden md:block">
            <ChainConnect />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {chain.registryName && navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 transition-all duration-200 ${
                    isActive
                      ? "bg-muted text-foreground font-semibold"
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
                className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 relative"
                title={`${totalPendingCount} pending transaction${totalPendingCount !== 1 ? 's' : ''}`}
              >
                <AlertCircle className="h-4 w-4" />
                <span className="hidden lg:inline">Pending</span>
                {/* Blinking dot */}
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              </Button>
            </Link>
          )}

          {/* Separator */}
          {chain.registryName && (
            <div className="w-px h-6 bg-border mx-2" />
          )}
          
          {/* Wallet Connection Button/Dropdown */}
          {walletInfo ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                >
                  <Image
                    alt=""
                    src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                    width={16}
                    height={16}
                    className={cn(walletInfo.type === "Ledger" && "bg-white p-0.5 rounded-sm")}
                  />
                  <span className="hidden lg:inline font-mono text-xs">{truncatedAddress}</span>
                  <span className="lg:hidden">Connected</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">Connected with {walletInfo.type}</p>
                  <p className="font-mono text-xs truncate">{truncatedAddress}</p>
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
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="action" 
                  size="action-sm" 
                  className="gap-2"
                  disabled={isConnecting}
                >
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
                      className="mr-2 bg-white p-0.5 rounded-sm"
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
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed top-16 left-0 right-0 bg-card border-b-2 border-border shadow-lg z-50 md:hidden animate-in slide-up">
            <nav className="container mx-auto px-[0.75in] py-4 space-y-2">
              {chain.registryName && navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-muted text-foreground font-semibold border-l-4 border-l-green-accent"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}>
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
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors relative">
                    <AlertCircle className="h-5 w-5" />
                    <span>Pending Transactions ({totalPendingCount})</span>
                    {/* Blinking dot */}
                    <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  </div>
                </Link>
              )}

              {/* Separator */}
              <div className="h-px bg-border my-3" />
              
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
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
                      <Image
                        alt=""
                        src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                        width={20}
                        height={20}
                        className={cn(walletInfo.type === "Ledger" && "bg-white p-0.5 rounded-sm")}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Connected to {walletInfo.type}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {truncatedAddress}
                        </p>
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
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                      <Settings className="h-5 w-5" />
                      <span>Settings</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      disconnect();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 w-full transition-colors"
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
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-foreground text-background font-medium transition-all w-full disabled:opacity-50"
                  >
                    {loading.keplr ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Image
                        alt=""
                        src="/assets/icons/keplr.svg"
                        width={20}
                        height={20}
                      />
                    )}
                    <span>Connect Keplr</span>
                  </button>
                  <button
                    onClick={() => {
                      connectLedger();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isConnecting}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-foreground font-medium transition-all w-full disabled:opacity-50 hover:bg-muted/50"
                  >
                    {loading.ledger ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Image
                        alt=""
                        src="/assets/icons/ledger.svg"
                        width={20}
                        height={20}
                        className="bg-white p-0.5 rounded-sm"
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
