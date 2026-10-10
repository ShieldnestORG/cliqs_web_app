# Buttons PRD

> **Cluster:** design-system · **Tags:** buttons, variants, house-style, coral, sizes, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Patterns PRD](./PATTERNS-PRD.md), [Forms PRD](./FORMS-PRD.md), [Cards PRD](./CARDS-PRD.md)

**Cosmos Multisig UI - Button System Specification**  
**Version:** 2.0  
**Last Updated:** 2026-10-10

> **2026-10-10: the house-style adoption.** The button and menu geometry of the house style (pill
> buttons, 44px controls, 8px gaps, as shipped in its stylesheet rather than as written in its
> prose) replaced the earlier institutional treatment, app-wide, in cliqs colours and Geist type. **The
> 11px mono uppercase `action` style is retired**: `action*` variants are sentence case now, in
> the same 600-weight sans as every other button. Until this date this document specified
> `font-family: Geist Mono; font-size: 11px; text-transform: uppercase` for `action`,
> `action-outline` and the bronze pair, `active:scale-95`, a 40px default and a 2px outline.
> Version 1.1 (2026-08-16) described that look.

---

## 1. Overview

The button system is the house style's, measured in a browser rather than copied from its prose
(the house style's design doc and its stylesheet disagree in places; the stylesheet wins):

- **Pill buttons** (`rounded-full`) at **44px**: `h-11 px-5 text-sm`, 600 weight, sentence case
- **One primary per view**: the coral sheen (`default`). Everything else is quieter
- **A 120ms ease** (`duration-ui ease-ui`, `cubic-bezier(.2,.6,.2,1)`) on background, border,
  shadow and press; no hover lift, no scale. Press is a **0.5px nudge** (`active:translate-y-[0.5px]`)
- **No rest shadows**: depth comes from the coral gradient and from `shadow-pop` on hover
- **Cliqs colours and type**: the brand coral `#FF6B4A` is already the house style's accent, so only the
  gradient stops and the press fill are new tokens; the font stays Geist (the house style's SF
  Pro/Inter stack is not used, so its pixel widths do not transfer exactly)

---

## 2. Button Categories

| Category | Shape | Use Case |
|----------|-------|----------|
| Primary (`default`) | Pill, coral sheen | The one main action of a view: Claim all, Create |
| Action (`action`) | Pill, solid ink | Strong secondary actions: Edit validator, Unjail |
| Outline / ghost | Pill, 1px edge or none | Everyday actions, cancel, row actions |
| Dense chip (`xs`) | 24px, `rounded-md` | Dense table rows only |
| Card CTAs | Rounded (`rounded-xl`) | Sign Up, Manage |
| Tab Buttons | Pill | Filter tabs |
| Icon Buttons | Pill / circle, 44px | Send, Close, Menu |
| Link Buttons | Text only | Learn More, View All |
| Navigation | Rounded (`rounded-lg`) | Sidebar nav items |

---

## 3. Design Tokens

### Colors (Dark Mode)

Buttons compose the core tokens plus the house-style tokens added 2026-10-10
(see [STYLE-GUIDE.md](../STYLE-GUIDE.md#house-style-control-tokens)).

| Variant | Background | Edge | Text | Hover | Press |
|---------|-----------|------|------|-------|-------|
| `default` (coral sheen) | `bg-primary-gradient`: 135deg `--primary-sheen` 0%, `--primary` 45%, `--primary-press` 100% | `border-primary-press` | `text-primary-foreground` | adds `shadow-pop` | solid `--primary-press`, no shadow |
| `action` | `bg-foreground` (solid ink) | none | `text-background` | `brightness-110` | 0.5px nudge |
| `outline`, `action-outline` | transparent | 1px `border-border/15` | inherited | `bg-field` | 0.5px nudge |
| `secondary` | `bg-field` | 1px `border-border/10` | `text-secondary-foreground` | `color-mix` 9% foreground into the fill | 0.5px nudge |
| `ghost` | none | none | inherited | `bg-field` | 0.5px nudge |
| `destructive` | `bg-destructive` | none | `text-destructive-foreground` | `bg-destructive/90` + `shadow-pop` | no shadow |
| `action-bronze` | `bg-bronze` (gold) | none | `text-background` | `brightness-110` | nudge |
| `action-bronze-outline` | transparent | 1px `border-bronze` | `text-foreground` | `bg-bronze/10` | nudge |
| `link` | none | none | `text-primary` | underline | nudge |
| Tab, active / inactive | unchanged | | | | |

`secondary` is a visible fill on the dark card (`--field` `#26262A` on `#18181B` is 1.18:1, with
a 10% edge); the previous `#1F1F22` fill was 1.08:1 and read as disabled. The house style's destructive
reds are **not** ported (the recipe is: cliqs `--destructive` stays `#D94343`, solid, no gradient).

### 3.1 Text on coral is near-black, never white

The canonical dark-mode pairing on a coral surface is
**`--primary-foreground` / `#0E0E10`**. On `#FF6B4A`, white lands at about 2.8:1 (fails WCAG
AA) while `#0E0E10` lands at about 6.9:1. On the gradient it is 8.3:1 at the light end
(`--primary-sheen`) and 5.2:1 at the dark end (`--primary-press`), so it passes everywhere.

There are **zero** `text-white` occurrences under `components/` or `pages/`. Do not
reintroduce one. If you need light text use `text-foreground` (`#F2F1ED`) on a dark surface,
never on coral.

### Typography

Geist (the app font), **14px / 600 / line-height 1.2**, sentence case, no tracking. The `sm`
size is 13px. There is no mono or uppercase treatment on any `default`, `action*`, `outline`,
`secondary`, `ghost` or `destructive` button. (`tab` keeps its mono uppercase pill; no page
uses it.)

**The 1.2 line height lives on each size string, not in the base.** `cn()` runs `tailwind-merge`,
which drops an earlier `leading-*` whenever a later `text-sm` / `text-[13px]` is present, so a
`leading-[1.2]` in the base alone never reached the page: buttons rendered at the 20px line
height of `text-sm` (measured on the built page, 2026-10-10). Each size that sets a text size
(`default`, `sm`, `lg`, `xl`, `xs` and the three `action` sizes) now carries `leading-[1.2]`
AFTER its `text-*` class, and `__tests__/components/button.test.tsx` pins the class on the
rendered default, `sm` and `lg` buttons. A call site that passes its own `leading-*` or `text-*`
still wins, as everywhere in this system. *(Until 2026-10-10 the only `leading-[1.2]` was in the
base string below, and this section claimed 1.2 without it being real.)*

---

## 4. Button Specifications

All variants share this base (`components/ui/button.tsx`):

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full
border border-transparent font-semibold leading-[1.2]
transition-[background-color,border-color,color,box-shadow,transform,filter] duration-ui ease-ui
active:translate-y-[0.5px]
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

### 4.1 Primary (`default`): the coral sheen

```tsx
<Button>Claim all</Button>
```

One per view (Von Restorff: a second coral button dilutes the first). On the validator page it
is "Claim all", or the one Claim row that can claim when only one amount exists.

### 4.2 Action (`action`): solid ink

```tsx
<Button variant="action" size="action">Create CLIQ</Button>
```

`bg-foreground text-background`, sentence case. Hover brightens slightly (`brightness-110`,
which takes the off-white to white without a hex). Use for strong actions that are not the
view's one primary.

### 4.3 Outline and ghost

```tsx
<Button variant="outline">Cancel</Button>
<Button variant="action-outline">Cancel</Button>   {/* identical to outline */}
<Button variant="ghost">Details</Button>
```

`outline` and `action-outline` are the ghost style: transparent, a visible 1px edge
(`border-border/15`, about 1.6:1 on the card, versus the old `border-input` at 1.08:1), a field
fill on hover. They are transparent: the page background shows through. `ghost` has no edge.

### 4.4 Secondary

```tsx
<Button variant="secondary">Learn more</Button>
```

A quiet fill that stays visible on the dark card (see the table above).

### 4.5 Dense chip (`xs`)

```tsx
<Button size="xs" variant="outline">Copy</Button>
```

The house style's small chip: `h-6 px-3 text-[11px] font-medium rounded-md`. **Dense table rows
only**; it is 24px (the house style's own 23px sits under the WCAG 2.5.8 floor). Everywhere else use `sm` or larger.

### 4.6 Card CTA, tab, nav, icon, link

Unchanged in meaning. `card-cta` and `card-cta-outline` keep `rounded-xl`; `tab` and `nav` keep
their treatment (the Sidebar renders `ghost` Buttons, see below). `icon` is a 44px square
(`h-11 w-11`) and, like every button, round (`rounded-full`).

> Note (2026-10-09): this section showed `<Button variant="nav" isActive={...}>`. The Sidebar
> no longer uses the `nav` variant. It renders each item from `lib/navigation.ts` as a `ghost`
> Button (`components/Sidebar.tsx`); the active item gets `bg-muted font-semibold` and a coral
> icon, decided by `isNavItemActive`. The destination is called **Home** now. The `nav` variant
> still exists in `components/ui/button.tsx` but no page uses it.

> The `.btn-action-primary`, `.btn-card-primary`, `.btn-tab*`, `.btn-nav*` CSS classes in
> `styles/globals.css` are legacy: components use the `Button` variants, not those classes
> (only `components/ChainConnect/TabButton.tsx` still reads `.btn-tab`). They are not
> the source of truth and were not updated.

---

## 5. Button Sizes

| Size | Height | Padding | Text | Use Case |
|------|--------|---------|------|----------|
| `default`, `action` | **44px** (`h-11`) | `px-5` | 14px | Standard actions |
| `sm`, `action-sm` | 36px (`h-9`) | `px-4` | 13px | Dense toolbars, row actions, the network control |
| `lg`, `action-lg` | 48px (`h-12`) | `px-6` | 14px | Hero CTAs |
| `xl` | 48px | `px-10` | 16px | unchanged |
| `xs` (new) | 24px (`h-6`) | `px-3` | 11px, 500 | Dense table rows only, not a pill |
| `icon` | 44px square | none | | Icon buttons |
| `icon-sm` | 32px square | none | | Small icon buttons (unchanged) |
| `tab`, `nav` | 36px, 48px | unchanged | | |

Every existing variant and size **name** is kept, so the 235 call sites compile unchanged. Sizes
that changed: `default` 40 to 44, `action` 40 to 44, `action-sm` 32 to 36, `lg` 44 to 48,
`action-lg` 48 (padding 32 to 24), `icon` 40 to 44. A button in a dense row (a table cell, a
toolbar that must stay 40px) should now say `size="sm"` explicitly.

**Phone (375px):** every action is at least 44px tall except `xs` chips in dense rows. `sm`
buttons that are standalone actions add `max-sm:h-11`.

---

## 6. Responsive Layout

### Mobile-First Button Groups

```tsx
{/* Vertical on mobile, horizontal on desktop */}
{/* Use flex-col-reverse so primary action appears on top on mobile */}
<div className="flex flex-col-reverse sm:flex-row gap-3">
  <Button variant="outline" className="w-full sm:flex-1">
    Cancel
  </Button>
  <Button className="w-full sm:flex-1">
    Confirm
  </Button>
</div>
```

Space between buttons in a row: 12px (`gap-3`). Space above a button row inside a card: 20px.

### Mobile (< 640px)
- Buttons stack vertically, full width (`w-full`), primary action on top (`flex-col-reverse`)

### Desktop (≥ 640px)
- Buttons align horizontally, primary action on the right

A full-width button in a wide panel looks like a bar: use `w-full sm:w-auto` unless it is the
panel's one primary.

---

## 7. Loading State

```tsx
<Button isLoading>Processing...</Button>
```

`isLoading` disables the button (`disabled={disabled || isLoading}`) and prepends a spinner. The
spinner inherits the text colour (`border-current`) and no longer carries a right margin: the
base `gap-2` spaces it.

### 7.1 Icons and labels inside a Button: no `mr-*` / `ml-*`

**The Button spaces its children with `gap-2` (8px, the house-style value). Do not put `mr-*` or
`ml-*` on an icon, a count or any other element inside it.** A margin on top of the gap shows
about 16px between icon and label. Until 2026-10-10 thirty-four icons inside `<Button>` still
carried `mr-1`, `mr-1.5`, `mr-2`, `ml-1` or `ml-2` from the old `mr-2` habit (35 class hits in
11 files); they were removed in one pass. A margin on the
Button element itself (`<Button className="ml-2">`) is fine: it spaces the button from its
neighbours. If a design needs a different gap, pass `gap-*` on the Button, not a margin on its
children.

`__tests__/components/button-icon-margins.test.ts` enforces this: it parses every `.tsx` under
`components/` and `pages/` and fails when anything inside `<Button>`, `<AlertDialogAction>` or
`<AlertDialogCancel>` (all three render through `buttonVariants`, so all three carry the `gap-2`)
has a numeric (or bracketed) side margin: `mr-*`, `ml-*`, `mx-*`, `ms-*` or `me-*`, with or without
a variant chain (`sm:ml-2`, `data-[state=open]:mr-1`) and behind a bracketed selector
(`[&>svg]:mr-2`, `[&_svg]:ml-1`). On the Button's own `className` it flags a margin aimed at the
children (`[&>svg]:mr-2`, `*:mx-1`) but not the Button's own margin. `mx-auto` and the other
`auto` margins are fine. Its allowlist is empty; an entry must say why the site cannot follow the
rule. A class held in a name does not hide: `className={ICON_CLS}` or `{icon}`
inside a Button is followed to the `const` / `function` in the same file that defines it, and what
that holds is scanned too. *Until 2026-10-10 it read only the class text written inside the
attribute, so `const ICON_CLS = "mr-1 h-4 w-4"` outside the Button passed (shown on
`CredentialManagerPanel`); and it knew only `Button`, `mr-*` and `ml-*`.* **What it cannot see**
(stated in the test header): a class passed as a prop to a component that puts it on an icon
inside a Button (`<Row iconClass="mr-2" />`), an aliased import (`import { Button as Btn }`), a
class imported from another file or an element rendered by a component defined in another file,
and a margin written as an inline `style`.

```tsx
<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
```

`isActive` is surfaced as `data-active`, which the `tab` and `nav` variants select on.

---

## 8. Accessibility

- Minimum contrast 4.5:1 for text (see 3.1)
- Touch target 44px (see 5)
- Disabled is `opacity-50` and `pointer-events-none`

### Focus ring

Every button carries `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
(`--ring` is the brand coral). The ring **stays a ring around the pill**. The reference
stylesheet's own `:focus-visible` rule sets `border-radius: 8px`, so every keyboard-focused pill
there snaps to a small radius (measured on six variants); that is a bug in that stylesheet and is
deliberately not copied: do not add a `rounded-*` class under any focus variant. Tailwind composes ring and
shadow in one `box-shadow`, so the hover shadow and the ring coexist (the reference stylesheet's
"a shadow erases the ring" trap only bites hand-written `box-shadow` CSS). `__tests__/components/button.test.tsx` renders every variant at
every size (the names are read from `components/ui/button.tsx`, so a new one is covered) and fails
on a rounding class under any focus variant: `focus:`, `focus-visible:`, `focus-within:`,
`group-focus:`, `peer-focus:` or an arbitrary selector such as `[&:focus]:`, with other variants
chained before or after it (`focus-visible:sm:rounded-md`) or an important mark (`focus-visible:!rounded-none`).
It does not see a class passed to the Button as a prop, nor a rounding set in a stylesheet.

---

## 9. Gotchas

1. **A colour override on the default variant replaces the sheen, but not the edge or the
   press fill.** `<Button className="bg-success">` drops the gradient (tailwind-merge treats the
   two as the same group, `__tests__/components/button.test.tsx` pins it), yet
   `border-primary-press` and `active:bg-primary-press` stay. Pass `border-transparent` and your
   own `active:bg-*`, or pick another variant. Call sites that needed it: the vote dialog buttons
   (`ProposalViewer`), `ButtonWithConfirm`, and the three `DonateDialog` buttons.
2. **`whitespace-nowrap` is in the base.** Keep labels short; a button that must wrap needs
   `h-auto whitespace-normal`.
3. **Tile-shaped buttons** (an icon above a label, `h-auto flex-col py-4`) are not pills: add
   `rounded-2xl`. Done for the Keplr and Ledger connect buttons.
4. **Inputs are 44px too.** The shared `Input` is `h-11` (since 2026-10-10), the same height as a
   default Button, so a button and an `Input` in one row line up with no class at the call site;
   do not pass `h-11` to an `Input`. *(Until 2026-10-10 this item said "Inputs are still 40px":
   a button next to an `Input` was 4px taller and the `Input` needed `className="h-11"` at the
   call site, done in the not-a-validator search form and the unlock-credentials form; making
   `Input` 44px by default was listed as a follow-up. The follow-up is done and those call-site
   patches are gone; `__tests__/components/input.test.tsx` pins it.)*
5. **Copy buttons** (`CopyButton` in `AddressDisplay`) stay 24px on purpose (`h-6 w-6`
   overrides the 44px `icon` size).

---

## 10. Component Props

```typescript
// components/ui/button.tsx: full variant/size sets
interface ButtonProps {
  variant?:
    // Standard
    | 'default'            // coral sheen
    | 'destructive'        // solid destructive token
    | 'outline'            // ghost: transparent, 1px edge
    | 'secondary'          // visible quiet fill
    | 'ghost'              // no edge, fill on hover
    | 'link'
    // UI4 institutional (names kept; sentence case since 2026-10-10)
    | 'action'             // solid ink
    | 'action-outline'     // same as outline
    | 'action-bronze'      // solid gold
    | 'action-bronze-outline'
    | 'card-cta'
    | 'card-cta-outline'
    | 'tab'
    | 'nav'
    | 'icon';

  size?:
    | 'default'            // h-11 px-5 text-sm
    | 'sm'                 // h-9  px-4 text-[13px]
    | 'lg'                 // h-12 px-6 text-sm
    | 'xl'                 // h-12 px-10 text-base
    | 'xs'                 // h-6  px-3 text-[11px] rounded-md (dense rows)
    | 'icon'               // h-11 w-11
    | 'icon-sm'            // h-8  w-8
    | 'action'             // h-11 px-5 text-sm
    | 'action-sm'          // h-9  px-4 text-[13px]
    | 'action-lg'          // h-12 px-6 text-sm
    | 'tab'                // h-9  px-5 py-2
    | 'nav';               // h-12 px-4 py-3

  isActive?: boolean;    // For tab/nav variants
  isLoading?: boolean;   // Disables the button and shows a spinner
  asChild?: boolean;     // Radix slot pattern
}
```

The legacy `components/inputs/Button` (used by the signing form and the transaction page) is
**not** part of this system and was not changed; the two looks coexist in the signing flow until
those call sites are migrated.

---

*Button PRD for Cosmos Multisig UI*
