# Cards PRD

> **Cluster:** design-system · **Tags:** cards, bento, gradient, brackets, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Patterns PRD](./PATTERNS-PRD.md), [Typography PRD](./TYPOGRAPHY-PRD.md)

**Cosmos Multisig UI - Card System Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

---

## 1. Overview

The card system implements an institutional-grade design with:

- **Rounded corners** (`rounded-xl`) on every variant — the earlier square/`rounded-none`
  treatment is gone
- **A subtle card gradient by default** (see §2.1)
- **Accent borders** for visual hierarchy
- **Bracket corners** for decorative emphasis
- **Hover animations** with subtle transforms
- **Dark mode optimized** color palette (the app is dark-only — no `dark:` variants)

---

## 2. Card Variants

Source of truth: `components/ui/card.tsx`, `variantClasses`.

| Variant | Classes as shipped | Use Case |
|---------|--------------------|----------|
| `default` | `rounded-xl border bg-card bg-gradient-to-br from-card to-muted/30 text-card-foreground shadow` | General content |
| `institutional` | `rounded-xl border-2 bg-card bg-gradient-to-br from-card to-muted/30 text-card-foreground transition-all duration-200` | Forms, data display |
| `elevated` | `rounded-xl border bg-card text-card-foreground shadow-lg` | Highlighted content |
| `outline` | `rounded-xl border-2 bg-transparent text-card-foreground` | Secondary containers |

`institutional` differs from `default` by border weight (`border-2`) and the transition,
**not** by corner radius. All four are `rounded-xl`.

### 2.1 The default gradient, and how to opt out

`default` and `institutional` carry `bg-gradient-to-br from-card to-muted/30` — a soft
top-left-to-bottom-right lift from `#18181B` to a 30%-opacity `#1F1F22`. This is the
default, not an option: you get it unless you remove it.

The same gradient is the default on the bento variants in
`components/ui/bento-grid.tsx`:

| `BentoCard` variant | Background as shipped |
|---------------------|-----------------------|
| `default` | `bg-card bg-gradient-to-br from-card to-muted/30` |
| `highlight` | `bg-card bg-gradient-to-br from-card to-muted/30` (+ coral border, brackets) |
| `accent` | `bg-gradient-to-br from-card to-muted/50` (stronger, purple border) |
| `muted` | `bg-muted/30` — flat, no gradient |

**Opt out with `bg-none`.** Tailwind's `bg-none` sets `background-image: none`, which
kills the gradient while leaving whatever `bg-*` colour you supplied intact. Use it any
time you need a flat or tinted surface — for example a status-tinted panel, where the
gradient would muddy the tint:

```tsx
{/* Flat muted panel — gradient removed, tint preserved */}
<Card className="border-border/[0.06] bg-muted/30 bg-none">…</Card>

{/* Flat destructive-tinted panel */}
<Card className="border-destructive/50 bg-destructive/10 bg-none">…</Card>
```

Shipped examples: `components/forms/OldCreateTxForm/BalanceDisplay.tsx`,
`pages/[chainName]/create.tsx`, `pages/[chainName]/index.tsx`.

### 2.2 Cards and the animated page background

The app paints an animated dotted-grid canvas behind every page
(`components/GridSpotlight.tsx`, mounted in `pages/_app.tsx` — see
[Patterns PRD §3](./PATTERNS-PRD.md#3-page-background-gridspotlight)). Two consequences
for cards:

1. A card's own background is what *hides* the canvas behind it, which is intended —
   cards are meant to read as opaque surfaces floating over the field.
2. The canvas suppresses its cursor spotlight and comet trail while the pointer is over
   any element whose computed `background-color` has alpha ≥ 0.12. Every card variant
   except `outline` clears that bar, so the spotlight will not bleed through them.
   Translucent surfaces below 0.12 alpha (e.g. `bg-card/10`) will let it through — if
   that looks wrong, raise the alpha rather than trying to disable the canvas.

---

## 3. Card Accents

> **Colour trap:** the accent classes use `green-accent`, which maps to `--accent-green`
> — hue 11, i.e. **the brand coral `#FF6B4A`, not a green.** The name is inherited from
> an earlier migration and kept because 97 call sites (77 lines across 22 files)
> depend on it. Never use an accent
> border to mean "success"; use `--success` (`#4A9D7C`) for that. See
> [STYLE-GUIDE.md](../STYLE-GUIDE.md).

### Left Accent
4px coral left border (`border-l-4 border-l-green-accent`) for primary emphasis.

```tsx
<Card variant="institutional" accent="left">
  {/* Primary content */}
</Card>
```

### Top Accent
3px coral top border (`border-t-[3px] border-t-green-accent`) for section headers.

```tsx
<Card variant="institutional" accent="top">
  {/* Section content */}
</Card>
```

### Header Dark
4px dark bar at top for container sections.

```tsx
<Card variant="institutional" accent="header-dark">
  {/* Container content */}
</Card>
```

---

## 4. Bracket Corners

Decorative bracket corners that expand on hover, drawn as `::before` / `::after`
pseudo-elements on `.card-bracket-corner`.

> **The `-round` variants are aliases, not a second style.** `styles/globals.css`
> defines `.card-bracket-corner-round { @apply card-bracket-corner; }` — the rules are
> byte-identical, and the single implementation already rounds its corners
> (`border-top-left-radius: 8px`). `bracket="green"` and `bracket="green-round"`
> therefore render the same thing. The prop values are kept for call-site
> compatibility; treat the distinction as historical.

### Brackets on institutional cards

```tsx
<Card variant="institutional" bracket="green">
  {/* Coral brackets — see the naming trap in §3 */}
</Card>

<Card variant="institutional" bracket="purple">
  {/* Purple brackets */}
</Card>
```

### The four-corner variant

`bracket="all"` adds the two pseudo-element brackets **plus** two real `<div>`s for the
top-right and bottom-left corners, because an element only has `::before` and `::after`
to give. Those extra corners are rendered by `card.tsx`, not by CSS, and they react to
`group-hover/card`.

### Bracket prop values

| Prop value | Classes applied |
|------------|-----------------|
| `green` | `card-bracket-corner` |
| `purple` | `card-bracket-corner card-bracket-purple` |
| `green-round` | `card-bracket-corner-round` (alias of `card-bracket-corner`) |
| `purple-round` | `card-bracket-corner-round card-bracket-purple` |
| `all` | `card-bracket-corner card-bracket-all` + two extra corner divs |

**CSS Implementation** (`styles/globals.css`, as shipped):
```css
.card-bracket-corner::before {
  content: "";
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-top: 3px solid hsl(var(--accent-green));
  border-left: 3px solid hsl(var(--accent-green));
  border-top-left-radius: 8px;
  opacity: 1;
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
  pointer-events: none;
}

/* Mirrored bottom-right corner, resting at 0.6 opacity */
.card-bracket-corner::after {
  bottom: 6px;
  right: 6px;
  border-bottom: 3px solid hsl(var(--accent-green));
  border-right: 3px solid hsl(var(--accent-green));
  border-bottom-right-radius: 8px;
  opacity: 0.6;
}

/* Hover: grow 20px -> 28px and slide 6px -> 4px from the edge */
.card-bracket-corner:hover::before,
.card-bracket-corner:hover::after {
  width: 28px;
  height: 28px;
  opacity: 1;
  top: 4px;
  left: 4px;
}

.card-bracket-corner:hover::after {
  top: auto;
  left: auto;
  bottom: 4px;
  right: 4px;
}

/* Purple override */
.card-bracket-purple::before,
.card-bracket-purple::after {
  border-color: hsl(var(--accent-purple));
}
```

Brackets are inset 6px from the card edge (4px on hover), so they render *inside* the
card box rather than overflowing it.

---

## 5. Card Sub-Components

### CardLabel

Section labels with optional comment-style prefix.

```tsx
<CardLabel comment>Section Title</CardLabel>
// Renders: // SECTION TITLE

<CardLabel>Section Title</CardLabel>
// Renders: SECTION TITLE
```

**Styling:**
```css
.text-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
}

.text-label-comment::before {
  content: '// ';
  opacity: 0.6;
}
```

### CardKPI

Large number display for key metrics.

```tsx
<CardKPI size="lg" trend="up">$85,270.48</CardKPI>
```

**Props:**
- `size`: `"sm"` (`text-lg`) | `"md"` (`text-xl`) | `"lg"` (`text-2xl`) | `"xl"` (`text-4xl`)
- `trend`: `"up"` → `text-success` | `"down"` → `text-destructive` | `"neutral"` → `text-foreground`

`trend="up"` correctly resolves to the semantic **`--success`** green (`#4A9D7C`) — not
to `green-accent`, which is coral. Keep it that way.

---

## 6. Design Tokens

There are **no** `--card-padding` / `--card-radius` / `--card-shadow` variables.
Padding comes from the sub-components (`CardHeader`, `CardContent`, `CardFooter` are all
`p-6`), radius from the `rounded-xl` utility, and the shadows from `tailwind.config.js`.

### Colours (`styles/globals.css`, `:root`)

```css
--card:            240 5.9% 10%;    /* #18181B */
--card-foreground: 48 16.1% 93.9%;  /* #F2F1ED */
--muted:           240 4.6% 12.7%;  /* #1F1F22 — the gradient's `to` colour at /30 */
--border:          0 0% 100%;       /* white, NO baked-in alpha — see below */
```

### Border alpha convention

`--border` is a plain HSL triplet with **no alpha inside the token**, so opacity
modifiers compose correctly. Consumers supply the alpha:

| State | Value |
|-------|-------|
| Resting | `border-border/[0.06]` — applied globally by `* { @apply border-border/[0.06] }` |
| Hover | `hsl(var(--border) / 0.12)` — e.g. `.card-institutional:hover`, `.quick-stat:hover` |

Never bake an alpha into the token itself; a token like `0 0% 100% / 0.06` makes every
`border-border/NN` expand to a double-slash colour the browser silently drops.

### Shadows (`tailwind.config.js`, `theme.extend.boxShadow`)

```javascript
card:         "0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
"card-hover": "0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)",
```

---

## 7. Hover Effects

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

### Enable Hover via Prop

```tsx
<Card variant="institutional" hover>
  {/* Content with hover effect */}
</Card>
```

The `hover` prop adds the `.card-hover` class (transition + `shadow-lg` +
`translateY(-2px)`); on `variant="institutional"` it additionally adds
`hover:shadow-card-hover hover:-translate-y-[3px]`.

---

## 8. Component Interface

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'institutional' | 'elevated' | 'outline';
  accent?: 'none' | 'left' | 'top' | 'header-dark';
  bracket?: 'none' | 'green' | 'purple' | 'green-round' | 'purple-round' | 'all';
  hover?: boolean;
}

// CardTitle renders an <h3> by default; override with `as`.
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

interface CardLabelProps {
  comment?: boolean;     // Adds "// " prefix
  children: React.ReactNode;
}

interface CardKPIProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  trend?: 'up' | 'down' | 'neutral';
  children: React.ReactNode;
}
```

---

## 9. Usage Examples

### Form Card

```tsx
<Card variant="institutional" bracket="green" className="overflow-visible">
  <CardHeader>
    <div className="flex items-center gap-3 mb-2">
      <Users className="w-5 h-5 text-green-accent" />
      <div>
        <CardLabel comment>Create Multisig</CardLabel>
        <CardTitle className="text-xl">New Multisig Account</CardTitle>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    {/* Form content */}
  </CardContent>
</Card>
```

### Feature Card

```tsx
<Card variant="institutional" bracket="green" hover>
  <CardHeader className="space-y-4">
    <Shield className="w-6 h-6 text-green-accent" />
    <div>
      <CardTitle className="text-lg mb-2">Security</CardTitle>
      <CardDescription>
        Multi-signature protection for your assets.
      </CardDescription>
    </div>
  </CardHeader>
</Card>
```

### KPI Card

```tsx
<Card variant="institutional" accent="left">
  <CardContent className="pt-6">
    <CardLabel comment>Total Value</CardLabel>
    <CardKPI size="xl">$85,270.48</CardKPI>
    <span className="text-sm text-success">+2.4%</span>
  </CardContent>
</Card>
```

Use `text-success` here, not the legacy `.change-positive` class — that class is still
hardcoded to hue 11 (coral), so it renders a positive delta in the brand accent rather
than green. See [Typography PRD §7](./TYPOGRAPHY-PRD.md#7-status-indicators).

---

## 10. Responsive Behavior

### Grid Layouts

```tsx
{/* Feature cards - 1 col mobile, 3 cols desktop */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {features.map(feature => (
    <Card key={feature.id} variant="institutional" bracket="green" hover>
      {/* ... */}
    </Card>
  ))}
</div>
```

### Card Padding

`.card-institutional` sets no padding of its own — it is only
`relative border-2 transition-all duration-200` plus border colour and shadow. Padding
comes from the sub-components, which are `p-6` (24px) at every breakpoint:

```tsx
<CardHeader  className="p-6" />        {/* flex flex-col space-y-1.5 p-6 */}
<CardContent className="p-6 pt-0" />
<CardFooter  className="p-6 pt-0" />
```

To tighten a card on mobile, pass responsive padding at the call site
(`<CardContent className="p-4 sm:p-6">`); there is no global mobile override.

---

## 11. Accessibility

### Focus States

There is **no** `.card-institutional:focus-visible` rule. The shared helper is
`.focus-ring`, which you opt into on any focusable element:

```css
/* styles/globals.css, as shipped */
.focus-ring:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px hsl(var(--accent-purple) / 0.3),
    0 4px 12px hsl(var(--accent-purple) / 0.12);
}
```

Note this helper is purple, while the token-driven `focus-visible:ring-ring` used by
`components/ui/button.tsx` is coral (`--ring` = `#FF6B4A`). Prefer the ring utilities on
new interactive elements so focus reads as the brand colour.

Cards used as buttons must carry the interaction contract themselves — `role="button"`,
`tabIndex={0}` and a keyboard handler — as on `pages/[chainName]/get-started.tsx`.

### Reduced Motion

Two layers apply. A global guard in `@layer base` collapses durations everywhere:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

…and a component-level block additionally cancels the hover lifts:

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

The page-background canvas honours the same preference independently — it renders a
single static frame instead of animating. See
[Patterns PRD §3](./PATTERNS-PRD.md#3-page-background-gridspotlight).

---

*Card PRD for Cosmos Multisig UI*
