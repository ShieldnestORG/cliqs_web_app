# Patterns PRD

**Cosmos Multisig UI - Visual Patterns Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

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

```css
:root {
  /* Background */
  --background: 220 13% 18%;          /* #2a2d36 - Main bg */
  --card: 220 13% 22%;                /* #33363f - Card bg */
  --muted: 217.2 10% 25%;             /* #3b3e47 - Muted bg */
  
  /* Foreground */
  --foreground: 210 40% 98%;          /* #f8fafc - Primary text */
  --muted-foreground: 215 20.2% 65.1%; /* #9ca3af - Secondary text */
  
  /* Border */
  --border: 217.2 10% 30%;            /* #454852 */
  --input: 217.2 10% 30%;             /* Same as border */
}
```

### Accent Colors

```css
:root {
  /* Green (Primary Accent) */
  --accent-green: 142 71% 45%;        /* #22c55e - Actions, success */
  --accent-green-bright: 142 76% 55%; /* Hover states */
  
  /* Purple (Secondary Accent) */
  --accent-purple: 263 70% 65%;       /* #a78bfa - Focus, links */
  
  /* Destructive */
  --destructive: 0 62.8% 50%;         /* #dc2626 - Errors */
}
```

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
    linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px);
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
  0 0 0 3px hsl(var(--accent-purple) / 0.3),
  0 4px 12px hsl(var(--accent-purple) / 0.12);
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
  color: hsl(142 76% 45%);
}

.change-negative {
  color: hsl(0 84% 60%);
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
    hsl(142 71% 65%) 0%,
    hsl(142 76% 45%) 50%,
    hsl(142 76% 36%) 100%
  );
  box-shadow: 
    0 0 12px hsl(var(--accent-green) / 0.4),
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

### Green Highlight

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
