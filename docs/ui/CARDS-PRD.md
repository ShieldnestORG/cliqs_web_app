# Cards PRD

**Cosmos Multisig UI - Card System Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

---

## 1. Overview

The card system implements an institutional-grade design with:

- **Square corners** for retro-futuristic aesthetic
- **Accent borders** for visual hierarchy
- **Bracket corners** for decorative emphasis
- **Hover animations** with subtle transforms
- **Dark mode optimized** color palette

---

## 2. Card Variants

| Variant | Description | Use Case |
|---------|-------------|----------|
| `default` | Standard rounded card | General content |
| `institutional` | Square corners, 2px border | Forms, data display |
| `elevated` | Standard with larger shadow | Highlighted content |
| `outline` | Transparent with border | Secondary containers |

---

## 3. Card Accents

### Left Accent
4px green left border for primary emphasis.

```tsx
<Card variant="institutional" accent="left">
  {/* Primary content */}
</Card>
```

### Top Accent
3px green top border for section headers.

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

Decorative bracket corners that expand on hover. Two styles are available:
- **Angular** (`green`, `purple`): For square/institutional cards with sharp corners
- **Rounded** (`green-round`, `purple-round`): For rounded cards with `rounded-xl`

### Angular Brackets (For Square Cards)

Use with `variant="institutional"` (square corners).

```tsx
<Card variant="institutional" bracket="green">
  {/* Square card with angular brackets */}
</Card>

<Card variant="institutional" bracket="purple">
  {/* Square card with purple angular brackets */}
</Card>
```

### Rounded Brackets (For Round Cards)

Use with `variant="default"`, `"elevated"`, or `"outline"` (rounded corners).

```tsx
<Card variant="default" bracket="green-round">
  {/* Rounded card with curved brackets */}
</Card>

<Card variant="elevated" bracket="purple-round">
  {/* Elevated card with purple curved brackets */}
</Card>
```

### Bracket Style Guide

| Card Variant | Recommended Bracket | Result |
|--------------|---------------------|--------|
| `institutional` | `green`, `purple` | Angular L-shaped brackets |
| `default` | `green-round`, `purple-round` | Curved arc brackets |
| `elevated` | `green-round`, `purple-round` | Curved arc brackets |
| `outline` | `green-round`, `purple-round` | Curved arc brackets |

**CSS Implementation - Angular:**
```css
.card-bracket-corner::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  width: 16px;
  height: 16px;
  border-top: 3px solid hsl(var(--accent-green));
  border-left: 3px solid hsl(var(--accent-green));
  transition: all 200ms ease;
}

/* Hover expansion */
.card-bracket-corner:hover::before,
.card-bracket-corner:hover::after {
  width: 24px;
  height: 24px;
  opacity: 1;
}
```

**CSS Implementation - Rounded:**
```css
.card-bracket-corner-round::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  width: 20px;
  height: 20px;
  border-top: 3px solid hsl(var(--accent-green));
  border-left: 3px solid hsl(var(--accent-green));
  border-top-left-radius: 12px;  /* Curved corner */
  transition: all 200ms ease;
}

/* Hover expansion */
.card-bracket-corner-round:hover::before,
.card-bracket-corner-round:hover::after {
  width: 28px;
  height: 28px;
  opacity: 1;
}
```

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
```

### CardKPI

Large number display for key metrics.

```tsx
<CardKPI size="lg" trend="up">$85,270.48</CardKPI>
```

**Props:**
- `size`: `"sm"` | `"md"` | `"lg"` | `"xl"`
- `trend`: `"up"` | `"down"` | `"neutral"`

---

## 6. Design Tokens

### CSS Variables

```css
:root {
  /* Card Structure */
  --card-padding: 24px;
  --card-padding-sm: 16px;
  --card-radius: 0;                    /* Institutional */
  --card-transition: all 200ms ease;
  
  /* Card Colors (Dark Mode) */
  --card: 220 13% 22%;                 /* Background */
  --card-foreground: 210 40% 98%;      /* Text */
  --border: 217.2 10% 30%;             /* Border */
  
  /* Shadows */
  --card-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --card-shadow-hover: 
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.08);
}
```

---

## 7. Hover Effects

### Standard Card Hover

```css
.card-institutional:hover {
  transform: translateY(-3px);
  border-color: hsl(var(--border) / 0.8);
  box-shadow: var(--card-shadow-hover);
}
```

### Enable Hover via Prop

```tsx
<Card variant="institutional" hover>
  {/* Content with hover effect */}
</Card>
```

---

## 8. Component Interface

```typescript
interface CardProps {
  variant?: 'default' | 'institutional' | 'elevated' | 'outline';
  accent?: 'none' | 'left' | 'top' | 'header-dark';
  bracket?: 'none' | 'green' | 'purple' | 'green-round' | 'purple-round';
  hover?: boolean;
  className?: string;
  children: React.ReactNode;
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
    <span className="text-sm change-positive">+2.4%</span>
  </CardContent>
</Card>
```

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

```css
/* Desktop */
.card-institutional { padding: 24px; }

/* Mobile */
@media (max-width: 768px) {
  .card-institutional { padding: 16px; }
}
```

---

## 11. Accessibility

### Focus States

```css
.card-institutional:focus-visible {
  outline: none;
  border-color: hsl(var(--accent-purple) / 0.5);
  box-shadow: 
    0 0 0 3px hsl(var(--accent-purple) / 0.2),
    0 4px 12px hsl(var(--accent-purple) / 0.12);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .card-institutional,
  .card-institutional::before,
  .card-institutional::after {
    transition: none;
  }
  
  .card-institutional:hover {
    transform: none;
  }
}
```

---

*Card PRD for Cosmos Multisig UI*
