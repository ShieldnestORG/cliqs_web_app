# Forms PRD

> **Cluster:** design-system · **Tags:** forms, inputs, slider, validation, tokens · **Related:** [STYLE-GUIDE.md](../STYLE-GUIDE.md), [UI Index](./INDEX.md), [Buttons PRD](./BUTTONS-PRD.md), [Cards PRD](./CARDS-PRD.md)

**Cosmos Multisig UI - Form System Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

---

## 1. Overview

Form components optimized for crypto use cases:

- **Input variants** for different contexts
- **Address validation** with visual feedback
- **Enhanced slider** for threshold selection
- **Accessible** with proper labels and error states
- **Mobile optimized** with touch-friendly controls

---

## 2. Input Variants

Source of truth: `components/ui/input.tsx`, `variantClasses`.

| Variant | Classes as shipped | Use Case |
|---------|--------------------|----------|
| `default` | `rounded-lg border border-input bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | Standard forms |
| `institutional` | `rounded-xl border-2 border-border/[0.06] bg-card font-mono focus:border-green-accent focus:ring-0 focus:ring-offset-0` | UI4 styled forms, addresses |
| `filled` | `rounded-lg border-none bg-muted focus:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring` | Search, filters |

All three share `flex h-10 w-full px-3 py-2 text-sm` plus
`disabled:cursor-not-allowed disabled:opacity-50`, and the `error` prop layers on
`border-destructive focus:border-destructive bg-destructive/5`.

> `focus:border-green-accent` on the institutional variant is the **coral** `#FF6B4A`
> (`--accent-green` is hue 11, not a green). That is correct here — it is the brand focus
> colour, matching `--ring`. It must never be read as a "valid/success" signal; success
> is `--success` (`#4A9D7C`).

---

## 3. Input Component

### Props Interface

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'institutional' | 'filled';
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  description?: string;
}
```

### Usage Examples

```tsx
// Standard Input
<Input 
  placeholder="Enter address"
  {...register('address')}
/>

// Institutional Input
<Input 
  variant="institutional"
  label="Wallet Address"
  description="Enter a valid Cosmos address"
  placeholder="core1..."
  error={errors.address?.message}
  {...register('address')}
/>

// With Icons
<Input
  leftIcon={<Search className="h-4 w-4" />}
  placeholder="Search..."
/>
```

### Institutional Input Styling

There is also a standalone `.input-institutional` class for non-React markup
(`styles/globals.css`, as shipped). Note the border alpha: the token `--border` is
alpha-free, so the class supplies `/ 0.06` itself.

```css
.input-institutional {
  @apply h-12 rounded-xl border-2 px-4 py-3 transition-colors duration-200;
  @apply focus:outline-none;
  border-color: hsl(var(--border) / 0.06);
  background: hsl(var(--card));
  font-family: "Geist Mono", ui-monospace, "SF Mono", monospace;
  font-size: 14px;
}

.input-institutional:focus {
  border-color: hsl(var(--accent-green));
  box-shadow: 0 0 0 3px hsl(var(--accent-green) / 0.1);
}

.input-institutional:disabled {
  background: hsl(var(--muted));
  border-color: hsl(var(--border) / 0.06);
  color: hsl(var(--muted-foreground));
  cursor: not-allowed;
}

.input-institutional.error {
  border-color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.05);
}
```

---

## 4. Slider Component

### Enhanced Slider for Threshold Selection

```tsx
<Slider
  size="lg"
  min={1}
  max={memberCount}
  step={1}
  value={[threshold]}
  onValueChange={([value]) => setThreshold(value)}
/>
```

### Props Interface

```typescript
interface SliderProps {
  size?: 'default' | 'lg';
  min?: number;
  max?: number;
  step?: number;
  value: number[];
  onValueChange: (value: number[]) => void;
  disabled?: boolean;
}
```

### Styling

The slider is styled entirely with Tailwind utilities on the Radix primitives in
`components/ui/slider.tsx` — there are **no** `.slider-*` classes in `globals.css`.

| Part | `size="default"` | `size="lg"` |
|------|------------------|-------------|
| Track | `h-2` (8px) | `h-3` (12px) |
| Thumb | `h-5 w-5` (20px) | `h-7 w-7` (28px) |

```tsx
<SliderPrimitive.Track className="relative w-full grow overflow-hidden rounded-full bg-muted …">
  <SliderPrimitive.Range className="absolute h-full bg-green-accent rounded-full" />
</SliderPrimitive.Track>

<SliderPrimitive.Thumb
  className="block rounded-full border-4 border-green-accent bg-background shadow-lg
             ring-offset-background transition-all duration-150
             hover:scale-110 hover:shadow-xl
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
             disabled:pointer-events-none disabled:opacity-50
             cursor-grab active:cursor-grabbing active:scale-95"
/>
```

Range and thumb are `green-accent` — i.e. the brand **coral**, consistent with the
focus ring. Do not swap it to `success` to imply "enough signers"; threshold safety is
communicated in copy, not colour (§7).

---

## 5. Form Field Layout

### Member Field with Remove Button

```tsx
<FormItem className="relative">
  <div className="flex items-center justify-between">
    <FormLabel className="text-sm font-medium">
      Member #{index + 1}
    </FormLabel>
    {canRemove && (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => remove(index)}
        className="h-6 w-6 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
  <FormDescription className="text-xs">
    Address or public key
  </FormDescription>
  <FormControl>
    <Input variant="institutional" {...register(`members.${index}.member`)} />
  </FormControl>
  <FormMessage />
</FormItem>
```

### Add Member Button

```tsx
<Button
  type="button"
  variant="action-outline"
  size="action-sm"
  onClick={handleAddMember}
  className="w-full gap-2"
>
  <Plus className="h-4 w-4" />
  Add Member
</Button>
```

---

## 6. Threshold Display

### Slider with Value Display

```tsx
<div className="flex items-center gap-6">
  <div className="flex-1">
    <Slider
      size="lg"
      min={1}
      max={memberCount}
      value={[threshold]}
      onValueChange={([v]) => setThreshold(v)}
    />
  </div>
  <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[100px] justify-center">
    <span className="text-2xl font-heading font-bold">
      {threshold}
    </span>
    <span className="text-muted-foreground font-medium">
      / {memberCount}
    </span>
  </div>
</div>
```

---

## 7. Validation States

### Error State

```tsx
{error && (
  <p className="mt-1.5 text-xs text-destructive" role="alert">
    {error}
  </p>
)}
```

### Warning State

Use the semantic tokens, never raw Tailwind palette utilities. This is the shipped
max-threshold warning from `components/forms/CreateCliqForm/index.tsx` — a neutral
`bg-muted` panel with a single `text-warning` icon carrying the status colour:

```tsx
{currentThreshold === memberCount && memberCount > 0 && (
  <div className="rounded-lg border border-border/[0.06] bg-muted p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Maximum threshold selected
        </p>
        <p className="text-xs text-muted-foreground">
          If any member loses access to their wallet, your CLIQ&apos;s assets will be
          permanently locked.
        </p>
      </div>
    </div>
  </div>
)}
```

> An earlier revision of this document showed this panel built from `bg-yellow-500/10`,
> `text-yellow-500` and `text-yellow-200`. Those raw palette utilities bypass the design
> tokens and must not be copied — `--warning` is `#E0A33E` (`text-warning`,
> `bg-warning`, `border-warning`). The same applies to green/red/blue: use
> `text-success`, `text-destructive`, `text-info`.

---

## 8. Form Actions Layout

### Responsive Button Group

```tsx
{/* Vertical on mobile, horizontal on desktop */}
{/* Primary action on top for mobile (flex-col-reverse) */}
<div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
  <Button 
    variant="action-outline" 
    size="action"
    className="w-full sm:flex-1"
  >
    Cancel
  </Button>
  <Button 
    variant="action" 
    size="action"
    className="w-full sm:flex-1"
  >
    Submit
  </Button>
</div>
```

> **Never hand-colour submit text.** The `default` button variant is coral
> (`bg-primary`) paired with near-black `text-primary-foreground`; `action` is off-white
> on near-black. Both pairings are already contrast-correct. There are zero `text-white`
> occurrences left under `components/` and `pages/` — adding one on a coral surface
> drops contrast to roughly 2.8:1 and fails WCAG AA. See
> [Buttons PRD §3.1](./BUTTONS-PRD.md#31-text-on-coral-is-near-black-never-white).

---

## 9. Form Card Structure

Form cards inherit the default card gradient (`bg-gradient-to-br from-card to-muted/30`).
If a form needs a flat or status-tinted surface, add `bg-none` alongside your `bg-*`
class — see [Cards PRD §2.1](./CARDS-PRD.md#21-the-default-gradient-and-how-to-opt-out).

```tsx
<Card variant="institutional" bracket="green">
  <CardHeader>
    <div className="flex items-center gap-3 mb-2">
      <Users className="w-5 h-5 text-green-accent" />
      <div>
        <CardLabel comment>Create Multisig</CardLabel>
        <CardTitle>New Multisig Account</CardTitle>
      </div>
    </div>
    <CardDescription>
      {/* Description */}
    </CardDescription>
  </CardHeader>
  
  <CardContent>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Form fields */}
        
        {/* Separator */}
        <div className="h-px bg-border" />
        
        {/* Threshold section */}
        
        {/* Submit button */}
      </form>
    </Form>
  </CardContent>
</Card>
```

---

## 10. Accessibility

### Labels

```tsx
<label htmlFor={inputId}>
  {label}
  {required && <span className="text-destructive ml-0.5">*</span>}
</label>
```

### Error Announcements

```tsx
<p 
  id={`${inputId}-error`} 
  className="text-xs text-destructive" 
  role="alert"
>
  {error}
</p>
```

### ARIA Attributes

```tsx
<input
  aria-invalid={!!error}
  aria-describedby={error ? `${inputId}-error` : description ? `${inputId}-desc` : undefined}
/>
```

---

## 11. Mobile Considerations

### Touch Targets

- Minimum button height: 44px
- Slider thumb: 28px (with touch area expansion)
- Remove buttons: 24px minimum

### Input Modes

```tsx
// For wallet addresses
<input type="text" inputMode="text" />

// For numeric amounts
<input type="text" inputMode="decimal" />
```

---

*Forms PRD for Cosmos Multisig UI*
