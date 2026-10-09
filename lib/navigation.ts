/**
 * Navigation source
 *
 * The one list of destinations that feeds both shells: the Sidebar (lg and up)
 * and the Header menu panel (below lg). Add, rename or reorder a destination
 * here and both update; neither shell keeps its own array.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChevronLeft,
  House,
  Server,
  Settings,
  ShieldCheck,
  ShieldPlus,
  Terminal,
} from "lucide-react";
import { showDevTools } from "@/lib/featureFlags";
import { usePendingTransactions } from "@/lib/hooks/usePendingTransactions";

export type NavGroup = "main" | "more" | "utility";

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Builds the link target for the connected chain's registry name. */
  readonly href: (registryName: string) => string;
  readonly group: NavGroup;
  /** The first path segment after the chain that this item owns. */
  readonly segment?: string;
  /** "needsMe" shows the count of transactions that need the user's signature. */
  readonly badge?: "needsMe";
  /** Listed only when Dev Tools are enabled (lib/featureFlags.ts). */
  readonly devOnly?: boolean;
  /** Leaves the app: rendered as a plain anchor and never active. */
  readonly external?: boolean;
}

export const TOKNS_URL = "https://app.tokns.fi";

/** Declaration order is display order inside each group. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: House,
    href: (chain) => `/${chain}/dashboard`,
    group: "main",
    segment: "dashboard",
    badge: "needsMe",
  },
  {
    id: "create",
    label: "Create CLIQ",
    icon: ShieldPlus,
    href: (chain) => `/${chain}/create`,
    group: "main",
    segment: "create",
  },
  {
    id: "validator",
    label: "Validator",
    icon: Server,
    href: (chain) => `/${chain}/validator`,
    group: "main",
    segment: "validator",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: (chain) => `/${chain}/settings`,
    group: "main",
    segment: "settings",
  },
  {
    id: "audit",
    label: "Audit & tests",
    icon: ShieldCheck,
    href: (chain) => `/${chain}/audit`,
    group: "more",
    segment: "audit",
  },
  {
    id: "guides",
    label: "Guides",
    icon: BookOpen,
    href: (chain) => `/${chain}/get-started`,
    group: "more",
    segment: "get-started",
  },
  {
    id: "dev",
    label: "Dev Tools",
    icon: Terminal,
    href: (chain) => `/${chain}/dev`,
    group: "more",
    segment: "dev",
    devOnly: true,
  },
  {
    id: "tokns",
    label: "Back to TOKNS",
    icon: ChevronLeft,
    href: () => TOKNS_URL,
    group: "utility",
    external: true,
  },
];

/**
 * Every static page under pages/[chainName]/. A path /{chain}/{segment} whose
 * segment is NOT listed here is a CLIQ address, which keeps Home highlighted.
 * __tests__/lib/navigation.test.ts reads the directory and fails when a page
 * is missing from this list. "operations" and "account" are redirected away
 * (next.config.js) but stay reserved so an old link never reads as a CLIQ.
 */
export const RESERVED_CHAIN_SEGMENTS: readonly string[] = [
  "account",
  "audit",
  "create",
  "dashboard",
  "dev",
  "get-started",
  "operations",
  "settings",
  "validator",
];

/** Items of one group, in display order; Dev Tools only when enabled. */
export function getNavItems(group: NavGroup, devToolsEnabled: boolean = showDevTools): NavItem[] {
  return NAV_ITEMS.filter((item) => item.group === group && (!item.devOnly || devToolsEnabled));
}

/**
 * Whether the item is the current destination. Strips the query and hash, then
 * compares the segment after the chain. Home also owns CLIQ pages
 * (/{chain}/{address}/...), which have no nav entry of their own.
 */
export function isNavItemActive(item: NavItem, asPath: string): boolean {
  if (item.external) return false;

  const pathOnly = asPath.split(/[?#]/)[0];
  const segment = pathOnly.split("/").filter(Boolean)[1];
  if (!segment) return false;

  if (item.id === "home") {
    return segment === item.segment || !RESERVED_CHAIN_SEGMENTS.includes(segment);
  }
  return segment === item.segment;
}

/**
 * The count behind the Home badge and the Header bell: pending transactions on
 * the user's CLIQs that still need THIS wallet's signature (not every pending
 * transaction). Sidebar and Header both read it from here.
 */
export function useNeedsMyCount(): number {
  const { needsMyCount } = usePendingTransactions();
  return needsMyCount;
}
