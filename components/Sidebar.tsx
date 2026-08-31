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
  ChevronLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import ChainConnect from "./ChainConnect";
import DonateDialog from "./DonateDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { showDevTools } from "@/lib/featureFlags";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddressDisplay } from "@/components/ui/address-display";

export default function Sidebar() {
  const { asPath } = useRouter();
  const { chain } = useChains();
  const { walletInfo, connectKeplr, connectLedger, disconnect, isConnecting, loading } =
    useWallet();
  const { hasPendingTransactions, totalPendingCount } = usePendingTransactions();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  // Derived with the old name so every `collapsed ?` branch below stays unchanged.
  const collapsed = !pinned && !hovered;

  const expand = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setHovered(true);
  };
  const scheduleCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setHovered(false), 150); // leave-delay kills edge flicker
  };

  // Pointer tracking uses native listeners rather than React's onMouseEnter/
  // onMouseLeave: clicking a nav item re-renders the tree mid-gesture and the
  // synthetic mouseleave is dropped, which left the rail stuck open for the rest
  // of the session. The native events still fire reliably in that case.
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const onEnter = () => expand();
    const onLeave = () => {
      // Keep it open only for KEYBOARD focus; a click also focuses the button,
      // and testing focus alone would pin the rail open permanently.
      const active = document.activeElement;
      if (active && el.contains(active) && active.matches(":focus-visible")) return;
      scheduleCollapse();
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
    // expand/scheduleCollapse only touch refs and setState, so the first
    // closures stay correct for the component's lifetime.
  }, []);

  // After a navigation, reconcile against the browser's own hover truth: if the
  // pointer is no longer over the rail, collapse it. Guards the case where the
  // pointer left during the route change and no leave event ever arrived.
  useEffect(() => {
    if (asideRef.current && !asideRef.current.matches(":hover")) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      setHovered(false);
    }
  }, [asPath]);

  // Hydrate the persisted pin after mount (server and client both render collapsed)
  useEffect(() => {
    setPinned(getUserSettings().sidebarPinned);
  }, []);

  useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    },
    [],
  );

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
      { href: `/${chain.registryName}/account`, label: "Account", icon: Wallet },
      { href: `/${chain.registryName}/settings`, label: "Settings", icon: Settings },
    ].concat(
      // Dev Tools can sign and broadcast real transactions, so it is not offered
      // to operators in production builds with the same weight as Settings. The
      // /dev route itself still exists for anyone who navigates to it directly.
      showDevTools
        ? [{ href: `/${chain.registryName}/dev`, label: "Dev Tools", icon: Terminal }]
        : [],
    );

  const truncatedAddress = walletInfo?.address
    ? `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-6)}`
    : null;

  return (
    <>
      {/* Spacer: reserves rail width in the flex row so the fixed aside overlays
          content on hover-expand. Pinned widens it -> push mode, nothing occluded. */}
      <div
        aria-hidden="true"
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-in-out lg:block",
          pinned ? "w-64" : "w-20",
        )}
      />
      <aside
        ref={asideRef}
        data-state={collapsed ? "collapsed" : "expanded"}
        onFocus={expand}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleCollapse();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setHovered(false);
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-r-2 border-border/[0.06] bg-card/50 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex",
          collapsed ? "w-20" : "w-64 bg-card shadow-card-hover",
        )}
      >
        {/* Brand & Pin */}
        <div
          className={cn(
            "flex items-center justify-between p-6",
            collapsed && "flex-col gap-6 px-0",
          )}
        >
          {!collapsed && (
            <Link
              href={chain.registryName ? `/${chain.registryName}/dashboard` : "/"}
              className="group flex items-center gap-3 overflow-hidden font-heading text-xl font-bold transition-opacity duration-200 animate-in fade-in hover:opacity-80"
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
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              updateUserSettings({ sidebarPinned: next });
            }}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={cn("text-muted-foreground hover:text-foreground", collapsed && "h-8 w-8")}
          >
            {pinned ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className={cn("mb-6 px-4", collapsed && "px-2 text-center")}>
          {/* ChainConnect holds the chain dialog's open state in its own useState,
              so it has to stay mounted across a collapse. Unmounting it threw that
              state away and the dialog shut itself ~150ms after opening: the modal
              moves focus into a portal outside the aside, the mouseleave guard
              below therefore does not match, scheduleCollapse fires, and this
              branch flipped. Hide the trigger with CSS instead -- the dialog is
              portaled to body, so it survives. Compare DonateDialog, which is
              already mounted outside every `collapsed ?` branch. */}
          <div className={cn(collapsed ? "hidden" : "duration-200 animate-in fade-in")}>
            <ChainConnect />
          </div>
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mx-auto flex h-10 w-10 cursor-help items-center justify-center rounded-full bg-muted">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-accent" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {chain.chainDisplayName || "Select Chain"}
              </TooltipContent>
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
                    "mb-2 h-10 w-full gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 animate-in fade-in",
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
                  aria-label={collapsed ? item.label : undefined}
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
                  {!collapsed && (
                    <span className="flex-1 truncate text-left duration-200 animate-in fade-in">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && showPendingIndicator && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-warning">{totalPendingCount}</span>
                      <div className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning"></span>
                      </div>
                    </div>
                  )}
                  {collapsed && showPendingIndicator && (
                    <div className="absolute right-2 top-2 flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-warning"></span>
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
                <div className="group/pending mt-4 cursor-pointer rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 transition-all animate-in fade-in slide-in-from-left-4 hover:bg-warning/20">
                  <div className="mb-1 flex items-center gap-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Pending Tasks
                    </span>
                    <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover/pending:opacity-100" />
                  </div>
                  <p className="text-[11px] leading-tight text-warning/80">
                    You have {totalPendingCount} transaction{totalPendingCount !== 1 ? "s" : ""}{" "}
                    awaiting signatures.
                  </p>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-warning/20 bg-warning/10 text-warning transition-all hover:bg-warning/20">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{totalPendingCount} Pending Tasks</TooltipContent>
                </Tooltip>
              )}
            </Link>
          )}
        </nav>

        {/* Back to TOKNS */}
        <div className={cn("mb-2 px-4", collapsed && "px-2")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://app.tokns.fi"
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/[0.06] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <ChevronLeft className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">Back to TOKNS</TooltipContent>
            </Tooltip>
          ) : (
            <a
              href="https://app.tokns.fi"
              className="flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg border border-border/[0.06] px-4 text-sm text-muted-foreground transition-colors duration-200 animate-in fade-in hover:bg-muted/50 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to TOKNS
            </a>
          )}
        </div>

        {/* Donate Button */}
        <div className={cn("mb-2 px-4", collapsed && "px-2")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowDonate(true)}
                  size="icon"
                  className="mx-auto h-10 w-10 transition-all hover:brightness-110"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Donate</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={() => setShowDonate(true)}
              className="h-10 w-full gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 animate-in fade-in hover:brightness-110"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
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
                <div className="rounded-xl border border-border/50 bg-muted/50 p-3 duration-200 animate-in fade-in">
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
                {!collapsed && (
                  <span className="whitespace-nowrap duration-200 animate-in fade-in">
                    Disconnect Wallet
                  </span>
                )}
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
                    {!collapsed && <span className="duration-200 animate-in fade-in">Keplr</span>}
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
                    {!collapsed && <span className="duration-200 animate-in fade-in">Ledger</span>}
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
              <div className="flex items-center gap-3 duration-200 animate-in fade-in">
                <span className="font-mono text-[10px] text-muted-foreground">v1.2.0</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
