# Cosmos Multisig UI Style Guide

> **Cluster:** design-system · **Tags:** coherence-daddy, tokens, tailwind, typography, geist, gridspotlight · **Related:** [UI Docs Index](ui/INDEX.md), [Typography PRD](ui/TYPOGRAPHY-PRD.md), [Buttons PRD](ui/BUTTONS-PRD.md), [Cards PRD](ui/CARDS-PRD.md), [Patterns PRD](ui/PATTERNS-PRD.md)

**Updated:** 2026-08-16
**Brand:** Coherence Daddy (ShieldNest ecosystem)

## Source of truth

The canonical design system is the Coherence Daddy portal — its `app/globals.css`,
`.dark` block. This repo mirrors those values.

The portal defines tokens as hex and consumes them as `var(--token)`. This repo's
Tailwind config consumes `hsl(var(--token))`, so the same values are stored here as
HSL triplets. **When updating a colour, convert from the portal's hex — do not
invent a value.** Each token below lists its source hex.

An earlier migration (`ac9309d`) claimed to apply this branding but used different
values throughout — a mid-grey canvas instead of near-black, and an off-white
`--primary` instead of the brand coral. Anything that looks "close but not quite"
should be checked against the portal rather than against this repo's history.

## Color Palette

### Core Palette (`styles/globals.css`, `:root`)

| Role | HSL triplet | Source hex | Usage |
|------|-------------|-----------|-------|
| Background | `240 6.7% 5.9%` | `#0E0E10` | Page background |
| Foreground | `48 16.1% 93.9%` | `#F2F1ED` | Primary text (warm off-white) |
| Card | `240 5.9% 10%` | `#18181B` | Card + popover backgrounds |
| Card Foreground | `48 16.1% 93.9%` | `#F2F1ED` | Text on cards |
| Primary | `10.9 100% 64.5%` | `#FF6B4A` | **Brand coral** — primary buttons, links |
| Primary Foreground | `240 6.7% 5.9%` | `#0E0E10` | Text on primary |
| Secondary | `240 4.6% 12.7%` | `#1F1F22` | Secondary surfaces |
| Muted | `240 4.6% 12.7%` | `#1F1F22` | Muted backgrounds |
| Muted Foreground | `240 2.7% 64.1%` | `#A1A1A6` | Muted text, labels |
| Destructive | `0 66.4% 55.7%` | `#D94343` | Errors, danger |
| Border | `0 0% 100%` | white | See "Border token" below |
| Input | `240 4.6% 12.7%` | `#1F1F22` | Input backgrounds |
| Ring | `10.9 100% 64.5%` | `#FF6B4A` | Focus rings (coral, not purple) |

### Semantic status colours

| Role | HSL triplet | Source hex | Tailwind |
|------|-------------|-----------|----------|
| Success | `156.1 35.9% 45.3%` | `#4A9D7C` | `text-success`, `bg-success` |
| Warning (portal "idea") | `37.4 72.3% 56.1%` | `#E0A33E` | `text-warning`, `bg-warning` |
| Info | `219.7 82.2% 64.7%` | `#5B8DEF` | `text-info`, `bg-info` |

Use these for status. Do **not** express status with raw Tailwind palette
utilities (`text-green-500`, `bg-amber-500`, `text-red-500`).

### The `green-accent` naming trap

`--accent-green` is **hue 11 — the brand coral, not a green.** The name is
inherited from an earlier migration and is kept only because 97 call sites (77
lines across 22 files, `grep -ro "green-accent" components pages`) use
`green-accent`.

**Never map "success" to `green-accent`.** It renders orange and becomes nearly
indistinguishable from `destructive` — which is exactly the bug that made the
`✓ OK` / `✗ MISMATCH` badges on the transaction page unreadable. Success is
`--success`.

### Accent colours

| Name | HSL triplet | Source hex | Usage |
|------|-------------|-----------|-------|
| `--accent-green` | `10.9 100% 64.5%` | `#FF6B4A` | Brand coral (misnamed — see above) |
| `--accent-green-bright` | `10.9 100% 70%` | — | Lighter coral variant |
| `--toast-green` | `156.1 35.9% 45.3%` | `#4A9D7C` | The actual green; same as `--success` |
| `--accent-purple` | `260 28% 55%` | `#7B68AE` | Secondary accent |
| `--accent-blue` | `219.7 82.2% 64.7%` | `#5B8DEF` | Info states, links |
| `--accent-gold` / `--accent-bronze` | `37.4 72.3% 56.1%` | `#E0A33E` | Badges, highlights |

### Named Tailwind extensions

| Class stem | CSS variable | Note |
|-----------|-------------|------|
| `green-accent` | `--accent-green` | Coral, despite the name |
| `purple-accent` | `--accent-purple` | **Order matters** — `accent-purple` emits no CSS |
| `blue-accent` | `--accent-blue` | |
| `gold-accent` | `--accent-gold` | |
| `success` / `warning` / `info` | `--success` / `--warning` / `--info` | Prefer these for status |

The Tailwind config nests these as `purple: { accent }`, so the utility is
`*-purple-accent`. Writing `*-accent-purple` compiles to nothing at all.

### Border token

`--border` is a plain HSL triplet (`0 0% 100%`) with **no alpha baked in**, so
opacity modifiers work: `border-border/30` → `hsl(0 0% 100% / .3)`.

The consumer supplies the alpha, and there are exactly two levels:

| State | Value |
|-------|-------|
| Resting | `border-border/[0.06]` — applied globally by `* { @apply border-border/[0.06] }` |
| Hover | `hsl(var(--border) / 0.12)` — e.g. `.card-institutional:hover`, `.quick-stat:hover` |

Doubling the alpha on hover is the whole border interaction; don't add a colour
shift on top of it.

Do **not** put an alpha inside the token (e.g. `0 0% 100% / 0.06`). That makes
every `border-border/NN` expand to `hsl(... / 0.06 / .5)` — two slashes, an
invalid colour the browser silently drops. That regression previously killed 63
border rules across the app.

## Typography

| Family | Font | Tailwind class | Usage |
|--------|------|---------------|-------|
| Sans | **Geist** | `font-sans` | Body text, UI |
| Heading | **Geist** | `font-heading` | Page titles, section headers |
| Mono | **Geist Mono** | `font-mono` | Addresses, hashes, code |

Geist is the Coherence Daddy typeface. The portal loads it via the `geist` npm
package; this repo loads it from the Google Fonts CDN in `pages/_document.tsx`,
matching how it already loads webfonts. Both families are available there.

`font-heading` resolves to Geist. There is no separate display face — the portal
uses weight and tight tracking for hierarchy rather than a second family.

Body sets `font-feature-settings: "cv11", "ss01", "ss03"` (Geist's alternates).

### Letter-spacing scale

| Token | Value | Applied to |
|-------|-------|-----------|
| `--tracking-tighter` | `-0.035em` | `h1` |
| `--tracking-tight` | `-0.02em` | `h2`, `h3`, `h4` |
| `--tracking-normal` | `0` | body |
| `--tracking-wide` | `0.02em` | |
| `--tracking-wider` | `0.06em` | |
| `--tracking-widest` | `0.14em` | `.label-caps` |

`.label-caps` is the portal's small-caps label treatment: Geist Mono, 0.6875rem,
weight 500, widest tracking, uppercase.

## Scales

### Radius

`--radius: 0.625rem`, plus `--radius-sm` `0.375rem`, `--radius-md` `0.625rem`,
`--radius-lg` `1rem`, `--radius-xl` `1.5rem`.

### Elevation

`--shadow-sm`, `--shadow-md`, `--shadow-lg`, and the button treatments
`--shadow-lift` / `--shadow-lift-hover`.

### Motion

`--ease-out: cubic-bezier(0.22, 0.61, 0.36, 1)`, with `--dur-fast` 180ms,
`--dur-base` 260ms, `--dur-slow` 480ms.

A `prefers-reduced-motion: reduce` guard collapses animation and transition
durations globally.

## Styling Rules

### Page background

The app paints one animated dotted-grid canvas behind every page —
`components/GridSpotlight.tsx`, mounted once in `pages/_app.tsx`. The mechanism
matters:

- **`<html>` carries the opaque `--background`; `body` is `transparent`.** The
  canvas is `position: fixed`, `z-index: -1`, `pointer-events: none`, so it paints
  above the html background and below all content.
- **Pages must not paint their own opaque, full-bleed background.** A
  `bg-background` on a page-level wrapper covers the canvas and deletes the effect
  for that route. `.bg-pattern-dots` was neutralised to `background: transparent`
  for exactly this reason — it still has a consumer in
  `components/layout/DashboardLayout.tsx`, so it could not be deleted.
- Panels, cards, headers and dialogs *should* paint their own backgrounds — they
  are meant to occlude the field.
- The canvas caps itself at ~30fps, pauses on a hidden tab, and renders a single
  static frame under `prefers-reduced-motion: reduce`.

Full rules, including the spotlight-suppression threshold, in
[Patterns PRD §3](ui/PATTERNS-PRD.md#3-page-background-gridspotlight).

### Cards

- Background `bg-card` (`#18181B`)
- **A linear gradient is the default:** `bg-gradient-to-br from-card to-muted/30`
  on the `default` and `institutional` card variants and on the bento variants.
  Opt out with **`bg-none`**, which clears `background-image` and keeps your
  `bg-*` colour — use it for flat or status-tinted panels.
- **No radial gradients.** The card gradient is the only background gradient a
  surface should carry.
- Border inherits the global `border-border/[0.06]`
- `rounded-xl` on every variant — there is no square card

### Buttons

- Primary: `bg-primary text-primary-foreground` — this is now **coral on
  near-black**, not light-on-dark
- Destructive: `bg-destructive text-destructive-foreground`
- Ghost/outline: standard Shadcn patterns using `--secondary`
- Do not hardcode `bg-[#ff876d]`; use `bg-primary`

### Text on coral

The canonical pairing on any coral surface is near-black
`--primary-foreground` / `#0E0E10`. White on `#FF6B4A` lands at roughly 2.8:1 and
fails WCAG AA; `#0E0E10` lands at roughly 6.9:1 and passes. There are currently
**zero** `text-white` occurrences under `components/` and `pages/` — keep it that
way. When you need light text, use `text-foreground` (`#F2F1ED`) on a dark
surface.

### Focus states

Ring is `--ring` = brand coral `#FF6B4A`, via
`focus-visible:ring-2 focus-visible:ring-ring`.

Two purple survivors are outstanding cleanup, not intent: the `.focus-ring`
helper class in `styles/globals.css` and the `shadow-focus-ring` key in
`tailwind.config.js` both still resolve to `--accent-purple` (`260 28% 55%`).

### Hardcoded colours to avoid

Roughly 200 raw Tailwind palette utilities still bypass these tokens in forms,
dialogs and dashboard panels. When touching such a file, migrate it:

| Instead of | Use |
|-----------|-----|
| `text-emerald-*`, `text-green-*` (success) | `text-success` |
| `text-red-*` (error) | `text-destructive` |
| `text-amber-*`, `text-yellow-*`, `text-orange-*` | `text-warning` |
| `text-blue-*` (info) | `text-info` |
| `bg-gray-*`, `bg-zinc-*` surfaces | `bg-card`, `bg-muted`, `bg-secondary` |
| any `dark:` variant | nothing — the app is dark-only, `dark:` never applies |

`dark:` variants are dead code here: `tailwind.config.js` sets
`darkMode: ["class"]` but nothing ever adds the `dark` class.

### Known deviations still in `globals.css`

These three utilities bypass the tokens today. They are **open cleanup**, not the
intended pattern — do not copy them, and prefer the semantic classes in new code.

| Class | As shipped | Should be |
|-------|-----------|-----------|
| `.change-positive` | `hsl(11 100% 71%)` — coral, so a positive delta is not green | `hsl(var(--success))` |
| `.change-negative` | `hsl(0 84% 60%)` — a raw red that is not `--destructive` | `hsl(var(--destructive))` |
| `.progress-gradient` | three raw `hsl(11 …)` coral stops | tokenised coral stops |

## Component framework

- **UI components**: Shadcn/Radix — inherit CSS variables automatically
- **Icons**: `lucide-react`
- **Animations**: `tailwindcss-animate`

## Theme metadata

- Meta `theme-color`: `#0E0E10`, matching `--background` (`pages/_document.tsx`)
- Single dark theme — no toggle
- `::selection` uses brand coral

## File references

- CSS variables: `styles/globals.css` (`:root`)
- Tailwind config: `tailwind.config.js`
- Font loading: `pages/_document.tsx`
- Page background canvas: `components/GridSpotlight.tsx`, mounted in `pages/_app.tsx`
- Shadcn components: `components/ui/*`
- Sidebar rail + pin persistence: `components/Sidebar.tsx`, `lib/settingsStorage.ts`
- Feature flags: `lib/featureFlags.ts`
