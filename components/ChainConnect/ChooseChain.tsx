import { useChains } from "@/context/ChainsContext";
import { getRecentChainsFromStorage } from "@/context/ChainsContext/storage";
import { ChainInfo } from "@/context/ChainsContext/types";
import { isTestnetsEnabled } from "@/lib/chainRegistry";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandList, CommandSeparator } from "../ui/command";
import ChainsGroup from "./ChainsGroup";

export default function ChooseChain() {
  const { chains } = useChains();
  const [recentChains, setRecentChains] = useState<readonly ChainInfo[]>([]);

  useEffect(() => {
    // Unblock the main thread
    setTimeout(() => {
      const newRecentChains = getRecentChainsFromStorage(chains);
      setRecentChains(newRecentChains);
    }, 0);
  }, [chains]);

  return (
    <Command className="flex min-h-0 flex-1 flex-col bg-transparent">
      {/* Search Input */}
      <div className="flex-shrink-0 border-b border-border bg-muted/20 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <CommandInput
            hideIcon
            placeholder="Search by chain name or ID..."
            className="h-11 w-full rounded-lg border-2 border-border bg-card pl-10 pr-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
          />
        </div>
      </div>

      {/* Chain List - Scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <CommandList className="max-h-none [&>[cmdk-list-sizer]]:space-y-4">
          <CommandEmpty className="flex flex-col items-center justify-center py-12 text-center">
            <div className="icon-container mb-4 h-12 w-12 rounded-lg opacity-50">
              <Search className="h-6 w-6" />
            </div>
            <p className="font-heading text-lg font-semibold text-foreground">No chains found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term or add a custom chain
            </p>
          </CommandEmpty>

          {recentChains.length > 0 && (
            <>
              <ChainsGroup
                chains={recentChains}
                heading="Recent"
                emptyMsg="No recent chains found."
              />
              <CommandSeparator className="my-4 bg-border/50" />
            </>
          )}

          <ChainsGroup
            chains={Array.from(chains.localnets.values())}
            heading="Custom Chains"
            emptyMsg="No custom chains. Add one using the Custom chain tab."
          />

          {chains.localnets.size > 0 && <CommandSeparator className="my-4 bg-border/50" />}

          <ChainsGroup
            chains={Array.from(chains.mainnets.values())}
            heading="Mainnets"
            emptyMsg="No mainnets found."
          />

          {isTestnetsEnabled() && (
            <>
              <CommandSeparator className="my-4 bg-border/50" />

              <ChainsGroup
                chains={Array.from(chains.testnets.values())}
                heading="Testnets"
                emptyMsg="No testnets found."
              />
            </>
          )}
        </CommandList>
      </div>
    </Command>
  );
}
