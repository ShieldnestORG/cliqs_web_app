/**
 * Input Test
 *
 * File: __tests__/components/input.test.tsx
 *
 * The shared text input (components/ui/input.tsx, docs/ui/FORMS-PRD.md §2a):
 *   - every Input is 44px tall (h-11), the height of the Buttons and Selects beside it
 *     (the house style gives every text input a 44px minimum height)
 *   - a call site can still pick its own height, so no page needs a one-off `h-11` patch
 *   - the textarea has no fixed height that could mismatch (only a min-height)
 *
 * Priority: P2
 */

import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

describe("Input height: P2", () => {
  it("is 44px tall (h-11), not 40px", () => {
    render(<Input aria-label="Name" />);

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveClass("h-11");
    expect(input).not.toHaveClass("h-10");
  });

  it("is 44px tall in every variant", () => {
    render(
      <>
        <Input aria-label="Default" variant="default" />
        <Input aria-label="Institutional" variant="institutional" />
        <Input aria-label="Filled" variant="filled" />
      </>,
    );

    for (const name of ["Default", "Institutional", "Filled"]) {
      expect(screen.getByRole("textbox", { name })).toHaveClass("h-11");
    }
  });

  it("is 44px tall when it carries an icon, a label or an error", () => {
    render(<Input label="Address" error="Required" leftIcon={<span>i</span>} />);

    expect(screen.getByLabelText("Address")).toHaveClass("h-11");
  });

  it("lets a call site pick another height instead of stacking two", () => {
    render(<Input aria-label="Dense" className="h-9" />);

    const input = screen.getByRole("textbox", { name: "Dense" });
    expect(input).toHaveClass("h-9");
    expect(input).not.toHaveClass("h-11");
  });
});

describe("Textarea height: P2", () => {
  it("has a minimum height only, so it cannot mismatch the 44px inputs", () => {
    render(<Textarea aria-label="Notes" />);

    const area = screen.getByRole("textbox", { name: "Notes" });
    expect(area).toHaveClass("min-h-[80px]");
    expect(area.className).not.toMatch(/(^|\s)h-\d/);
  });
});
