/**
 * Network Toggle Test
 *
 * File: __tests__/components/network-toggle.test.tsx
 *
 * The compact Mainnet | Testnet control (components/DevTools/NetworkToggle.tsx), used by the
 * validator dashboard and by Dev Tools:
 *   - two small outlined boxes, not a panel
 *   - the word "Testnet" is always gold; on testnet its box gets a gold outline and a TESTNET status
 *     tag shows beside the control, and only then. The tag is a Badge (`warning` colour, no border
 *     or fill) with the half-lit moving mark: a child span[aria-hidden][data-mark="half"]
 *   - on mainnet there is NO caption at all: the control is the two boxes and nothing else (the
 *     short "Real assets. Check before you sign." line and its screen-reader-only long sentence
 *     were both removed on 2026-10-10, the owner's call); testnet has no such line either
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
  it("shows a gold TESTNET status tag with the half-lit mark on testnet", () => {
    render(<NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const tag = screen.getByText("TESTNET");
    expect(tag).toHaveClass("text-warning");
    // a Badge of the `warning` variant carries no border, no fill and no pill
    expect(Array.from(tag.classList).filter((c) => /^(border|bg-|rounded|px-)/.test(c))).toEqual(
      [],
    );
    // the mark is a hidden child span; the word is the tag's only text
    expect(tag.querySelectorAll("[data-mark]")).toHaveLength(1);
    const mark = tag.querySelector("span[aria-hidden='true'][data-mark]");
    expect(mark).toHaveAttribute("data-mark", "half");
    expect(mark).toHaveClass("status-mark", "status-mark-half");
    expect(tag).toHaveTextContent(/^TESTNET$/);
  });

  it("puts the TESTNET tag beside the boxes, on the same row", () => {
    render(<NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />);

    const boxes = screen.getByRole("group", { name: "Network" });
    expect(screen.getByText("TESTNET").parentElement).toBe(boxes.parentElement);
    expect(boxes.parentElement).toHaveClass("flex", "flex-wrap", "sm:flex-nowrap");
  });

  it("shows no TESTNET badge on mainnet", () => {
    render(<NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />);

    expect(screen.queryByText("TESTNET")).not.toBeInTheDocument();
    expect(document.querySelector("[data-mark]")).toBeNull();
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

describe("NetworkToggle: no mainnet caption: P1", () => {
  it("on mainnet the control is the two boxes and nothing else", () => {
    const { container } = render(
      <NetworkToggle currentNetwork="mainnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );

    const boxes = screen.getByRole("group", { name: "Network" });
    // the row holds the group and nothing next to it
    expect(boxes.parentElement?.children).toHaveLength(1);
    // the only text is the two box labels: no caption, no sr-only sentence
    expect(container).toHaveTextContent(/^MainnetTestnet$/);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Mainnet", "Testnet"]);
    // no paragraph, no title tooltip, no sr-only text anywhere
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("[title]")).toBeNull();
    expect(container.querySelector(".sr-only")).toBeNull();
  });

  it.each(["mainnet", "testnet"] as const)(
    "%s: the real-assets line is gone, short and long",
    (network) => {
      render(
        <NetworkToggle currentNetwork={network} onNetworkChange={jest.fn()} testnetAvailable />,
      );

      expect(screen.queryByText(REAL_ASSETS)).not.toBeInTheDocument();
      expect(screen.queryByText(REAL_ASSETS_LONG)).not.toBeInTheDocument();
      expect(screen.queryByText(/real assets/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/before you sign/i)).not.toBeInTheDocument();
    },
  );

  it("the testnet control has only the tag beside the boxes, no paragraph", () => {
    const { container } = render(
      <NetworkToggle currentNetwork="testnet" onNetworkChange={jest.fn()} testnetAvailable />,
    );

    expect(container).toHaveTextContent(/^MainnetTestnetTESTNET$/);
    expect(container.querySelector("p")).toBeNull();
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
