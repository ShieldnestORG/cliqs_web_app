/**
 * Validator Identity Strip Test
 *
 * File: __tests__/components/validator-identity-strip.test.tsx
 *
 * ValidatorIdentityCard is a slim strip now, not a card (2026-10-10): one row with the moniker
 * (h2), a status tag, the commission rate, the operator and account addresses with copy buttons,
 * and the explorer link. No card chrome and no "Validator" label; the jailed warning and Unjail
 * moved to JailedAlert.
 * The status tag is a Badge with a moving mark and no icon, so colour is never the only signal:
 * Active = `success` + `signal`, Unbonding = `warning` + `half`, Jailed = `destructive` + `stripes`
 * (jailed wins over the chain status), anything else = "Inactive", `secondary` + `ring`. The mark is
 * a child span[aria-hidden][data-mark] with the classes `status-mark status-mark-<name>`. A badge has
 * no border, fill or pill of its own any more (components/ui/badge.tsx).
 * The explorer link is icon-only with an aria-label, so the strip stays one row at
 * 1024px for a validator like TOKNS.FI instead of wrapping the link to a second row.
 *
 * Priority: P2
 */

import { render, screen, within } from "@testing-library/react";
import ValidatorIdentityCard from "@/components/dataViews/ValidatorDashboard/ValidatorIdentityCard";
import { ValidatorInfo } from "@/lib/validatorHelpers";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";
const ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";

let mockExplorerAccount = "https://explorer.invalid/accounts/${accountAddress}";
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({ chain: { explorerLinks: { account: mockExplorerAccount } } }),
}));

const validator = (over: Partial<ValidatorInfo> = {}) =>
  ({
    operatorAddress: VALOPER,
    delegatorAddress: ACCOUNT,
    moniker: "Tokns.fi",
    commissionRate: "0.050000000000000000",
    status: "BONDED",
    jailed: false,
    ...over,
  }) as ValidatorInfo;

beforeEach(() => {
  mockExplorerAccount = "https://explorer.invalid/accounts/${accountAddress}";
});

describe("ValidatorIdentityCard strip: P2", () => {
  it("shows the moniker as an h2 and the commission rate", () => {
    render(<ValidatorIdentityCard validator={validator()} />);

    expect(screen.getByRole("heading", { level: 2, name: "Tokns.fi" })).toBeInTheDocument();
    expect(screen.getByText("5.0%")).toBeInTheDocument();
  });

  it("shows both addresses with copy buttons and an explorer link", () => {
    render(<ValidatorIdentityCard validator={validator()} />);

    expect(screen.getByTitle(VALOPER)).toBeInTheDocument();
    expect(screen.getByTitle(ACCOUNT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy operator address/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy account address/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View validator in explorer" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://explorer.invalid/accounts/"),
    );
  });

  it("makes the explorer link icon-only: no visible label, a proper aria-label, opens a new tab", () => {
    render(<ValidatorIdentityCard validator={validator()} />);

    const link = screen.getByRole("link", { name: "View validator in explorer" });
    expect(link).toHaveTextContent("");
    expect(link).toHaveAttribute("aria-label", "View validator in explorer");
    expect(link).toHaveAttribute("title", "View in explorer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(link).getByTestId("icon-ExternalLink")).toBeInTheDocument(); // jest mocks lucide icons
    // 32px from sm up, a 44px tap target on phones
    expect(link).toHaveClass("h-8", "w-8", "max-sm:h-11", "max-sm:w-11");
  });

  it("has no explorer link when the chain has no account explorer", () => {
    mockExplorerAccount = "";
    render(<ValidatorIdentityCard validator={validator()} />);

    expect(
      screen.queryByRole("link", { name: "View validator in explorer" }),
    ).not.toBeInTheDocument();
  });

  // The status tag is the element that holds the word; its first child is the mark.
  const tag = (label: string) => screen.getByText(label);
  const markOf = (el: HTMLElement) => el.querySelector("span[aria-hidden='true'][data-mark]");

  it.each([
    ["Active", "text-success", "signal", {}],
    ["Unbonding", "text-warning", "half", { status: "UNBONDING" }],
    ["Jailed", "text-destructive", "stripes", { jailed: true }],
    ["Inactive", "text-muted-foreground", "ring", { status: "UNBONDED" }],
  ] as const)(
    "status %s: colour %s, its own moving mark %s, no icon",
    (label, colour, mark, over) => {
      render(<ValidatorIdentityCard validator={validator(over as Partial<ValidatorInfo>)} />);

      const el = tag(label);
      expect(el).toHaveClass(colour);
      // exactly one mark, hidden from assistive tech, drawn by the stylesheet's status-mark classes
      expect(el.querySelectorAll("[data-mark]")).toHaveLength(1);
      const dot = markOf(el);
      expect(dot).toHaveAttribute("data-mark", mark);
      expect(dot).toHaveClass("status-mark", `status-mark-${mark}`);
      // the word is the only text, and no icon sits beside it
      expect(el).toHaveTextContent(new RegExp(`^${label}$`));
      expect(within(el).queryByTestId(/^icon-/)).not.toBeInTheDocument();
    },
  );

  it("jailed wins over the chain status: a bonded but jailed validator reads Jailed with the hazard bar", () => {
    render(<ValidatorIdentityCard validator={validator({ status: "BONDED", jailed: true })} />);

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(markOf(tag("Jailed"))).toHaveAttribute("data-mark", "stripes");
  });

  it("each state has a different mark, so the colour is never the only signal", () => {
    const marks = [{}, { status: "UNBONDING" }, { jailed: true }, { status: "UNBONDED" }].map(
      (over) => {
        const { container, unmount } = render(
          <ValidatorIdentityCard validator={validator(over as Partial<ValidatorInfo>)} />,
        );
        const mark = container.querySelector("[data-mark]")?.getAttribute("data-mark");
        unmount();
        return mark;
      },
    );

    expect(marks).toEqual(["signal", "half", "stripes", "ring"]);
    expect(new Set(marks).size).toBe(4);
  });

  it("the status tag has no border, no fill and no pill", () => {
    const { rerender } = render(<ValidatorIdentityCard validator={validator()} />);

    for (const over of [{}, { status: "UNBONDING" }, { jailed: true }, { status: "UNBONDED" }]) {
      rerender(<ValidatorIdentityCard validator={validator(over as Partial<ValidatorInfo>)} />);
      const el = document.querySelector("[data-mark]")?.parentElement as HTMLElement;
      const chrome = Array.from(el.classList).filter((cls) =>
        /^(border|bg-|rounded|px-|shadow)/.test(cls),
      );
      expect(chrome).toEqual([]);
    }
  });

  it("is a strip: no card chrome, no 'Validator' label, no Unjail", () => {
    const { container } = render(<ValidatorIdentityCard validator={validator({ jailed: true })} />);

    expect(container.firstElementChild?.className).not.toMatch(/(^|\s)(border|bg-|rounded)/);
    expect(screen.queryByText("Validator")).not.toBeInTheDocument();
    expect(screen.queryByText(/unjail/i)).not.toBeInTheDocument();
  });
});
