# Cosmos Multisig UI Style Guide

**Updated:** 2026-04-09
**Brand:** Coherence Daddy (ShieldNest ecosystem)

## Color Palette

### Core Palette (CSS Variables — HSL)

All base colors are defined as CSS custom properties in HSL format in `styles/globals.css`.

| Role | HSL | Approx Hex | Usage |
|------|-----|------------|-------|
| Background | `0 0% 15%` | `#262626` | Page background |
| Foreground | `0 0% 89%` | `#e2e2e2` | Primary text |
| Card | `0 0% 18%` | `#2e2e2e` | Card backgrounds |
| Card Foreground | `0 0% 89%` | `#e2e2e2` | Text on cards |
| Primary | `0 0% 89%` | `#e2e2e2` | Primary buttons, links |
| Primary Foreground | `0 0% 15%` | `#262626` | Text on primary buttons |
| Secondary | `0 0% 22%` | `#383838` | Secondary surfaces |
| Secondary Foreground | `0 0% 89%` | `#e2e2e2` | Text on secondary |
| Muted | `0 0% 22%` | `#383838` | Muted backgrounds |
| Muted Foreground | `0 0% 63%` | `#a0a0a0` | Muted text, labels |
| Destructive | `0 62.8% 50%` | `#cc3030` | Errors, danger |
| Border | `0 0% 100% / 0.06` | — | Dividers, card edges |
| Input | `0 0% 25%` | `#404040` | Input backgrounds |
| Ring | `260 28% 55%` | `#7b68ae` | Focus rings |

### Accent Colors (CSS Variables — HSL)

| Name | HSL | Approx Hex | Usage |
|------|-----|------------|-------|
| Accent Green | `11 100% 71%` | `#ff876d` | Brand salmon/peach (primary accent) |
| Accent Green Bright | `11 100% 76%` | `#ffa58e` | Lighter salmon variant |
| Toast Green | `164 100% 39%` | `#00c896` | Success toasts |
| Accent Purple | `260 28% 55%` | `#7b68ae` | Focus rings, secondary accent |
| Accent Blue | `210 52% 43%` | `#346aa9` | Info states, links |
| Accent Gold | `37 45% 61%` | `#c8a96e` | Badges, highlights |
| Accent Bronze | `37 45% 61%` | `#c8a96e` | Bronze tier badges |
| Accent Teal | `210 52% 43%` | `#346aa9` | Alias for blue |
| Accent Orange | `11 100% 71%` | `#ff876d` | Alias for primary salmon |
| Accent Peach | `11 100% 86%` | `#ffb8a8` | Light salmon backgrounds |

### Tailwind Personal Palette

Defined in `tailwind.config.js` under `theme.extend.colors.personal`:

```js
personal: {
  purple: "#7b68ae",
  teal: "#346aa9",
  orange: "#ff876d",
  peach: "#ffb8a8",
  white: "#e2e2e2",
  charcoal: "#262626",
  gray: "#6b6b6b",
}
```

### Named Tailwind Color Extensions

| Name | CSS Variable | Usage |
|------|-------------|-------|
| `green-accent` | `--accent-green` | Salmon brand color |
| `green-bright` | `--accent-green-bright` | Lighter salmon |
| `purple-accent` | `--accent-purple` | Purple accent |
| `blue-accent` | `--accent-blue` | Steel blue |
| `gold-accent` | `--accent-gold` | Gold/warm |
| `bronze` | `--accent-bronze` | Badge backgrounds |

## Typography

| Family | Font | Tailwind Class | Usage |
|--------|------|---------------|-------|
| Sans | Inter | `font-sans` | Body text, UI |
| Heading | Space Grotesk | `font-heading` | Page titles, section headers |
| Mono | JetBrains Mono | `font-mono` | Addresses, hashes, code |

Loaded via Google Fonts in `pages/_document.tsx`.

## Styling Rules

### Cards

- Background: `bg-card` (uses `--card` CSS variable = neutral `#2e2e2e`)
- Border: `border` (uses `--border` = `rgba(255, 255, 255, 0.06)`)
- Rounded: `rounded-xl` (0.75rem)
- **No radial gradients.** Flat backgrounds only.
- Shadow: `shadow-card` (`0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.05)`)

### Buttons

- Primary buttons: `bg-primary text-primary-foreground` (light on dark)
- Brand accent buttons: `bg-[#ff876d] text-white` (salmon CTA)
- Destructive: `bg-destructive text-destructive-foreground`
- Ghost/outline: standard Shadcn patterns using `--secondary`

### Focus States

- Ring color: `--ring` = purple `#7b68ae`
- Focus shadow: `0 0 0 3px hsl(260 28% 55% / 0.3)`

### Status Colors

| State | Color | CSS |
|-------|-------|-----|
| Success | `#00c896` | `hsl(var(--toast-green))` |
| Error | `#cc3030` | `hsl(var(--destructive))` |
| Warning | Amber/gold | `text-amber-500` (Tailwind default) |
| Info | `#346aa9` | `hsl(var(--accent-blue))` |

### Hardcoded Colors to Avoid

These old values should NOT be used. Map them to CSS variable equivalents:

| Old Color | Replace With |
|-----------|-------------|
| `#561253` | `hsl(var(--accent-purple))` or `#7b68ae` |
| `#722d6f` | `hsl(var(--accent-purple))` or `#7b68ae` |
| `#1c2130` | `hsl(var(--background))` |
| `#222838` | `hsl(var(--card))` |
| `#2e3548` | `hsl(var(--secondary))` |
| `#3b82f6` | `hsl(var(--accent-blue))` or `#346aa9` |

## Component Framework

- **UI Components**: Shadcn/Radix UI — all use CSS variables automatically
- **Icons**: `lucide-react`
- **Animations**: `tailwindcss-animate` plugin

## Theme Metadata

- Meta theme-color: `#262626` (set in `pages/_document.tsx`)
- Single dark theme — no theme toggle
- All Shadcn components inherit from CSS variables automatically

## File References

- CSS variables: `styles/globals.css` (`:root` block)
- Tailwind config: `tailwind.config.js`
- Font loading: `pages/_document.tsx`
- Shadcn components: `components/ui/*`
