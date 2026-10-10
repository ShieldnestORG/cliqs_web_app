/**
 * Kit Icons Test
 *
 * File: __tests__/components/kit-icons.test.tsx
 *
 * Enforces the TOKNS brand icon kit idiom on components/icons/kit.tsx (docs/ui/PATTERNS-PRD.md,
 * "Kit icons"): every icon sits on the 48 grid, has EXACTLY ONE coral part, paints with
 * tokens only (no hex colour anywhere), and is decorative unless it is given a title.
 *
 * A coral part is one element: a single coral shape, or one `<g data-coral>` that holds the
 * shapes meant to read as one (an arrow's shaft and head). A second coral shape outside the
 * group is a second part, and fails here. Until 2026-10-10 this test only asked for "at least
 * one", so a second coral circle added to the stake glyph stayed green.
 *
 * Priority: P2
 */

import { render } from "@testing-library/react";
import { KitIcon, KIT_ICON_NAMES, kitStrokeWidth } from "@/components/icons/kit";

const CORAL = /(stroke|fill)-primary/;

const isCoral = (el: Element) => CORAL.test(el.getAttribute("class") ?? "");

/** How many coral parts an <svg> has: loose coral shapes plus coral groups. */
function coralParts(svg: Element): number {
  const shapes = Array.from(svg.querySelectorAll("path, rect, circle"));
  const loose = shapes.filter((s) => isCoral(s) && !s.closest("g[data-coral]"));
  return loose.length + svg.querySelectorAll("g[data-coral]").length;
}

describe("Kit icons: the idiom: P2", () => {
  it("ships the eleven kit glyphs and the eight new ones", () => {
    expect([...KIT_ICON_NAMES].sort()).toEqual(
      [
        "governance",
        "stake",
        "rewards",
        "portfolio",
        "pulse",
        "dashboard",
        "multisig",
        "clock",
        "guide",
        "contract",
        "journey",
        "rank",
        "withdraw",
        "stakers",
        "tip",
        "sign",
        "database",
        "search",
        "wallet",
      ].sort(),
    );
  });

  it.each(KIT_ICON_NAMES)("%s: 48 grid, round caps, ink and coral parts, no hex colour", (name) => {
    const { container } = render(<KitIcon name={name} />);

    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg).toHaveAttribute("viewBox", "0 0 48 48");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");

    const shapes = Array.from(svg.querySelectorAll("path, rect, circle"));
    expect(shapes.length).toBeGreaterThan(0);

    // every shape is painted by a class (ink or coral), never by an attribute colour
    for (const shape of shapes) {
      expect(shape.getAttribute("class") ?? "").toMatch(/fill-none|fill-primary/);
      expect(shape.getAttribute("stroke")).toBeNull();
      expect(shape.getAttribute("fill")).toBeNull();
    }
    // at least one ink part (currentColor)
    expect(shapes.some((s) => (s.getAttribute("class") ?? "").includes("stroke-current"))).toBe(
      true,
    );
    // exactly ONE coral part: one coral shape, or one group of coral shapes that read as one
    expect(coralParts(svg)).toBe(1);
    // a coral group holds coral shapes only (no ink inside it) and is never nested
    for (const group of Array.from(svg.querySelectorAll("g[data-coral]"))) {
      const inner = Array.from(group.querySelectorAll("path, rect, circle"));
      expect(inner.length).toBeGreaterThan(0);
      expect(inner.every(isCoral)).toBe(true);
      expect(group.querySelector("g")).toBeNull();
    }
    // the whole markup carries no hex literal
    expect(svg.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("Kit icons: the coral-part counter: P2", () => {
  const count = (markup: string) => {
    const host = document.createElement("div");
    host.innerHTML = `<svg>${markup}</svg>`;
    return coralParts(host.firstElementChild as Element);
  };
  const ink = '<path class="fill-none stroke-current" d="M0 0"/>';
  const coral = '<circle class="fill-primary" cx="1" cy="1" r="1"/>';

  it("counts one loose coral shape as one part", () => {
    expect(count(ink + coral)).toBe(1);
  });

  it("counts a coral group as one part, however many shapes it holds", () => {
    expect(count(`${ink}<g data-coral="">${coral}${coral}</g>`)).toBe(1);
  });

  it("counts a second coral shape, loose or in a second group, as a second part", () => {
    expect(count(ink + coral + coral)).toBe(2);
    expect(count(`${ink}<g data-coral="">${coral}</g>${coral}`)).toBe(2);
    expect(count(`${ink}<g data-coral="">${coral}</g><g data-coral="">${coral}</g>`)).toBe(2);
  });

  it("counts an icon with no coral at all as zero parts", () => {
    expect(count(ink)).toBe(0);
  });
});

describe("Kit icons: accessibility and size: P2", () => {
  it("is decorative (aria-hidden) unless it has a title", () => {
    const { container } = render(<KitIcon name="rewards" />);

    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg.querySelector("title")).toBeNull();
  });

  it("with a title it is an image with that accessible name", () => {
    const { getByRole } = render(<KitIcon name="rewards" title="Rewards" />);

    const img = getByRole("img", { name: "Rewards" });
    expect(img).not.toHaveAttribute("aria-hidden");
    expect(img.querySelector("title")?.textContent).toBe("Rewards");
  });

  it("is 24px by default and follows the size prop", () => {
    const { container, rerender } = render(<KitIcon name="stake" />);
    const svg = () => container.querySelector("svg") as SVGSVGElement;
    expect(svg()).toHaveAttribute("width", "24");
    expect(svg()).toHaveAttribute("height", "24");

    rerender(<KitIcon name="stake" size={48} />);
    expect(svg()).toHaveAttribute("width", "48");
  });

  it("thickens the grid stroke below 40px so the line stays about 2px on screen", () => {
    expect(kitStrokeWidth(24)).toBe(4);
    expect(kitStrokeWidth(32)).toBe(3);
    expect(kitStrokeWidth(48)).toBe(2.5);
    expect(kitStrokeWidth(64)).toBe(2.5);
    expect(kitStrokeWidth(20)).toBe(4.5);
  });

  it("an explicit strokeWidth wins over the size rule", () => {
    const { container } = render(<KitIcon name="pulse" size={24} strokeWidth={2.5} />);

    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "2.5");
  });
});
