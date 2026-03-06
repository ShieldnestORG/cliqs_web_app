import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";
import {
  Users,
  Search,
  ShieldPlus,
  Shield,
  Wallet,
  Unplug,
  Loader2,
  Settings,
  AlertCircle,
  Github,
  ChevronRight,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Heart,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import ChainConnect from "./ChainConnect";
import DonateDialog from "./DonateDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddressDisplay } from "@/components/ui/address-display";

export default function Sidebar() {
  const { asPath } = useRouter();
  const { chain } = useChains();
  const { walletInfo, connectKeplr, connectLedger, disconnect, isConnecting, loading } =
    useWallet();
  const { hasPendingTransactions, totalPendingCount } = usePendingTransactions();
  const [collapsed, setCollapsed] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  const logoPath = "/assets/icons/cliq LIGHT.svg";

  const navItems: { href: string; label: string; icon: typeof Activity; showPending?: boolean }[] =
    [
      {
        href: `/${chain.registryName}/operations`,
        label: "Operations",
        icon: Activity,
        showPending: true,
      },
      { href: `/${chain.registryName}/dashboard?tab=cliqs`, label: "My CLIQS", icon: Users },
      { href: `/${chain.registryName}/validator`, label: "Validator", icon: Shield },
      { href: `/${chain.registryName}/dashboard?tab=find`, label: "Find CLIQ", icon: Search },
      { href: `/${chain.registryName}/create`, label: "Create Multisig", icon: ShieldPlus },
      { href: `/${chain.registryName}/dev`, label: "Dev Tools", icon: Terminal },
      { href: `/${chain.registryName}/account`, label: "Account", icon: Wallet },
      { href: `/${chain.registryName}/settings`, label: "Settings", icon: Settings },
    ];

  const truncatedAddress = walletInfo?.address
    ? `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-6)}`
    : null;

  return (
    <aside
      className={cn(
        "sticky top-0 z-50 hidden h-screen flex-col border-r-2 border-border bg-card/50 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex",
        collapsed ? "w-20" : "w-64",
      )}
    >
      {/* Brand & Toggle */}
      <div
        className={cn("flex items-center justify-between p-6", collapsed && "flex-col gap-6 px-0")}
      >
        {!collapsed && (
          <Link
            href={chain.registryName ? `/${chain.registryName}/dashboard` : "/"}
            className="group flex items-center gap-3 overflow-hidden font-heading text-xl font-bold transition-opacity hover:opacity-80"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <Image
                src={logoPath}
                alt="CLIQ Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="cliqs-brand tracking-tight">CLIQS</span>
          </Link>
        )}

        {collapsed && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl">
            <Image
              src={logoPath}
              alt="CLIQ Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("text-muted-foreground hover:text-foreground", collapsed && "h-8 w-8")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className={cn("mb-6 px-4", collapsed && "px-2 text-center")}>
        {!collapsed ? (
          <ChainConnect />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mx-auto flex h-10 w-10 cursor-help items-center justify-center rounded-full bg-muted">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-accent" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{chain.chainDisplayName || "Select Chain"}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 px-4 py-2", collapsed && "px-2")}>
        {/* Get Started - prominent CTA at top */}
        {chain.registryName &&
          (collapsed ? (
            <Link href={`/${chain.registryName}/get-started`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      asPath === `/${chain.registryName}/get-started` ? "default" : "outline"
                    }
                    size="icon"
                    className={cn(
                      "mb-2 h-10 w-full transition-all",
                      asPath === `/${chain.registryName}/get-started`
                        ? "bg-primary text-primary-foreground"
                        : "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <BookOpen className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Get Started</TooltipContent>
              </Tooltip>
            </Link>
          ) : (
            <Link href={`/${chain.registryName}/get-started`}>
              <Button
                variant={asPath === `/${chain.registryName}/get-started` ? "default" : "outline"}
                className={cn(
                  "mb-2 h-10 w-full gap-2 text-sm font-semibold transition-all",
                  asPath === `/${chain.registryName}/get-started`
                    ? "bg-primary text-primary-foreground"
                    : "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                <BookOpen className="h-4 w-4" />
                Get Started
              </Button>
            </Link>
          ))}

        {chain.registryName &&
          navItems.map((item) => {
            const isActive =
              asPath === item.href ||
              (item.label === "My CLIQS" && asPath === `/${chain.registryName}/dashboard`) ||
              (item.label === "Operations" && asPath === `/${chain.registryName}/operations`);
            const Icon = item.icon;
            const showPendingIndicator = item.showPending && hasPendingTransactions;

            const content = (
              <Button
                variant="ghost"
                className={cn(
                  "group relative h-11 w-full justify-start overflow-hidden px-4 transition-all duration-200",
                  collapsed ? "justify-center px-0" : "gap-3",
                  isActive
                    ? "bg-muted font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-green-accent" : "group-hover:text-foreground",
                  )}
                />
                {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!collapsed && showPendingIndicator && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-amber-500">{totalPendingCount}</span>
                    <div className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </div>
                  </div>
                )}
                {collapsed && showPendingIndicator && (
                  <div className="absolute right-2 top-2 flex h-2 w-2">
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                  </div>
                )}
                {!collapsed && isActive && !showPendingIndicator && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-green-accent/50" />
                )}
              </Button>
            );

            if (collapsed) {
              return (
                <Link key={item.href} href={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}

        {hasPendingTransactions && (
          <Link href={`/${chain.registryName}/operations?tab=pending`} className="block">
            {!collapsed ? (
              <div className="group/pending mt-4 cursor-pointer rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 transition-all animate-in fade-in slide-in-from-left-4 hover:bg-amber-500/20">
                <div className="mb-1 flex items-center gap-2 text-amber-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
                  <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover/pending:opacity-100" />
                </div>
                <p className="text-[11px] leading-tight text-amber-500/80">
                  You have {totalPendingCount} transaction{totalPendingCount !== 1 ? "s" : ""}{" "}
                  awaiting signatures.
                </p>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 transition-all hover:bg-amber-500/20">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{totalPendingCount} Pending Tasks</TooltipContent>
              </Tooltip>
            )}
          </Link>
        )}
      </nav>

      {/* Donate Button */}
      <div className={cn("mb-2 px-4", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowDonate(true)}
                size="icon"
                className="mx-auto h-10 w-10 transition-all hover:brightness-110"
                style={{ backgroundColor: "#ff876d", color: "#fff" }}
              >
                <Heart className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Donate</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={() => setShowDonate(true)}
            className="h-10 w-full gap-2 text-sm font-semibold transition-all hover:brightness-110"
            style={{ backgroundColor: "#ff876d", color: "#fff" }}
          >
            <Heart className="h-4 w-4" />
            Donate
          </Button>
        )}
      </div>

      <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />

      {/* Wallet Section */}
      <div className={cn("mt-auto border-t border-border/50 p-4", collapsed && "px-2")}>
        {walletInfo ? (
          <div className="space-y-3">
            {!collapsed ? (
              <div className="rounded-xl border border-border/50 bg-muted/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Image
                    alt={walletInfo.type}
                    src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                    width={14}
                    height={14}
                    className={cn(walletInfo.type === "Ledger" && "rounded-sm bg-white p-0.5")}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {walletInfo.type} Connected
                  </span>
                </div>
                <AddressDisplay
                  address={walletInfo.address}
                  copyLabel="wallet address"
                  className="text-foreground/80"
                />
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-muted/50">
                    <Image
                      alt={walletInfo.type}
                      src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                      width={18}
                      height={18}
                      className={cn(walletInfo.type === "Ledger" && "rounded-sm bg-white p-0.5")}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {walletInfo.type}: {truncatedAddress}
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={disconnect}
              className={cn(
                "h-9 justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
                collapsed ? "mx-auto h-10 w-10 justify-center" : "w-full gap-2",
              )}
            >
              <Unplug className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Disconnect Wallet</span>}
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-2", collapsed ? "grid-cols-1" : "grid-cols-2")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={connectKeplr}
                  disabled={isConnecting}
                  className={cn("gap-2 text-xs", collapsed && "mx-auto h-10 w-10")}
                >
                  {loading.keplr ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Image src="/assets/icons/keplr.svg" width={14} height={14} alt="Keplr" />
                  )}
                  {!collapsed && "Keplr"}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Connect Keplr</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={connectLedger}
                  disabled={isConnecting}
                  className={cn("gap-2 text-xs", collapsed && "mx-auto h-10 w-10")}
                >
                  {loading.ledger ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Image
                      src="/assets/icons/ledger.svg"
                      width={14}
                      height={14}
                      alt="Ledger"
                      className="rounded-sm bg-white p-0.5"
                    />
                  )}
                  {!collapsed && "Ledger"}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Connect Ledger</TooltipContent>}
            </Tooltip>
          </div>
        )}

        {/* Footer Links */}
        <div
          className={cn(
            "mt-4 flex items-center justify-between px-2",
            collapsed && "flex-col gap-4 px-0",
          )}
        >
          <a
            href="https://github.com/cosmos/cosmos-multisig-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-muted-foreground">v1.2.0</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
