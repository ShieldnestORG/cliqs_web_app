# Buttons PRD

**Cosmos Multisig UI - Button System Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

---

## 1. Overview

The button system implements an institutional design language with:

- **Pill-shaped buttons** (rounded-full) for primary actions
- **Square buttons** (rounded-none) for card CTAs
- **Monospace typography** (JetBrains Mono) for technical aesthetic
- **High contrast** with green accents in dark mode
- **Micro-interactions** with scale transforms on press

---

## 2. Button Categories

| Category | Shape | Use Case |
|----------|-------|----------|
| Action Buttons | Pill (rounded-full) | Buy, Swap, Create, Submit |
| Card CTAs | Square (rounded-none) | Sign Up, Manage |
| Tab Buttons | Pill (rounded-full) | Filter tabs, navigation |
| Icon Buttons | Square/Circle | Send, Close, Menu |
| Link Buttons | Text only | Learn More, View All |
| Navigation | Rounded | Sidebar nav items |

---

## 3. Design Tokens

### Colors (Dark Mode)

```css
/* Primary Button */
--btn-primary-bg: hsl(var(--foreground));     /* Light on dark */
--btn-primary-text: hsl(var(--background));   /* Dark on light */

/* Secondary Button */
--btn-secondary-bg: transparent;
--btn-secondary-border: hsl(var(--foreground));

/* Active State (Tabs) */
--btn-active-bg: hsl(var(--accent-green));    /* Green */
--btn-active-text: white;

/* Inactive State */
--btn-inactive-border: hsl(var(--muted-foreground));
--btn-inactive-text: hsl(var(--muted-foreground));
```

### Typography

```css
/* Action Button Text */
font-family: 'JetBrains Mono', monospace;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
```

---

## 4. Button Specifications

### 4.1 Primary Action Button (Pill)

**Visual:** Foreground background, background text, fully rounded

```tsx
<Button variant="action" size="action">
  Create Multisig
</Button>
```

**CSS Classes:**
```css
.btn-action-primary {
  @apply px-6 py-2.5 rounded-full font-semibold text-sm uppercase tracking-wide;
  @apply bg-foreground text-background;
  @apply hover:opacity-90 transition-all duration-200;
  @apply active:scale-95;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.05em;
}
```

**States:**
- Default: `bg-foreground text-background`
- Hover: `opacity-90`
- Active: `scale-95`
- Disabled: `opacity-50 cursor-not-allowed`

---

### 4.2 Secondary Action Button (Outlined Pill)

**Visual:** Transparent with foreground border

```tsx
<Button variant="action-outline" size="action">
  Cancel
</Button>
```

**CSS Classes:**
```css
.btn-action-secondary {
  @apply px-6 py-2.5 rounded-full font-semibold text-sm uppercase tracking-wide;
  @apply bg-transparent border-2;
  @apply hover:bg-muted transition-all duration-200;
  @apply active:scale-95;
  border-color: hsl(var(--foreground));
  color: hsl(var(--foreground));
}
```

---

### 4.3 Card CTA Button (Square)

**Visual:** Square corners for institutional look within cards

```tsx
<Button variant="card-cta" size="action">
  Sign Up Free
</Button>
```

**CSS Classes:**
```css
.btn-card-primary {
  @apply px-6 py-3 rounded-none font-semibold text-sm;
  @apply bg-foreground text-background;
  @apply hover:opacity-90 transition-all duration-200;
  @apply active:scale-95;
  font-family: 'Space Grotesk', sans-serif;
}
```

---

### 4.4 Tab Button

**Visual:** Pill-shaped tabs with active/inactive states

```tsx
<Button variant="tab" isActive={activeTab === 'tokens'}>
  Tokens
</Button>
```

**CSS Classes:**
```css
.btn-tab-active {
  background: hsl(var(--accent-green));
  color: white;
  border: 2px solid hsl(var(--accent-green));
}

.btn-tab-inactive {
  background: transparent;
  color: hsl(var(--muted-foreground));
  border: 2px solid hsl(var(--muted-foreground));
}

.btn-tab-inactive:hover {
  border-color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.5);
}
```

---

### 4.5 Navigation Button

**Visual:** Sidebar navigation items with active indicator

```tsx
<Button variant="nav" isActive={pathname === '/dashboard'}>
  <Home className="w-5 h-5" />
  Dashboard
</Button>
```

**CSS Classes:**
```css
.btn-nav-active {
  background: hsl(var(--accent-green) / 0.2);
  border-left: 4px solid hsl(var(--accent-green));
  color: hsl(var(--foreground));
  font-weight: 600;
}

.btn-nav-inactive {
  color: hsl(var(--muted-foreground));
}

.btn-nav-inactive:hover {
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--foreground));
}
```

---

### 4.6 Icon Button

**Visual:** Square button with icon only

```tsx
<Button variant="icon" size="icon-sm">
  <X className="h-4 w-4" />
</Button>
```

---

## 5. Button Sizes

| Size | Height | Padding | Use Case |
|------|--------|---------|----------|
| action-sm | 32px | 8px 16px | Compact areas |
| action | 40px | 10px 24px | Standard actions |
| action-lg | 48px | 12px 32px | Hero CTAs |
| icon | 40px | - | Icon buttons |
| icon-sm | 32px | - | Small icon buttons |

---

## 6. Responsive Layout

### Mobile-First Button Groups

```tsx
{/* Vertical on mobile, horizontal on desktop */}
{/* Use flex-col-reverse so primary action appears on top on mobile */}
<div className="flex flex-col-reverse sm:flex-row gap-3">
  <Button variant="action-outline" className="w-full sm:flex-1">
    Cancel
  </Button>
  <Button variant="action" className="w-full sm:flex-1">
    Confirm
  </Button>
</div>
```

### Mobile (< 640px)
- Buttons stack vertically
- Full width (`w-full`)
- Primary action on top (using `flex-col-reverse`)

### Desktop (≥ 640px)
- Buttons align horizontally
- Equal width (`flex-1`)
- Primary action on right

---

## 7. Loading State

```tsx
<Button variant="action" isLoading>
  Processing...
</Button>
```

**Implementation:**
```tsx
{isLoading && (
  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
)}
```

---

## 8. Accessibility

### Requirements
- Minimum contrast ratio: 4.5:1
- Focus visible indicator
- Disabled state clearly distinguishable
- Touch target minimum: 44x44px on mobile

### Focus Ring
```css
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```

---

## 9. Component Props

```typescript
interface ButtonProps {
  variant?: 
    | 'default' 
    | 'action' 
    | 'action-outline'
    | 'card-cta'
    | 'card-cta-outline'
    | 'tab'
    | 'nav'
    | 'icon'
    | 'ghost'
    | 'link'
    | 'destructive';
  
  size?: 
    | 'default'
    | 'sm'
    | 'lg'
    | 'action'
    | 'action-sm'
    | 'action-lg'
    | 'icon'
    | 'icon-sm'
    | 'tab'
    | 'nav';
  
  isActive?: boolean;    // For tab/nav variants
  isLoading?: boolean;   // Shows spinner
  asChild?: boolean;     // Radix slot pattern
}
```

---

*Button PRD for Cosmos Multisig UI*
