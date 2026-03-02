/**
 * Validator Identity Card
 *
 * File: components/dataViews/ValidatorDashboard/ValidatorIdentityCard.tsx
 *
 * Displays validator moniker, status, commission rate, and operator address.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { ExternalLink, Shield, AlertTriangle, CircleDashed } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { useChains } from "@/context/ChainsContext";

interface ValidatorIdentityCardProps {
  validator: ValidatorInfo;
}

export default function ValidatorIdentityCard({ validator }: ValidatorIdentityCardProps) {
  const { chain } = useChains();

  const getStatusConfig = (status: ValidatorInfo["status"], jailed: boolean) => {
    if (jailed) {
      return {
        label: "Jailed",
        variant: "destructive" as const,
        icon: AlertTriangle,
        className: "bg-destructive/20 text-destructive border-destructive/30",
      };
    }

    switch (status) {
      case "BONDED":
        return {
          label: "Active",
          variant: "default" as const,
          icon: Shield,
          className: "bg-green-accent/20 text-green-accent border-green-accent/30",
        };
      case "UNBONDING":
        return {
          label: "Unbonding",
          variant: "secondary" as const,
          icon: CircleDashed,
          className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
        };
      default:
        return {
          label: "Inactive",
          variant: "outline" as const,
          icon: CircleDashed,
          className: "bg-muted text-muted-foreground border-border",
        };
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
    <Card variant="institutional" bracket="green" className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardLabel comment>Validator</CardLabel>
            <CardTitle className="truncate font-heading text-xl font-bold">
              {validator.moniker}
            </CardTitle>
          </div>
          <Badge className={statusConfig.className}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Commission Rate */}
        <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
          <span className="text-sm text-muted-foreground">Commission Rate</span>
          <span className="font-mono font-semibold text-foreground">
            {formatCommissionRate(validator.commissionRate)}
          </span>
        </div>

        {/* Operator Address */}
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Operator Address
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted/30 px-3 py-2 font-mono text-xs text-foreground">
              {validator.operatorAddress}
            </code>
            <CopyButton value={validator.operatorAddress} copyLabel="operator address" />
          </div>
        </div>

        {/* Account Address */}
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Account Address
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted/30 px-3 py-2 font-mono text-xs text-foreground">
              {validator.delegatorAddress}
            </code>
            <CopyButton value={validator.delegatorAddress} copyLabel="account address" />
          </div>
        </div>

        {/* Explorer Link */}
        {explorerLink && (
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={explorerLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View in Explorer
            </a>
          </Button>
        )}

        {/* Jailed Warning */}
        {validator.jailed && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Validator Jailed</p>
                <p className="mt-1 text-muted-foreground">
                  Your validator has been jailed. You can still claim pending rewards.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
