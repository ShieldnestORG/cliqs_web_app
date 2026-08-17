# Buttons PRD

> **Cluster:** design-system · **Tags:** buttons, variants, coral, contrast, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Forms PRD](./FORMS-PRD.md), [Cards PRD](./CARDS-PRD.md)

**Cosmos Multisig UI - Button System Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

---

## 1. Overview

The button system implements an institutional design language with:

- **Pill-shaped buttons** (`rounded-full`) for action-bar CTAs
- **Rounded card CTAs** (`rounded-xl`) — the old `rounded-none` treatment is gone
- **Monospace typography** (Geist Mono) for the action/tab variants
- **High contrast** built on the brand **coral** `#FF6B4A` (the accent is coral, not
  green — see §3.1)
- **Micro-interactions** with scale transforms on press (`active:scale-95`)

---

## 2. Button Categories

| Category | Shape | Use Case |
|----------|-------|----------|
| Action Buttons | Pill (`rounded-full`) | Buy, Swap, Create, Submit |
| Card CTAs | Rounded (`rounded-xl`) | Sign Up, Manage |
| Tab Buttons | Pill (`rounded-full`) | Filter tabs, navigation |
| Icon Buttons | Rounded square | Send, Close, Menu |
| Link Buttons | Text only | Learn More, View All |
| Navigation | Rounded (`rounded-lg`) | Sidebar nav items |

---

## 3. Design Tokens

### Colors (Dark Mode)

The app has no `--btn-*` variables; buttons compose the core tokens directly.

| Role | Background | Text |
|------|-----------|------|
| Default / primary | `bg-primary` (`#FF6B4A` coral) | `text-primary-foreground` (`#0E0E10` near-black) |
| Destructive | `bg-destructive` (`#D94343`) | `text-destructive-foreground` (`#F2F1ED`) |
| Secondary | `bg-secondary` (`#1F1F22`) | `text-secondary-foreground` (`#F2F1ED`) |
| `action` / `card-cta` | `bg-foreground` (`#F2F1ED`) | `text-background` (`#0E0E10`) |
| `action-outline` | transparent, 2px `--foreground` border | `text-foreground` |
| Tab, active | `hsl(var(--accent-green))` — coral | `hsl(var(--primary-foreground))` — near-black |
| Tab, inactive | transparent, 2px `--muted-foreground` border | `text-muted-foreground` |

### 3.1 Text on coral is near-black, never white

The canonical dark-mode pairing on a coral surface is
**`--primary-foreground` / `#0E0E10`**. The contrast maths decides it: on `#FF6B4A`,
white lands at ≈2.8:1 (fails WCAG AA for any text size) while `#0E0E10` lands at
≈6.9:1 (passes AA). Earlier revisions of this document specified
`--btn-active-text: white` for the active tab — that never matched the shipped CSS,
which uses `color: hsl(var(--primary-foreground))`.

There are currently **zero** `text-white` occurrences under `components/` or `pages/`
(verified by grep). Do not reintroduce one. If you need light text, use
`text-foreground` (`#F2F1ED`, the warm off-white) on a dark surface — not `text-white`,
and not on coral.

### Typography

```css
/* Action Button Text */
font-family: 'Geist Mono', ui-monospace, monospace;
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

**CSS Classes** (`styles/globals.css`, as shipped):
```css
.btn-action-primary {
  @apply rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wide;
  @apply bg-foreground text-background;
  @apply transition-all duration-200 hover:opacity-90;
  @apply active:scale-95;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
  @apply flex items-center justify-center gap-2;
  font-family: "Geist Mono", ui-monospace, "SF Mono", monospace;
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

**CSS Classes** (`styles/globals.css`, as shipped):
```css
.btn-action-secondary {
  @apply rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wide;
  @apply border-2 bg-transparent;
  @apply transition-all duration-200 hover:bg-muted;
  @apply active:scale-95;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
  @apply flex items-center justify-center gap-2;
  border-color: hsl(var(--foreground));
  color: hsl(var(--foreground));
  font-family: "Geist Mono", ui-monospace, "SF Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.05em;
}
```

---

### 4.3 Card CTA Button

**Visual:** `rounded-xl` corners, matching the card radius it sits inside

```tsx
<Button variant="card-cta" size="action">
  Sign Up Free
</Button>
```

**CSS Classes** (`styles/globals.css`, as shipped):
```css
.btn-card-primary {
  @apply rounded-xl px-6 py-3 text-sm font-semibold;
  @apply bg-foreground text-background;
  @apply transition-all duration-200 hover:opacity-90;
  @apply active:scale-95;
  font-family: "Geist", system-ui, sans-serif;
}
```

The `card-cta` button variant in `components/ui/button.tsx` matches:
`bg-foreground text-background hover:opacity-90 rounded-xl font-heading`.

---

### 4.4 Tab Button

**Visual:** Pill-shaped tabs with active/inactive states

```tsx
<Button variant="tab" isActive={activeTab === 'tokens'}>
  Tokens
</Button>
```

**CSS Classes** (`styles/globals.css`, as shipped):
```css
.btn-tab-active {
  @apply border-2;
  background: hsl(var(--accent-green));   /* coral #FF6B4A */
  border-color: hsl(var(--accent-green));
  color: hsl(var(--primary-foreground));  /* near-black #0E0E10 — NOT white */
}

.btn-tab-inactive {
  @apply border-2;
  background: transparent;
  border-color: hsl(var(--muted-foreground));
  color: hsl(var(--muted-foreground));
}

.btn-tab-inactive:hover {
  border-color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.5);
}
```

The `tab` button variant carries the same pairing via utilities:
`data-[active=true]:bg-green-accent data-[active=true]:text-primary-foreground`.

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

**Implementation** (`components/ui/button.tsx`): `isLoading` both disables the button
(`disabled={disabled || isLoading}`) and prepends a spinner before the children. The
spinner inherits the button's text colour via `border-current`, so it stays legible on
coral without any extra styling.

```tsx
<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
```

`isActive` is surfaced as `data-active`, which is what the `tab` and `nav` variants
select on (`data-[active=true]:…`).

---

## 8. Accessibility

### Requirements
- Minimum contrast ratio: 4.5:1
- Focus visible indicator
- Disabled state clearly distinguishable
- Touch target minimum: 44x44px on mobile

### Focus Ring

Every button carries this in its base class string:

```css
ring-offset-background
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

`--ring` is the brand coral `#FF6B4A`, so focus reads as the brand accent. Note the
separate `.focus-ring` helper class in `globals.css`, and the `shadow-focus-ring` key in
`tailwind.config.js`, both still resolve to purple (`260 28% 55%`) — prefer these ring
utilities on buttons so focus stays consistent.

---

## 9. Component Props

```typescript
// components/ui/button.tsx — full variant/size sets
interface ButtonProps {
  variant?:
    // Standard
    | 'default'            // coral bg, near-black text
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    // UI4 institutional
    | 'action'
    | 'action-outline'
    | 'action-bronze'
    | 'action-bronze-outline'
    | 'card-cta'
    | 'card-cta-outline'
    | 'tab'
    | 'nav'
    | 'icon';

  size?:
    | 'default'            // h-10 px-4 py-2 text-sm
    | 'sm'                 // h-9  px-3
    | 'lg'                 // h-11 px-8
    | 'xl'                 // h-12 px-10
    | 'icon'               // h-10 w-10
    | 'icon-sm'            // h-8  w-8
    | 'action'             // h-10 px-6 py-2.5
    | 'action-sm'          // h-8  px-4 py-2
    | 'action-lg'          // h-12 px-8 py-3
    | 'tab'                // h-9  px-5 py-2
    | 'nav';               // h-12 px-4 py-3

  isActive?: boolean;    // For tab/nav variants
  isLoading?: boolean;   // Disables the button and shows a spinner
  asChild?: boolean;     // Radix slot pattern
}
```

---

*Button PRD for Cosmos Multisig UI*
