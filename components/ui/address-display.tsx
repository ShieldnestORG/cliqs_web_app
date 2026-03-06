import * as React from "react";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/displayHelpers";
import { CopyButton } from "./copy-button";

interface AddressDisplayProps {
  address: string;
  copyLabel?: string;
  head?: number;
  tail?: number;
  className?: string;
  showCopy?: boolean;
}

export function AddressDisplay({
  address,
  copyLabel = "address",
  head = 8,
  tail = 6,
  className,
  showCopy = true,
}: AddressDisplayProps) {
  if (!address) return null;

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <span className="truncate font-mono text-xs text-foreground" title={address}>
        {truncateAddress(address, head, tail)}
      </span>
      {showCopy && (
        <CopyButton
          value={address}
          copyLabel={copyLabel}
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
        />
      )}
    </div>
  );
}
