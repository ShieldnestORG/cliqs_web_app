import * as React from "react"

import { cn } from "@/lib/utils"

// Card variant types for institutional styling
type CardVariant = "default" | "institutional" | "elevated" | "outline"
type CardAccent = "none" | "left" | "top" | "header-dark"
// Bracket types: angular (for square cards) and round (for rounded cards)
type CardBracket = "none" | "green" | "purple" | "green-round" | "purple-round" | "all"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  accent?: CardAccent
  bracket?: CardBracket
  hover?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", accent = "none", bracket = "none", hover = false, ...props }, ref) => {
    const variantClasses = {
      default: "rounded-xl border bg-card text-card-foreground shadow",
      institutional: "rounded-xl border-2 bg-card text-card-foreground transition-all duration-200",
      elevated: "rounded-xl border bg-card text-card-foreground shadow-lg",
      outline: "rounded-xl border-2 bg-transparent text-card-foreground",
    }

    const accentClasses = {
      none: "",
      left: "border-l-4 border-l-green-accent",
      top: "border-t-[3px] border-t-green-accent",
      "header-dark": "card-header-dark",
    }

    // Angular brackets for square/institutional cards, round brackets for rounded cards
    const bracketClasses = {
      none: "",
      green: "card-bracket-corner",
      purple: "card-bracket-corner card-bracket-purple",
      "green-round": "card-bracket-corner-round",
      "purple-round": "card-bracket-corner-round card-bracket-purple",
      "all": "card-bracket-corner card-bracket-all",
    }

    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          accentClasses[accent],
          bracketClasses[bracket],
          "group/card", // Added for nested hover effects
          hover && "card-hover",
          variant === "institutional" && hover && "hover:shadow-card-hover hover:-translate-y-[3px]",
          className
        )}
        {...props}
      >
        {bracket === "all" && (
          <>
            <div className="absolute top-[6px] right-[6px] w-5 h-5 border-t-[3px] border-r-[3px] border-green-accent rounded-tr-lg opacity-60 pointer-events-none group-hover/card:opacity-100 group-hover/card:top-1 group-hover/card:right-1 transition-all duration-300 z-10" />
            <div className="absolute bottom-[6px] left-[6px] w-5 h-5 border-b-[3px] border-l-[3px] border-green-accent rounded-bl-lg opacity-60 pointer-events-none group-hover/card:opacity-100 group-hover/card:bottom-1 group-hover/card:left-1 transition-all duration-300 z-10" />
          </>
        )}
        {props.children}
      </div>
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

const CardTitle = React.forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, as: Component = "h3", ...props }, ref) => (
    <Component
      ref={ref as any}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight font-heading",
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// UI4 Label Component for card section labels
interface CardLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  comment?: boolean
}

const CardLabel = React.forwardRef<HTMLDivElement, CardLabelProps>(
  ({ className, comment = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2",
        comment && "before:content-['//'] before:mr-1 before:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
CardLabel.displayName = "CardLabel"

// UI4 KPI Value Component for large numbers
interface CardKPIProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  trend?: "up" | "down" | "neutral"
}

const CardKPI = React.forwardRef<HTMLDivElement, CardKPIProps>(
  ({ className, size = "md", trend, children, ...props }, ref) => {
    const sizeClasses = {
      sm: "text-lg",
      md: "text-xl",
      lg: "text-2xl",
      xl: "text-4xl",
    }

    const trendClasses = {
      up: "text-green-accent",
      down: "text-red-500",
      neutral: "text-foreground",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "font-heading font-bold tabular-nums tracking-tight",
          sizeClasses[size],
          trend ? trendClasses[trend] : "text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardKPI.displayName = "CardKPI"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardLabel,
  CardKPI,
  type CardVariant,
  type CardAccent,
  type CardBracket,
}
