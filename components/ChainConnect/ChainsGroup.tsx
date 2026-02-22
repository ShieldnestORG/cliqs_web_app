import { ChainInfo } from "@/context/ChainsContext/types";
import { useEffect, useRef, useState } from "react";
import { CommandGroup } from "../ui/command";
import ChainItem from "./ChainItem";

interface ChainsGroupProps {
  readonly chains: readonly ChainInfo[];
  readonly heading: string;
  readonly emptyMsg: string;
}

export default function ChainsGroup({ chains, heading, emptyMsg }: ChainsGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numChainsToRender, setNumChainsToRender] = useState(10);

  useEffect(() => {
    // Unblock the main thread
    setTimeout(() => {
      if (numChainsToRender < chains.length) {
        setNumChainsToRender((prev) => prev + 10);
      }
    }, 0);
  }, [chains.length, numChainsToRender]);

  // Don't render empty groups without chains
  if (chains.length === 0) {
    return null;
  }

  return (
    <CommandGroup
      heading={heading}
      className="[&_[cmdk-group-heading]]:mb-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:before:content-['//\_'] [&_[cmdk-group-heading]]:before:opacity-60"
    >
      {chains.length ? (
        <div ref={containerRef} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {chains.slice(0, numChainsToRender).map((chain) => (
            <ChainItem
              key={chain.registryName}
              chain={chain}
              hoverCardElementBoundary={containerRef.current}
            />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">{emptyMsg}</p>
      )}
    </CommandGroup>
  );
}
