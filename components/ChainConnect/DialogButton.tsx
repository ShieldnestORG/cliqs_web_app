import { useChains } from "@/context/ChainsContext";
import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { ChevronDown, Link } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DialogTrigger } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";

export function ChainHeader() {
  const { chain } = useChains();

  return isChainInfoFilled(chain) ? (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Avatar className="h-7 w-7 border border-border">
          <AvatarImage src={chain.logo} alt={`${chain.chainDisplayName} logo`} />
          <AvatarFallback className="bg-muted text-[10px] font-mono">
            {chain.registryName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Connected indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-card bg-[hsl(var(--accent-green))]">
          <span className="sr-only">Connected</span>
        </div>
      </div>
      <span className="font-heading text-xs font-semibold text-foreground">
        {chain.chainDisplayName}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Skeleton className="h-7 w-7 rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export default function DialogButton() {
  const showChainSelect = process.env.NEXT_PUBLIC_MULTICHAIN?.toLowerCase() === "true";

  return showChainSelect ? (
    <DialogTrigger asChild>
      <button className="group relative flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 transition-all duration-200 hover:border-[hsl(var(--accent-green)/0.5)] hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-purple)/0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <ChainHeader />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground group-data-[state=open]:rotate-180" />
      </button>
    </DialogTrigger>
  ) : (
    <div className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5">
      <Link className="h-3.5 w-3.5 text-[hsl(var(--accent-green))]" />
      <ChainHeader />
    </div>
  );
}
