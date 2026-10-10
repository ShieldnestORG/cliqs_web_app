/**
 * Badge Test
 *
 * File: __tests__/components/badge.test.tsx
 *
 * The Badge is a status tag (components/ui/badge.tsx, docs/ui/CARDS-PRD.md section 5): a small
 * mark, then the word in the state's colour, set in the section-label type (mono, 11px, uppercase,
 * 0.14em). Since 2026-10-10:
 *   - it has no border, no fill and no pill of its own, in any variant: the colour is the text
 *   - it carries a mark only when one is passed (`mark`): there is no plain dot, so a badge without
 *     `mark` is the word alone
 *   - a mark is one hidden child span in front of the word, `span[aria-hidden="true"][data-mark]`
 *     with the classes `status-mark status-mark-<name>`; the four names are signal, half, stripes
 *     and ring, and the stylesheet draws each of them
 * The status strip of the validator page and the TESTNET tag of the network control are pinned in
 * their own files; this file pins the primitive.
 *
 * Priority: P2
 */

import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import { Badge, type BadgeMark } from "@/components/ui/badge";

type Variant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const VARIANTS: [Variant, string][] = [
  ["default", "text-primary"],
  ["secondary", "text-muted-foreground"],
  ["destructive", "text-destructive"],
  ["outline", "text-foreground"],
  ["success", "text-success"],
  ["info", "text-info"],
  ["warning", "text-warning"],
];
const MARKS: BadgeMark[] = ["signal", "half", "stripes", "ring"];

/** Border, fill, pill and padding utilities: what the old pill carried and the tag no longer does. */
const chromeClasses = (el: HTMLElement) =>
  Array.from(el.classList).filter((cls) => /^(border|bg-|rounded|px-|shadow)/.test(cls));

describe("Badge status tag: P2", () => {
  it.each(VARIANTS)("%s is its colour as text: no border, no fill, no pill", (variant, colour) => {
    render(<Badge variant={variant}>Label</Badge>);

    const tag = screen.getByText("Label");
    expect(tag).toHaveClass(colour);
    expect(chromeClasses(tag)).toEqual([]);
  });

  it("is set in the section-label type", () => {
    render(<Badge>Label</Badge>);

    expect(screen.getByText("Label")).toHaveClass(
      "font-mono",
      "text-[11px]",
      "font-medium",
      "uppercase",
      "leading-4",
      "tracking-[0.14em]",
    );
  });

  it("without a mark it is the word alone: no dot, no child element", () => {
    const { container } = render(<Badge variant="success">Verified</Badge>);

    const tag = screen.getByText("Verified");
    expect(tag.children).toHaveLength(0);
    expect(container.querySelector("[data-mark]")).toBeNull();
    expect(container.querySelector(".status-mark")).toBeNull();
    expect(tag).toHaveTextContent(/^Verified$/);
  });

  it.each(MARKS)("mark %s is one hidden span in front of the word", (mark) => {
    render(<Badge mark={mark}>Label</Badge>);

    const tag = screen.getByText("Label");
    expect(tag.children).toHaveLength(1);
    const dot = tag.firstElementChild as HTMLElement;
    expect(tag.firstChild).toBe(dot); // in front of the word, not after it
    expect(dot.tagName).toBe("SPAN");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveAttribute("data-mark", mark);
    expect(dot).toHaveClass("status-mark", `status-mark-${mark}`);
    // the span is empty: the word stays the tag's only text, so a screen reader reads it once
    expect(dot).toBeEmptyDOMElement();
    expect(tag).toHaveTextContent(/^Label$/);
    // and the mark takes no border or fill from the Badge: it draws itself in currentColor
    expect(chromeClasses(tag)).toEqual([]);
  });

  it.each(MARKS)("the stylesheet draws the %s mark (its shape, not only its motion)", (mark) => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles/globals.css"), "utf8");

    // a rule for the mark that sets a size, a fill or a border: the reduced-motion block repeats the
    // selector with an `animation` alone, which would pass a bare selector match
    expect(css).toMatch(
      new RegExp(`\\.status-mark-${mark}\\s*\\{[^}]*\\b(width|background|border)\\b[^}]*\\}`),
    );
  });

  it("the stylesheet draws the shared .status-mark base", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles/globals.css"), "utf8");

    expect(css).toMatch(/\.status-mark\s*\{/);
  });
});
