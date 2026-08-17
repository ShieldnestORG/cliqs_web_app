# Cosmos Multisig UI - Design System Documentation

> **Cluster:** design-system · **Tags:** ui, design-system, tokens, coherence-daddy, geist, index · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [Typography PRD](./TYPOGRAPHY-PRD.md), [Cards PRD](./CARDS-PRD.md), [Buttons PRD](./BUTTONS-PRD.md), [Forms PRD](./FORMS-PRD.md), [Patterns PRD](./PATTERNS-PRD.md), [Validator Dashboard PRD](./VALIDATOR-DASHBOARD-PRD.md), [Transaction Page Redesign PRD](./TRANSACTION-PAGE-REDESIGN-PRD.md)

**UI4 Institutional Design System**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

> **Canonical token reference: [`docs/STYLE-GUIDE.md`](../STYLE-GUIDE.md).**
> It carries the current Coherence Daddy colour, typography, radius, elevation and
> motion values, and the two naming traps worth knowing before touching styles
> (`--accent-green` is coral, not green; the utility is `purple-accent`, not
> `accent-purple`). The PRDs in this folder describe component intent; where a
> concrete token value here disagrees with the style guide, the style guide wins.

---

## Overview

The Cosmos Multisig UI implements an institutional-grade design system inspired by the ShieldNest UI4 methodology, optimized for dark mode with a professional, crypto-native aesthetic.

---

## Documents

### Core UI System
| Document | Description |
|----------|-------------|
| [CARDS-PRD.md](./CARDS-PRD.md) | Card system: variants, the default gradient and its `bg-none` opt-out, accents, brackets |
| [BUTTONS-PRD.md](./BUTTONS-PRD.md) | Button system with action, tab, and nav variants; the near-black-on-coral contrast rule |
| [TYPOGRAPHY-PRD.md](./TYPOGRAPHY-PRD.md) | Font system (Geist, Geist Mono — no third family) |
| [FORMS-PRD.md](./FORMS-PRD.md) | Input fields, validation states, slider components |
| [PATTERNS-PRD.md](./PATTERNS-PRD.md) | The GridSpotlight page background, visual language, and the hover-card / copy-tooltip / sidebar-rail interaction patterns |

### Page & Feature Specs
| Document | Description |
|----------|-------------|
| [VALIDATOR-DASHBOARD-PRD.md](./VALIDATOR-DASHBOARD-PRD.md) | Free validator dashboard — CLIQ mode, gas handling, validator actions (partly reconciled against shipped code) |
| [TRANSACTION-PAGE-REDESIGN-PRD.md](./TRANSACTION-PAGE-REDESIGN-PRD.md) | In-progress transaction page redesign — verification, fees, broadcast-safety states (shipped, with documented drift) |

---

## Quick Reference

### Color Variables (Dark Mode)

```css
/* Background — Coherence Daddy dark canvas */
--background: 240 6.7% 5.9%;         /* #0E0E10 */
--card:       240 5.9% 10%;          /* #18181B — card + popover */
--muted:      240 4.6% 12.7%;        /* #1F1F22 */

/* Foreground */
--foreground:       48 16.1% 93.9%;  /* #F2F1ED — warm off-white */
--muted-foreground: 240 2.7% 64.1%;  /* #A1A1A6 */

/* Brand */
--primary:            10.9 100% 64.5%;  /* #FF6B4A coral */
--primary-foreground: 240 6.7% 5.9%;    /* #0E0E10 — text ON coral */
--accent-green:       10.9 100% 64.5%;  /* #FF6B4A — hue 11: CORAL, not green */
--accent-purple:      260 28% 55%;      /* #7B68AE */

/* Semantic status */
--success:     156.1 35.9% 45.3%;    /* #4A9D7C — the real green */
--warning:     37.4 72.3% 56.1%;     /* #E0A33E */
--info:        219.7 82.2% 64.7%;    /* #5B8DEF */
--destructive: 0 66.4% 55.7%;        /* #D94343 */
```

### Page background

Never paint an opaque, full-bleed background on a page wrapper — one animated canvas
(`components/GridSpotlight.tsx`) sits behind every route, with the opaque colour on
`<html>` and a transparent `body`. See
[Patterns PRD §3](./PATTERNS-PRD.md#3-page-background-gridspotlight).

### Card Classes

```css
/* Variants — all rounded-xl; `institutional` differs by border weight, not radius */
.card-institutional              /* 2px border + transition */

/* Accents (coral — `--accent-green` is hue 11) */
.card-accent-left               /* 4px coral left border */
.card-accent-top                /* 3px coral top border */

/* Brackets */
.card-bracket-corner            /* Coral corner brackets */
.card-bracket-purple            /* Purple override */
.card-bracket-corner-round      /* Alias of .card-bracket-corner — identical output */
```

### Bracket Corners Quick Reference

| Prop | Renders |
|------|---------|
| `bracket="green"` / `"green-round"` | The same coral brackets — `-round` is an alias |
| `bracket="purple"` / `"purple-round"` | The same purple brackets |
| `bracket="all"` | Adds two extra corner divs for a four-corner frame |

### Card background gradient

`default` and `institutional` cards (and the bento variants) ship with
`bg-gradient-to-br from-card to-muted/30` **by default**. Opt out with `bg-none`.

### Button Variants

```css
/* Action Buttons (Pill Shape) */
.btn-action-primary             /* Filled pill  — bg-foreground / text-background */
.btn-action-secondary           /* Outlined pill */

/* Card CTAs (rounded-xl, not square) */
.btn-card-primary               /* Filled */
.btn-card-secondary             /* Outlined */

/* Tab Buttons */
.btn-tab-active                 /* Coral fill, near-black text (--primary-foreground) */
.btn-tab-inactive               /* Gray inactive */

/* Navigation */
.btn-nav-active                 /* Active nav item — coral tint + 4px coral left border */
.btn-nav-inactive               /* Inactive nav item */
```

> **Text on coral is near-black, never white.** `--primary-foreground` (`#0E0E10`) is
> the canonical pairing; white on `#FF6B4A` fails WCAG AA. Zero `text-white` remain
> under `components/` and `pages/`.

### Typography Classes

```css
/* Labels */
.text-label                     /* Monospace uppercase */
.text-label-comment             /* With // prefix */

/* KPI Values */
.text-kpi                       /* Bold tabular nums */
.text-kpi-lg                    /* 36px */
.text-kpi-md                    /* 24px */
.text-kpi-sm                    /* 18px */
```

### Label + Title Pattern

> ⚠️ **Avoid Redundancy**: The `// label` and title must NOT repeat the same information.

| Element | Role | Example |
|---------|------|---------|
| `// Label` | Category/context keyword | `// How It Works`, `// New Cliq` |
| Title | Descriptive heading | `Simple & Secure Process`, `Build Your Shared Wallet` |

```tsx
// ❌ BAD (redundant)
<CardLabel comment>Create Your Cliq</CardLabel>
<CardTitle>Create a Cliq</CardTitle>

// ✅ GOOD (complementary)
<CardLabel comment>New Cliq</CardLabel>
<CardTitle>Build Your Shared Wallet</CardTitle>
```

---

## Font Stack

| Role | Font | Fallback |
|------|------|----------|
| **Headings** | Geist | system-ui, sans-serif |
| **Body** | Geist | system-ui, sans-serif |
| **Mono/Labels** | Geist Mono | ui-monospace, SF Mono, monospace |

---

## Component Usage

### Card with Accent

```tsx
{/* 2px border, coral left accent, coral corner brackets */}
<Card variant="institutional" accent="left" bracket="green">
  <CardHeader>
    <CardLabel comment>Section Title</CardLabel>
    <CardTitle>Main Heading</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

{/* 1px border + shadow, hover lift */}
<Card variant="default" bracket="green" hover>
  <CardHeader>
    <CardTitle>Feature Card</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

{/* Flat, tinted panel — gradient removed with bg-none */}
<Card className="border-border/[0.06] bg-muted/30 bg-none">
  <CardContent className="pt-6">{/* Content */}</CardContent>
</Card>
```

### Action Buttons

```tsx
{/* Vertical on mobile, horizontal on desktop */}
<div className="flex flex-col-reverse sm:flex-row gap-3">
  <Button variant="action-outline" size="action">Cancel</Button>
  <Button variant="action" size="action">Confirm</Button>
</div>
```

### Slider (Enhanced)

```tsx
<Slider
  size="lg"
  min={1}
  max={10}
  value={[value]}
  onValueChange={([v]) => setValue(v)}
/>
```

---

## File Structure

```
/styles/
  └── globals.css                 # All CSS variables & utilities

/pages/
  ├── _app.tsx                    # Mounts GridSpotlight + Sidebar
  └── _document.tsx               # Geist / Geist Mono webfont loading

/components/
  ├── GridSpotlight.tsx           # Animated dotted-grid page background
  ├── Sidebar.tsx                 # Auto-collapsing icon rail (overlay expand)
  └── ui/
      ├── button.tsx              # Button with UI4 variants
      ├── card.tsx                # Card with gradient, accents & brackets
      ├── bento-grid.tsx          # Bento grid + stat/action cards
      ├── copy-button.tsx         # Click-only "Copied!" tooltip
      ├── input.tsx               # Input with variants
      └── slider.tsx              # Enhanced slider

/lib/
  └── settingsStorage.ts          # sidebarPinned + other user prefs

/docs/
  ├── STYLE-GUIDE.md              # Canonical token reference
  └── ui/
      ├── INDEX.md                        # This file
      ├── BUTTONS-PRD.md                  # Button specifications
      ├── CARDS-PRD.md                    # Card specifications
      ├── TYPOGRAPHY-PRD.md               # Font specifications
      ├── FORMS-PRD.md                    # Form specifications
      ├── PATTERNS-PRD.md                 # Background + interaction patterns
      ├── VALIDATOR-DASHBOARD-PRD.md      # Validator dashboard spec
      └── TRANSACTION-PAGE-REDESIGN-PRD.md # Transaction page redesign spec
```

---

## Responsive Guidelines

### Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | < 640px | Stack vertically |
| Tablet | 640px - 1024px | Two columns |
| Desktop | > 1024px | Full layout |

### Button Layout Pattern

```tsx
{/* Always use flex-col-reverse on mobile for primary action on top */}
<div className="flex flex-col-reverse sm:flex-row gap-3">
  <Button variant="action-outline">Secondary</Button>
  <Button variant="action">Primary</Button>
</div>
```

---

*Design system documentation for Cosmos Multisig UI*
