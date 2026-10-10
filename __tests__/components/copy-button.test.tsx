/**
 * Copy Button Test
 *
 * File: __tests__/components/copy-button.test.tsx
 *
 * components/ui/copy-button.tsx renders an absolutely positioned `sr-only` label inside the button:
 *   - the button is itself positioned (`relative`), so that label is contained wherever the button
 *     is used. Unpositioned, hundreds of hidden labels inside a scrolling list use <main> as their
 *     containing block, escape the list's clip and stretch the page (29,805px, measured 2026-10-10
 *     on /tx/validator with 645 stakers). jsdom does no layout, so the class is what a test can pin.
 *   - a caller can still position it another way (`absolute` replaces `relative`)
 *   - the accessible name and the copy action are unchanged
 *
 * Priority: P1
 */

import { fireEvent, render, screen } from "@testing-library/react";
import copy from "copy-to-clipboard";
import { CopyButton } from "@/components/ui/copy-button";

jest.mock("copy-to-clipboard", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("CopyButton containment: P1", () => {
  it("is a positioned box, so its absolute sr-only label stays inside it", () => {
    render(<CopyButton value="testcore1abc" copyLabel="address" />);

    const button = screen.getByRole("button", { name: "Copy address" });
    expect(button).toHaveClass("relative");
    expect(button.querySelector(".sr-only")).toHaveTextContent("Copy address");
  });

  it("stays positioned when it carries a label of its own", () => {
    render(<CopyButton value="testcore1abc">Copy it</CopyButton>);

    expect(screen.getByRole("button", { name: "Copy it" })).toHaveClass("relative");
  });

  it("lets a caller that positions it absolutely replace `relative`", () => {
    render(<CopyButton value="testcore1abc" className="absolute right-2 top-2" />);

    const button = screen.getByRole("button", { name: "Copy address" });
    expect(button).toHaveClass("absolute");
    expect(button).not.toHaveClass("relative");
  });

  it("still copies the value", () => {
    render(<CopyButton value="testcore1abc" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    expect(copy).toHaveBeenCalledWith("testcore1abc");
  });
});
