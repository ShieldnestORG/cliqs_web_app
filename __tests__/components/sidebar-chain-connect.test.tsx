/**
 * Sidebar / ChainConnect Mount-Stability Test
 *
 * File: __tests__/components/sidebar-chain-connect.test.tsx
 *
 * The sidebar collapses 150ms after the pointer leaves it. ChainConnect keeps the
 * chain dialog's open state in its own useState, so if a collapse unmounts it that
 * state is destroyed and the open dialog vanishes. That is what happened: opening
 * the chain switcher moves focus into a Radix portal outside the aside, the
 * mouseleave guard in Sidebar therefore does not match, scheduleCollapse fires, and
 * the dialog closed itself ~150ms after opening.
 *
 * These assertions fail if ChainConnect is ever put back inside a `collapsed ?`
 * branch.
 *
 * Priority: P0
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

let mockPendingCount = 0;

// jest.setup.js mocks next/link down to <a href> and drops every other prop. The
// bell's aria-label and the active link's aria-current are exactly what these
// tests check, and the real Link forwards them, so forward them here too.
jest.mock("next/link", () => {
  const React = jest.requireActual("react");
  return ({
    children,
    href,
    asChild,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    asChild?: boolean;
  }) =>
    asChild && React.isValidElement(children)
      ? React.cloneElement(children, { href, ...rest })
      : React.createElement("a", { href, ...rest }, children);
});

jest.mock("@/lib/hooks/usePendingTransactions", () => ({
  usePendingTransactions: () => ({
    hasPendingTransactions: mockPendingCount > 0,
    // The badge reads needsMyCount; totalPendingCount is deliberately different
    // so a regression back to "all pending" fails the badge assertions.
    totalPendingCount: mockPendingCount + 5,
    needsMyCount: mockPendingCount,
  }),
}));

let unmountCount = 0;

jest.mock("@/components/ChainConnect", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    __esModule: true,
    default: function MockChainConnect() {
      useEffect(
        () => () => {
          unmountCount += 1;
        },
        [],
      );
      return <div data-testid="chain-connect" />;
    },
  };
});

const renderSidebar = () =>
  render(
    <TooltipProvider>
      <Sidebar />
    </TooltipProvider>,
  );

const getAside = () => {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("sidebar <aside> not found");
  return aside;
};

describe("Sidebar keeps ChainConnect mounted across a collapse: P0", () => {
  beforeEach(() => {
    unmountCount = 0;
    mockPendingCount = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const collapseAfterHover = () => {
    const aside = getAside();
    fireEvent.mouseEnter(aside);
    // The switcher is reachable only while the rail is expanded.
    expect(screen.getByTestId("chain-connect")).toBeInTheDocument();
    expect(aside).toHaveAttribute("data-state", "expanded");

    fireEvent.mouseLeave(aside);
    act(() => {
      jest.advanceTimersByTime(300); // past the 150ms leave-delay
    });
    return aside;
  };

  it("does not unmount ChainConnect when the rail collapses", () => {
    renderSidebar();

    const aside = collapseAfterHover();

    expect(aside).toHaveAttribute("data-state", "collapsed");
    expect(unmountCount).toBe(0);
  });

  it("leaves ChainConnect in the DOM once collapsed, so an open dialog survives", () => {
    renderSidebar();

    collapseAfterHover();

    expect(screen.getByTestId("chain-connect")).toBeInTheDocument();
  });
});

describe("Sidebar lists the shared navigation source: P0", () => {
  beforeEach(() => {
    mockPendingCount = 0;
  });

  const expandSidebar = () => {
    renderSidebar();
    const aside = getAside();
    fireEvent.mouseEnter(aside);
    return aside;
  };

  it("shows the destinations in order, each pointing at the connected chain", () => {
    const aside = expandSidebar();
    const nav = within(aside).getByRole("navigation", { name: "Main" });

    const links = within(nav)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Home", "/cosmos/dashboard"],
      ["Create CLIQ", "/cosmos/create"],
      ["Validator", "/cosmos/validator"],
      ["Settings", "/cosmos/settings"],
      ["Audit & tests", "/cosmos/audit"],
      ["Guides", "/cosmos/get-started"],
      ["Dev Tools", "/cosmos/dev"],
    ]);
  });

  it("drops the retired entries and chrome", () => {
    const aside = expandSidebar();

    for (const gone of [
      "Operations",
      "My CLIQS",
      "Find CLIQ",
      "Create Multisig",
      "Account",
      "Get Started",
      "Pending Tasks",
      "v1.2.0",
    ]) {
      expect(within(aside).queryByText(gone)).not.toBeInTheDocument();
    }
    expect(within(aside).queryByTitle("GitHub")).not.toBeInTheDocument();
  });

  it("has Back to TOKNS and Donate in the footer, not in the scrolling nav", () => {
    const aside = expandSidebar();
    const nav = within(aside).getByRole("navigation", { name: "Main" });

    expect(within(nav).queryByText("Back to TOKNS")).not.toBeInTheDocument();
    expect(within(aside).getAllByText("Back to TOKNS")).toHaveLength(1);
    expect(within(aside).getByRole("link", { name: /back to tokns/i })).toHaveAttribute(
      "href",
      "https://app.tokns.fi",
    );
    expect(within(aside).getByRole("button", { name: "Donate" })).toBeInTheDocument();
    expect(nav).toHaveClass("overflow-y-auto");
  });

  it("shows the waiting count on Home only when there is one", () => {
    const { unmount } = render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    );
    fireEvent.mouseEnter(getAside());
    expect(within(getAside()).queryByText("3")).not.toBeInTheDocument();
    unmount();

    mockPendingCount = 3;
    renderSidebar();
    fireEvent.mouseEnter(getAside());
    const home = within(getAside()).getByRole("link", { name: /^Home/ });
    expect(within(home).getByText("3")).toBeInTheDocument();
  });
});

describe("Header menu uses the same source below lg: P0", () => {
  beforeEach(() => {
    mockPendingCount = 0;
  });

  const openMenu = () => {
    render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    return screen.getByRole("navigation", { name: "Main" });
  };

  it("sends the logo to Home", () => {
    render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    expect(screen.getByRole("link", { name: /CLIQ Logo/ })).toHaveAttribute(
      "href",
      "/cosmos/dashboard",
    );
  });

  it("lists every destination, Settings included without a wallet", () => {
    const nav = openMenu();

    const links = within(nav)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Home", "/cosmos/dashboard"],
      ["Create CLIQ", "/cosmos/create"],
      ["Validator", "/cosmos/validator"],
      ["Settings", "/cosmos/settings"],
      ["Audit & tests", "/cosmos/audit"],
      ["Guides", "/cosmos/get-started"],
      ["Dev Tools", "/cosmos/dev"],
      ["Back to TOKNS", "https://app.tokns.fi"],
    ]);
    expect(within(nav).getByRole("button", { name: /donate/i })).toBeInTheDocument();
  });

  it("has no bell when nothing needs a signature", () => {
    render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    expect(screen.queryByRole("link", { name: /your signature/i })).not.toBeInTheDocument();
  });

  it("shows a labelled bell to Home with the count, capped at 9+", () => {
    mockPendingCount = 3;
    const { unmount } = render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    const bell = screen.getByRole("link", { name: "3 transactions need your signature" });
    expect(bell).toHaveAttribute("href", "/cosmos/dashboard");
    expect(within(bell).getByText("3")).toBeInTheDocument();
    unmount();

    mockPendingCount = 1;
    const second = render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("link", { name: "1 transaction needs your signature" }),
    ).toBeInTheDocument();
    second.unmount();

    mockPendingCount = 12;
    render(
      <TooltipProvider>
        <Header />
      </TooltipProvider>,
    );
    expect(
      within(screen.getByRole("link", { name: "12 transactions need your signature" })).getByText(
        "9+",
      ),
    ).toBeInTheDocument();
  });
});
