/**
 * Navigation source tests
 *
 * File: __tests__/lib/navigation.test.ts
 *
 * lib/navigation.ts feeds both the Sidebar and the Header panel. These tests pin
 * the item list, the active-state rule, and the reserved-route list that keeps a
 * CLIQ address from being mistaken for a static page (and the other way round).
 *
 * Priority: P0
 */

import fs from "fs";
import path from "path";
import {
  NAV_ITEMS,
  RESERVED_CHAIN_SEGMENTS,
  getNavItems,
  isNavItemActive,
  type NavItem,
} from "@/lib/navigation";

const item = (id: string): NavItem => {
  const found = NAV_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`nav item ${id} not found`);
  return found;
};

describe("lib/navigation: item list: P0", () => {
  it("lists the main group in order", () => {
    expect(getNavItems("main", true).map((i) => i.label)).toEqual([
      "Home",
      "Create CLIQ",
      "Validator",
      "Settings",
    ]);
  });

  it("lists the more group with Audit & tests before Guides, Dev Tools last", () => {
    expect(getNavItems("more", true).map((i) => i.label)).toEqual([
      "Audit & tests",
      "Guides",
      "Dev Tools",
    ]);
  });

  it("hides Dev Tools unless they are enabled", () => {
    expect(getNavItems("more", false).map((i) => i.label)).toEqual(["Audit & tests", "Guides"]);
  });

  it("holds Back to TOKNS once, as an external utility item", () => {
    const utility = getNavItems("utility", true);
    expect(utility).toHaveLength(1);
    expect(utility[0].label).toBe("Back to TOKNS");
    expect(utility[0].external).toBe(true);
    expect(utility[0].href("tx")).toBe("https://app.tokns.fi");
  });

  it("builds chain-relative hrefs", () => {
    expect(item("home").href("tx")).toBe("/tx/dashboard");
    expect(item("guides").href("tx")).toBe("/tx/get-started");
    expect(item("audit").href("tx")).toBe("/tx/audit");
  });

  it("puts the signature badge on Home only", () => {
    expect(NAV_ITEMS.filter((i) => i.badge).map((i) => i.id)).toEqual(["home"]);
  });
});

describe("lib/navigation: isNavItemActive: P0", () => {
  it("marks Home active on /dashboard, ignoring query and hash", () => {
    expect(isNavItemActive(item("home"), "/tx/dashboard")).toBe(true);
    expect(isNavItemActive(item("home"), "/tx/dashboard?tab=cliqs")).toBe(true);
    expect(isNavItemActive(item("home"), "/tx/dashboard#open-by-address")).toBe(true);
  });

  it("keeps Home active on CLIQ pages and transaction pages", () => {
    expect(isNavItemActive(item("home"), "/tx/testcore1abc")).toBe(true);
    expect(isNavItemActive(item("home"), "/tx/testcore1abc/transaction/new?type=send")).toBe(true);
    expect(isNavItemActive(item("home"), "/tx/testcore1abc/transaction/42")).toBe(true);
  });

  it("does not mark Home active on any other destination", () => {
    for (const segment of ["create", "validator", "settings", "audit", "get-started", "dev"]) {
      expect(isNavItemActive(item("home"), `/tx/${segment}`)).toBe(false);
    }
  });

  it("matches each other item on its own segment only", () => {
    expect(isNavItemActive(item("validator"), "/tx/validator")).toBe(true);
    expect(isNavItemActive(item("validator"), "/tx/validator?x=1")).toBe(true);
    expect(isNavItemActive(item("settings"), "/tx/settings#database-config")).toBe(true);
    expect(isNavItemActive(item("guides"), "/tx/get-started")).toBe(true);
    expect(isNavItemActive(item("audit"), "/tx/audit")).toBe(true);
    expect(isNavItemActive(item("create"), "/tx/create")).toBe(true);
    expect(isNavItemActive(item("settings"), "/tx/validator")).toBe(false);
    expect(isNavItemActive(item("create"), "/tx/dashboard")).toBe(false);
  });

  it("marks nothing active outside a chain page or for the external item", () => {
    expect(isNavItemActive(item("home"), "/")).toBe(false);
    expect(isNavItemActive(item("home"), "/tx")).toBe(false);
    expect(isNavItemActive(item("home"), "/404")).toBe(false);
    expect(isNavItemActive(item("tokns"), "/tx/dashboard")).toBe(false);
  });
});

describe("lib/navigation: reserved routes: P0", () => {
  // Reads pages/[chainName]/ at run time. A new static page that is not listed
  // would make Home swallow it as if it were a CLIQ address.
  const pagesDir = path.join(process.cwd(), "pages", "[chainName]");
  const staticPages = fs
    .readdirSync(pagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name))
    .map((entry) => entry.name.replace(/\.(tsx?|jsx?)$/, ""))
    .filter((name) => name !== "index" && !name.startsWith("["));

  it("finds the static pages it is meant to guard", () => {
    expect(staticPages).toEqual(expect.arrayContaining(["dashboard", "settings", "audit"]));
  });

  it.each(staticPages)("reserves the static page %s", (name) => {
    expect(RESERVED_CHAIN_SEGMENTS).toContain(name);
  });

  it("gives every nav item with a segment a reserved segment", () => {
    for (const nav of NAV_ITEMS) {
      if (nav.segment) expect(RESERVED_CHAIN_SEGMENTS).toContain(nav.segment);
    }
  });

  it("keeps the redirected routes reserved so an old link never reads as a CLIQ", () => {
    expect(RESERVED_CHAIN_SEGMENTS).toEqual(expect.arrayContaining(["operations", "account"]));
  });
});
