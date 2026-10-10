/**
 * Scale Rule Test
 *
 * File: __tests__/components/scale-rule.test.tsx
 *
 * The section divider that reads like the edge of a ruler (components/ui/scale-rule.tsx):
 *   - the label is a real h2, so a page has section headings
 *   - the tone decides the colour (coral for the one important area, muted otherwise)
 *   - the tick line and the start tick are decorative: hidden from assistive tech
 *   - it paints no opaque fill, so the page background shows through
 *
 * Priority: P2
 */

import { render, screen } from "@testing-library/react";
import { ScaleRule } from "@/components/ui/scale-rule";

describe("ScaleRule: P2", () => {
  it("renders its label as a level-2 heading", () => {
    render(<ScaleRule label="Rewards" />);

    expect(screen.getByRole("heading", { level: 2, name: "Rewards" })).toBeInTheDocument();
  });

  it("puts the optional meta text at the end of the row", () => {
    render(<ScaleRule label="Rewards" meta="2 pending" />);

    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });

  it("is muted by default and coral for tone=primary", () => {
    const { rerender } = render(<ScaleRule label="Performance" />);
    expect(screen.getByRole("heading", { name: "Performance" })).toHaveClass(
      "text-muted-foreground",
    );

    rerender(<ScaleRule label="Rewards" tone="primary" />);
    const heading = screen.getByRole("heading", { name: "Rewards" });
    expect(heading).toHaveClass("text-primary");
    expect(heading).not.toHaveClass("text-muted-foreground");
  });

  it("hides the start tick and the tick line from assistive tech", () => {
    const { container } = render(<ScaleRule label="Rewards" tone="primary" />);

    const decorative = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorative).toHaveLength(2);
    expect(container.querySelector(".scale-rule-line")).toBe(decorative[1]);
    expect(decorative[0]).toHaveClass("bg-primary");
  });

  it("paints no fill on the row, so the page background shows through", () => {
    const { container } = render(<ScaleRule label="Governance" />);

    const row = container.firstElementChild as HTMLElement;
    expect(row.className).not.toMatch(/(^|\s)bg-/);
  });

  it("passes headingId to the heading so a section can name itself by it", () => {
    render(<ScaleRule label="Stakers" headingId="vd-stakers" />);

    expect(screen.getByRole("heading", { name: "Stakers" })).toHaveAttribute("id", "vd-stakers");
  });
});
