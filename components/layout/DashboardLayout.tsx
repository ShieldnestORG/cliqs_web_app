import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Head from "../head";

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
  /** Optional sidebar content */
  sidebar?: ReactNode;
  /** Optional header content (will be placed below the main header) */
  subheader?: ReactNode;
  /** Layout variant */
  variant?: "default" | "wide" | "full";
  className?: string;
}

export default function DashboardLayout({
  title,
  children,
  sidebar,
  subheader,
  variant = "default",
  className,
}: DashboardLayoutProps) {
  const maxWidthClasses = {
    default: "max-w-[1600px]",
    wide: "max-w-[1800px]",
    full: "max-w-[1800px]",
  };

  return (
    <div className="bg-pattern-dots min-h-screen w-full">
      <Head title={title || "Cosmos Multisig Manager"} />

      {/* Subheader slot */}
      {subheader && (
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className={cn("container mx-auto px-[0.75in] py-3", maxWidthClasses[variant])}>
            {subheader}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn("container mx-auto px-[0.75in] py-6", maxWidthClasses[variant])}>
        {sidebar ? (
          // Layout with sidebar
          <div className="flex gap-6">
            {/* Sidebar - fixed on desktop */}
            <aside className="hidden w-72 shrink-0 lg:block">
              <div className="sticky top-24 space-y-4">{sidebar}</div>
            </aside>

            {/* Main content */}
            <main className={cn("min-w-0 flex-1", className)}>{children}</main>
          </div>
        ) : (
          // Full width layout
          <main className={cn("w-full", className)}>{children}</main>
        )}
      </div>
    </div>
  );
}

// Dashboard section with title
interface DashboardSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function DashboardSection({
  title,
  description,
  children,
  className,
  action,
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && (
              <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Dashboard tabs container
interface DashboardTabsProps {
  children: ReactNode;
  className?: string;
}

export function DashboardTabs({ children, className }: DashboardTabsProps) {
  return (
    <div className={cn("flex w-fit items-center gap-2 rounded-xl bg-muted/50 p-1", className)}>
      {children}
    </div>
  );
}

interface DashboardTabProps {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}

export function DashboardTab({ active, children, onClick, icon }: DashboardTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// Quick stats row
interface QuickStatsRowProps {
  children: ReactNode;
  className?: string;
}

export function QuickStatsRow({ children, className }: QuickStatsRowProps) {
  return <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-4", className)}>{children}</div>;
}

interface QuickStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

export function QuickStat({ label, value, icon, trend }: QuickStatProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      {icon && icon}
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-heading text-xl font-bold">{value}</p>
        {trend && (
          <p
            className={cn(
              "mt-1 text-xs",
              trend.direction === "up" && "text-green-accent",
              trend.direction === "down" && "text-red-500",
              trend.direction === "neutral" && "text-muted-foreground",
            )}
          >
            {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
