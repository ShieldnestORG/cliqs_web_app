/**
 * Network Toggle Test
 *
 * File: __tests__/components/network-toggle.test.tsx
 *
 * The compact Mainnet | Testnet control (components/DevTools/NetworkToggle.tsx), used by the
 * validator dashboard and by Dev Tools:
 *   - two small outlined boxes, not a panel
 *   - the word "Testnet" is always gold; on testnet its box gets a gold outline and a gold
 *     TESTNET badge shows beside the control, and only then
 *   - on mainnet one short muted caption ("Real assets. Check before you sign.") sits on the SAME row
 *     as the boxes and never wraps (the control is 36px tall, not the 74px of the old two-line
 *     sentence under the boxes); the long sentence is its `title` AND screen-reader-only text
 *     beside it (a `title` alone does not reach a screen reader), the short caption being hidden
 *     from assistive tech so nothing is read twice; on testnet both are gone
 *   - the boxes are 36px (h-9) and a 44px tap target below 640px (max-sm:h-11), in both states
 *   - the props keep their meaning: onNetworkChange gets the clicked network, and a chain with
 *     no testnet variant says so
 *
 * Priority: P1
 */

import { fireEvent, render, screen } from "@testing-library/react";
import NetworkToggle from "@/components/DevTools/NetworkToggle";

const REAL_ASSETS = "Real assets. Check before you sign.";
const REAL_ASSETS_LONG =
  "Mainnet actions use real assets. Verify all addresses and messages before signing.";

describe("NetworkToggle: testnet marker: P1", () => {
  it("shows a gold TESTNET badge on testnet", () => {
    render(<NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const badge = screen.getByText("TESTNET");
    expect(badge).toHaveClass("text-warning", "border-warning/40");
  });

  it("shows no TESTNET badge on mainnet", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(screen.queryByText("TESTNET")).not.toBeInTheDocument();
  });

  it("keeps the word Testnet gold in both states and outlines the active box in gold", () => {
    const { rerender } = render(
      <NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );
    const inactive = screen.getByRole("button", { name: "Testnet" });
    expect(inactive).toHaveClass("text-warning");
    expect(inactive).not.toHaveClass("border-warning");

    rerender(
      <NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );
    const active = screen.getByRole("button", { name: "Testnet" });
    expect(active).toHaveClass("text-warning", "border-warning");
  });
});

// The caption element: the short visible text is a span inside it
const caption = () => screen.getByText(REAL_ASSETS).closest("p") as HTMLElement;

describe("NetworkToggle: mainnet warning: P1", () => {
  it("says the assets are real on mainnet, as one muted line, not a panel", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const note = caption();
    expect(note).toHaveClass("text-muted-foreground");
    expect(note.className).not.toMatch(/(^|\s)(border|bg-)/);
  });

  it("keeps the caption on the boxes' row and never wraps it: the control is one row", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const note = caption();
    const boxes = screen.getByRole("group", { name: "Network" });
    expect(note.parentElement).toBe(boxes.parentElement); // same flex row
    expect(note).toHaveClass("whitespace-nowrap");
    // from 640px up the row does not wrap; below it the caption may drop under the boxes
    expect(note.parentElement).toHaveClass("flex", "flex-wrap", "sm:flex-nowrap");
  });

  it("keeps the old long sentence as the caption's title, and shortens what shows", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(caption()).toHaveAttribute("title", REAL_ASSETS_LONG);
    expect(REAL_ASSETS.length).toBeLessThan(40);
  });

  it("gives a screen reader the full sentence as sr-only text beside the short caption", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const full = screen.getByText(REAL_ASSETS_LONG);
    expect(full).toHaveClass("sr-only");
    expect(full.closest("p")).toBe(caption()); // beside the short caption, in the same line
    expect(full).not.toHaveAttribute("aria-hidden");
    // the visible short caption is hidden from assistive tech, so nothing is read twice
    expect(screen.getByText(REAL_ASSETS)).toHaveAttribute("aria-hidden", "true");
  });

  it("positions the caption so the sr-only sentence cannot escape a scroll box", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(caption()).toHaveClass("relative");
  });

  it("drops the real-assets line, short and full, on testnet", () => {
    render(<NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(screen.queryByText(REAL_ASSETS)).not.toBeInTheDocument();
    expect(screen.queryByText(REAL_ASSETS_LONG)).not.toBeInTheDocument();
  });
});

describe("NetworkToggle: behaviour: P1", () => {
  it("passes the clicked network to onNetworkChange", () => {
    const onNetworkChange = jest.fn();
    render(
      <NetworkToggle currentNetwork="mainnet" onNetworkChange={onNetworkChange} testnetAvailable />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Testnet" }));
    expect(onNetworkChange).toHaveBeenLastCalledWith("testnet");
    fireEvent.click(screen.getByRole("button", { name: "Mainnet" }));
    expect(onNetworkChange).toHaveBeenLastCalledWith("mainnet");
  });

  it("marks the active network as pressed", () => {
    render(<NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(screen.getByRole("button", { name: "Testnet" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mainnet" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is a 36px control (sm buttons), not a panel", () => {
    const { container } = render(
      <NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );

    expect(screen.getByRole("button", { name: "Mainnet" })).toHaveClass("h-9");
    expect(screen.getByRole("button", { name: "Testnet" })).toHaveClass("h-9");
    expect(container.firstElementChild?.className).not.toMatch(/(^|\s)(border|bg-|p-\d)/);
  });

  it("keeps both boxes a 44px tap target on a phone (max-sm:h-11), in both states", () => {
    const { rerender } = render(
      <NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );
    for (const name of ["Mainnet", "Testnet"]) {
      const box = screen.getByRole("button", { name });
      expect(box).toHaveClass("max-sm:h-11");
      expect(box).not.toHaveClass("max-sm:h-9");
    }

    rerender(
      <NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );
    for (const name of ["Mainnet", "Testnet"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("max-sm:h-11");
    }
  });

  it("says so when the chain has no testnet variant", () => {
    render(
      <NetworkToggle
        currentNetwork="mainnet"
        onNetworkChange={jest.fn()}
        testnetAvailable={false}
      />,
    );

    expect(screen.getByText(/No testnet variant is registered for this chain/)).toBeInTheDocument();
  });
});
