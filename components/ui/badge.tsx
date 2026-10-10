import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge: a status tag. A small mark, then the word in the state's colour. No pill around it.
 * It is the status tag of the TOKNS site in cliqs tokens and the section-label type
 * (mono, 11px, uppercase, 0.14em). Spec: docs/ui/CARDS-PRD.md section 5.
 *
 * A state can carry a small moving mark, so colour is never the only signal: `signal` a
 * three-bar meter (live), `half` a half-lit dot that turns (part-way), `stripes` a sliding
 * hazard bar (stopped), `ring` a turning dashed outline (not running). They hold still when the
 * visitor asked for reduced motion. Without `mark` a badge is the word alone: there is no plain
 * dot (owner, 2026-10-10). The marks are drawn in styles/globals.css (`.status-mark*`) in
 * currentColor.
 * Until 2026-10-10 a badge was a bordered pill with a tinted fill.
 */
const badgeVariants = cva(
  "inline-flex min-h-5 items-center gap-2 whitespace-nowrap font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.14em]",
  {
    variants: {
      variant: {
        default: "text-primary",
        secondary: "text-muted-foreground",
        destructive: "text-destructive",
        outline: "text-foreground",
        // Status variants (docs/ui/CARDS-PRD.md §5, "Status tag"). Semantic tokens only.
        success: "text-success",
        info: "text-info",
        warning: "text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeMark = "signal" | "half" | "stripes" | "ring"

// Whole class names on purpose: Tailwind drops a `@layer components` rule whose class it
// cannot find as a literal in the source, so `status-mark-${mark}` would ship no mark styles.
const markClass: Record<BadgeMark, string> = {
  signal: "status-mark status-mark-signal",
  half: "status-mark status-mark-half",
  stripes: "status-mark status-mark-stripes",
  ring: "status-mark status-mark-ring",
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  mark?: BadgeMark
}

function Badge({ className, variant, mark, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {mark && (
        <span aria-hidden="true" data-mark={mark} className={markClass[mark]} />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
