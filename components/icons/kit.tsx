import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Kit icons: the TOKNS brand icon kit idiom, painted with cliqs tokens.
 *
 * Source of truth: the TOKNS brand icon kit. The idiom changes in the kit first;
 * cliqs copies. Spec and catalog: docs/ui/PATTERNS-PRD.md ("Kit icons").
 *
 * The idiom: a 48 grid, round caps and joins, no tile behind the icon, an ink line
 * that is `currentColor`, and exactly ONE coral part per icon (`text-primary`): a
 * stroke, a solid, or an 18% wash with an outline. A part may be two shapes that
 * read as one (an arrow's shaft and head); those shapes sit together in ONE
 * `<g data-coral="">`, so a part is always one element and a test can count them
 * (__tests__/components/kit-icons.test.tsx). A second coral shape outside that
 * group is a second part, and breaks the rule.
 *
 * `multisig` and `clock` come from the TOKNS brand icon kit; `clock` is the kit's
 * clock face under a plain name. `rank`, `withdraw` and `stakers` are new in
 * cliqs, drawn in the same idiom. The TOKNS wordmark and product-named icons are
 * deliberately not copied.
 */

/** Ink line: follows the text colour of the parent. */
const LN = "fill-none stroke-current";
/** Coral stroke. */
const AC = "fill-none stroke-primary";
/** Coral solid. */
const AF = "fill-primary";
/** Coral 18% wash with its coral outline. */
const AS = "fill-primary/[0.18] stroke-primary";

const GLYPHS = {
  // a ballot standing in the box's slot, ticked in coral
  governance: (
    <>
      <path className={LN} d="M16 24V9.5A2.5 2.5 0 0 1 18.5 7h11A2.5 2.5 0 0 1 32 9.5V24" />
      <path className={LN} d="M7 24h34v13.5a4.5 4.5 0 0 1-4.5 4.5h-25A4.5 4.5 0 0 1 7 37.5V24Z" />
      <path className={LN} d="M19 33h10" />
      <path className={AC} d="m19.5 15.5 3 3 6-6" />
    </>
  ),
  // a shield with a coral check
  stake: (
    <>
      <path
        className={LN}
        d="M24 5 9 10.5v11c0 9.5 6.3 17.6 15 20.5 8.7-2.9 15-11 15-20.5v-11L24 5Z"
      />
      <path className={AC} d="m17 23.5 5 5 9.5-10" />
    </>
  ),
  // a gift box with a coral bow
  rewards: (
    <>
      <path className={LN} d="M9 22h30v17.5a2.5 2.5 0 0 1-2.5 2.5h-25A2.5 2.5 0 0 1 9 39.5V22Z" />
      <rect className={LN} x="6" y="15" width="36" height="7" rx="2" />
      <path className={LN} d="M24 15v27" />
      <path
        className={AC}
        d="M24 15c-2.5-5-9.5-6.5-9.5-2.5S21 15 24 15c3 0 9.5-.5 9.5-2.5S26.5 10 24 15Z"
      />
    </>
  ),
  // a pie with one coral slice: your share of the whole (voting power)
  portfolio: (
    <>
      <path className={LN} d="M41 26A17 17 0 1 1 22 7v19h19Z" />
      <path className={AS} d="M28 5.5A17 17 0 0 1 42.5 20H28V5.5Z" />
    </>
  ),
  // a flat line with a coral heartbeat in the middle (network health)
  pulse: (
    <>
      <path className={LN} d="M5 25h8" />
      <path className={LN} d="M34 25h9" />
      <path className={AC} d="m13 25 4-10 6 21 5-15 3 4h3" />
    </>
  ),
  // four tiles, one of them coral
  dashboard: (
    <>
      <rect className={LN} x="6" y="6" width="16" height="20" rx="3.5" />
      <rect className={LN} x="26" y="21" width="16" height="21" rx="3.5" />
      <rect className={LN} x="6" y="30" width="16" height="12" rx="3.5" />
      <rect className={AS} x="26" y="6" width="16" height="11" rx="3.5" />
    </>
  ),
  // a padlock with three key dots, two of them coral (a CLIQ: some of the keys have signed)
  multisig: (
    <>
      <path className={LN} d="M15 21v-5a9 9 0 0 1 18 0v5" />
      <rect className={LN} x="8" y="21" width="32" height="21" rx="5.5" />
      <circle className={LN} cx="16" cy="31.5" r="3" />
      <circle className={LN} cx="24" cy="31.5" r="3" />
      <circle className={LN} cx="32" cy="31.5" r="3" opacity={0.45} />
      <g data-coral="">
        <circle className={AF} cx="16" cy="31.5" r="3.4" />
        <circle className={AF} cx="24" cy="31.5" r="3.4" />
      </g>
    </>
  ),
  // a clock face with a coral minute hand (the kit's repo clock; the product name is not used here)
  clock: (
    <>
      <circle className={LN} cx="24" cy="24" r="18" />
      <path className={LN} d="M24 9.5v2.5M38.5 24H36M24 38.5V36M9.5 24H12" opacity={0.55} />
      <path className={LN} d="M24 24 18 18" />
      <g data-coral="">
        <path className={AC} d="M24 24h11" />
        <circle className={AF} cx="24" cy="24" r="2.6" />
      </g>
    </>
  ),
  // NEW in cliqs: three bars, the tallest coral (ranking)
  rank: (
    <>
      <rect className={LN} x="6" y="26" width="8" height="16" rx="2.5" />
      <rect className={AS} x="20" y="8" width="8" height="34" rx="2.5" />
      <rect className={LN} x="34" y="32" width="8" height="10" rx="2.5" />
    </>
  ),
  // NEW in cliqs: a coral arrow leaving a frame (paid out to an address)
  withdraw: (
    <>
      <path className={LN} d="M21 8h-9a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h9" />
      <g data-coral="">
        <path className={AC} d="M19 24h21" />
        <path className={AC} d="m33 17 7 7-7 7" />
      </g>
    </>
  ),
  // NEW in cliqs: two figures, the second coral (stakers)
  stakers: (
    <>
      <circle className={LN} cx="19" cy="15" r="7" />
      <path className={LN} d="M5 41v-3a10 10 0 0 1 10-10h8a10 10 0 0 1 10 10v3" />
      <g data-coral="">
        <path className={AC} d="M32.5 8.5a7 7 0 0 1 0 13" />
        <path className={AC} d="M36 29a10 10 0 0 1 8 9.8V41" />
      </g>
    </>
  ),
} as const;

export type KitIconName = keyof typeof GLYPHS;

/** Every icon name, in catalog order. */
export const KIT_ICON_NAMES = Object.keys(GLYPHS) as KitIconName[];

/**
 * Stroke width on the 48 grid. The kit's own 2.5 renders 1.25px at 24px, thinner
 * than the rest of the app's 2px line icons, so below 40px the grid stroke grows to
 * keep the line about 2px on screen (24px -> 4, 32px -> 3, 40px and up -> 2.5).
 */
export function kitStrokeWidth(size: number): number {
  return Math.min(4.5, Math.max(2.5, Math.round((96 / size) * 10) / 10));
}

export interface KitIconProps extends Omit<
  React.SVGProps<SVGSVGElement>,
  "name" | "children" | "viewBox"
> {
  name: KitIconName;
  /** Pixel size (the icon is square). Default 24. Do not go below 20. */
  size?: number;
  /** Stroke width on the 48 grid. Default: `kitStrokeWidth(size)`. */
  strokeWidth?: number;
  /** Gives the icon an accessible name. Without it the icon is decorative (`aria-hidden`). */
  title?: string;
}

export function KitIcon({ name, size = 24, strokeWidth, title, className, ...rest }: KitIconProps) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      strokeWidth={strokeWidth ?? kitStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {labelled ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}
