/**
 * Validator Identity Strip
 *
 * One slim row under the page title: moniker, status badge, commission rate, operator and
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
import { ExternalLink, Shield, AlertTriangle, CircleDashed } from "lucide-react";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { useChains } from "@/context/ChainsContext";
import { AddressDisplay } from "@/components/ui/address-display";

interface ValidatorIdentityCardProps {
  validator: ValidatorInfo;
}

export default function ValidatorIdentityCard({ validator }: ValidatorIdentityCardProps) {
  const { chain } = useChains();

  // Active = success, Unbonding = warning, Jailed = destructive; anything else is a quiet outline.
  const getStatusConfig = (status: ValidatorInfo["status"], jailed: boolean) => {
    if (jailed) {
      return { label: "Jailed", variant: "destructive" as const, icon: AlertTriangle };
    }

    switch (status) {
      case "BONDED":
        return { label: "Active", variant: "success" as const, icon: Shield };
      case "UNBONDING":
        return { label: "Unbonding", variant: "warning" as const, icon: CircleDashed };
      default:
        return { label: "Inactive", variant: "outline" as const, icon: CircleDashed };
    }
  };

  const statusConfig = getStatusConfig(validator.status, validator.jailed);
  const StatusIcon = statusConfig.icon;

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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="min-w-0 truncate font-heading text-xl font-bold">{validator.moniker}</h2>
        <Badge variant={statusConfig.variant} className="shrink-0">
          <StatusIcon className="mr-1 h-3 w-3" />
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
