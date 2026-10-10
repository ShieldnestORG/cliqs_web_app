import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * ScaleRule: a section divider that reads like the edge of a ruler.
 *
 *   <ScaleRule label="Rewards" tone="primary" meta="2 pending" />
 *
 * One row: a short start tick, the label (an `h2`, so a page has real section
 * headings), then a hairline that fills the row with fine ticks. `tone="primary"`
 * marks the one most important area of a page (label and start tick in coral);
 * the default tone is muted. It paints no fill, so the GridSpotlight background
 * stays visible. The tick pattern lives in styles/globals.css (`.scale-rule-line`);
 * below `sm` only the label and hairline remain. Spec: docs/ui/PATTERNS-PRD.md.
 */
export interface ScaleRuleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The section name. Rendered as an `h2`. */
  label: string
  /** `primary` = coral label and start tick. Use for at most one area per page. */
  tone?: "default" | "primary"
  /** Optional short text at the right end of the rule (a count, a status). */
  meta?: React.ReactNode
  /** `id` for the heading, so a wrapping `<section>` can point `aria-labelledby` at it. */
  headingId?: string
}

const ScaleRule = React.forwardRef<HTMLDivElement, ScaleRuleProps>(
  ({ label, tone = "default", meta, headingId, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-end gap-3", className)} {...props}>
      <span
        aria-hidden="true"
        className={cn(
          "mb-[3px] h-2.5 w-[3px] shrink-0 rounded-full",
          tone === "primary" ? "bg-primary" : "bg-muted-foreground/60"
        )}
      />
      <h2
        id={headingId}
        className={cn(
          "shrink-0 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.14em]",
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </h2>
      <span aria-hidden="true" className="scale-rule-line mb-[3px] min-w-0 flex-1" />
      {meta ? (
        <span className="shrink-0 text-xs tabular-nums leading-4 text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </div>
  )
)
ScaleRule.displayName = "ScaleRule"

export { ScaleRule }
