# Patterns PRD

> **Cluster:** design-system · **Tags:** ui, patterns, backgrounds, tokens, coherence-daddy · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Cards PRD](./CARDS-PRD.md)

**Cosmos Multisig UI - Visual Patterns Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-13

---

## 1. Overview

Visual patterns for consistent styling across the application:

- **Background patterns** for texture and depth
- **Color palette** optimized for dark mode
- **Shadow system** for elevation
- **Animation patterns** for micro-interactions
- **Status indicators** for feedback

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
> earlier migration and kept because ~60 call sites use `green-accent`. Never map a
> success meaning onto it; it renders orange and collides with `destructive`. Use
> `--success` for success.

---

## 3. Background Patterns

### Dot Pattern

Subtle dot grid for page backgrounds.

```css
.bg-pattern-dots {
  background-color: hsl(var(--background));
  background-image: radial-gradient(
    circle at center,
    hsl(var(--muted-foreground) / 0.1) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}
```

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

```css
box-shadow: 
  0 0 0 3px hsl(var(--ring) / 0.3),
  0 4px 12px hsl(var(--ring) / 0.12);
```

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

```css
.status-dot-active {
  @apply w-2 h-2 rounded-full;
  background: hsl(var(--accent-green));
  animation: status-pulse 2s ease-in-out infinite;
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
.change-positive {
  color: hsl(var(--success));
}

.change-negative {
  color: hsl(var(--destructive));
}
```

---

## 8. Progress Bar

### Gradient Progress

```css
.progress-track {
  @apply h-2 rounded-full overflow-hidden;
  background: hsl(var(--muted));
}

.progress-gradient {
  @apply h-full rounded-full;
  background: linear-gradient(
    90deg,
    hsl(var(--success) / 0.7) 0%,
    hsl(var(--success)) 50%,
    hsl(var(--success) / 0.85) 100%
  );
  box-shadow: 
    0 0 12px hsl(var(--success) / 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.3);
}
```

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
.card-institutional:hover {
  transform: translateY(-3px);
  border-color: hsl(var(--border) / 0.8);
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.08);
}
```

---

## 14. Section Wrappers

```css
.section-wrapper {
  @apply relative w-full py-12;
}

.section-inner {
  @apply relative z-10 max-w-6xl mx-auto px-[0.75in];
}
```

---

## 15. Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .card-institutional,
  .card-institutional::before,
  .card-institutional::after,
  .btn-action-primary,
  .btn-action-secondary,
  .animate-in {
    transition: none;
    animation: none;
  }
  
  .card-institutional:hover,
  .card-hover:hover {
    transform: none;
  }
}
```

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

*Patterns PRD for Cosmos Multisig UI*
