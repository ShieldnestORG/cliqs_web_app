/**
 * Validator Performance Card
 *
 * File: components/dataViews/ValidatorDashboard/ValidatorPerformanceCard.tsx
 *
 * Displays validator performance metrics including voting power, delegators, and ranking.
 */

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { useChains } from "@/context/ChainsContext";
import { 
  TrendingUp, 
  Users, 
  Award, 
  Percent, 
  Coins,
  BarChart3
} from "lucide-react";

interface ValidatorPerformanceCardProps {
  data: ValidatorDashboardData;
}

export default function ValidatorPerformanceCard({ data }: ValidatorPerformanceCardProps) {
  const { chain } = useChains();
  const { validator, delegatorsCount, selfDelegation, ranking, votingPowerPercentage } = data;

  // Format token amounts
  const displayDenom = chain.displayDenom || chain.denom;
  const decimals = chain.displayDenomExponent || 6;

  const formatTokens = (amount: string): string => {
    if (!amount || amount === "0") return "0";
    const num = parseInt(amount, 10);
    const formatted = num / Math.pow(10, decimals);
    
    if (formatted >= 1_000_000) {
      return `${(formatted / 1_000_000).toFixed(2)}M`;
    }
    if (formatted >= 1_000) {
      return `${(formatted / 1_000).toFixed(2)}K`;
    }
    return formatted.toFixed(2);
  };

  // Format commission rate
  const formatCommissionRate = (rate: string): string => {
    if (!rate || rate === "0") return "0%";
    if (rate.includes(".")) {
      const numRate = parseFloat(rate);
      return `${(numRate * 100).toFixed(1)}%`;
    }
    const numRate = parseInt(rate, 10) / 1e18;
    return `${(numRate * 100).toFixed(1)}%`;
  };

  const stats = [
    {
      icon: TrendingUp,
      label: "Voting Power",
      value: `${votingPowerPercentage}%`,
      subtext: "of network",
    },
    {
      icon: Award,
      label: "Ranking",
      value: ranking ? `#${ranking}` : "—",
      subtext: "in active set",
    },
    {
      icon: Users,
      label: "Delegators",
      value: delegatorsCount.toLocaleString(),
      subtext: "total",
    },
    {
      icon: Coins,
      label: "Total Stake",
      value: formatTokens(validator.tokens),
      subtext: displayDenom,
    },
    {
      icon: BarChart3,
      label: "Self-Delegation",
      value: selfDelegation ? formatTokens(selfDelegation.amount) : "0",
      subtext: displayDenom,
    },
    {
      icon: Percent,
      label: "Commission",
      value: formatCommissionRate(validator.commissionRate),
      subtext: "rate",
    },
  ];

  return (
    <Card variant="institutional" className="h-full">
      <CardHeader>
        <CardLabel comment>Metrics</CardLabel>
        <CardTitle className="text-xl font-heading font-bold">
          Validator Performance
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-mono uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <div>
                  <span className="text-2xl font-heading font-bold tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {stat.subtext}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Min Self-Delegation Info */}
        {validator.minSelfDelegation && validator.minSelfDelegation !== "1" && (
          <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Min Self-Delegation</span>
              <span className="font-mono text-foreground">
                {formatTokens(validator.minSelfDelegation)} {displayDenom}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

