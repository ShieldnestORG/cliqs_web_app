import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 md:gap-6",
        "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        "auto-rows-[minmax(120px,auto)]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  /** Span options for responsive grid behavior */
  colSpan?: 1 | 2 | 3 | 4 | "full";
  rowSpan?: 1 | 2 | 3;
  /** Visual variants */
  variant?: "default" | "highlight" | "accent" | "muted";
  /** Whether the card should have hover effects */
  interactive?: boolean;
  /** Click handler for interactive cards */
  onClick?: () => void;
}

export function BentoCard({
  children,
  className,
  colSpan = 1,
  rowSpan = 1,
  variant = "default",
  interactive = false,
  onClick,
}: BentoCardProps) {
  const colSpanClasses = {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-2 lg:col-span-3",
    4: "md:col-span-2 lg:col-span-3 xl:col-span-4",
    full: "col-span-full",
  };

  const rowSpanClasses = {
    1: "row-span-1",
    2: "row-span-2",
    3: "row-span-3",
  };

  const variantClasses = {
    default: "bg-card border-border",
    highlight: "bg-card border-green-accent/50 card-bracket-corner",
    accent: "bg-gradient-to-br from-card to-muted/50 border-accent-purple/30",
    muted: "bg-muted/30 border-border/50",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border-2 transition-all duration-300",
        colSpanClasses[colSpan],
        rowSpanClasses[rowSpan],
        variantClasses[variant],
        interactive && [
          "cursor-pointer",
          "hover:shadow-lg hover:shadow-black/10",
          "hover:-translate-y-1",
          "hover:border-foreground/20",
          "active:translate-y-0 active:shadow-md",
        ],
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function BentoCardHeader({ children, className }: BentoCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      {children}
    </div>
  );
}

interface BentoCardTitleProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function BentoCardTitle({ children, className, icon }: BentoCardTitleProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && icon}
      <h3 className="text-lg font-heading font-semibold tracking-tight">{children}</h3>
    </div>
  );
}

interface BentoCardContentProps {
  children: ReactNode;
  className?: string;
}

export function BentoCardContent({ children, className }: BentoCardContentProps) {
  return <div className={cn("flex-1", className)}>{children}</div>;
}

interface BentoCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function BentoCardFooter({ children, className }: BentoCardFooterProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-border/50 flex items-center gap-2", className)}>
      {children}
    </div>
  );
}

// Quick stat card for dashboard KPIs
interface BentoStatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  className?: string;
}

export function BentoStatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  className,
}: BentoStatCardProps) {
  const changeColors = {
    positive: "text-green-accent",
    negative: "text-red-500",
    neutral: "text-muted-foreground",
  };

  return (
    <BentoCard className={cn("flex flex-col justify-between", className)}>
      <div className="flex items-start justify-between">
        <span className="text-label text-label-comment">{label}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-auto">
        <p className="text-kpi text-kpi-lg">{value}</p>
        {change && (
          <p className={cn("text-sm mt-1", changeColors[changeType])}>{change}</p>
        )}
      </div>
    </BentoCard>
  );
}

// Action card for quick actions
interface BentoActionCardProps {
  title: string;
  description?: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function BentoActionCard({
  title,
  description,
  icon,
  onClick,
  className,
}: BentoActionCardProps) {
  return (
    <BentoCard
      interactive
      onClick={onClick}
      className={cn("group flex flex-col p-6", className)}
    >
      {icon}
      <div className="mt-auto pt-4">
        <h4 className="font-heading font-semibold text-foreground group-hover:text-green-accent transition-colors">
          {title}
        </h4>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </BentoCard>
  );
}
