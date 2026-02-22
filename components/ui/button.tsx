import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        // Standard variants
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-md",
        link: "text-primary underline-offset-4 hover:underline",
        
        // UI4 Institutional variants
        action: 
          "bg-foreground text-background hover:opacity-90 rounded-full uppercase tracking-wide font-mono text-[11px]",
        "action-outline": 
          "bg-transparent border-2 border-foreground text-foreground hover:bg-muted rounded-full uppercase tracking-wide font-mono text-[11px]",
        "action-bronze": 
          "bg-bronze text-background hover:opacity-90 rounded-full uppercase tracking-wide font-mono text-[11px]",
        "action-bronze-outline": 
          "bg-transparent border-2 border-bronze text-foreground hover:bg-bronze/10 rounded-full uppercase tracking-wide font-mono text-[11px]",
        "card-cta":
          "bg-foreground text-background hover:opacity-90 rounded-xl font-heading",
        "card-cta-outline":
          "bg-transparent border-2 border-foreground text-foreground hover:bg-muted rounded-xl font-heading",
        tab:
          "rounded-full uppercase tracking-wide font-mono text-xs border-2 data-[active=true]:bg-green-accent data-[active=true]:text-white data-[active=true]:border-green-accent data-[active=false]:border-muted-foreground data-[active=false]:text-muted-foreground data-[active=false]:hover:border-foreground data-[active=false]:hover:bg-muted/50",
        nav:
          "w-full justify-start gap-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active=true]:bg-green-accent/20 data-[active=true]:border-l-4 data-[active=true]:border-l-green-accent data-[active=true]:text-foreground data-[active=true]:font-semibold",
        icon:
          "rounded-lg hover:bg-muted [&_svg]:transition-colors [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-8 text-base",
        xl: "h-12 px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        // UI4 sizes
        action: "h-10 px-6 py-2.5",
        "action-sm": "h-8 px-4 py-2",
        "action-lg": "h-12 px-8 py-3",
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
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
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
