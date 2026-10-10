import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Unplug, Loader2, ChevronRight, PanelLeftClose, PanelLeftOpen, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import ChainConnect from "./ChainConnect";
import DonateDialog from "./DonateDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNavItems, isNavItemActive, useNeedsMyCount } from "@/lib/navigation";
import { getUserSettings, updateUserSettings } from "@/lib/settingsStorage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddressDisplay } from "@/components/ui/address-display";

export default function Sidebar() {
  const { asPath } = useRouter();
  const { chain } = useChains();
  const { walletInfo, connectKeplr, connectLedger, disconnect, isConnecting, loading } =
    useWallet();
  const needsMyCount = useNeedsMyCount();
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

  const mainItems = getNavItems("main");
  const moreItems = getNavItems("more");
  const utilityItems = getNavItems("utility");

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

        {/* Navigation: scrolls on short screens so the footer below never gets cut off */}
        <nav
          aria-label="Main"
          className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-2", collapsed && "px-2")}
        >
          {chain.registryName &&
            [mainItems, moreItems].map((items, groupIndex) =>
              items.length === 0 ? null : (
                <div key={groupIndex} className="space-y-1">
                  {groupIndex > 0 && <div className="my-2 h-px bg-border/[0.06]" />}
                  {items.map((item) => {
                    const isActive = isNavItemActive(item, asPath);
                    const Icon = item.icon;
                    const href = item.href(chain.registryName);
                    const showBadge = item.badge === "needsMe" && needsMyCount > 0;
                    const tooltipLabel = showBadge ? `${item.label} (${needsMyCount})` : item.label;

                    const content = (
                      <Button
                        variant="ghost"
                        aria-label={collapsed ? tooltipLabel : undefined}
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
                        {!collapsed && showBadge && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-warning">{needsMyCount}</span>
                            <div className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"></span>
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-warning"></span>
                            </div>
                          </div>
                        )}
                        {collapsed && showBadge && (
                          <div className="absolute right-2 top-2 flex h-2 w-2">
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning"></span>
                          </div>
                        )}
                        {!collapsed && isActive && !showBadge && (
                          <ChevronRight className="h-4 w-4 shrink-0 text-green-accent/50" />
                        )}
                      </Button>
                    );

                    if (collapsed) {
                      return (
                        <Link
                          key={item.id}
                          href={href}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>{content}</TooltipTrigger>
                            <TooltipContent side="right">{tooltipLabel}</TooltipContent>
                          </Tooltip>
                        </Link>
                      );
                    }

                    return (
                      <Link key={item.id} href={href} aria-current={isActive ? "page" : undefined}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ),
            )}
        </nav>

        {/* Back to TOKNS */}
        {utilityItems.map((item) => {
          const Icon = item.icon;
          const href = item.href(chain.registryName);
          return (
            <div key={item.id} className={cn("mb-2 shrink-0 px-4", collapsed && "px-2")}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={href}
                      aria-label={item.label}
                      className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/[0.06] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <a
                  href={href}
                  className="flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg border border-border/[0.06] px-4 text-sm text-muted-foreground transition-colors duration-200 animate-in fade-in hover:bg-muted/50 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              )}
            </div>
          );
        })}

        {/* Donate Button: outline, so it never outranks a page action */}
        <div className={cn("mb-2 shrink-0 px-4", collapsed && "px-2")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowDonate(true)}
                  variant="outline"
                  size="icon"
                  aria-label="Donate"
                  className="mx-auto flex h-10 w-10"
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Donate</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={() => setShowDonate(true)}
              variant="outline"
              className="h-10 w-full gap-2 whitespace-nowrap text-sm duration-200 animate-in fade-in"
            >
              <Heart className="h-4 w-4" />
              Donate
            </Button>
          )}
        </div>

        <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />

        {/* Wallet Section */}
        <div className={cn("shrink-0 border-t border-border/50 p-4", collapsed && "px-2")}>
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
                aria-label={collapsed ? "Disconnect wallet" : undefined}
                className={cn(
                  "h-9 justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
                  // `flex`, not the Button's own inline-flex: auto margins do not centre an
                  // inline box, so the collapsed icon sat left of the column (2026-10-10)
                  collapsed ? "mx-auto flex h-10 w-10 justify-center" : "w-full gap-2",
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
        </div>
      </aside>
    </>
  );
}
