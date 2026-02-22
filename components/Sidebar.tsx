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

export default function Sidebar() {
  const { asPath } = useRouter();
  const { chain } = useChains();
  const { walletInfo, connectKeplr, connectLedger, disconnect, isConnecting, loading } = useWallet();
  const { hasPendingTransactions, totalPendingCount } = usePendingTransactions();
  const [collapsed, setCollapsed] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  const logoPath = "/assets/icons/cliq LIGHT.svg";

  const navItems: { href: string; label: string; icon: typeof Activity; showPending?: boolean }[] = [
    { href: `/${chain.registryName}/operations`, label: "Operations", icon: Activity, showPending: true },
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
        "hidden lg:flex flex-col h-screen sticky top-0 border-r-2 border-border bg-card/50 backdrop-blur-md z-50 transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand & Toggle */}
      <div className={cn(
        "p-6 flex items-center justify-between",
        collapsed && "flex-col gap-6 px-0"
      )}>
        {!collapsed && (
          <Link 
            href={chain.registryName ? `/${chain.registryName}/dashboard` : "/"}
            className="flex items-center gap-3 font-heading font-bold text-xl hover:opacity-80 transition-opacity group overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center">
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
          className={cn(
            "text-muted-foreground hover:text-foreground",
            collapsed && "h-8 w-8"
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      <div className={cn("px-4 mb-6", collapsed && "px-2 text-center")}>
        {!collapsed ? (
          <ChainConnect />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center cursor-help">
                <div className="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {chain.chainDisplayName || "Select Chain"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 px-4 py-2 space-y-1", collapsed && "px-2")}>
        {/* Get Started - prominent CTA at top */}
        {chain.registryName && (
          collapsed ? (
            <Link href={`/${chain.registryName}/get-started`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={asPath === `/${chain.registryName}/get-started` ? "default" : "outline"}
                    size="icon"
                    className={cn(
                      "w-full h-10 mb-2 transition-all",
                      asPath === `/${chain.registryName}/get-started`
                        ? "bg-primary text-primary-foreground"
                        : "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
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
                  "w-full gap-2 h-10 mb-2 font-semibold text-sm transition-all",
                  asPath === `/${chain.registryName}/get-started`
                    ? "bg-primary text-primary-foreground"
                    : "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                )}
              >
                <BookOpen className="h-4 w-4" />
                Get Started
              </Button>
            </Link>
          )
        )}

        {chain.registryName && navItems.map((item) => {
          const isActive = asPath === item.href || 
            (item.label === "My CLIQS" && asPath === `/${chain.registryName}/dashboard`) ||
            (item.label === "Operations" && asPath === `/${chain.registryName}/operations`);
          const Icon = item.icon;
          const showPendingIndicator = item.showPending && hasPendingTransactions;

          const content = (
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-11 px-4 transition-all duration-200 group overflow-hidden relative",
                collapsed ? "px-0 justify-center" : "gap-3",
                isActive
                  ? "bg-muted text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-colors shrink-0",
                isActive ? "text-green-accent" : "group-hover:text-foreground"
              )} />
              {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
              {!collapsed && showPendingIndicator && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-amber-500">{totalPendingCount}</span>
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </div>
                </div>
              )}
              {collapsed && showPendingIndicator && (
                <div className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </div>
              )}
              {!collapsed && isActive && !showPendingIndicator && <ChevronRight className="h-4 w-4 text-green-accent/50 shrink-0" />}
            </Button>
          );

          if (collapsed) {
            return (
              <Link key={item.href} href={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {content}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
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
              <div className="mt-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-left-4 hover:bg-amber-500/20 transition-all cursor-pointer group/pending">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
                  <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover/pending:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-amber-500/80 leading-tight">
                  You have {totalPendingCount} transaction{totalPendingCount !== 1 ? 's' : ''} awaiting signatures.
                </p>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-4 w-10 h-10 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 hover:bg-amber-500/20 transition-all">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {totalPendingCount} Pending Tasks
                </TooltipContent>
              </Tooltip>
            )}
          </Link>
        )}
      </nav>

      {/* Donate Button */}
      <div className={cn("px-4 mb-2", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowDonate(true)}
                size="icon"
                className="w-10 h-10 mx-auto hover:brightness-110 transition-all"
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
            className="w-full gap-2 font-semibold text-sm h-10 hover:brightness-110 transition-all"
            style={{ backgroundColor: "#ff876d", color: "#fff" }}
          >
            <Heart className="h-4 w-4" />
            Donate
          </Button>
        )}
      </div>

      <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />

      {/* Wallet Section */}
      <div className={cn("p-4 mt-auto border-t border-border/50", collapsed && "px-2")}>
        {walletInfo ? (
          <div className="space-y-3">
            {!collapsed ? (
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    alt={walletInfo.type}
                    src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                    width={14}
                    height={14}
                    className={cn(walletInfo.type === "Ledger" && "bg-white p-0.5 rounded-sm")}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {walletInfo.type} Connected
                  </span>
                </div>
                <p className="font-mono text-[11px] truncate text-foreground/80">
                  {truncatedAddress}
                </p>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10 mx-auto rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
                    <Image
                      alt={walletInfo.type}
                      src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                      width={18}
                      height={18}
                      className={cn(walletInfo.type === "Ledger" && "bg-white p-0.5 rounded-sm")}
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
                "justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-9",
                collapsed ? "w-10 h-10 mx-auto justify-center" : "w-full gap-2"
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
                  className={cn("gap-2 text-xs", collapsed && "w-10 h-10 mx-auto")}
                >
                  {loading.keplr ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image src="/assets/icons/keplr.svg" width={14} height={14} alt="Keplr" />}
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
                  className={cn("gap-2 text-xs", collapsed && "w-10 h-10 mx-auto")}
                >
                  {loading.ledger ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image src="/assets/icons/ledger.svg" width={14} height={14} alt="Ledger" className="bg-white p-0.5 rounded-sm" />}
                  {!collapsed && "Ledger"}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Connect Ledger</TooltipContent>}
            </Tooltip>
          </div>
        )}

        {/* Footer Links */}
        <div className={cn(
          "mt-4 flex items-center justify-between px-2",
          collapsed && "flex-col gap-4 px-0"
        )}>
          <a 
            href="https://github.com/cosmos/cosmos-multisig-ui" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          {!collapsed && (
            <div className="flex items-center gap-3">
               <span className="text-[10px] text-muted-foreground font-mono">v1.2.0</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
