import { cn } from "@/lib/utils";
import { ComponentProps } from "react";
import { TabsTrigger } from "../ui/tabs";

export default function TabButton({
  value,
  children,
  className,
  ...restProps
}: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "btn-tab rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide",
        "border-2 bg-transparent transition-all duration-200",
        "data-[state=inactive]:border-muted-foreground data-[state=inactive]:text-muted-foreground",
        "data-[state=inactive]:hover:border-foreground data-[state=inactive]:hover:bg-muted/50",
        "data-[state=active]:border-[hsl(var(--accent-green))] data-[state=active]:bg-[hsl(var(--accent-green))] data-[state=active]:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-purple)/0.5)]",
        className,
      )}
      {...restProps}
    >
      {children}
    </TabsTrigger>
  );
}
