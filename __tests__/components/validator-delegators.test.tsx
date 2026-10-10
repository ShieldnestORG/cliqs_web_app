/**
 * Validator Delegators Test
 *
 * File: __tests__/components/validator-delegators.test.tsx
 *
 * The Stakers section of the validator dashboard (ValidatorDelegatorsCard):
 *   - a summary line "645 stakers · 0 unbonding" that is also the tab list
 *   - the top 5 stakers show at once; "Show all" opens the rest in a drop-down with its own
 *     scroll, and "Show fewer" folds it back
 *   - the Unbonding tab stays reachable and keeps its table
 *   - the two tab triggers are a 44px tap target on a phone (max-sm:min-h-11); they measured 34px
 *     at 375px wide, and docs/ui/VALIDATOR-DASHBOARD-PRD.md promises 44px
 *   - the scroll box is a positioned ancestor (`relative`): jsdom does no layout, so this class
 *     is the one thing a test can pin about the page-height bug below
 *
 * Measured 2026-10-10 in a real browser (/tx/validator, 645 stakers): after "Show all" the page
 * grew from 1,939px to 29,805px. Every row's copy button holds an absolutely positioned sr-only
 * label; with no positioned scroll box those labels escape its clip and stretch <main>. The old
 * list sat in a shadcn Table, whose wrapper is `relative`, so it never showed.
 *
 * Priority: P1
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import ValidatorDelegatorsCard from "@/components/dataViews/ValidatorDashboard/ValidatorDelegatorsCard";
import { ValidatorDashboardData } from "@/lib/validatorHelpers";

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      denom: "utestcore",
      displayDenom: "TESTCORE",
      displayDenomExponent: 6,
      explorerLinks: { account: "https://explorer.invalid/accounts/${accountAddress}" },
    },
  }),
}));

const delegation = (n: number) => ({
  delegation: {
    delegatorAddress: `testcore1staker${String(n).padStart(2, "0")}aaaaaaaaaaaaaaaaaaaa`,
  },
  balance: { amount: String((100 - n) * 1_000_000) },
});

const data = (stakers: number, unbonding = 0) =>
  ({
    delegations: Array.from({ length: stakers }, (_, i) => delegation(i + 1)),
    unbondingDelegations: Array.from({ length: unbonding }, (_, i) => ({
      delegatorAddress: `testcore1leaver${i}aaaaaaaaaaaaaaaaaaaa`,
      entries: [{ balance: "5000000", completionTime: { seconds: BigInt(1_790_000_000) } }],
    })),
  }) as unknown as ValidatorDashboardData;

const rows = () => screen.getAllByRole("listitem");

const UNAVAILABLE_STAKERS = "Stakers unavailable right now. Use Refresh to try again.";
const UNAVAILABLE_UNBONDING = "Unbonding unavailable right now. Use Refresh to try again.";

/** Same as data(), but with either list failed (null = the fetch failed; [] = none). */
const failed = (which: "stakers" | "unbonding" | "both", stakers = 7, unbonding = 2) => {
  const base = data(stakers, unbonding);
  return {
    ...base,
    delegations: which === "unbonding" ? base.delegations : null,
    unbondingDelegations: which === "stakers" ? base.unbondingDelegations : null,
  } as ValidatorDashboardData;
};

describe("ValidatorDelegatorsCard summary line: P1", () => {
  it("reads '645 stakers' and '0 unbonding' as the two tabs", () => {
    render(<ValidatorDelegatorsCard data={data(7)} />);

    expect(screen.getByRole("tab", { name: "7 stakers" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "0 unbonding" })).toBeInTheDocument();
  });

  it("uses the singular for one staker", () => {
    render(<ValidatorDelegatorsCard data={data(1)} />);

    expect(screen.getByRole("tab", { name: "1 staker" })).toBeInTheDocument();
  });
});

describe("ValidatorDelegatorsCard tab triggers are a phone tap target: P1", () => {
  it("gives the Stakers and Unbonding tabs max-sm:min-h-11", () => {
    render(<ValidatorDelegatorsCard data={data(7, 2)} />);

    expect(screen.getByRole("tab", { name: "7 stakers" })).toHaveClass("max-sm:min-h-11");
    expect(screen.getByRole("tab", { name: "2 unbonding" })).toHaveClass("max-sm:min-h-11");
  });

  it("keeps it when a list is unavailable (the tabs then read just 'Stakers' / 'Unbonding')", () => {
    render(<ValidatorDelegatorsCard data={failed("both")} />);

    expect(screen.getByRole("tab", { name: "Stakers" })).toHaveClass("max-sm:min-h-11");
    expect(screen.getByRole("tab", { name: "Unbonding" })).toHaveClass("max-sm:min-h-11");
  });
});

describe("ValidatorDelegatorsCard top five and Show all: P1", () => {
  it("shows 5 rows until Show all", () => {
    render(<ValidatorDelegatorsCard data={data(8)} />);

    expect(rows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Show all 8" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows the head of the data first, in order (the helper sorts largest first)", () => {
    render(<ValidatorDelegatorsCard data={data(8)} />);

    const addressOf = (row: HTMLElement) => row.querySelector("[title]")?.getAttribute("title");
    expect(addressOf(rows()[0])).toBe("testcore1staker01aaaaaaaaaaaaaaaaaaaa");
    expect(addressOf(rows()[4])).toBe("testcore1staker05aaaaaaaaaaaaaaaaaaaa");
    expect(rows()[0]).toHaveTextContent("99 TESTCORE");
  });

  it("opens the rest in the drop-down on Show all, then folds it back", () => {
    render(<ValidatorDelegatorsCard data={data(8)} />);

    fireEvent.click(screen.getByRole("button", { name: "Show all 8" }));
    expect(rows()).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(rows()).toHaveLength(5);
  });

  it("gives the opened list its own scroll box", () => {
    const { container } = render(<ValidatorDelegatorsCard data={data(30)} />);

    fireEvent.click(screen.getByRole("button", { name: "Show all 30" }));

    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller).toHaveClass("max-h-[260px]");
    expect(within(scroller).getAllByRole("listitem")).toHaveLength(25);
  });

  it("keeps the scroll box positioned, so the rows' sr-only labels cannot grow the page", () => {
    const { container } = render(<ValidatorDelegatorsCard data={data(30)} />);

    fireEvent.click(screen.getByRole("button", { name: "Show all 30" }));

    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller).toHaveClass("relative");
    // the labels this guards against: one sr-only copy label per row, inside the scroll box
    expect(scroller.querySelectorAll(".sr-only")).toHaveLength(25);
  });

  it("makes each explorer link a 44px tap target on phones (32px from sm up)", () => {
    render(<ValidatorDelegatorsCard data={data(3)} />);

    const links = screen.getAllByRole("link", { name: "View staker in explorer" });
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveClass("h-8", "w-8", "max-sm:h-11", "max-sm:w-11");
    }
  });

  it("has no Show all when there are 5 stakers or fewer", () => {
    render(<ValidatorDelegatorsCard data={data(5)} />);

    expect(rows()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("says so when there are no stakers, in the page's one word for them", () => {
    render(<ValidatorDelegatorsCard data={data(0)} />);

    expect(screen.getByText("No stakers yet")).toBeInTheDocument();
    expect(screen.queryByText(/delegators/i)).not.toBeInTheDocument();
  });
});

describe("ValidatorDelegatorsCard unbonding tab: P1", () => {
  it("stays reachable and shows the total and the table", () => {
    render(<ValidatorDelegatorsCard data={data(3, 2)} />);

    // Radix tabs switch on mousedown
    fireEvent.mouseDown(screen.getByRole("tab", { name: "2 unbonding" }), { button: 0 });

    expect(screen.getByText("Total Unbonding")).toBeInTheDocument();
    expect(screen.getByText("10 TESTCORE")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Completion" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Staker" })).toBeInTheDocument();
  });
});

describe("ValidatorDelegatorsCard when a fetch failed (null, not []): P1", () => {
  it("says stakers are unavailable and never reads '0 stakers' when the stakers fetch failed", () => {
    render(<ValidatorDelegatorsCard data={failed("stakers")} />);

    expect(screen.getByText(UNAVAILABLE_STAKERS)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Stakers" })).toBeInTheDocument();
    expect(screen.queryByText(/0 stakers/)).not.toBeInTheDocument();
    expect(screen.queryByText("No stakers yet")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("keeps 'No stakers yet' for a real empty answer: [] is not null", () => {
    render(<ValidatorDelegatorsCard data={data(0)} />);

    expect(screen.getByText("No stakers yet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "0 stakers" })).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_STAKERS)).not.toBeInTheDocument();
  });

  it("says unbonding is unavailable and never reads '0 unbonding' when that fetch failed", () => {
    render(<ValidatorDelegatorsCard data={failed("unbonding")} />);

    expect(screen.getByRole("tab", { name: "Unbonding" })).toBeInTheDocument();
    expect(screen.queryByText(/0 unbonding/)).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Unbonding" }), { button: 0 });

    expect(screen.getByText(UNAVAILABLE_UNBONDING)).toBeInTheDocument();
    expect(screen.queryByText("Total Unbonding")).not.toBeInTheDocument();
    expect(screen.queryByText("No unbonding delegations found")).not.toBeInTheDocument();
  });

  it("partial failure: the stakers that loaded still show when unbonding failed", () => {
    render(<ValidatorDelegatorsCard data={failed("unbonding", 7)} />);

    expect(screen.getByRole("tab", { name: "7 stakers" })).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(screen.queryByText(UNAVAILABLE_STAKERS)).not.toBeInTheDocument();
  });

  it("partial failure: the unbonding list that loaded still shows when stakers failed", () => {
    render(<ValidatorDelegatorsCard data={failed("stakers", 7, 2)} />);

    expect(screen.getByRole("tab", { name: "2 unbonding" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "2 unbonding" }), { button: 0 });

    expect(screen.getByText("Total Unbonding")).toBeInTheDocument();
    expect(screen.getByText("10 TESTCORE")).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_UNBONDING)).not.toBeInTheDocument();
  });

  it("both failed: both parts say unavailable and no count appears anywhere", () => {
    const { container } = render(<ValidatorDelegatorsCard data={failed("both")} />);

    expect(screen.getByText(UNAVAILABLE_STAKERS)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Unbonding" }), { button: 0 });
    expect(screen.getByText(UNAVAILABLE_UNBONDING)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0 (stakers|unbonding)\b/);
  });
});
