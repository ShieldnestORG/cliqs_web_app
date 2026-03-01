import { useChains } from "@/context/ChainsContext";
import { setNewConnection } from "@/context/ChainsContext/helpers";
import { ChainInfo } from "@/context/ChainsContext/types";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { CommandItem } from "../ui/command";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import ChainDigest from "./ChainDigest";

interface ChainItemProps {
  readonly chain: ChainInfo;
  readonly hoverCardElementBoundary: HTMLDivElement | null;
}

export default function ChainItem({ chain, hoverCardElementBoundary }: ChainItemProps) {
  const { chain: connectedChain, chainsDispatch } = useChains();
  const isConnected = connectedChain.registryName === chain.registryName;

  return (
    <HoverCard key={chain.registryName} openDelay={400}>
      <HoverCardTrigger asChild>
        <CommandItem
          value={chain.registryName}
          onSelect={
            isConnected
              ? () => {}
              : () => {
                  setNewConnection(chainsDispatch, { action: "confirm", chain });
                }
          }
          className={cn(
            "group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-purple)/0.5)]",
            "aria-selected:bg-muted/50",
            isConnected
              ? "cursor-default border-[hsl(var(--accent-green))] bg-[hsl(var(--accent-green)/0.1)]"
              : "border-border bg-card hover:border-[hsl(var(--accent-green)/0.5)] hover:bg-muted/30",
          )}
        >
          {/* Connected Badge */}
          {isConnected && (
            <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--accent-green))] shadow-md">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </div>
          )}

          {/* Chain Logo */}
          <Avatar className="h-10 w-10 shrink-0 border-2 border-border bg-muted">
            <AvatarImage
              src={chain.logo}
              alt={`${chain.chainDisplayName} logo`}
              className="h-full w-full"
            />
            <AvatarFallback className="bg-muted font-mono text-xs font-semibold text-muted-foreground">
              {chain.registryName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Chain Name */}
          <span
            className={cn(
              "block min-h-[1.25rem] text-center font-mono text-[11px] font-medium leading-tight",
              isConnected ? "text-[hsl(var(--accent-green-bright))]" : "text-foreground",
            )}
          >
            {chain.registryName}
          </span>
        </CommandItem>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-auto border-2 border-border bg-card p-4 shadow-lg"
        collisionBoundary={hoverCardElementBoundary}
        side="right"
        align="start"
      >
        <ChainDigest chain={chain} />
      </HoverCardContent>
    </HoverCard>
  );
}
