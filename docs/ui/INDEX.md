# Cosmos Multisig UI - Design System Documentation

**UI4 Institutional Design System**  
**Version:** 1.0  
**Last Updated:** December 2024

---

## Overview

The Cosmos Multisig UI implements an institutional-grade design system inspired by the ShieldNest UI4 methodology, optimized for dark mode with a professional, crypto-native aesthetic.

---

## Documents

### Core UI System
| Document | Description |
|----------|-------------|
| [CARDS-PRD.md](./CARDS-PRD.md) | Card system specification with variants and accents |
| [BUTTONS-PRD.md](./BUTTONS-PRD.md) | Button system with action, tab, and nav variants |
| [TYPOGRAPHY-PRD.md](./TYPOGRAPHY-PRD.md) | Font system (Space Grotesk, JetBrains Mono, Inter) |
| [FORMS-PRD.md](./FORMS-PRD.md) | Input fields, validation states, slider components |
| [PATTERNS-PRD.md](./PATTERNS-PRD.md) | CSS patterns, backgrounds, and visual language |

---

## Quick Reference

### Color Variables (Dark Mode)

```css
/* Background */
--background: 220 13% 18%;        /* Dark slate */
--card: 220 13% 22%;              /* Slightly lighter */
--muted: 217.2 10% 25%;           /* Subtle gray */

/* Foreground */
--foreground: 210 40% 98%;        /* Near white */
--muted-foreground: 215 20.2% 65.1%;

/* Accents */
--accent-green: 142 71% 45%;      /* Primary green */
--accent-purple: 263 70% 65%;     /* Secondary purple */
--destructive: 0 62.8% 50%;       /* Error red */
```

### Card Classes

```css
/* Variants */
.card-institutional              /* Square corners, 2px border */

/* Accents */
.card-accent-left               /* 4px green left border */
.card-accent-top                /* 3px green top border */

/* Angular Brackets (for square cards) */
.card-bracket-corner            /* Green angular brackets */
.card-bracket-purple            /* Purple angular brackets */

/* Rounded Brackets (for rounded cards) */
.card-bracket-corner-round      /* Green curved brackets */
.card-bracket-corner-round.card-bracket-purple  /* Purple curved */
```

### Bracket Corners Quick Reference

| Card Style | Use Bracket | Example |
|------------|-------------|---------|
| Square (`institutional`) | `bracket="green"` or `"purple"` | Angular L-shaped |
| Round (`default`, `elevated`) | `bracket="green-round"` or `"purple-round"` | Curved arcs |

### Button Variants

```css
/* Action Buttons (Pill Shape) */
.btn-action-primary             /* Filled pill */
.btn-action-secondary           /* Outlined pill */

/* Card CTAs (Square) */
.btn-card-primary               /* Filled square */
.btn-card-secondary             /* Outlined square */

/* Tab Buttons */
.btn-tab-active                 /* Green active state */
.btn-tab-inactive               /* Gray inactive */

/* Navigation */
.btn-nav-active                 /* Active nav item */
.btn-nav-inactive               /* Inactive nav item */
```

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
| **Headings** | Space Grotesk | Inter, sans-serif |
| **Body** | Inter | system-ui, sans-serif |
| **Mono/Labels** | JetBrains Mono | SF Mono, monospace |

---

## Component Usage

### Card with Accent

```tsx
{/* Square card with angular brackets */}
<Card variant="institutional" accent="left" bracket="green">
  <CardHeader>
    <CardLabel comment>Section Title</CardLabel>
    <CardTitle>Main Heading</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

{/* Round card with curved brackets */}
<Card variant="default" bracket="green-round" hover>
  <CardHeader>
    <CardTitle>Feature Card</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
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

/components/ui/
  ├── button.tsx                  # Button with UI4 variants
  ├── card.tsx                    # Card with accents & brackets
  ├── input.tsx                   # Input with variants
  └── slider.tsx                  # Enhanced slider

/docs/ui/
  ├── INDEX.md                    # This file
  ├── BUTTONS-PRD.md              # Button specifications
  ├── CARDS-PRD.md                # Card specifications
  ├── TYPOGRAPHY-PRD.md           # Font specifications
  ├── FORMS-PRD.md                # Form specifications
  └── PATTERNS-PRD.md             # Visual patterns
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
