import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button: the house style's geometry and motion (pill buttons, 44px controls,
 * 8px gaps), cliqs colours and Geist type.
 * Spec: docs/ui/BUTTONS-PRD.md. Pill, sentence case, 600 weight, a 120ms
 * ease on background / border / shadow / press, and a 0.5px press nudge.
 * The focus ring stays a ring on the pill (the focus rule of the stylesheet
 * this style was taken from squares the corners; that is a measured bug and
 * is not copied).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold leading-[1.2] ring-offset-background transition-[background-color,border-color,color,box-shadow,transform,filter] duration-ui ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[0.5px]",
  {
    variants: {
      variant: {
        // Standard variants
        // Solid buttons share one recipe: a 135deg sheen, a lit top edge and a short drop
        // (shadow-btn), the popover shadow on hover, a flat pressed fill that sinks in.
        // default = the coral sheen. One per view.
        default:
          "border-primary-press bg-primary-gradient text-primary-foreground shadow-btn hover:shadow-btn-hover active:bg-primary-press active:bg-none active:shadow-btn-pressed",
        // destructive = the same recipe in red
        destructive:
          "border-destructive-press bg-destructive-gradient text-destructive-foreground shadow-btn hover:shadow-btn-hover active:bg-destructive-press active:bg-none active:shadow-btn-pressed",
        // outline = a quiet raised pill: a faint top light, a visible 1px edge, a fill on hover
        outline:
          "border-border/15 bg-transparent bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015] shadow-btn-quiet hover:bg-field hover:text-accent-foreground active:shadow-btn-pressed",
        // secondary = a quiet fill that stays visible on the dark card
        secondary:
          "border-border/10 bg-field bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015] text-secondary-foreground shadow-btn-quiet hover:bg-[color-mix(in_srgb,hsl(var(--field)),hsl(var(--foreground))_9%)] active:shadow-btn-pressed",
        ghost: "hover:bg-field hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // UI4 Institutional variants (kept by name; sentence case since 2026-10-10)
        // action = the ink sheen (the solid recipe in ink)
        action:
          "border-ink-press bg-ink-gradient text-background shadow-btn hover:shadow-btn-hover active:bg-ink-press active:bg-none active:shadow-btn-pressed",
        "action-outline":
          "border-border/15 bg-transparent bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.015] text-foreground shadow-btn-quiet hover:bg-field active:shadow-btn-pressed",
        "card-cta":
          "bg-foreground text-background hover:opacity-90 rounded-xl font-heading",
        "card-cta-outline":
          "bg-transparent border-2 border-foreground text-foreground hover:bg-muted rounded-xl font-heading",
        tab:
          "rounded-full uppercase tracking-wide font-mono text-xs border-2 data-[active=true]:bg-green-accent data-[active=true]:text-primary-foreground data-[active=true]:border-green-accent data-[active=false]:border-muted-foreground data-[active=false]:text-muted-foreground data-[active=false]:hover:border-foreground data-[active=false]:hover:bg-muted/50",
        nav:
          "w-full justify-start gap-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active=true]:bg-green-accent/20 data-[active=true]:border-l-4 data-[active=true]:border-l-green-accent data-[active=true]:text-foreground data-[active=true]:font-semibold",
        icon:
          "hover:bg-field [&_svg]:transition-colors [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground",
      },
      size: {
        // leading-[1.2] sits AFTER the text-* class on purpose: tailwind-merge drops
        // an earlier leading-* whenever a later text-* size is present, so a leading
        // in the base string never reaches the page (measured 2026-10-10: 20px).
        default: "h-11 px-5 text-sm leading-[1.2]",
        sm: "h-9 px-4 text-[13px] leading-[1.2]",
        lg: "h-12 px-6 text-sm leading-[1.2]",
        xl: "h-12 px-10 text-base leading-[1.2]",
        // xs = a dense-row chip (24px, not a pill)
        xs: "h-6 px-3 text-[11px] leading-[1.2] font-medium rounded-md",
        icon: "h-11 w-11",
        "icon-sm": "h-8 w-8",
        // UI4 sizes (same geometry as default / sm / lg since 2026-10-10)
        action: "h-11 px-5 text-sm leading-[1.2]",
        "action-sm": "h-9 px-4 text-[13px] leading-[1.2]",
        "action-lg": "h-12 px-6 text-sm leading-[1.2]",
        tab: "h-9 px-5 py-2",
        nav: "h-12 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isActive?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isActive, isLoading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        data-active={isActive}
        {...props}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
