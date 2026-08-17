# Typography PRD

> **Cluster:** design-system · **Tags:** typography, geist, fonts, tracking, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Cards PRD](./CARDS-PRD.md), [Buttons PRD](./BUTTONS-PRD.md)

**Cosmos Multisig UI - Font System Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

---

## 1. Overview

A **two-family system** — one sans and one mono — optimized for crypto data display:

| Font | Role | Personality |
|------|------|-------------|
| **Geist** | Headlines, KPIs, body text, navigation | The Coherence Daddy typeface; hierarchy via weight + tight tracking |
| **Geist Mono** | Code, addresses, labels, action buttons | Technical, monospaced, precise |

> **There is no third family.** `pages/_document.tsx` loads exactly two Google Fonts
> families — `Geist` and `Geist+Mono` — and `styles/globals.css` names only those two
> in every `font-family` declaration. Inter, JetBrains Mono and Space Grotesk are **not**
> loaded and must not be referenced in specs or components; earlier revisions of this
> document listed Inter for body text and navigation, which never matched the code.

---

## 2. Font Stack Configuration

### Tailwind Config

```javascript
// tailwind.config.js — theme.extend.fontFamily, verbatim
fontFamily: {
  sans:    ["Geist", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  heading: ["Geist", "system-ui", "sans-serif"],
  mono:    ["Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
  body:    ["Geist", "system-ui", "-apple-system", "sans-serif"],
}
```

`font-heading` is kept as a separate key only because ~104 call sites use it; it resolves
to Geist, the same family as `font-sans`. Hierarchy comes from weight and tracking, not
from a second display face.

### Google Fonts Import

```html
<link 
  href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" 
  rel="stylesheet" 
/>
```

---

## 3. Font Usage Matrix

| Context | Font | Size | Weight | Case |
|---------|------|------|--------|------|
| **Page Title (h1)** | Geist | 30-36px | Bold | Title |
| **Section Heading (h2)** | Geist | 24px | Semibold | Title |
| **Card Title (h3)** | Geist | 18-20px | Semibold | Title |
| **Body Text** | Geist | 14-16px | Normal | Sentence |
| **KPI Value** | Geist | 24-48px | Bold | — |
| **Data Label** | Geist Mono | 10-12px | Normal | UPPERCASE |
| **Button Text** | Geist Mono | 11-14px | Semibold | UPPERCASE |
| **Code/Address** | Geist Mono | 12-14px | Normal | As-is |
| **Table Header** | Geist Mono | 10-12px | Medium | UPPERCASE |
| **Navigation** | Geist | 14px | Medium | Title |

---

## 4. Scales and CSS Variables

### Font sizes

Sizes come from Tailwind's default scale. `tailwind.config.js` extends it with three
extra keys — everything else (`text-sm`, `text-2xl`, …) is stock Tailwind. There are
**no** `--text-*` or `--font-*` CSS variables in `styles/globals.css`.

```javascript
// tailwind.config.js — theme.extend.fontSize
micro:     ["0.625rem",  { lineHeight: "1" }],     // 10px
label:     ["0.75rem",   { lineHeight: "1.25" }],  // 12px
"body-sm": ["0.8125rem", { lineHeight: "1.5" }],   // 13px
```

### Letter spacing

The tracking scale **is** a set of CSS variables, defined in `styles/globals.css`
(`:root`). `tailwind.config.js` does not extend `letterSpacing`, so the `tracking-*`
utilities remain Tailwind's own scale and are a **separate** set of values from these
variables — reach for `var(--tracking-*)` when you want the brand scale.

```css
:root {
  --tracking-tighter: -0.035em;  /* h1 */
  --tracking-tight:   -0.02em;   /* h2, h3, h4 */
  --tracking-normal:  0;         /* body */
  --tracking-wide:    0.02em;
  --tracking-wider:   0.06em;
  --tracking-widest:  0.14em;    /* .label-caps */
}
```

`body` also sets `font-feature-settings: "cv11", "ss01", "ss03"` — Geist's stylistic
alternates.

---

## 5. Typography Components

### Headings

```tsx
// h1 - Page Title
<h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">
  Cosmos Multisig
</h1>

// h2 - Section Heading
<h2 className="text-2xl font-heading font-semibold">
  How It Works
</h2>

// h3 - Card Title
<h3 className="text-xl font-heading font-semibold">
  Create Your Multisig
</h3>
```

### Labels (Comment Style)

```tsx
// With // prefix
<div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
  <span className="opacity-60">// </span>Section Title
</div>

// Using CardLabel component
<CardLabel comment>Section Title</CardLabel>
```

### Label + Title Pattern (Avoiding Redundancy)

The `// label` and title serve **different purposes** and should NOT repeat the same information:

| Element | Purpose | Example |
|---------|---------|---------|
| **`// Label`** | Category, context, or section type | `// How It Works`, `// Benefits`, `// New Cliq` |
| **Title** | Descriptive heading with detail | `Simple & Secure Process`, `Why Use a Cliq?`, `Build Your Shared Wallet` |

#### ❌ BAD (Redundant)

```tsx
// DON'T: Both say the same thing
<CardLabel comment>Create Your Cliq</CardLabel>
<CardTitle>Create a Cliq</CardTitle>

// DON'T: Label repeats the title's meaning
<CardLabel comment>Send Tokens</CardLabel>
<CardTitle>Token Transfer</CardTitle>
```

#### ✅ GOOD (Complementary)

```tsx
// DO: Label = category, Title = description
<CardLabel comment>How It Works</CardLabel>
<CardTitle>Simple & Secure Process</CardTitle>

// DO: Label = context, Title = action
<CardLabel comment>New Cliq</CardLabel>
<CardTitle>Build Your Shared Wallet</CardTitle>

// DO: Label = type, Title = details
<CardLabel comment>Benefits</CardLabel>
<CardTitle>Why Use a Cliq?</CardTitle>

// DO: Label = section type, Title = descriptive
<CardLabel comment>New Account</CardLabel>
<CardTitle>Create a Multisig Wallet</CardTitle>
```

#### Guidelines

1. **Labels are keywords**: Short (1-3 words), describe the *category* or *type* of content
2. **Titles are descriptive**: Provide the actual heading with more context
3. **Never duplicate**: If you can remove one and still understand the section, you have redundancy
4. **Think of labels as breadcrumbs**: They help orient the user without repeating the main message

### KPI Values

```tsx
// Large KPI
<span className="text-4xl font-heading font-bold tabular-nums tracking-tight">
  $85,270.48
</span>

// With trend indicator
<div className="flex items-baseline gap-2">
  <span className="text-2xl font-heading font-bold">951.21K</span>
  <span className="text-sm change-positive">+2.4%</span>
</div>
```

### Monospace/Code

```tsx
// Wallet Address
<span className="font-mono text-sm">
  core1mgvlgvh2hfw5pgdqc79up3du69v2z3t8qz4kwg
</span>

// Button Text
<button className="font-mono text-[11px] font-semibold uppercase tracking-wide">
  Create Multisig
</button>
```

---

## 6. Utility Classes

### globals.css

```css
/* Section Labels */
.text-label {
  font-family: "Geist Mono", ui-monospace, "SF Mono", monospace;
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

/* KPI Values */
.text-kpi {
  font-family: 'Geist', system-ui, sans-serif;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}

.text-kpi-lg { font-size: 2.25rem; line-height: 1.1; }
.text-kpi-md { font-size: 1.5rem; line-height: 1.2; }
.text-kpi-sm { font-size: 1.125rem; line-height: 1.3; }

/* Portal small-caps label treatment (@layer base) */
.label-caps {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
}
```

---

## 7. Status Indicators

### Positive

```tsx
<span className="change-positive">+2.4%</span>
```

```css
/* styles/globals.css, as shipped */
.change-positive {
  color: hsl(11 100% 71%);
}
```

### Negative

```tsx
<span className="change-negative">-1.2%</span>
```

```css
/* styles/globals.css, as shipped */
.change-negative {
  color: hsl(0 84% 60%);
}
```

> **Known deviation — do not copy this pattern.** Both classes still hardcode raw HSL
> instead of the semantic tokens. `.change-positive` is hue 11, i.e. **coral, not
> green**, so a "positive" change currently reads as the brand accent rather than as
> success; `.change-negative` is a raw red that is not `--destructive`
> (`0 66.4% 55.7%`). New code should use `text-success` / `text-destructive` directly.
> Migrating these two classes to `hsl(var(--success))` / `hsl(var(--destructive))` is
> outstanding work, not something that has shipped.

---

## 8. Responsive Typography

### Base heading rules

`styles/globals.css` sets a single, non-responsive size per heading level, plus the
brand tracking. There is **no** base `p` rule.

```css
h1 { @apply text-3xl font-bold;      letter-spacing: var(--tracking-tighter); }
h2 { @apply text-2xl font-semibold;  letter-spacing: var(--tracking-tight); }
h3 { @apply text-xl  font-semibold;  letter-spacing: var(--tracking-tight); }
h4 { @apply text-lg  font-semibold;  letter-spacing: var(--tracking-tight); }
```

### Responsive steps

Responsive sizing is applied **per usage** with Tailwind classes, not globally — so a
hero heading opts in explicitly:

```tsx
<h1 className="text-3xl font-heading font-bold tracking-tight sm:text-4xl">
  Cosmos Multisig
</h1>
```

---

## 9. Accessibility

### Minimum Sizes

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Body text | 14px | 16px |
| Labels | 10px | 12px |
| Buttons | 12px | 14px |
| KPIs | 18px | 24px+ |

### Contrast Ratios

| Text Type | Ratio | Compliance |
|-----------|-------|------------|
| Body on background | 7:1+ | AAA |
| Labels on background | 4.5:1+ | AA |
| Muted text | 3:1+ | AA (large) |

### Line Length

- **Body text**: 45-75 characters per line
- **Code/addresses**: 80 characters max (with truncation)

---

## 10. Usage Examples

### Hero Section

```tsx
<section className="text-center space-y-4">
  <h1 className="text-4xl sm:text-5xl font-heading font-bold tracking-tight">
    Cosmos <span className="text-muted-foreground">Multisig</span>
  </h1>
  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
    Secure multi-signature transactions for the Cosmos blockchain.
  </p>
</section>
```

### Data Display

```tsx
<div className="space-y-2">
  <CardLabel comment>Available Balance</CardLabel>
  <div className="flex items-baseline gap-2">
    <span className="text-kpi text-kpi-lg">10.89K</span>
    <span className="text-sm text-muted-foreground font-mono">CORE</span>
  </div>
</div>
```

### Form Labels

```tsx
<label className="text-sm font-medium text-foreground">
  Wallet Address
  <span className="text-destructive ml-0.5">*</span>
</label>
<p className="text-xs text-muted-foreground mt-1">
  Enter a valid Cosmos address starting with the chain prefix.
</p>
```

---

*Typography PRD for Cosmos Multisig UI*
