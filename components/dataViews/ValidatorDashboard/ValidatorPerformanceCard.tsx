/**
 * Validator Performance
 *
 * Three headline stats (voting power, ranking, stakers) with kit icons, then the secondary
 * figures (total stake, self-delegation, commission, minimum self-delegation) on one quiet line.
 * Renders its content only; the Performance panel (card) comes from ValidatorDashboard/index.tsx.
 * Until 2026-10-10 this was six bordered tiles in a card of its own.
 *
 * A figure that could not be fetched is `null` and reads as an em dash with a screen-reader
 * "unavailable", never as "0" (a real, measured zero still reads "0"). Until 2026-10-10 a failed
 * stakers fetch read "0 total" and a failed pool query read "0%".
 */

import { ValidatorDashboardData } from "@/lib/validatorHelpers";
import { useChains } from "@/context/ChainsContext";
import { KitIcon, KitIconName } from "@/components/icons/kit";

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

  const headline: { icon: KitIconName; label: string; value: string | null; subtext: string }[] = [
    {
      icon: "portfolio",
      label: "Voting Power",
      value: votingPowerPercentage === null ? null : `${votingPowerPercentage}%`,
      subtext: "of network",
    },
    {
      icon: "rank",
      label: "Ranking",
      value: ranking ? `#${ranking}` : null,
      subtext: "in active set",
    },
    {
      icon: "stakers",
      label: "Stakers",
      value: delegatorsCount === null ? null : delegatorsCount.toLocaleString(),
      subtext: "total",
    },
  ];

  const secondary = [
    { label: "Total Stake", value: `${formatTokens(validator.tokens)} ${displayDenom}` },
    {
      label: "Self-Delegation",
      value: `${selfDelegation ? formatTokens(selfDelegation.amount) : "0"} ${displayDenom}`,
    },
    { label: "Commission", value: formatCommissionRate(validator.commissionRate) },
    // Min self-delegation is only worth a line when the validator set one above the chain default
    ...(validator.minSelfDelegation && validator.minSelfDelegation !== "1"
      ? [
          {
            label: "Min Self-Delegation",
            value: `${formatTokens(validator.minSelfDelegation)} ${displayDenom}`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        {headline.map((stat) => (
          <div key={stat.label} className="min-w-0 space-y-1.5">
            <KitIcon name={stat.icon} size={28} className="text-foreground" />
            <dt className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </dt>
            <dd>
              {/* `relative` contains the sr-only word (it is absolutely positioned) */}
              <span className="relative font-heading text-xl font-bold tabular-nums sm:text-2xl">
                {stat.value === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">unavailable</span>
                  </>
                ) : (
                  stat.value
                )}
              </span>
              <span className="block text-xs text-muted-foreground">{stat.subtext}</span>
            </dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-x-8 gap-y-1.5 border-t border-border/[0.06] pt-3 text-sm">
        {secondary.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-mono tabular-nums text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
