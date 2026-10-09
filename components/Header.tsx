import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { Bell, Heart, Menu, X, Unplug, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import ChainConnect from "./ChainConnect";
import DonateDialog from "./DonateDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNavItems, isNavItemActive, useNeedsMyCount } from "@/lib/navigation";
import { AddressDisplay } from "@/components/ui/address-display";

export default function Header() {
  const { asPath } = useRouter();
  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, disconnect, isConnecting } =
    useWallet();
  const needsMyCount = useNeedsMyCount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  // We are now locked to dark theme
  const logoPath = "/assets/icons/cliq LIGHT.svg";

  // This header is the only navigation below the lg breakpoint (the Sidebar is
  // lg:flex). Both shells render the same list from lib/navigation.ts.
  const navGroups = [getNavItems("main"), getNavItems("more")].filter((items) => items.length > 0);
  const utilityItems = getNavItems("utility");

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border/[0.06] bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-[0.75in]">
        {/* Logo / Brand */}
        <Link
          href={chain.registryName ? `/${chain.registryName}/dashboard` : "/"}
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

        <div className="flex items-center gap-2">
          <ChainConnect />

          {/* Signatures waiting for me */}
          {chain.registryName && needsMyCount > 0 && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="relative text-warning hover:bg-warning/30 hover:text-warning"
            >
              <Link
                href={`/${chain.registryName}/dashboard`}
                aria-label={`${needsMyCount} ${
                  needsMyCount === 1 ? "transaction needs" : "transactions need"
                } your signature`}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold leading-none text-warning-foreground">
                  {needsMyCount > 9 ? "9+" : needsMyCount}
                </span>
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mounted outside the panel so it survives the panel closing, and only
          while open: DonateDialog fetches balances on mount, and the Sidebar
          already holds one for the lg+ shell. */}
      {showDonate && <DonateDialog open onClose={() => setShowDonate(false)} />}

      {/* Menu Panel: every width below lg */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={closeMenu}
          />

          <div className="slide-up fixed left-0 right-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b-2 border-border/[0.06] bg-card shadow-lg animate-in">
            <nav
              aria-label="Main"
              className="container mx-auto space-y-2 px-4 py-4 sm:px-6 lg:px-[0.75in]"
            >
              {chain.registryName &&
                navGroups.map((items, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    {groupIndex > 0 && <div className="my-3 h-px bg-border/[0.06]" />}
                    {items.map((item) => {
                      const isActive = isNavItemActive(item, asPath);
                      const Icon = item.icon;
                      const showBadge = item.badge === "needsMe" && needsMyCount > 0;

                      return (
                        <Link
                          key={item.id}
                          href={item.href(chain.registryName)}
                          onClick={closeMenu}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 transition-all",
                              isActive
                                ? "border-l-4 border-l-green-accent bg-muted font-semibold text-foreground"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="flex-1">{item.label}</span>
                            {showBadge && (
                              <span className="text-xs font-medium text-warning">
                                {needsMyCount}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))}

              <div className="my-3 h-px bg-border/[0.06]" />

              {/* Utility block: Back to TOKNS, Donate, wallet */}
              {utilityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.href(chain.registryName)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
              <button
                onClick={() => {
                  setShowDonate(true);
                  closeMenu();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Heart className="h-5 w-5" />
                <span>Donate</span>
              </button>

              <div className="my-3 h-px bg-border/[0.06]" />

              {/* Wallet Section */}
              {walletInfo ? (
                <>
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
                  <button
                    onClick={() => {
                      disconnect();
                      closeMenu();
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
                      closeMenu();
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
                      closeMenu();
                    }}
                    disabled={isConnecting}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/[0.06] px-4 py-3 font-medium text-foreground transition-all hover:bg-muted/50 disabled:opacity-50"
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
