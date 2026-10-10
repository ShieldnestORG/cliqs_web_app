/**
 * Menus and Select Test
 *
 * File: __tests__/components/menus-select.test.tsx
 *
 * The house-style menu metrics on the shared Radix wrappers (docs/ui/PATTERNS-PRD.md, "Menus"):
 *   - panel: 220px minimum, 16px radius (rounded-2xl), 6px inset (p-1.5), the pop shadow
 *   - item: 40px minimum (44px on phones), 8px radius, 13px text, coral-wash highlight
 *   - label: small mono caps; separator: hairline inset 6px
 *   - select: a 44px trigger (min-h-11) with the interactive edge and the field fill
 *
 * Priority: P2
 */

import { render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("Dropdown menu metrics: P2", () => {
  const renderOpenMenu = () =>
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>
            Profile <DropdownMenuShortcut>P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

  it("renders the panel at 220px minimum, 16px radius, 6px inset", () => {
    renderOpenMenu();

    const panel = screen.getByRole("menu");
    expect(panel).toHaveClass("min-w-[220px]", "rounded-2xl", "p-1.5", "shadow-pop");
  });

  it("renders items at 40px (44px on phones) with the coral-wash highlight", () => {
    renderOpenMenu();

    const item = screen.getByRole("menuitem", { name: /Sign out/ });
    expect(item).toHaveClass(
      "min-h-10",
      "max-sm:min-h-11",
      "rounded-md",
      "px-2.5",
      "py-2",
      "text-[13px]",
      "data-[highlighted]:bg-primary-soft",
    );
  });

  it("renders the label as small mono caps, the shortcut as mono, the separator as a hairline", () => {
    renderOpenMenu();

    expect(screen.getByText("Account")).toHaveClass("font-mono", "text-[10px]", "uppercase");
    expect(screen.getByText("P")).toHaveClass("font-mono", "ml-auto");
    expect(screen.getByRole("separator")).toHaveClass("mx-1.5", "h-px");
  });
});

describe("Select trigger metrics: P2", () => {
  it("is a 44px field with the interactive edge", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Role">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Role" });
    expect(trigger).toHaveClass(
      "min-h-11",
      "rounded-md",
      "px-3.5",
      "border-interactive",
      "bg-field",
    );
  });
});
