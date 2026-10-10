/**
 * Validator Identity Strip
 *
 * One slim row under the page title: moniker, status tag, commission rate, operator and
 * account addresses (each with a copy button) and the explorer link. It replaced the identity
 * card on 2026-10-10 (no card chrome, no "Validator" label). The jailed warning and the Unjail
 * action moved to JailedAlert, at the very top of the dashboard.
 *
 * The explorer link is icon-only (since 2026-10-10): with a text label it was 102px wide
 * and wrapped to a second row at 1024px for a validator like TOKNS.FI (the other five parts take
 * about 707px of a 792px row). Below 1024px the strip may still wrap.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { ExternalLink } from "lucide-react";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { useChains } from "@/context/ChainsContext";
import { AddressDisplay } from "@/components/ui/address-display";

interface ValidatorIdentityCardProps {
  validator: ValidatorInfo;
}

export default function ValidatorIdentityCard({ validator }: ValidatorIdentityCardProps) {
  const { chain } = useChains();

  // A status tag: each state has its own colour AND its own mark. Active = green signal meter,
  // Unbonding = gold half-lit dot, Jailed = red hazard bar, anything else = a quiet dashed ring.
  const getStatusConfig = (status: ValidatorInfo["status"], jailed: boolean) => {
    if (jailed) {
      return { label: "Jailed", variant: "destructive" as const, mark: "stripes" as const };
    }

    switch (status) {
      case "BONDED":
        return { label: "Active", variant: "success" as const, mark: "signal" as const };
      case "UNBONDING":
        return { label: "Unbonding", variant: "warning" as const, mark: "half" as const };
      default:
        return { label: "Inactive", variant: "secondary" as const, mark: "ring" as const };
    }
  };

  const statusConfig = getStatusConfig(validator.status, validator.jailed);

  // Format commission rate (stored as 18-decimal string)
  const formatCommissionRate = (rate: string): string => {
    if (!rate || rate === "0") return "0%";
    // Rate is stored as decimal * 10^18, so "0.050000000000000000" means 5%
    // The string might already be formatted, let's handle both cases
    if (rate.includes(".")) {
      const numRate = parseFloat(rate);
      return `${(numRate * 100).toFixed(1)}%`;
    }
    // If it's a big integer string
    const numRate = parseInt(rate, 10) / 1e18;
    return `${(numRate * 100).toFixed(1)}%`;
  };

  const explorerLink = explorerLinkAccount(chain.explorerLinks.account, validator.operatorAddress);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-4">
        <h2 className="min-w-0 truncate font-heading text-xl font-bold">{validator.moniker}</h2>
        <Badge variant={statusConfig.variant} mark={statusConfig.mark} className="shrink-0">
          {statusConfig.label}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Commission{" "}
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {formatCommissionRate(validator.commissionRate)}
        </span>
      </p>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Operator</span>
        <AddressDisplay
          address={validator.operatorAddress}
          copyLabel="operator address"
          head={6}
          tail={4}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Account</span>
        <AddressDisplay
          address={validator.delegatorAddress}
          copyLabel="account address"
          head={6}
          tail={4}
        />
      </div>

      {explorerLink && (
        <Button variant="ghost" size="icon-sm" className="shrink-0 max-sm:h-11 max-sm:w-11" asChild>
          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View validator in explorer"
            title="View in explorer"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}
