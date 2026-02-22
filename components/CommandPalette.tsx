"use client";

import { useChains } from "@/context/ChainsContext";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Plus,
  Search,
  ArrowRight,
  Wallet,
  FileText,
  Layers,
  Globe,
  Command as CommandIcon,
  X,
  Home,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { chain } = useChains();

  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  const setIsOpen = onOpenChange || setOpen;

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setIsOpen]);

  const runCommand = useCallback(
    (command: () => void) => {
      setIsOpen(false);
      command();
    },
    [setIsOpen]
  );

  const navigationItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      shortcut: "⌘D",
      action: () => chain.registryName && router.push(`/${chain.registryName}/dashboard`),
    },
    {
      icon: Home,
      label: "Landing Page",
      shortcut: "⌘H",
      action: () => chain.registryName && router.push(`/${chain.registryName}`),
    },
    {
      icon: Plus,
      label: "Create Multisig",
      shortcut: "⌘N",
      action: () => chain.registryName && router.push(`/${chain.registryName}/create`),
    },
  ];

  const quickActions = [
    {
      icon: Search,
      label: "Find Multisig",
      description: "Search for an existing multisig address",
      action: () => router.push(`/${chain.registryName}/dashboard?tab=find`),
    },
    {
      icon: FileText,
      label: "New Transaction",
      description: "Create a new transaction",
      action: () => {
        const address = router.query.address;
        if (address) {
          router.push(`/${chain.registryName}/${address}/transaction/new`);
        } else {
          router.push(`/${chain.registryName}/dashboard?tab=multisigs`);
        }
      },
    },
    {
      icon: Wallet,
      label: "Connect Wallet",
      description: "Connect your Keplr wallet",
      action: () => router.push(`/${chain.registryName}/account`),
    },
  ];

  const chainInfo = [
    {
      icon: Globe,
      label: `Switch Chain`,
      description: `Current: ${chain.chainDisplayName || "Select Chain"}`,
      action: () => router.push("/"),
    },
    {
      icon: Layers,
      label: "View Network",
      description: `${chain.chainId || "No chain selected"}`,
      action: () => {
        const explorerUrl = chain.explorerLinks?.tx || chain.explorerLinks?.account;
        if (explorerUrl) {
          // Remove template placeholders to get base explorer URL
          const baseUrl = explorerUrl.replace(/\$\{[^}]+\}/g, "").replace(/\/$/, "");
          window.open(baseUrl, "_blank");
        }
      },
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl w-[90vw] p-0 gap-0 overflow-hidden">
        {/* Custom close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        <Command className="rounded-xl border-0">
          {/* Header */}
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <CommandInput 
                placeholder="Type a command or search..." 
                className="h-12 text-lg border-0 focus:ring-0 px-0"
              />
            </div>
            <kbd className="hidden sm:inline-flex h-8 select-none items-center gap-1 rounded-md border bg-muted px-3 font-mono text-sm font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          <CommandList className="max-h-[500px] overflow-y-auto p-4">
            <CommandEmpty className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium">No results found</p>
                <p className="text-sm text-muted-foreground">Try a different search term</p>
              </div>
            </CommandEmpty>

            <CommandGroup heading="Navigation" className="pb-4">
              <div className="grid gap-2">
                {navigationItems.map((item) => (
                  <CommandItem
                    key={item.label}
                    onSelect={() => runCommand(item.action)}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl cursor-pointer"
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="flex-1 text-base font-medium">{item.label}</span>
                    <CommandShortcut className="text-sm px-2 py-1 rounded-md bg-muted">
                      {item.shortcut}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </div>
            </CommandGroup>

            <CommandSeparator className="my-4" />

            <CommandGroup heading="Quick Actions" className="pb-4">
              <div className="grid gap-2">
                {quickActions.map((item) => (
                  <CommandItem
                    key={item.label}
                    onSelect={() => runCommand(item.action)}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl cursor-pointer"
                  >
                    <item.icon className="h-6 w-6" />
                    <div className="flex-1">
                      <p className="text-base font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CommandItem>
                ))}
              </div>
            </CommandGroup>

            <CommandSeparator className="my-4" />

            <CommandGroup heading="Chain" className="pb-4">
              <div className="grid gap-2">
                {chainInfo.map((item) => (
                  <CommandItem
                    key={item.label}
                    onSelect={() => runCommand(item.action)}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl cursor-pointer"
                  >
                    <item.icon className="h-6 w-6" />
                    <div className="flex-1">
                      <p className="text-base font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </div>
            </CommandGroup>
          </CommandList>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 border-t px-6 py-4 bg-muted/30">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-xs">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-xs">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-xs">ESC</kbd>
                Close
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CommandIcon className="h-3.5 w-3.5" />
              <span>Command Palette</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Keyboard shortcut hint component for the header
export function CommandPaletteTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all group"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="font-mono">Search...</span>
      <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium opacity-70 group-hover:opacity-100">
        <CommandIcon className="h-3 w-3" />K
      </kbd>
    </button>
  );
}
