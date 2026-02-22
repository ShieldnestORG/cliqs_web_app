# Typography PRD

**Cosmos Multisig UI - Font System Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

---

## 1. Overview

A **three-font system** optimized for crypto data display:

| Font | Role | Personality |
|------|------|-------------|
| **Space Grotesk** | Headlines, KPIs, bold values | Modern, geometric, institutional |
| **Inter** | Body text, paragraphs | Clean, readable, accessible |
| **JetBrains Mono** | Code, labels, buttons, data | Technical, monospaced, precise |

---

## 2. Font Stack Configuration

### Tailwind Config

```javascript
// tailwind.config.js
fontFamily: {
  sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  heading: ['Space Grotesk', 'Inter', 'sans-serif'],
  mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
  body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
}
```

### Google Fonts Import

```html
<link 
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" 
  rel="stylesheet" 
/>
```

---

## 3. Font Usage Matrix

| Context | Font | Size | Weight | Case |
|---------|------|------|--------|------|
| **Page Title (h1)** | Space Grotesk | 30-36px | Bold | Title |
| **Section Heading (h2)** | Space Grotesk | 24px | Semibold | Title |
| **Card Title (h3)** | Space Grotesk | 18-20px | Semibold | Title |
| **Body Text** | Inter | 14-16px | Normal | Sentence |
| **KPI Value** | Space Grotesk | 24-48px | Bold | — |
| **Data Label** | JetBrains Mono | 10-12px | Normal | UPPERCASE |
| **Button Text** | JetBrains Mono | 11-14px | Semibold | UPPERCASE |
| **Code/Address** | JetBrains Mono | 12-14px | Normal | As-is |
| **Table Header** | JetBrains Mono | 10-12px | Medium | UPPERCASE |
| **Navigation** | Inter | 14px | Medium | Title |

---

## 4. CSS Variables

```css
:root {
  /* Font Sizes (rem) */
  --text-micro: 0.625rem;    /* 10px - Tiny labels */
  --text-label: 0.75rem;     /* 12px - Labels */
  --text-sm: 0.875rem;       /* 14px - Body small */
  --text-base: 1rem;         /* 16px - Body */
  --text-lg: 1.125rem;       /* 18px - Large body */
  --text-xl: 1.25rem;        /* 20px - Card titles */
  --text-2xl: 1.5rem;        /* 24px - Section heads */
  --text-3xl: 1.875rem;      /* 30px - Page heads */
  --text-4xl: 2.25rem;       /* 36px - Hero heads */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Letter Spacing */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
}
```

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
  font-family: 'JetBrains Mono', monospace;
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
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}

.text-kpi-lg { font-size: 2.25rem; line-height: 1.1; }
.text-kpi-md { font-size: 1.5rem; line-height: 1.2; }
.text-kpi-sm { font-size: 1.125rem; line-height: 1.3; }
```

---

## 7. Status Indicators

### Positive (Green)

```tsx
<span className="change-positive">+2.4%</span>
```

```css
.change-positive {
  color: hsl(142 76% 45%);
}
```

### Negative (Red)

```tsx
<span className="change-negative">-1.2%</span>
```

```css
.change-negative {
  color: hsl(0 84% 60%);
}
```

---

## 8. Responsive Typography

### Mobile Adjustments

```css
/* Page Title */
h1 {
  @apply text-3xl sm:text-4xl lg:text-5xl;
}

/* Section Heading */
h2 {
  @apply text-xl sm:text-2xl;
}

/* Body Text - Slightly larger on mobile for readability */
p {
  @apply text-sm sm:text-base;
}
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
