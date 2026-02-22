# Forms PRD

**Cosmos Multisig UI - Form System Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

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

| Variant | Background | Border | Use Case |
|---------|------------|--------|----------|
| `default` | Background | 1px input | Standard forms |
| `institutional` | Card | 2px border | UI4 styled forms |
| `filled` | Muted | None | Search, filters |

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

```css
.input-institutional {
  @apply h-12 px-4 py-3 border-2 transition-colors duration-200;
  @apply focus:outline-none;
  border-color: hsl(var(--border));
  background: hsl(var(--card));
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
}

.input-institutional:focus {
  border-color: hsl(var(--accent-green));
  box-shadow: 0 0 0 3px hsl(var(--accent-green) / 0.1);
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

```css
/* Track */
.slider-track-lg {
  height: 12px;
  background: hsl(var(--muted));
  border-radius: 9999px;
}

/* Range (filled portion) */
.slider-range {
  background: hsl(var(--accent-green));
  border-radius: 9999px;
}

/* Thumb */
.slider-thumb-lg {
  width: 28px;
  height: 28px;
  border: 4px solid hsl(var(--accent-green));
  background: hsl(var(--background));
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: grab;
  transition: transform 150ms, box-shadow 150ms;
}

.slider-thumb-lg:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.slider-thumb-lg:active {
  cursor: grabbing;
  transform: scale(0.95);
}
```

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

```tsx
{threshold === memberCount && memberCount > 0 && (
  <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
    <div className="flex items-start gap-3">
      <span className="text-yellow-500 text-lg">⚠️</span>
      <div>
        <p className="text-sm font-semibold text-yellow-200">
          Maximum threshold selected
        </p>
        <p className="text-xs text-yellow-200/80">
          Losing access to any wallet will result in permanent loss...
        </p>
      </div>
    </div>
  </div>
)}
```

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

---

## 9. Form Card Structure

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
