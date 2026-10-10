/**
 * Validator Performance Test
 *
 * File: __tests__/components/validator-performance.test.tsx
 *
 * The Performance section of the validator dashboard (ValidatorPerformanceCard):
 *   - one word for the same people: the headline tile says "Stakers" (the section beside it is
 *     "Stakers"), never "Delegators"; chain terms in the data rows stay ("Self-Delegation")
 *   - the three headline stats and the secondary line keep their figures
 *   - a figure that could not be fetched (null) reads as an em dash with a screen-reader
 *     "unavailable", never as "0"; a real, measured zero still reads "0". Until 2026-10-10 a failed
 *     stakers fetch read "0 total" and a failed pool query read "0%".
 *
 * Priority: P2
 */

import { render, screen, within } from "@testing-library/react";
import ValidatorPerformanceCard from "@/components/dataViews/ValidatorDashboard/ValidatorPerformanceCard";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: { denom: "utestcore", displayDenom: "TESTCORE", displayDenomExponent: 6 },
  }),
}));

const data = (over: Record<string, unknown> = {}) =>
  ({
    validator: {
      tokens: "2500000000",
      commissionRate: "0.050000000000000000",
      minSelfDelegation: "1000000",
    },
    delegatorsCount: 645,
    selfDelegation: { denom: "utestcore", amount: "1000000000" },
    ranking: 12,
    votingPowerPercentage: "2.74",
    ...over,
  }) as unknown as ValidatorDashboardData;

describe("ValidatorPerformanceCard labels: P2", () => {
  it("calls the staker tile 'Stakers', never 'Delegators'", () => {
    render(<ValidatorPerformanceCard data={data()} />);

    expect(screen.getByText("Stakers")).toBeInTheDocument();
    expect(screen.queryByText(/^Delegators$/i)).not.toBeInTheDocument();
    expect(screen.getByText("645")).toBeInTheDocument();
  });

  it("keeps the other headline stats and the chain terms in the data rows", () => {
    render(<ValidatorPerformanceCard data={data()} />);

    expect(screen.getByText("Voting Power")).toBeInTheDocument();
    expect(screen.getByText("2.74%")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Self-Delegation")).toBeInTheDocument();
    expect(screen.getByText("Min Self-Delegation")).toBeInTheDocument();
  });
});

describe("ValidatorPerformanceCard unavailable figures: P2", () => {
  const tile = (label: string) => screen.getByText(label).closest("div") as HTMLElement;

  it.each([
    ["Voting Power", { votingPowerPercentage: null }],
    ["Ranking", { ranking: null }],
    ["Stakers", { delegatorsCount: null }],
  ])("%s shows an em dash and 'unavailable' for null, never a zero", (label, over) => {
    render(<ValidatorPerformanceCard data={data(over)} />);

    expect(within(tile(label)).getByText("—")).toBeInTheDocument();
    expect(within(tile(label)).getByText("unavailable")).toHaveClass("sr-only");
    expect(tile(label)).not.toHaveTextContent(/(^|[^\d.])0%?(?![\d.])/);
  });

  it("marks only the null tile: the other two keep their figures", () => {
    render(<ValidatorPerformanceCard data={data({ delegatorsCount: null })} />);

    expect(screen.getAllByText("—")).toHaveLength(1);
    expect(screen.getAllByText("unavailable")).toHaveLength(1);
    expect(screen.getByText("2.74%")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
  });

  it("shows three dashes and never a zero when all three are null", () => {
    render(
      <ValidatorPerformanceCard
        data={data({ votingPowerPercentage: null, ranking: null, delegatorsCount: null })}
      />,
    );

    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getAllByText("unavailable")).toHaveLength(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("still shows a real, measured zero as '0'", () => {
    render(<ValidatorPerformanceCard data={data({ delegatorsCount: 0 })} />);

    expect(within(tile("Stakers")).getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("unavailable")).not.toBeInTheDocument();
  });

  it("still shows a measured 0% voting power as '0%'", () => {
    render(<ValidatorPerformanceCard data={data({ votingPowerPercentage: "0" })} />);

    expect(within(tile("Voting Power")).getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("unavailable")).not.toBeInTheDocument();
  });

  it("keeps the sr-only word inside a positioned element so it cannot escape a scroll box", () => {
    render(<ValidatorPerformanceCard data={data({ ranking: null })} />);

    expect(screen.getByText("unavailable").parentElement).toHaveClass("relative");
  });
});
