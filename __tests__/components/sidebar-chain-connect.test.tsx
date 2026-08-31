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

import { act, fireEvent, render, screen } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

jest.mock("@/lib/hooks/usePendingTransactions", () => ({
  usePendingTransactions: () => ({ hasPendingTransactions: false, totalPendingCount: 0 }),
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
