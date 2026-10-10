/**
 * Guides Page Icons Test
 *
 * File: __tests__/pages/get-started-icons.test.tsx
 *
 * The Guides page (/[chainName]/get-started) draws its content icons from the icon kit
 * (docs/ui/PATTERNS-PRD.md, "Kit icons"): the page header, one glyph per journey card, the
 * walkthrough header and the Pro Tip box. No tile sits behind a card icon. Small utility icons
 * (the breadcrumb marker, chevrons, button icons) stay lucide, which the shared jest mock renders
 * as `icon-<Name>` spans.
 *
 * Priority: P2
 */

import { render, screen, fireEvent } from "@testing-library/react";
import GetStartedPage from "@/pages/[chainName]/get-started";
import { userJourneys } from "@/lib/userJourneys";
import { KIT_ICON_NAMES } from "@/components/icons/kit";

const KIT_SVG = 'svg[viewBox="0 0 48 48"]';

describe("Guides page icons: P2", () => {
  it("every journey names a glyph that exists in the kit", () => {
    for (const journey of userJourneys) {
      expect(KIT_ICON_NAMES).toContain(journey.icon);
    }
  });

  it("puts a kit icon on the page header and on every journey card, with no tile behind it", () => {
    const { container } = render(<GetStartedPage />);

    const header = screen.getByRole("heading", { level: 1, name: "Guides" });
    expect(header.querySelector(KIT_SVG)).not.toBeNull();

    const cards = Array.from(container.querySelectorAll('[role="button"][tabindex="0"]'));
    expect(cards).toHaveLength(userJourneys.length);
    for (const card of cards) {
      expect(card.querySelector(KIT_SVG)).not.toBeNull();
      expect(card.querySelector(".bg-primary\\/10")).toBeNull();
    }
    // header icon plus one per card, and no other kit icon on the list view
    expect(container.querySelectorAll(KIT_SVG)).toHaveLength(1 + userJourneys.length);
  });

  it("shows the journey glyph in the walkthrough header and a kit glyph in the Pro Tip box", () => {
    const { container } = render(<GetStartedPage />);
    const first = userJourneys[0];
    expect(first.steps[0].tip).toBeTruthy();

    fireEvent.click(container.querySelectorAll('[role="button"][tabindex="0"]')[0]);

    const title = screen.getByRole("heading", { level: 1, name: first.title });
    const headerRow = title.parentElement?.parentElement as HTMLElement;
    expect(headerRow.querySelector(KIT_SVG)).not.toBeNull();
    expect(headerRow.querySelector(".bg-primary\\/10")).toBeNull();

    const tipBox = screen.getByText("Pro Tip").parentElement?.parentElement as HTMLElement;
    expect(tipBox.querySelector(KIT_SVG)).not.toBeNull();
    expect(screen.queryByTestId("icon-Lightbulb")).toBeNull();
  });
});
