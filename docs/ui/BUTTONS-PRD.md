# Buttons PRD

> **Cluster:** design-system · **Tags:** buttons, variants, house-style, coral, sizes, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Patterns PRD](./PATTERNS-PRD.md), [Forms PRD](./FORMS-PRD.md), [Cards PRD](./CARDS-PRD.md)

**Cosmos Multisig UI - Button System Specification**  
**Version:** 2.1  
**Last Updated:** 2026-10-10

> **2026-10-10 (round 2): sheen and depth on every button, and no gold.** The owner: "these
> buttons can be the nicer quality ones ... with sheen and depth and not just this page but thru
> out app, and we should not use gold; that is testnet color; can go back to the coral orange".
> Three changes, all app-wide. (1) The solid buttons (`default`, `destructive`, `action`) share
> one recipe: a 135deg three-stop gradient, a short neutral rest shadow, a deeper shadow on hover
> and a flat sunk fill when pressed (§3, §4.7). (2) The quiet buttons (`outline`, `secondary`,
> `action-outline`) carry a faint top light and a hairline shadow; `ghost`, `link` and `icon`
> stay flat. (3) `action-bronze` and `action-bronze-outline` are removed: gold is the testnet
> colour, so no button uses it (§4.8). This reverses the earlier rule "No rest shadows" (§1); the
> old sentence is kept there. Not yet measured: label contrast on the new ink and red stops (§3.2).

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
  shadow and press; no hover lift (the button does not move, its shadow deepens), no scale. Press
  is a **0.5px nudge** (`active:translate-y-[0.5px]`)
- **Sheen and depth** (round 2): a solid button rests on a short neutral shadow (`shadow-btn`: a
  lit top edge, a shaded bottom edge and a short drop), deepens to `shadow-btn-hover` on hover and
  sinks to a flat fill with `shadow-btn-pressed` when pressed. Quiet buttons carry the lighter
  `shadow-btn-quiet`. Shadows are always neutral (black, and white for the lit edge): never a
  coloured glow. *Until 2026-10-10 (round 2) this bullet read: "**No rest shadows**: depth comes
  from the coral gradient and from `shadow-pop` on hover".*
- **Coral, ink and red; never gold** (round 2): gold is the testnet colour, so no button variant
  uses it (§4.8)
- **Cliqs colours and type**: the brand coral `#FF6B4A` is already the house style's accent, so the
  coral needed only the gradient stops and the press fill as new tokens (round 2 added the shadow,
  ink and red tokens, §3); the font stays Geist (the house style's SF
  Pro/Inter stack is not used, so its pixel widths do not transfer exactly)

---

## 2. Button Categories

| Category | Shape | Use Case |
|----------|-------|----------|
| Primary (`default`) | Pill, coral sheen and depth | The one main action of a view: Claim all, Create |
| Action (`action`) | Pill, ink sheen and depth | Strong secondary actions: Edit validator, Unjail |
| Destructive (`destructive`) | Pill, red sheen and depth | Dangerous actions, where one is needed |
| Outline / secondary | Pill, 1px edge, faint top light and hairline shadow | Everyday actions, cancel, row actions |
| Ghost | Pill, flat, no edge | Quiet row actions |
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
(see [STYLE-GUIDE.md](../STYLE-GUIDE.md#house-style-control-tokens)) and the round 2 sheen and
depth tokens listed below the table.

| Variant | Background | Edge | Text | Rest | Hover | Press |
|---------|-----------|------|------|------|-------|-------|
| `default` (coral sheen) | `bg-primary-gradient`: 135deg `--primary-sheen` 0%, `--primary` 45%, `--primary-press` 100% | `border-primary-press` | `text-primary-foreground` | `shadow-btn` | `shadow-btn-hover` | flat `--primary-press` fill (`active:bg-none` + `active:bg-primary-press`), `shadow-btn-pressed`, 0.5px nudge |
| `destructive` (red sheen) | `bg-destructive-gradient`: 135deg `--destructive-sheen` 0%, `--destructive-fill` 45%, `--destructive-press` 100% | `border-destructive-press` | `text-destructive-foreground` | `shadow-btn` | `shadow-btn-hover` | flat `--destructive-press` fill, `shadow-btn-pressed`, nudge |
| `action` (ink sheen) | `bg-ink-gradient`: 135deg `--ink-sheen` 0%, `--foreground` 45%, `--ink-press` 100% | `border-ink-press` | `text-background` | `shadow-btn` | `shadow-btn-hover` | flat `--ink-press` fill, `shadow-btn-pressed`, nudge |
| `outline`, `action-outline` | `bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]` over a transparent fill | 1px `border-border/15` | inherited (`action-outline`: `text-foreground`) | `shadow-btn-quiet` | `bg-field` | `shadow-btn-pressed`, nudge |
| `secondary` | `bg-field` with `bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]` over it | 1px `border-border/10` | `text-secondary-foreground` | `shadow-btn-quiet` | `color-mix` 9% foreground into the fill | `shadow-btn-pressed`, nudge |
| `ghost` | none | none | inherited | none | `bg-field` | 0.5px nudge |
| `link` | none | none | `text-primary` | none | underline | nudge |
| Tab, active / inactive | unchanged | | | | | |

`icon` is flat like `ghost` (a `bg-field` hover, no gradient, no shadow).

The fill and the light are separate classes on purpose (`bg-field` plus `bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]`): a custom gradient class would be read as a fill colour by `cn()` and would remove `bg-field`. See gotcha 6 in §9.

*Until 2026-10-10 (round 2) this table read differently. `action` was a flat `bg-foreground` with
no edge (hover `brightness-110`). `destructive` was a flat `bg-destructive` with no edge (hover
`bg-destructive/90` plus `shadow-pop`, no shadow when pressed). `default` had no rest shadow (hover
added `shadow-pop`; pressed was a solid `--primary-press` with no shadow). `outline`,
`action-outline` and `secondary` had no gradient and no shadow. And it had two more rows, removed
in round 2 because gold is the testnet colour: `action-bronze` (`bg-bronze`, no edge,
`text-background`, hover `brightness-110`) and `action-bronze-outline` (transparent, 1px
`border-bronze`, `text-foreground`, hover `bg-bronze/10`). They were the CLIQ-mode Claim buttons.*

`secondary` is a visible fill on the dark card (`--field` `#26262A` on `#18181B` is 1.18:1, with
a 10% edge; measured before round 2, to be re-measured, because the quiet gradient now lays a faint
light over the fill); the previous `#1F1F22` fill was 1.08:1 and read as disabled. The red button
has its own three stops (below), darker than `--destructive` `#D94343`, so the light label stays readable (see §3.2).
Whether those end stops match the house style's own destructive reds was not checked. *Until
2026-10-10 (round 2) this paragraph said: "The house style's destructive reds are **not** ported
(the recipe is: cliqs `--destructive` stays `#D94343`, solid, no gradient)."*

### Sheen and depth tokens (round 2)

All are in `styles/globals.css` (`:root`) and `tailwind.config.js`. The shadow values are copied
from the stylesheet. Hex values are converted from the HSL triplets (the same conversion gives the
documented `#D94343` and `#E5553A`); the code does not record a source hex for the ink and red
stops.

| Token | Value | Tailwind | Used for |
|-------|-------|----------|----------|
| `--shadow-btn` | `inset 0 1px 0 rgba(255,255,255,.3), inset 0 -1px 0 rgba(0,0,0,.2), 0 1px 2px rgba(0,0,0,.45), 0 3px 8px rgba(0,0,0,.3)` | `shadow-btn` | rest depth of a solid button: lit top edge, shaded bottom edge, short neutral drop |
| `--shadow-btn-hover` | `inset 0 1px 0 rgba(255,255,255,.36), inset 0 -1px 0 rgba(0,0,0,.2), 0 8px 28px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4)` | `shadow-btn-hover` | solid button on hover: the same lit edges plus the two layers of the popover shadow (`--shadow-pop`) |
| `--shadow-btn-pressed` | `inset 0 2px 4px rgba(0,0,0,.35)` | `shadow-btn-pressed` | solid and quiet buttons while pressed: sunk in |
| `--shadow-btn-quiet` | `inset 0 1px 0 rgba(255,255,255,.07), 0 1px 2px rgba(0,0,0,.35)` | `shadow-btn-quiet` | rest depth of `outline`, `secondary`, `action-outline` (and the Manage tiles, see the Validator Dashboard PRD) |
| `--ink-sheen` | `0 0% 100%` (`#FFFFFF`) | none (used inside the gradient only) | start of `bg-ink-gradient` |
| `--ink-press` | `48 7% 78%` (`#CBC9C3`) | `bg-ink-press`, `border-ink-press` | end of the ink gradient, the pressed fill and the edge of `action` |
| `--destructive-sheen` | `3 72% 47%` (`#CE2A22`) | none (used inside the gradient only) | start of `bg-destructive-gradient` |
| `--destructive-fill` | `0 66% 45%` (`#BE2727`) | none (used inside the gradient only) | middle of `bg-destructive-gradient` |
| `--destructive-press` | `358 62% 37%` (`#992428`) | `bg-destructive-press`, `border-destructive-press` | end of the red gradient, the pressed fill and the edge of `destructive` |

The gradients are Tailwind background images in `tailwind.config.js`:

| Class | Value |
|-------|-------|
| `bg-primary-gradient` | `linear-gradient(135deg, --primary-sheen 0%, --primary 45%, --primary-press 100%)` (unchanged) |
| `bg-ink-gradient` | `linear-gradient(135deg, --ink-sheen 0%, --foreground 45%, --ink-press 100%)` |
| `bg-destructive-gradient` | `linear-gradient(135deg, --destructive-sheen 0%, --destructive 45%, --destructive-press 100%)` |
| `bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]` | `linear-gradient(180deg, --foreground at 7% 0%, --foreground at 1.5% 100%)`: a faint top-down light, not a fill |

### 3.1 Text on coral is near-black, never white

The canonical dark-mode pairing on a coral surface is
**`--primary-foreground` / `#0E0E10`**. On `#FF6B4A`, white lands at about 2.8:1 (fails WCAG
AA) while `#0E0E10` lands at about 6.9:1. On the gradient it is 8.3:1 at the light end
(`--primary-sheen`) and 5.2:1 at the dark end (`--primary-press`), so it passes everywhere.

There are **zero** `text-white` occurrences under `components/` or `pages/`. Do not
reintroduce one. If you need light text use `text-foreground` (`#F2F1ED`) on a dark surface,
never on coral. The coral recipe is unchanged by round 2, so these figures still stand.

### 3.2 Text on the ink and red buttons (round 2)

`action` puts `text-background` (`#0E0E10`) on the ink gradient (`#FFFFFF` to `#CBC9C3`, with
`--foreground` `#F2F1ED` in the middle). `destructive` puts `text-destructive-foreground`
(`#F2F1ED`) on the red gradient (`#CE2A22` to `#992428`, with `--destructive-fill` `#BE2727` in the
middle). Hex values are converted from the HSL tokens.

**Measured (2026-10-10, WCAG contrast from the token values):** the near-black label on the ink
button is 19.28:1 at the sheen stop, 17.05:1 at the middle and 11.66:1 at the press stop. The light
label on the red button is 4.66:1, 5.27:1 and 7.06:1. The red button has its own three stops
(`--destructive-sheen`, `--destructive-fill`, `--destructive-press`) because `--destructive`
itself is too light under a light label: 3.84:1, which is what the flat red button measured
until round 2.

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
is "Claim all", or the one Claim row that can claim when only one amount exists. It follows the
solid recipe in §4.7. The depth does not allow a second coral button: the rule is unchanged.

### 4.2 Action (`action`): the ink sheen

```tsx
<Button variant="action" size="action">Create CLIQ</Button>
```

`bg-ink-gradient text-background`, sentence case: the coral recipe in ink (§4.7). Hover deepens
the shadow (`shadow-btn-hover`); there is no `brightness-110` any more. Use for strong actions
that are not the view's one primary. *Until 2026-10-10 (round 2) `action` was a flat
`bg-foreground` and hover brightened it (`brightness-110`, which takes the off-white to white
without a hex).*

### 4.3 Outline and ghost

```tsx
<Button variant="outline">Cancel</Button>
<Button variant="action-outline">Cancel</Button>   {/* the same quiet recipe; the text is always text-foreground */}
<Button variant="ghost">Details</Button>
```

`outline` and `action-outline` are quiet raised pills: a transparent fill with a faint top-down
light over it (`bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]`), a hairline shadow (`shadow-btn-quiet`), a visible 1px edge
(`border-border/15`, about 1.6:1 on the card, versus the old `border-input` at 1.08:1; measured
before round 2, to be re-measured), a field fill on hover, and `shadow-btn-pressed` when pressed.
The fill colour is transparent, so the page background still shows through under the light.
`ghost` has no edge, no light and no shadow. *Until 2026-10-10 (round 2) `outline` and
`action-outline` were "the ghost style": transparent, with no light and no shadow.*

### 4.4 Secondary

```tsx
<Button variant="secondary">Learn more</Button>
```

A quiet fill that stays visible on the dark card (see the table above), with the same faint top
light and hairline shadow as `outline`. *Until round 2 it had neither.*

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

### 4.7 The depth recipe: solid, quiet, flat (round 2)

Every variant follows one of three recipes. The tokens are in §3.

| Recipe | Variants | Rest | Hover | Pressed |
|--------|----------|------|-------|---------|
| Solid | `default`, `destructive`, `action` | 135deg three-stop gradient, 1px `border-*-press`, `shadow-btn` | `hover:shadow-btn-hover` | the gradient is cleared (`active:bg-none`) for the flat `active:bg-*-press` fill, with `active:shadow-btn-pressed` and the 0.5px nudge |
| Quiet | `outline`, `secondary`, `action-outline` | `bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]`, 1px `border-border/10` or `/15`, `shadow-btn-quiet` | a fill (`hover:bg-field` or the `color-mix` fill) | `active:shadow-btn-pressed` and the nudge |
| Flat | `ghost`, `link`, `icon` | no gradient, no shadow | a fill (`ghost`, `icon`) or an underline (`link`) | the nudge |

Rules that hold for all three:

- **Shadows are neutral.** Black for the drop, white for the lit top edge. Never a coloured glow,
  never a coral shadow under a coral button.
- **One primary (coral) per view** still holds. Sheen and depth make every button look finished;
  they do not make a second primary acceptable.
- **The lit top edge is part of the shadow** (`inset 0 1px 0`), not a border or a highlight
  element, so it follows the pill's rounding.
- A new solid colour is a new gradient plus a `-press` token, built like the three above. Do not
  hand-write a one-off gradient or shadow on a call site.

### 4.8 No gold on buttons (round 2)

Gold (`--accent-gold` / `--accent-bronze`, the same value as `--warning`) is the testnet colour.
No button **variant** uses it. `action-bronze` and `action-bronze-outline` were removed: in CLIQ
mode the validator Claim buttons are the same coral `default` and `outline` as in wallet mode. The
CLIQ path is told apart by its "Create:" labels and the note in the Rewards card ("Actions will
create a transaction for multisig signing"; see the
[Validator Dashboard PRD](VALIDATOR-DASHBOARD-PRD.md) §2 and §4.2). Colour is not a second
signal for it. *Until 2026-10-10 (round 2) CLIQ-mode Claim buttons were gold so that "this
creates a proposal" read differently from "this signs right now".* The `bronze` Tailwind colour
and the `--accent-bronze` token still exist (nothing in `components/` or `pages/` reads `bronze`
now); a few call sites paint their own button gold with the `warning` token, which is a call-site
colour, not a variant (the Testnet box in the network control, and the "No with Veto" option in
the vote dialog).

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

- Minimum contrast 4.5:1 for text (see 3.1; the ink and red buttons are not yet measured, see 3.2)
- Touch target 44px (see 5)
- Disabled is `opacity-50` and `pointer-events-none`

### Focus ring

Every button carries `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
(`--ring` is the brand coral). The ring **stays a ring around the pill**. The reference
stylesheet's own `:focus-visible` rule sets `border-radius: 8px`, so every keyboard-focused pill
there snaps to a small radius (measured on six variants); that is a bug in that stylesheet and is
deliberately not copied: do not add a `rounded-*` class under any focus variant. Tailwind composes ring and
shadow in one `box-shadow`, so the hover shadow and the ring coexist (the reference stylesheet's
"a shadow erases the ring" trap only bites hand-written `box-shadow` CSS). Since round 2 every
solid and quiet button also has a rest shadow (`shadow-btn`, `shadow-btn-quiet`) that goes through
the same utility, so it should coexist with the ring the same way (INFERRED from that
composition; not checked on a built page). `__tests__/components/button.test.tsx` renders every variant at
every size (the names are read from `components/ui/button.tsx`, so a new one is covered) and fails
on a rounding class under any focus variant: `focus:`, `focus-visible:`, `focus-within:`,
`group-focus:`, `peer-focus:` or an arbitrary selector such as `[&:focus]:`, with other variants
chained before or after it (`focus-visible:sm:rounded-md`) or an important mark (`focus-visible:!rounded-none`).
It does not see a class passed to the Button as a prop, nor a rounding set in a stylesheet.

---

## 9. Gotchas

1. **A colour override on a solid variant replaces the sheen, but not the edge, the press fill
   or the shadows.** `<Button className="bg-success">` drops the gradient (tailwind-merge treats
   the two as the same group, `__tests__/components/button.test.tsx` pins it for `default`), yet
   `border-primary-press` and `active:bg-primary-press` stay. Pass `border-transparent` and your
   own `active:bg-*`, or pick another variant. Call sites that needed it: the vote dialog buttons
   (`ProposalViewer`), `ButtonWithConfirm`, and the three `DonateDialog` buttons. Since round 2
   the same holds for `destructive` (`border-destructive-press`, `active:bg-destructive-press`)
   and `action` (`border-ink-press`, `active:bg-ink-press`), and the three shadows
   (`shadow-btn`, `hover:shadow-btn-hover`, `active:shadow-btn-pressed`) stay too, so an
   overridden button keeps its depth (checked by running `tailwind-merge` 2.6.0 on the variant
   strings; the rendered look of those call sites was not re-checked).
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
6. **A fill colour and a gradient in one class string: the last one wins.** `cn()` runs
   `tailwind-merge`, which files every `bg-<name>` it does not know (`bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]`,
   `bg-ink-gradient`, `bg-primary-gradient`) in the same group as a fill colour (`bg-field`,
   `bg-transparent`, `bg-success`) and keeps only the last. Found in round 2: at the round 2
   commit `secondary` is written `bg-field bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015]`, and the merge drops `bg-field`, so
   the fill the table in §3 promises does not reach the page (checked by running `tailwind-merge`
   2.6.0 on that string). `outline` loses only `bg-transparent`, which changes nothing. When a variant needs a
   fill and a gradient together, check the output of `cn()` and pin it with a test; a class under
   a variant prefix (`hover:bg-field`) is a different key and is kept.
7. **A `shadow-*` class from a call site does not replace the depth shadows.** `tailwind-merge`
   reads `shadow-btn`, `shadow-btn-hover` and the other custom names as shadow colours, so
   `shadow-none` and `shadow-lg` are kept beside `shadow-btn` in the class list; which one paints is
   then decided by the order of the generated stylesheet (not checked). `shadow-pop` does replace it
   (same group). For a flat button use `ghost`, `link` or `icon` instead of `shadow-none`.
8. **`mx-auto` on a Button needs `flex`.** A Button is `inline-flex`, and auto margins do not
   centre an inline box. The collapsed menu's Donate and Disconnect buttons sat left of the
   column until they got `flex` with `mx-auto` (round 2, `components/Sidebar.tsx`).

---

## 10. Component Props

```typescript
// components/ui/button.tsx: full variant/size sets
interface ButtonProps {
  variant?:
    // Standard
    | 'default'            // coral sheen and depth
    | 'destructive'        // red sheen and depth
    | 'outline'            // quiet raised: faint top light, hairline shadow, 1px edge
    | 'secondary'          // visible quiet fill, same light and shadow
    | 'ghost'              // flat: no edge, fill on hover
    | 'link'
    // UI4 institutional (names kept; sentence case since 2026-10-10)
    | 'action'             // ink sheen and depth
    | 'action-outline'     // same quiet recipe as outline
    // 'action-bronze' and 'action-bronze-outline' were removed 2026-10-10 (round 2): gold is the testnet colour, see 4.8
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
