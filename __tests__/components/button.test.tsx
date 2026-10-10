/**
 * Button Test
 *
 * File: __tests__/components/button.test.tsx
 *
 * The house-style button: pill, 44px, 8px gaps (components/ui/button.tsx, docs/ui/BUTTONS-PRD.md):
 *   - the default size is the 44px class (h-11) and every button keeps the pill shape
 *   - sm is 36px, lg is 48px, the new xs chip is 24px and not a pill, icon is 44px square
 *   - the default variant is the coral sheen, action is solid ink and no longer mono uppercase
 *   - a colour override from a call site replaces the sheen, so it never shows through
 *   - disabled and loading buttons cannot be clicked
 *   - a focused button keeps its pill: no variant or size carries a rounding class under any
 *     focus variant (focus:, focus-visible:, focus-within:, group-focus:, peer-focus:, an arbitrary
 *     [&:focus] selector), with other variants chained before or after it (focus-visible:sm:rounded-md)
 *     and with an important mark (focus-visible:!rounded-none). The house style's own focus rule
 *     squares the corners; that is a measured bug and is not copied. Each class is split on its
 *     top-level colons, so the check reads the class and does not match a text shape. The variants and
 *     sizes are read from the source of components/ui/button.tsx, so a new one is covered without
 *     touching this test. Not seen: a class passed to the Button as a prop, a focus rounding the
 *     component adds under a condition (isActive, isLoading), or one set in a stylesheet.
 *
 * Priority: P2
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button geometry: P2", () => {
  it("default size is 44px tall (h-11) and keeps rounded-full", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("h-11", "px-5", "rounded-full");
  });

  it("action and action-lg share the default and lg geometry", () => {
    render(
      <>
        <Button variant="action" size="action">
          Act
        </Button>
        <Button variant="action" size="action-lg">
          Act big
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Act" })).toHaveClass("h-11", "px-5");
    expect(screen.getByRole("button", { name: "Act big" })).toHaveClass("h-12", "px-6");
  });

  it("sm is 36px, lg is 48px, icon is a 44px square", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Add" />
      </>,
    );

    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("h-9", "rounded-full");
    expect(screen.getByRole("button", { name: "Large" })).toHaveClass("h-12", "rounded-full");
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("h-11", "w-11");
  });

  it("xs is the 24px chip for dense rows and is not a pill", () => {
    render(<Button size="xs">Copy</Button>);

    const chip = screen.getByRole("button", { name: "Copy" });
    expect(chip).toHaveClass("h-6", "rounded-md");
    expect(chip).not.toHaveClass("rounded-full");
  });

  it("presses with a half-pixel nudge, not a scale", () => {
    render(<Button>Press</Button>);

    const button = screen.getByRole("button", { name: "Press" });
    expect(button).toHaveClass("active:translate-y-[0.5px]");
    expect(button).not.toHaveClass("active:scale-95");
  });
});

describe("Button line height: P2", () => {
  // House-style buttons are line-height 1.2. The class has to SURVIVE tailwind-merge:
  // a text-sm / text-[13px] size drops any earlier leading-*, so a leading in the base string
  // alone renders as 20px on the real page (measured 2026-10-10). It lives on each size string.
  it("default, sm and lg keep leading-[1.2] after the merge", () => {
    render(
      <>
        <Button>Default</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </>,
    );

    for (const name of ["Default", "Small", "Large"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("leading-[1.2]");
    }
  });

  it("keeps it on the other text sizes too: xs, xl and the three action sizes", () => {
    render(
      <>
        <Button size="xs">Chip</Button>
        <Button size="xl">Huge</Button>
        <Button variant="action" size="action">
          Act
        </Button>
        <Button variant="action" size="action-sm">
          Act small
        </Button>
        <Button variant="action" size="action-lg">
          Act big
        </Button>
      </>,
    );

    for (const name of ["Chip", "Huge", "Act", "Act small", "Act big"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("leading-[1.2]");
    }
  });

  it("leaves a call site free to choose its own line height", () => {
    render(<Button className="leading-tight">Tight</Button>);

    const button = screen.getByRole("button", { name: "Tight" });
    expect(button).toHaveClass("leading-tight");
    expect(button).not.toHaveClass("leading-[1.2]");
  });
});

describe("Button variants: P2", () => {
  it("default is the coral sheen with near-black text", () => {
    render(<Button>Coral</Button>);

    expect(screen.getByRole("button", { name: "Coral" })).toHaveClass(
      "bg-primary-gradient",
      "text-primary-foreground",
    );
  });

  it("action is solid ink in sentence case: no uppercase, no mono", () => {
    render(<Button variant="action">Create CLIQ</Button>);

    const button = screen.getByRole("button", { name: "Create CLIQ" });
    expect(button).toHaveClass("bg-foreground", "text-background");
    expect(button).not.toHaveClass("uppercase");
    expect(button).not.toHaveClass("font-mono");
  });

  it("outline and action-outline are a transparent ghost with a visible 1px edge", () => {
    render(
      <>
        <Button variant="outline">Out</Button>
        <Button variant="action-outline">Act out</Button>
      </>,
    );

    for (const name of ["Out", "Act out"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("border", "bg-transparent", "border-border/15");
      expect(button).not.toHaveClass("border-2");
    }
  });

  it("a background colour from a call site replaces the sheen instead of sitting under it", () => {
    render(<Button className="bg-success">Yes</Button>);

    const button = screen.getByRole("button", { name: "Yes" });
    expect(button).toHaveClass("bg-success");
    expect(button).not.toHaveClass("bg-primary-gradient");
  });
});

describe("Button states: P2", () => {
  it("a disabled button does not call onClick", () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("isLoading disables the button and puts the spinner before the label", () => {
    const { container } = render(<Button isLoading>Working</Button>);

    const button = screen.getByRole("button", { name: "Working" });
    expect(button).toBeDisabled();
    expect(button.firstElementChild).toHaveClass("animate-spin");
    expect(container.querySelectorAll(".animate-spin")).toHaveLength(1);
  });

  it("asChild keeps the pill on a link", () => {
    render(
      <Button asChild variant="outline">
        <a href="https://example.invalid/open">Open</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: "Open" })).toHaveClass("h-11", "rounded-full");
  });
});

/** The keys of cva's `variants.<group>` object, read from the source so the list cannot drift. */
function declaredKeys(group: "variant" | "size"): string[] {
  const file = path.resolve(__dirname, "../../components/ui/button.tsx");
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const keys: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText() === group &&
      ts.isObjectLiteralExpression(node.initializer) &&
      // the cva `variants` entry, not the `variant` / `size` of ButtonProps or of defaultVariants
      node.parent.parent &&
      ts.isPropertyAssignment(node.parent.parent) &&
      node.parent.parent.name.getText() === "variants"
    ) {
      for (const prop of node.initializer.properties) {
        if (ts.isPropertyAssignment(prop)) {
          keys.push(prop.name.getText().replace(/^["']|["']$/g, ""));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return keys;
}

/** Splits a class on the colons that are not inside [...] or (...): "md:[&:focus]:rounded-lg" gives ["md", "[&:focus]", "rounded-lg"]. */
function splitClass(cls: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i];
    if (c === "[" || c === "(") {
      depth++;
    } else if (c === "]" || c === ")") {
      depth--;
    } else if (c === ":" && depth === 0) {
      parts.push(cls.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(cls.slice(start));
  return parts;
}

/**
 * The classes of a list that change the corner radius while a focus state is on: some variant in
 * front names focus (focus, focus-visible, focus-within, group-focus, peer-focus-visible/name,
 * [&:focus], has-[:focus]) and the utility behind it is rounded-* or an arbitrary radius property.
 * The important mark (a leading ! in Tailwind 3, a trailing ! in 4) is not part of the utility.
 */
function focusRoundedClasses(classList: string): string[] {
  return classList
    .split(/\s+/)
    .filter(Boolean)
    .filter((cls) => {
      const parts = splitClass(cls);
      const utility = (parts.pop() ?? "").replace(/^!|!$/g, "");
      return (
        parts.some((variant) => /(?<![a-z])focus/.test(variant)) &&
        /^(?:rounded(?:-|$)|\[[a-z-]*radius:)/.test(utility)
      );
    });
}

describe("Button focus keeps the pill shape: P2", () => {
  const variants = declaredKeys("variant");
  const sizes = declaredKeys("size");

  it("reads the real variant and size names from the source (a read that finds none proves nothing)", () => {
    expect(variants).toEqual(expect.arrayContaining(["default", "outline", "ghost", "action"]));
    expect(sizes).toEqual(expect.arrayContaining(["default", "sm", "lg", "xs", "icon"]));
    expect(variants.length).toBeGreaterThanOrEqual(10);
    expect(sizes.length).toBeGreaterThanOrEqual(8);
  });

  it("flags a focus rounding class and nothing else (the check itself, on inline class lists)", () => {
    // each one sits beside the pill's own rounded-full, which must not be flagged
    for (const cls of [
      "focus:rounded-none",
      "focus-visible:rounded-sm",
      "focus-within:rounded-none",
      "md:focus:rounded-lg",
      "hover:focus-visible:rounded-md",
      "[&:focus-visible]:rounded-none",
      "md:[&:focus]:rounded-lg",
      // a variant after the focus variant
      "focus-visible:sm:rounded-md",
      // a colon inside parentheses belongs to the value, not to a variant
      "focus:rounded-(length:--r)",
      // the important mark, Tailwind 3 (in front) and 4 (behind)
      "focus-visible:!rounded-none",
      "focus:rounded-none!",
      // the focus of a parent or a sibling
      "group-focus:rounded-none",
      "group-focus-visible/menu:rounded-sm",
      "peer-focus-within:rounded-lg",
      "has-[:focus]:rounded-none",
      // another shape of the same utility
      "focus:rounded",
      "focus:rounded-t-none",
      "focus:rounded-[4px]",
      "sm:focus-visible:!rounded-tl-none",
      "focus:[border-radius:0]",
      "focus:[border-top-left-radius:0px]",
    ]) {
      expect(focusRoundedClasses(`rounded-full ${cls} px-4`)).toEqual([cls]);
    }
    for (const fine of [
      "rounded-full focus-visible:ring-2 focus-visible:ring-offset-2",
      "focus:outline-none rounded-md",
      "hover:rounded-full",
      "sm:rounded-lg md:hover:rounded-none",
      "group-hover:rounded-none peer-checked:rounded-sm",
      "focus-visible:ring-[3px] focus-visible:ring-offset-[2px]",
      "focus:bg-[color:red] focus:[mask-type:alpha]",
      "data-[unfocused]:rounded-none",
      "focus:roundedish",
    ]) {
      expect(focusRoundedClasses(fine)).toEqual([]);
    }
  });

  it.each(declaredKeys("variant"))("variant %s keeps its shape at every size", (variant) => {
    for (const size of sizes) {
      const { container, unmount } = render(
        <Button
          variant={variant as React.ComponentProps<typeof Button>["variant"]}
          size={size as React.ComponentProps<typeof Button>["size"]}
        >
          Label
        </Button>,
      );

      const classes = container.firstElementChild?.getAttribute("class") ?? "";
      expect({ variant, size, focusRounded: focusRoundedClasses(classes) }).toEqual({
        variant,
        size,
        focusRounded: [],
      });
      unmount();
    }
  });

  it("still has a focus ring on the pill, so the shape check is not satisfied by dropping focus styles", () => {
    render(<Button>Ring</Button>);

    const button = screen.getByRole("button", { name: "Ring" });
    expect(button).toHaveClass("focus-visible:ring-2", "rounded-full");
  });
});
