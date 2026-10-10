# Patterns PRD

> **Cluster:** design-system · **Tags:** ui, patterns, gridspotlight, scale-rule, kit-icons, menus, sidebar, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Cards PRD](./CARDS-PRD.md), [Buttons PRD](./BUTTONS-PRD.md), [Forms PRD](./FORMS-PRD.md)

**Cosmos Multisig UI - Visual Patterns Specification**  
**Version:** 1.3  
**Last Updated:** 2026-10-10

---

## 1. Overview

Visual patterns for consistent styling across the application:

- **The animated page background** (§3) — one global canvas, and the transparency
  contract every page must honour
- **Color palette** optimized for dark mode
- **Shadow system** for elevation
- **Animation patterns** for micro-interactions
- **Status indicators** for feedback
- **Interaction patterns** (§17–§19) — hover-card disclosure, click-only copy
  confirmation, and the auto-collapsing sidebar rail
- **The scale rule** (§20) — the ruler-edge section divider; **menus** (§21) — the house-style
  dropdown and select metrics; **kit icons** (§9) — the TOKNS brand icon kit glyph set;
  **scroll boxes** (§22) — why a `max-h` scroller must be `relative`

---

## 2. Color Palette (Dark Mode)

### Core Colors

> **Canonical values live in [`docs/STYLE-GUIDE.md`](../STYLE-GUIDE.md).** The block
> below mirrors it for convenience; if the two disagree, the style guide wins.

```css
:root {
  /* Background — Coherence Daddy dark canvas */
  --background: 240 6.7% 5.9%;         /* #0E0E10 - Main bg */
  --card: 240 5.9% 10%;                /* #18181B - Card + popover bg */
  --muted: 240 4.6% 12.7%;             /* #1F1F22 - Muted / secondary bg */

  /* Foreground */
  --foreground: 48 16.1% 93.9%;        /* #F2F1ED - Primary text (warm) */
  --muted-foreground: 240 2.7% 64.1%;  /* #A1A1A6 - Secondary text */

  /* Border — NOTE: no alpha inside the token, so border-border/NN works */
  --border: 0 0% 100%;                 /* white; applied globally at /[0.06] */
  --input: 240 4.6% 12.7%;             /* #1F1F22 */
}
```

### Accent Colors

```css
:root {
  /* Brand coral — this is --primary and, confusingly, --accent-green too */
  --primary: 10.9 100% 64.5%;          /* #FF6B4A */
  --accent-green: 10.9 100% 64.5%;     /* #FF6B4A - hue 11: CORAL, not green */
  --accent-green-bright: 10.9 100% 70%;/* Hover states */

  /* Secondary accent */
  --accent-purple: 260 28% 55%;        /* #7B68AE - utility is `purple-accent` */

  /* Semantic status */
  --success: 156.1 35.9% 45.3%;        /* #4A9D7C - the real green */
  --warning: 37.4 72.3% 56.1%;         /* #E0A33E */
  --info: 219.7 82.2% 64.7%;           /* #5B8DEF */
  --destructive: 0 66.4% 55.7%;        /* #D94343 - Errors */
}
```

> **`--accent-green` is hue 11 — coral, not green.** The name is inherited from an
> earlier migration and kept because 97 call sites (77 lines across 22 files) use
> `green-accent`. Never map a
> success meaning onto it; it renders orange and collides with `destructive`. Use
> `--success` for success.

---

## 3. Page Background (GridSpotlight)

Every page sits on a single animated dotted-grid canvas —
`components/GridSpotlight.tsx`, mounted once in `pages/_app.tsx` above all the providers.
It is the brand background; pages do not paint their own.

### How it renders

A single `<canvas>`, `position: fixed`, `inset: 0`, `z-index: -1`,
`pointer-events: none`, `aria-hidden="true"`. Each frame draws three layers:

1. **Dot lattice** on a 26px grid, resting radius 1.0–1.6px, colour
   `rgba(242,241,237,α)` — the dot sizes drift through a smooth 2D value-noise field, so
   "bigness" migrates across the field instead of pulsing in lockstep. (A wave would
   line its peaks up on diagonals; the noise field is what avoids that.)
2. **Cursor spotlight** — dots within 160px of the pointer brighten.
3. **Comet trail** — small dots along the pointer's path, fading over 650ms.

### The transparency contract — read this before styling a page

```css
/* styles/globals.css, @layer base */
html { background-color: hsl(var(--background)); }  /* the opaque canvas colour */
body { background-color: transparent; }             /* lets the <canvas> show through */
```

The opaque `#0E0E10` lives on **`<html>`**, and `body` plus the page wrappers are
transparent, so the `z-index: -1` canvas paints above the html background and below all
content.

**Consequence: a page must not paint its own opaque, full-bleed background.** A
`bg-background` on a page-level wrapper covers the canvas completely and silently
deletes the effect for that route. This is why `.bg-pattern-dots` was neutralised rather
than deleted:

```css
/* styles/globals.css, as shipped */
.bg-pattern-dots {
  background: transparent;
}
```

It still has one consumer — `components/layout/DashboardLayout.tsx` applies it to its
`min-h-screen` wrapper — so the class must stay, but it now paints nothing. Two reasons
it could not simply keep its old rule: the old opaque `background-color` would have
hidden the canvas, and its static 24px lattice would have moiréd against the animated
26px one.

### Opting out / interacting with it

| You want | Do this |
|----------|---------|
| A full-bleed page background | Nothing. Leave wrappers transparent; the canvas is the background. |
| An opaque panel over it | Give the panel its own `bg-card` / `bg-muted` — cards, headers and dialogs are meant to occlude the field. |
| To suppress the cursor spotlight under a surface | Nothing — automatic. The canvas walks up from the hovered element and suppresses the spotlight and trail whenever it finds a computed `background-color` with alpha ≥ 0.12. Surfaces below that threshold (e.g. `bg-card/10`) will let the spotlight bleed through; raise the alpha rather than fighting the canvas. |
| To kill the effect on one route | Not supported by design. If a route genuinely needs it gone, paint an opaque background on that page's own wrapper and say so in review — do not edit `GridSpotlight`. |

### Cost and accessibility controls

| Control | Behaviour |
|---------|-----------|
| Frame rate | Capped at ~30fps (`if (now - last < 33) return`) |
| Hidden tab | `visibilitychange` cancels the RAF loop entirely; it restarts on return |
| `prefers-reduced-motion: reduce` | Draws **one** static frame and never starts the loop; a resize redraws that single frame |
| Coarse pointer (touch) | Spotlight and trail listeners are only attached for `(pointer: fine)`; the dot drift still renders |
| DPR | Clamped to 2 (`Math.min(window.devicePixelRatio || 1, 2)`) |

---

## 3a. Legacy Background Patterns

These predate the canvas. They still exist in `globals.css` but currently have **no
consumers** under `components/` or `pages/`.

### Grid Pattern

Engineering-paper style grid.

```css
.bg-pattern-grid {
  background-color: hsl(var(--background));
  background-image: 
    linear-gradient(to right, hsl(var(--border) / 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

> ⚠️ `.bg-pattern-grid` sets an **opaque** `background-color`. Applying it to a
> full-bleed page wrapper will hide the GridSpotlight canvas on that route (§3). Scope it
> to a bounded panel, or don't use it.

### Diagonal Stripes

For section accents.

```css
.bg-pattern-stripes {
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 8px,
    hsl(var(--muted) / 0.3) 8px,
    hsl(var(--muted) / 0.3) 9px
  );
}
```

---

## 4. Gradient Backgrounds

### Card gradient (the default)

`default` and `institutional` cards, and the `default` / `highlight` / `accent` bento
variants, all ship with `bg-gradient-to-br from-card to-muted/30` **by default**. Opt out
with `bg-none`, which zeroes `background-image` and leaves your `bg-*` colour intact.
Full treatment in [Cards PRD §2.1](./CARDS-PRD.md#21-the-default-gradient-and-how-to-opt-out).

```tsx
<Card className="bg-muted/30 bg-none">Flat, tinted panel</Card>
```

### Default Gradient

```css
.gradient-bg {
  background: linear-gradient(
    135deg, 
    hsl(var(--background)) 0%, 
    hsl(var(--muted) / 0.3) 100%
  );
}
```

### Hero Gradient

```css
.gradient-hero {
  background: linear-gradient(
    180deg, 
    hsl(var(--background)) 0%, 
    hsl(var(--muted) / 0.2) 100%
  );
}
```

---

## 5. Shadow System

### Card Shadow (Resting)

```css
box-shadow: 
  0 1px 3px rgba(0, 0, 0, 0.04),
  inset 0 1px 0 rgba(255, 255, 255, 0.05);
```

### Card Shadow (Hover)

```css
box-shadow: 
  0 8px 24px rgba(0, 0, 0, 0.12),
  0 4px 8px rgba(0, 0, 0, 0.08);
```

### Focus Ring

Two mechanisms exist, and they are **different colours**:

```css
/* 1. The .focus-ring helper class (styles/globals.css) — purple */
.focus-ring:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px hsl(var(--accent-purple) / 0.3),
    0 4px 12px hsl(var(--accent-purple) / 0.12);
}
```

```css
/* 2. The token-driven ring utilities used by components/ui/button.tsx — coral */
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
/* --ring = 10.9 100% 64.5% = #FF6B4A */
```

`tailwind.config.js` also carries a `shadow-focus-ring` key hardcoded to purple
(`hsl(260 28% 55% / 0.3)`). Prefer the `ring-ring` utilities on new work so focus reads
as the brand coral; the two purple survivors are cleanup, not intent.

---

## 6. Glass Morphism

```css
.glass {
  background: hsl(var(--background) / 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

---

## 7. Status Indicators

### Active Dot (Pulsing)

The shape lives on `.status-dot`; the state classes only set colour and animation. The
active dot is `--accent-green`, i.e. **coral** — it means "live", not "success".

```css
.status-dot {
  @apply h-2 w-2 rounded-full;
}

.status-dot-active {
  background: hsl(var(--accent-green));
  animation: status-pulse 2s ease-in-out infinite;
}

.status-dot-inactive {
  background: hsl(var(--muted-foreground));
}

@keyframes status-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 hsl(var(--accent-green) / 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px hsl(var(--accent-green) / 0);
  }
}
```

### Change Indicators

```css
/* styles/globals.css, as shipped */
.change-positive {
  color: hsl(11 100% 71%);
}

.change-negative {
  color: hsl(0 84% 60%);
}
```

> **Known deviation — outstanding, not fixed.** Both classes hardcode raw HSL instead of
> the semantic tokens, and `.change-positive` is hue 11, i.e. **coral, not green**, so a
> positive delta currently renders as the brand accent. `.change-negative` is a raw red
> that is not `--destructive` (`0 66.4% 55.7%`). New code should use `text-success` /
> `text-destructive` directly; migrating these two classes is open work.

---

## 8. Progress Bar

### Gradient Progress

```css
/* styles/globals.css, as shipped */
.progress-track {
  @apply h-2 overflow-hidden rounded-full;
  background: hsl(var(--muted));
}

.progress-gradient {
  @apply h-full rounded-full;
  background: linear-gradient(
    90deg,
    hsl(11 100% 80%) 0%,
    hsl(11 100% 71%) 50%,
    hsl(11 100% 60%) 100%
  );
  box-shadow:
    0 0 12px hsl(var(--accent-green) / 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.3);
}
```

The fill is a **coral** ramp (hue 11), not green — progress is brand-coloured, not a
success signal. The three gradient stops are still raw HSL rather than tokens; that is a
known deviation, same family as the change indicators in §7.

---

## 9. Icons

Icons are used directly without containers for a cleaner, lighter appearance. Use appropriate sizing based on context:

- **Small icons**: `h-4 w-4` (16px)
- **Medium icons**: `h-5 w-5` (20px)
- **Large icons**: `h-6 w-6` (24px)

```tsx
{/* Direct icon usage - preferred approach */}
<Search className="h-5 w-5 text-muted-foreground" />

{/* Avoid icon containers */}
{/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
  <Search className="h-5 w-5" />
</div> */}
```

`lucide-react` stays the set for small UI glyphs (16px row icons: check, close, spinner,
external link, info) and for status alerts. Section and feature icons come from the kit below.

### Kit icons (`components/icons/kit.tsx`)

The TOKNS brand icon kit idiom, painted with cliqs tokens. **Source of truth: the TOKNS brand
icon kit.** The idiom changes in the kit first; cliqs copies. A new glyph is a design-system
change first.

```tsx
import { KitIcon } from "@/components/icons/kit";

<KitIcon name="rewards" size={28} className="text-foreground" />   {/* decorative */}
<KitIcon name="stake" size={24} title="Staking" />                  {/* labelled: role="img" */}
```

**The idiom (do not break it):**

- A **48 grid** (`viewBox="0 0 48 48"`), round caps and joins, **no tile or chip behind the icon**.
- The **ink** is `currentColor`: it follows the parent's text colour (`text-foreground`,
  `text-muted-foreground`).
- **Exactly one coral part per icon**, in the tokens' coral (`text-primary`, `--primary`):
  a coral stroke, a coral solid, or an 18% coral wash with its outline. One part may be two
  shapes that read as one (an arrow's shaft and head, a clock's hand and hub, `multisig`'s two
  signed key dots); those shapes sit together in **one `<g data-coral="">`**, so a part is
  always one element and a test can count it. A second coral shape outside that group is a
  second part and breaks the rule (the stake glyph once passed with two). Coral is the brand
  colour, never a status colour: an icon does not turn
  green or red for active or jailed; put the state in a Badge or a word beside it. Use
  `--primary`, not `--accent-green` (that token is coral under a wrong name).
- Colours come from classes (`stroke-current`, `stroke-primary`, `fill-primary`,
  `fill-primary/[0.18]`), never from attributes, so tokens drive them. No hex anywhere.
- Decorative by default (`aria-hidden`); pass `title` for a labelled use.

**Size and stroke.** The kit's own stroke is 2.5 on the 48 grid: 1.25px at 24px, thinner than
the app's 2px line icons. `kitStrokeWidth(size)` therefore thickens the grid stroke below 40px
so the line stays about 2px on screen (24px = 4, 32px = 3, 40px and up = 2.5). Pass
`strokeWidth` to override. Never use a kit icon under 20px; use lucide there. Static only: no
motion is shipped (the landing's icon animations are not ported).

| Name | Coral part | Where it is used | Source |
|------|-----------|------------------|--------|
| `governance` | the tick on the ballot | Vote Now (Governance); the Contract Proposal guide; the "Governance Settings" headings of the contract and Flex create forms | the TOKNS brand icon kit |
| `stake` | the check in the shield | Self-delegation rewards row | the TOKNS brand icon kit |
| `rewards` | the bow | Validator commission row | the TOKNS brand icon kit |
| `portfolio` | one pie slice (wash + outline) | Voting power (a slice of the whole) | the TOKNS brand icon kit |
| `pulse` | the heartbeat | network health (not placed yet) | the TOKNS brand icon kit |
| `dashboard` | one tile (wash + outline) | overview (not placed yet) | the TOKNS brand icon kit |
| `multisig` | two of the three key dots | a CLIQ: the PubKey create form header, the "no CLIQs yet" empty state, the PubKey guide | the TOKNS brand icon kit |
| `clock` | the minute hand and hub | Unbonding | the TOKNS brand icon kit (the kit names it after a TOKNS product; a plain name here) |
| `rank` | the tallest bar (wash + outline) | Ranking | new in cliqs |
| `withdraw` | the arrow leaving the frame | the "Paid to" line | new in cliqs |
| `stakers` | the second figure | Stakers; also a group of members (the Flex CLIQ guide and create form header) | new in cliqs |
| `guide` | the bookmark (solid) | Guides page header and empty state | the TOKNS brand icon kit (the kit's open-book "learn" glyph under a plain name) |
| `contract` | the heading line | the Contract Fixed guide, the contract create form header | the TOKNS brand icon kit (the kit's "article" page under a plain name) |
| `journey` | the flag (pole and pennant) | the "Journey Complete" banner on the Guides page | the TOKNS brand icon kit (the kit's "roadmap" glyph under a plain name) |
| `tip` | the filament | the Pro Tip box on the Guides page | new in cliqs |
| `sign` | the signature line | the Create and Sign guide | new in cliqs |
| `database` | the middle band | Database settings header, the Set Up Your Own Database guide | new in cliqs |
| `search` | the handle | Open a CLIQ by address, the "No chains found" empty state, the Find and Join guide | new in cliqs |
| `wallet` | the clasp (wash + outline) | Balances header, the wallet prompt, the Connect Your Wallet guide | new in cliqs |

The paths for the first eight were generated from the kit's sources by a script, not typed by
hand, and re-diffed against them. `guide`, `contract` and `journey` were copied from the kit's
icon registry and re-diffed the same way. `rank`, `withdraw`, `stakers`, `tip`, `sign`,
`database`, `search` and `wallet` are drawn in the same idiom and should be added to the kit so
the sources do not drift. The Guides page names each journey's glyph in `lib/userJourneys.ts` as a
`KitIconName`, so a journey cannot point at a glyph that does not exist. Not copied, on purpose:
the TOKNS wordmark and monogram, product-named icons (the kit's clock is named after a product; it
is `clock` here), and the marketing-only marks. `__tests__/components/kit-icons.test.tsx` enforces
the 48 grid, **exactly one** coral part (loose coral shapes plus `g[data-coral]` groups must add
up to 1; a coral group may hold coral shapes only), no hex, and the decorative default. Until
2026-10-10 it only asked for "at least one".

---

## 10. Loading Spinner

```css
.card-loading-indicator {
  @apply w-5 h-5 rounded-full;
  border: 2px solid hsl(var(--accent-purple) / 0.2);
  border-top-color: hsl(var(--accent-purple));
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 11. Animations

### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 200ms ease-out forwards;
}
```

### Slide Up

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 300ms ease-out forwards;
}
```

### Scale In

```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scaleIn 200ms ease-out forwards;
}
```

---

## 12. Highlight Bars

### Brand Highlight (coral — `--accent-green` is hue 11)

```css
.highlight-bar {
  display: inline;
  padding: 2px 6px;
  margin: 0 2px;
  background: hsl(var(--accent-green) / 0.2);
  border-radius: 2px;
}
```

### Purple Highlight

```css
.highlight-bar-purple {
  display: inline;
  padding: 2px 6px;
  margin: 0 2px;
  background: hsl(var(--accent-purple) / 0.15);
  border-radius: 2px;
}
```

---

## 13. Hover Effects

### Card Hover

```css
.card-hover {
  @apply transition-all duration-200;
}

.card-hover:hover {
  @apply shadow-lg;
  transform: translateY(-2px);
}
```

### Institutional Card Hover

```css
/* styles/globals.css, as shipped */
.card-institutional:hover {
  transform: translateY(-3px);
  border-color: hsl(var(--border) / 0.12);
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.08);
}
```

### The border alpha convention

`--border` is `0 0% 100%` with **no alpha baked into the token**, so consumers supply it:

| State | Value |
|-------|-------|
| Resting | `border-border/[0.06]` — set globally by `* { @apply border-border/[0.06] }` |
| Hover | `hsl(var(--border) / 0.12)` — used by `.card-institutional:hover` and `.quick-stat:hover` |

Doubling the alpha on hover is the whole border interaction; do not add a colour change.
Never move the alpha inside the token — `0 0% 100% / 0.06` makes every `border-border/NN`
expand to a two-slash colour the browser drops silently.

---

## 14. Section Wrappers

`.section-wrapper` and `.section-inner` were removed in the 2026-10 flow cleanup, together with the chain landing page (their only user); pages use `DashboardLayout` or `Page`.

---

## 15. Reduced Motion Support

Two layers. First, a global guard in `@layer base` that collapses every animation and
transition:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Second, a component-level block that also cancels the hover lifts:

```css
@media (prefers-reduced-motion: reduce) {
  .card-institutional,
  .card-institutional::before,
  .card-institutional::after,
  .btn-action-primary,
  .btn-action-secondary,
  .btn-tab,
  .animate-in,
  .bento-card,
  .quick-stat {
    transition: none;
    animation: none;
  }

  .card-institutional:hover,
  .card-hover:hover,
  .bento-card:hover,
  .quick-stat:hover {
    transform: none;
  }
}
```

CSS cannot reach the canvas background, so `GridSpotlight` checks the media query in JS
and renders a single static frame instead (§3).

---

## 16. Custom Scrollbar

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--muted));
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

---

## 17. Hover-Card Disclosure

**Where:** the journey cards on `pages/[chainName]/get-started.tsx`.

A progressive-disclosure pattern: the card shows title, difficulty, duration and step
count; hovering (or keyboard-focusing) it reveals a translucent panel with the journey's
subtitle and highlight bullets. Clicking the card opens the full walkthrough.

```tsx
<HoverCard openDelay={300} closeDelay={100}>
  <HoverCardTrigger asChild>
    <Card
      className="group cursor-pointer border-border/[0.06] bg-card transition-all duration-200
                 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
      onClick={() => onSelect(journey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(journey)}
    >
      …
    </Card>
  </HoverCardTrigger>
  <HoverCardContent
    side="top"
    align="center"
    sideOffset={8}
    className="w-96 border-border/[0.06] bg-card/90 shadow-lg backdrop-blur-md"
  >
    {/* title + subtitle, then a bulleted highlight list with text-primary bullets */}
  </HoverCardContent>
</HoverCard>
```

### Rules

| Concern | Rule |
|---------|------|
| Panel surface | `bg-card/90` + `backdrop-blur-md` — translucent, so the page reads through it. Note this is above the 0.12 alpha threshold, so the background canvas's spotlight is correctly suppressed under it (§3). |
| Timing | `openDelay={300}` so a pointer crossing the grid doesn't strobe panels; `closeDelay={100}` so travel into the panel doesn't close it. |
| Keyboard | Radix `HoverCardTrigger` opens on **focus** as well as pointer-enter, so tabbing through the grid discloses the same content. The trigger must therefore be focusable — hence `tabIndex={0}` on the `asChild` card. |
| Touch | Radix `preventDefault()`s `touchstart` on the trigger and gates pointer-enter to non-touch, so the panel **never opens on touch**. That is intentional: on touch the tap goes straight to `onSelect`, and the walkthrough is the fallback that carries the same information. |
| Content duty | Because touch users never see the panel, it must stay **supplementary**. Anything required to make a choice belongs on the card face or in the walkthrough — never only in the hover panel. |
| Interactive content | None. Panels are read-only; a hover panel is not a place for buttons. |

---

## 18. Copy-Button Tooltip (click-only)

**Where:** `components/ui/copy-button.tsx`, used anywhere an address or hash is copyable.

The tooltip is a **confirmation**, not a hint. It is a controlled Radix tooltip whose
open state is driven purely by copy success:

```tsx
const [hasCopied, setHasCopied] = React.useState(false);

React.useEffect(() => {
  if (hasCopied) {
    const timer = setTimeout(() => setHasCopied(false), 2000);
    return () => clearTimeout(timer);
  }
}, [hasCopied]);

<Tooltip open={hasCopied}>          {/* controlled — hover can never open it */}
  <TooltipTrigger asChild>
    <Button onClick={onCopy}>
      {hasCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      <span className="sr-only">Copy {copyLabel}</span>
    </Button>
  </TooltipTrigger>
  <TooltipContent side="top" className="border-success bg-success text-success-foreground">
    <p className="text-xs font-bold">Copied!</p>
  </TooltipContent>
</Tooltip>
```

### Rules

- **Never opens on hover.** Passing `open` to Radix's `Tooltip` makes it fully
  controlled, so the usual hover/focus triggers are inert. Address rows are dense; a
  hover tooltip on every copy affordance would be noise.
- **Opens on click, closes on a 2s timer.** The icon swaps `Copy` → `Check` for the same
  window, so the confirmation is visible even if the tooltip is clipped.
- **Success colour is `--success`,** the real green `#4A9D7C` — on the tooltip surface
  and on the check icon. Never `green-accent`, which is coral.
- **`e.stopPropagation()` in the click handler** so a copy button inside a clickable row
  or card does not also trigger the row's navigation.
- A Sonner toast fires alongside by default (`showToast`), naming what was copied.

---

## 19. Sidebar Rail (auto-collapsing overlay)

**Where:** `components/Sidebar.tsx`, mounted in `pages/_app.tsx` on every route except
`/` (which only redirects to Home).

**One nav source.** The Sidebar does not keep its own list of destinations. It renders
`getNavItems("main")`, `getNavItems("more")` and `getNavItems("utility")` from
`lib/navigation.ts`, and so does the Header menu (`components/Header.tsx`, below `lg`).
Add, rename or reorder a destination in that file and both update. The Home badge (count of
transactions that need *this* wallet's signature) comes from `useNeedsMyCount()` in the same
file. Active state is `isNavItemActive`: Home also owns CLIQ pages (`/{chain}/{address}`),
which is why every static page under `pages/[chainName]/` must be listed in
`RESERVED_CHAIN_SEGMENTS`. This section described a hard-coded item list in `Sidebar.tsx`
until the 2026-10 flow cleanup.

**Footer does not scroll.** The Sidebar is a flex column. Only the `<nav>` list has
`overflow-y-auto` (with `min-h-0 flex-1`), so on a short screen the list scrolls and the
footer stays put: Back to TOKNS, Donate and the wallet block are `shrink-0`.

The desktop sidebar rests as a 20-unit icon rail and expands to 64 on hover or keyboard
focus. Expansion is an **overlay**, not a push.

### Layout mechanics

```tsx
{/* Spacer — reserves rail width in the flex row */}
<div aria-hidden="true"
     className={cn("hidden shrink-0 transition-[width] duration-300 ease-in-out lg:block",
                   pinned ? "w-64" : "w-20")} />

{/* The rail itself — fixed, so expanding it never reflows content */}
<aside data-state={collapsed ? "collapsed" : "expanded"}
       className={cn("fixed inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-r-2 " +
                     "border-border/[0.06] bg-card/50 backdrop-blur-md " +
                     "transition-all duration-300 ease-in-out lg:flex",
                     collapsed ? "w-20" : "w-64 bg-card shadow-card-hover")} />
```

The spacer is what makes this work: it holds the rail's footprint in normal flow while
the `fixed` aside floats above. Hover-expand widens only the aside, so **page content
never reflows**. Pinning widens the spacer too, which turns it into push mode where
nothing is occluded. The pin is persisted as `sidebarPinned` via
`lib/settingsStorage.ts` (default `false`) and hydrated after mount, so server and
client both render collapsed.

Note the rail is translucent at rest (`bg-card/50 backdrop-blur-md`) and turns opaque
`bg-card` when expanded — so the page background canvas (§3) shows through the collapsed
rail but not through the expanded overlay.

### Implementation notes worth keeping

These two are load-bearing. Both were bugs before they were rules.

1. **Pointer tracking must use native `mouseenter` / `mouseleave` listeners, not React's
   `onMouseEnter` / `onMouseLeave`.** Clicking a nav item re-renders the tree mid-gesture
   and React's synthetic `mouseleave` is dropped — which left the rail stuck open for the
   rest of the session. The native events still fire reliably in that case. The listeners
   are attached once in a `useEffect` on the `aside` ref.

2. **The keyboard "keep open" guard must test `:focus-visible`, not focus.** On leave,
   the rail stays open only if the focused element is inside it *and* matches
   `:focus-visible`:

   ```tsx
   const active = document.activeElement;
   if (active && el.contains(active) && active.matches(":focus-visible")) return;
   scheduleCollapse();
   ```

   Testing focus alone pins the rail open permanently, because a mouse click also focuses
   the button — and since the sidebar is mounted in `_app` and never unmounts, there is
   no remount to recover from that state.

Supporting details: a 150ms leave delay kills edge flicker; a `useEffect` on `asPath`
reconciles against `:hover` after navigation (in case the pointer left during the route
change and no leave event arrived); `Escape` collapses an unpinned rail.

---

## 20. Scale Rule (section divider)

**Where:** `components/ui/scale-rule.tsx`, with the tick pattern in `styles/globals.css`
(`.scale-rule-line`). Added 2026-10-10 for the owner's "scalelines": a way to separate areas
and mark the one that matters most, without painting a fill over the page background.

```tsx
<ScaleRule label="Rewards" tone="primary" meta="2 pending" />
<ScaleRule label="Performance" />
```

One row that reads like the edge of a ruler:

1. a short **start tick** (coral for `tone="primary"`, muted otherwise);
2. the **label**: `font-mono`, 11px, uppercase, `tracking-[0.14em]`, rendered as an **`h2`**,
   so a page gets real section headings (pass `headingId` to name a wrapping `<section>`);
3. a **hairline that fills the row** with a fine tick every 8px (4px tall) and a taller tick
   every 40px (8px tall), drawn with `repeating-linear-gradient` backgrounds from the border
   token, fading out towards the right edge with a mask;
4. optional right-hand `meta` text.

Rules:

- **Use `tone="primary"` for at most one area per page**: the one that matters most (on the
  validator page, Rewards). Everything else stays muted.
- It paints **no opaque fill**: the GridSpotlight canvas (§3) shows through. The ticks are
  hidden below `sm` (label and hairline only). The start tick and the line are `aria-hidden`.
- Put it above a section's panel, not inside it: `<section>` + `ScaleRule` + `Card`. The panel
  keeps its own background (cards occlude the field on purpose).

Used by: the validator dashboard (Rewards, Performance, Governance, Stakers, Manage).
Test: `__tests__/components/scale-rule.test.tsx`.

---

## 21. Menus (dropdown and select)

**Where:** `components/ui/dropdown-menu.tsx` and `components/ui/select.tsx` (Radix). Restyled
2026-10-10 to the house-style menu metrics, in cliqs colours. Radix keeps its behaviour: open on
click or keyboard, arrow-key roving, Escape returns focus. The reference style's hover-open is
**not** adopted (it has no arrow-key handling; Radix does).

| Part | Value |
|------|-------|
| Dropdown panel | `rounded-2xl` (16px), `p-1.5` (6px), `min-w-[220px]`, 1px border, `shadow-pop`, `collisionPadding={8}`, `sideOffset` 4 |
| Select panel | `rounded-2xl`, `p-1.5` viewport, `min-w-[8rem]` and `max-w-[min(480px,calc(100vw-2rem))]`, 1px border, `shadow-pop`, `collisionPadding={8}`; the panel follows its trigger's width (the viewport's `min-w` is `--radix-select-trigger-width`), so it is never narrower than the control that opened it. *Until 2026-10-10 this row listed `min-w-[220px]` for both panels; that is the dropdown's only (`components/ui/select.tsx` has `min-w-[8rem]`).* |
| Item | `min-h-10` (`max-sm:min-h-11`), `rounded-md` (8px), `px-2.5 py-2`, `text-[13px]`, `gap-3`, highlight `bg-primary-soft text-foreground` |
| Label | mono, 10px, uppercase, `tracking-[0.1em]`, muted |
| Separator | 1px, `mx-1.5 my-1`, `bg-border/[0.06]` |
| Shortcut / meta | mono 11px, `tabular-nums`, muted |
| Open motion | a 120ms fade (`duration-ui`); the old zoom and slide are gone |
| Select trigger | `min-h-11` (44px), `rounded-md`, `px-3.5 py-2.5`, 14px, `bg-field`, `border-interactive`; hover `border-muted-foreground`, open `border-primary` |
| Select item | `min-h-11`, `rounded-lg` (10px), `px-3 py-2`, selected `font-semibold` with a **trailing** check |

The highlight wash is `--primary-soft` (the coral wash), not `accent` (a neutral grey in this
repo) and not `green-accent` (coral under a wrong name). The select keeps its chevron: the
reference style drops it by owner decision, but a Radix select without one is not discoverable. The select's
"interactive edge" and field fill are new tokens (`--border-interactive`, `--field`), see
[STYLE-GUIDE.md](../STYLE-GUIDE.md#house-style-control-tokens).

Where they are used: `Select` in the signer-rotation form, credentials panel, Dev Tools and the
message forms (looks only; the frozen `MsgForm/*` files are not edited). `DropdownMenu` has no
importer in the app today: only `__tests__/components/menus-select.test.tsx` imports it. *(This
line said "has one importer today: none in the app", which contradicted itself, and before
2026-10-10 it named `components/policies/PolicyManager.tsx` as the only importer; PR #82 deleted
that file on main.)* It stays in `components/ui` as the shared menu primitive. Test:
`__tests__/components/menus-select.test.tsx`.

---

## 22. Scroll boxes (`max-h` + `overflow-y-auto`)

**Rule: a scroll box that holds a button, an `AddressDisplay` or any `sr-only` text is `relative`.**

`sr-only` is `position: absolute`. With no positioned ancestor between it and the scroll box,
its containing block is further up (the app shell's `<main className="relative">`), so the
scroll box's clip no longer applies to it: every label stays at its static position, which for
a long list is far below the box, and the page's scroll height grows to match.

Measured 2026-10-10 in a real browser on the PR #81 preview build (/tx/validator, 1024px, 645
stakers): after "Show all" the document went from 1,939px to 29,805px, about 27,600px of empty
scroll under the page. A `position: relative` on the one `<ul>` brought it back to 2,199px;
removing it brought the 29,805px back. Each row's copy button carries one `sr-only` "Copy
address" label, and 613 of them were outside the clip. The old list sat in a shadcn `Table`,
whose wrapper is `relative`, so it never showed. Re-measured after the fix on a static render of
the real component (645 stakers, headless Chrome, inside `<main class="relative">`): 23,974px
without `relative`, 813px (the same as with the list closed) with it. jsdom does no layout, so
only a real browser measures this: `document.documentElement.scrollHeight` before and after
opening the list.

```tsx
{/* relative: the rows' sr-only copy labels must be clipped by this box */}
<ul className="relative max-h-[260px] overflow-y-auto">…</ul>
```

**The root fix (2026-10-10): `CopyButton` is itself `relative`.** The label is inside
the copy button, so the button now contains it wherever it is used, and a scroll box no longer
needs to remember (`__tests__/components/copy-button.test.tsx` pins the class; a caller that
positions the button another way, for example `absolute`, still replaces it). Keep the `relative`
on the scroll box too: it is the rule for any other `sr-only` text, and the Stakers list test
pins it. jsdom still cannot see the effect, so measure in a browser after any change here.

Where it is applied: the Stakers drop-down in `ValidatorDelegatorsCard.tsx` (pinned by
`__tests__/components/validator-delegators.test.tsx`). The Unbonding table needs nothing: the
shadcn `Table` wrapper is already `relative`. The scroll lists around `AddressDisplay` in
`components/DevTools/DevToolsPage.tsx` (`max-h-[280px]`) use the same `CopyButton`, so they are
covered by the root fix. *(Until 2026-10-10 this paragraph listed them as "not yet
applied" and proposed a `relative` root on `AddressDisplay` as the shared fix; the fix went into
`CopyButton` instead, one level closer to the label.)*

---

*Patterns PRD for Cosmos Multisig UI*
