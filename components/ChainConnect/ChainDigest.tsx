import { useChains } from "@/context/ChainsContext";
import { deleteLocalChainFromStorage } from "@/context/ChainsContext/storage";
import { ChainInfo } from "@/context/ChainsContext/types";
import { CheckCircle2, ChevronDown, Coins, ExternalLink, Globe, Server } from "lucide-react";
import Link from "next/link";
import ButtonWithConfirm from "../inputs/ButtonWithConfirm";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

interface ChainItemProps {
  readonly chain: ChainInfo;
  readonly simplify?: boolean;
}

export default function ChainDigest({ chain, simplify }: ChainItemProps) {
  const { chain: connectedChain, chains } = useChains();
  const isConnected = connectedChain.registryName === chain.registryName;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12 border-2 border-border">
            <AvatarImage
              src={chain.logo}
              alt={`${chain.chainDisplayName} logo`}
              className="h-full w-full"
            />
            <AvatarFallback className="bg-muted font-mono text-sm font-semibold">
              {chain.registryName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!simplify && isConnected && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--accent-green))] shadow-md">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-base font-semibold text-foreground">
            {chain.chainDisplayName}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-border bg-muted/50 font-mono text-[10px] text-muted-foreground"
            >
              {chain.chainId}
            </Badge>
            {isConnected && (
              <Badge className="bg-[hsl(var(--accent-green)/0.2)] text-[10px] text-[hsl(var(--accent-green-bright))]">
                Connected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Chain Details */}
      <div className="space-y-2">
        {/* Fee Token */}
        <div className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Fee Token:</span>
          <span className="font-mono font-medium text-foreground">{chain.displayDenom}</span>
        </div>

        {/* RPC Endpoints */}
        <Collapsible className="w-full">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {chain.nodeAddresses.length > 1 ? "RPC Endpoints:" : "RPC Endpoint:"}
            </span>
            {!simplify && chain.nodeAddresses.length > 1 && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="mr-1">{chain.nodeAddresses.length}</span>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <code className="block truncate font-mono text-xs text-foreground">
              {chain.nodeAddress || chain.nodeAddresses[0]}
            </code>
          </div>
          <CollapsibleContent className="mt-2 space-y-2">
            {chain.nodeAddresses
              .filter(
                (address, _, nodeAddresses) =>
                  (chain.nodeAddress && address !== chain.nodeAddress) ||
                  (!chain.nodeAddress && address !== nodeAddresses[0]),
              )
              .map((address) => (
                <div
                  key={address}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <code className="block truncate font-mono text-xs text-foreground">{address}</code>
                </div>
              ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Actions */}
      {!simplify && (
        <div className="border-t border-border pt-3">
          {chains.localnets.has(chain.registryName) ? (
            <ButtonWithConfirm
              onClick={() => {
                deleteLocalChainFromStorage(chain.registryName, chains);
              }}
              text="Delete custom chain"
              confirmText="Confirm deletion?"
              disabled={isConnected}
            />
          ) : (
            <Link
              href={`https://github.com/cosmos/chain-registry/tree/master/${
                chains.testnets.has(chain.registryName) ? `testnets/` : ""
              }${chain.registryName}`}
              target="_blank"
              className="group flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-[hsl(var(--accent-purple))]"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>View on Chain Registry</span>
              <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
